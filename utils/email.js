import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, subject, text, html }) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const mailOptions = { from, to, subject, text, html };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Failed to send email to ${to}: ${error.message}`);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const subject = 'Password Reset — Student Management System';

  const text = [
    'You requested a password reset for your Student Management System account.',
    '',
    `Click the link below to reset your password (expires in 1 hour):`,
    resetUrl,
    '',
    'If you did not request this, please ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #1a1a2e; color: #e0e0e0; border-radius: 12px;">
      <h2 style="margin: 0 0 8px; color: #ffffff; font-size: 22px;">Password Reset</h2>
      <p style="color: #a0a0b0; font-size: 14px; margin: 0 0 24px;">Student Management System</p>

      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        You requested a password reset. Click the button below to choose a new password.
        This link <strong>expires in 1 hour</strong>.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Reset Password
        </a>
      </div>

      <p style="font-size: 13px; color: #888; line-height: 1.5; margin: 0 0 8px;">
        If the button above doesn't work, copy and paste this link into your browser:
      </p>
      <p style="font-size: 12px; color: #667eea; word-break: break-all; margin: 0 0 24px;">
        ${resetUrl}
      </p>

      <hr style="border: none; border-top: 1px solid #2a2a3e; margin: 24px 0;">
      <p style="font-size: 12px; color: #666; margin: 0;">
        If you didn't request this reset, you can safely ignore this email.
      </p>
    </div>
  `;

  await sendEmail({ to: email, subject, text, html });
};
