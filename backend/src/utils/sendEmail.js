/**
 * Minimal email sender stub.
 * Replace the transporter below with your real provider
 * (nodemailer + SMTP, SendGrid, Resend, SES, etc.).
 *
 * Required env vars (nodemailer example):
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * @param {{ to: string, subject: string, html: string }} options
 */
const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"WatchTogether" <noreply@example.com>',
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;
