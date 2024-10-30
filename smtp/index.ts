import "source-map-support/register.js";
import "localenv";
import Server from "smtp-server";
import {
  getCredentials,
  getMicrosoftGraphClient,
  MicrosoftOAuthCredentials,
} from "../lib/microsoft.js";
import fs from "node:fs";
import { getUser, User } from "../lib/db.js";
import { onMailForwarded } from "../lib/hooks.js";

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
      const credentials = await getCredentials(user.email);
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
          const msg = Buffer.concat(chunks).toString("base64");
          const sessionUser = session.user as any as SessionUser;
          const client = getMicrosoftGraphClient(sessionUser.credentials);
          await client
            .api("/me/sendMail")
            .header("Content-Type", "text/plain")
            .post(msg);
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
    server.close(() => {
      console.log("SMTP server exiting");
      process.exit(0);
    });
  });
});
