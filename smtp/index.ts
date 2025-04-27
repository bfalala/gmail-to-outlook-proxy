import "source-map-support/register.js";
import "localenv";
import Server from "smtp-server";
import {
  getApp,
  getCredentials,
  getMicrosoftGraphClient,
  MicrosoftOAuthCredentials,
} from "../lib/microsoft.js";
import fs from "node:fs";
import { getUser, User } from "../lib/db.js";
import { onMailForwarded } from "../lib/hooks.js";
import Cache from "node-cache";
import { simpleParser } from "mailparser";

type SessionUser = {
  user: User;
  credentials: MicrosoftOAuthCredentials;
};

const cert =
  process.env.SMTP_KEY_FILE && process.env.SMTP_CERT_FILE
    ? {
      key: fs.readFileSync(process.env.SMTP_KEY_FILE),
      cert: fs.readFileSync(process.env.SMTP_CERT_FILE),
    }
    : {};

const cache = new Cache({ stdTTL: 60, checkperiod: 60 });

const server = new Server.SMTPServer({
  authMethods: ["PLAIN", "LOGIN"],
  onConnect(session, callback) {
    return callback();
  },
  ...cert,
  async onAuth(auth, session, callback) {
    try {
      const user = await getUser(auth.username);
      if (!user || user.smtp_password !== auth.password) {
        throw new Error("Invalid username or password.");
      }
      const credentials = await getCredentials(
        user.email,
        user.email,
        getApp(user.app_id)
      );
      callback(null, {
        user: {
          user,
          credentials,
        } as SessionUser,
      });
    } catch (err) {
      callback(new Error("Invalid username or password."));
    }
  },
  onData(stream, session, callback) {
    const chunks: Buffer[] = [];
    stream
      .on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      })
      .on("error", (err) => callback(err))
      .on("end", async () => {
        try {
          const msg = Buffer.concat(chunks).toString();
          // unfortunately, gmail seems to send the same message multiple times when sending to multiple recipients so we must dedupe
          const email = await simpleParser(msg, {
            skipHtmlToText: true
          });
          const messageId = email.messageId;
          const to = email.to;
          const cc = email.cc;
          const bcc = email.bcc;
          const from = email.from;
          const replyto = email.headers.get('reply-to');
          if (messageId) {
            if (cache.get(messageId)) {
              return callback();
            }
            cache.set(messageId, true);
          }
          let sendMail = {
            message: {
              subject: email.subject,
              body: {
                contentType: 'html',
                content: email.html
              },
              conversationId: email.inReplyTo,
              replyTo: [] as any[],
              toRecipients: [] as any[],
              ccRecipients: [] as any[],
              bccRecipients: [] as any[],
              from: '' as any
            }
          };
          if (replyto) {
            sendMail.message.replyTo.push({
              emailAddress: {
                address: replyto
              }
            });
          }
          if (Array.isArray(from)) {
            from.forEach((toElt: any) => {
              sendMail.message.from = {
                emailAddress: {
                  address: toElt.address,
                  name: toElt.name
                }
              };
            });
          } else if (from && Array.isArray(from.value) && from.value.length > 0) {
            sendMail.message.from = {
              emailAddress: {
                address: from.value[0].address,
                name: from.value[0].name
              }
            };
          }
          if (Array.isArray(to)) {
            to.forEach((toElt: any) => {
              sendMail.message.toRecipients.push({
                emailAddress: {
                  address: toElt.address,
                  name: toElt.name
                }
              });
            });
          } else if (to && Array.isArray(to.value)) {
            to.value.forEach((toElt: any) => {
              sendMail.message.toRecipients.push({
                emailAddress: {
                  address: toElt.address,
                  name: toElt.name
                }
              });
            });
          }
          if (Array.isArray(cc)) {
            cc.forEach((toElt: any) => {
              sendMail.message.ccRecipients.push({
                emailAddress: {
                  address: toElt.address,
                  name: toElt.name
                }
              });
            });
          } else if (cc && Array.isArray(cc.value)) {
            cc.value.forEach((toElt: any) => {
              sendMail.message.ccRecipients.push({
                emailAddress: {
                  address: toElt.address,
                  name: toElt.name
                }
              });
            });
          }
          if (Array.isArray(bcc)) {
            bcc.forEach((toElt: any) => {
              sendMail.message.bccRecipients.push({
                emailAddress: {
                  address: toElt.address,
                  name: toElt.name
                }
              });
            });
          } else if (bcc && Array.isArray(bcc.value)) {
            bcc.value.forEach((toElt: any) => {
              sendMail.message.bccRecipients.push({
                emailAddress: {
                  address: toElt.address,
                  name: toElt.name
                }
              });
            });
          }
          // console.log("sendMail object :");
          // console.log(JSON.stringify(sendMail));
          const sessionUser = session.user as any as SessionUser;
          const client = getMicrosoftGraphClient(sessionUser.credentials);
          await client
            .api("/me/sendMail")
            .header("content-type", "application/json")
            .post(sendMail);
          onMailForwarded(sessionUser.user.email, msg);
          callback();
        } catch (err: any) {
          callback(err);
        }
      });
  },
}).on("error", (err) => {
  // prevent unhandled error from crashing the server
  console.log(err);
});

const port = 587;
server.listen(port, () => {
  console.log(`SMTP server listening on port ${port}`);
  process.on("SIGINT", () => {
    console.log("SMTP server shutting down");
    cache.close();
    server.close(() => {
      console.log("SMTP server exiting");
      process.exit(0);
    });
  });
});
