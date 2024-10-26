import "source-map-support/register";
import "localenv";
import nodemailer from "nodemailer";
import { getUser } from "../lib/db";

(async () => {
  const [from, to] = process.argv.slice(2);

  const user = await getUser(from);

  if (!user) {
    throw new Error(`User ${from} not found.`);
  }

  const transporter = nodemailer.createTransport({
    host: "localhost",
    port: 587,
    auth: {
      user: user.email,
      pass: user.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  await transporter.sendMail({
    to,
    subject: "Hello!",
    text: "Hello from your relay!",
  });
})();
