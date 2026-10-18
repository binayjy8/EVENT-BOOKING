const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 2525,
  auth: { user: process.env.BREVO_USER, pass: process.env.BREVO_KEY },
});

exports.sendMail = (to, subject, text) => {
  if (process.env.SKIP_EMAIL === "1") return Promise.resolve();
  return transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
};