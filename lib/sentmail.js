require("dotenv").config();
const nodemailer = require('nodemailer');

function getTransporter() {
    if (!process.env.EMAIL_ID || !process.env.EMAIL_PASS) {
        console.warn("Email credentials (EMAIL_ID, EMAIL_PASS) not configured in .env");
        return null;
    }
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_ID,
            pass: process.env.EMAIL_PASS
        }
    });
}

const defaultToMail = process.env.TO_MAIL;
const subject = 'Reminder Notification from Slack Bot';

async function sendEmail(text, time, recipientEmail = null) {
    const targetEmail = recipientEmail || defaultToMail;
    if (!targetEmail) {
        console.warn("No recipient email specified or configured in TO_MAIL");
        return false;
    }

    const transporter = getTransporter();
    if (!transporter) {
        console.warn("Transporter could not be created because email credentials are missing.");
        return false;
    }

    try {
        const formattedTime = new Date(time).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        const message = `
        <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:10px;padding:30px;box-sizing:border-box;">
    <h2 style="margin:0 0 10px;color:#222;">🔔 Reminder Alert</h2>
    <p style="color:#555;font-size:15px;">
      This is your scheduled reminder:
    </p>
    <div style="background:#fff3cd;border-left:5px solid #ffc107;padding:15px;margin:20px 0;border-radius:5px;">
      <p style="margin:0 0 5px;color:#856404;font-size:13px;font-weight:bold;">
        REMINDER TASK
      </p>
      <p style="margin:0;color:#222;font-size:18px;font-weight:bold;">
        ${text}
      </p>
    </div>
    <p style="color:#666;font-size:14px;">
      ⏰ Scheduled time: <strong>${formattedTime}</strong>
    </p>
    <p style="margin-top:30px;color:#999;font-size:12px;">
      This is an automated reminder from your Slack system.
    </p>
  </div>
</body>
</html>
        `;

        const mailSent = await transporter.sendMail({
            from: process.env.EMAIL_ID,
            to: targetEmail,
            subject: subject,
            html: message
        });

        console.log('Email sent successfully to:', targetEmail);
        return mailSent;
    } catch (error) {
        console.error('Error while sending email:', error);
        return false;
    }
}

module.exports = {
    sendEmail
};