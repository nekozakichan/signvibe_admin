import '../loadEnv.js';
import nodemailer from 'nodemailer';

// Created lazily on first send so the SMTP password (a Cloud secret) is read
// at runtime, after Functions has injected it into the environment.
let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.MAIL_PORT || '587'),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }
  return transporter;
}

// ─── Send Student Username + Password ────────────────────────────────────────
export const sendStudentCredentials = async ({
  full_name, email, password, grade_level, section,
}) => {
  await getTransporter().sendMail({
    from: `"SignVibe Admin" <${process.env.MAIL_USER}>`,
    to: email,
    subject: '📋 Your SignVibe Student Account Credentials',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;border:1px solid #e0e0e0;border-radius:14px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:#008080;padding:12px 24px;border-radius:8px;">
            <h2 style="color:#fff;margin:0;font-size:20px;">📚 SignVibe</h2>
          </div>
          <p style="color:#555;margin-top:12px;font-size:15px;">Your student account is ready!</p>
        </div>
        <p style="color:#333;font-size:15px;">Hi <strong>${full_name}</strong>,</p>
        <p style="color:#555;font-size:14px;">
          Your account for <strong>Grade ${grade_level} – ${section}</strong> has been created by your admin.
          Use the credentials below to log in to SignVibe:
        </p>
        <div style="background:#f0fafa;border:1px solid #b2dfdb;border-left:5px solid #008080;padding:20px;border-radius:10px;margin:24px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#555;font-size:13px;width:100px;"><strong>Username</strong></td>
              <td style="padding:8px 0;">
                <code style="background:#e0f4f4;color:#00695c;padding:4px 10px;border-radius:5px;font-size:14px;">${email}</code>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#555;font-size:13px;"><strong>Password</strong></td>
              <td style="padding:8px 0;">
                <code style="background:#e0f4f4;color:#00695c;padding:4px 10px;border-radius:5px;font-size:16px;letter-spacing:2px;font-weight:bold;">${password}</code>
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#fff8e1;border:1px solid #ffe082;padding:12px 16px;border-radius:8px;margin-bottom:20px;">
          <p style="margin:0;color:#78550a;font-size:13px;">
            ⚠️ <strong>Keep this confidential.</strong> Do not share your password with anyone.
            Please change your password after your first login.
          </p>
        </div>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:11px;text-align:center;margin:0;">
          This email was sent by SignVibe Admin. Do not reply to this email.
        </p>
      </div>`,
  });
};

// ─── Send Teacher Username + Password ────────────────────────────────────────
export const sendTeacherCredentials = async ({
  full_name, email, password, employee_no, section_handled,
}) => {
  await getTransporter().sendMail({
    from: `"SignVibe Admin" <${process.env.MAIL_USER}>`,
    to: email,
    subject: '📋 Your SignVibe Teacher Account Credentials',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;border:1px solid #e0e0e0;border-radius:14px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:#008080;padding:12px 24px;border-radius:8px;">
            <h2 style="color:#fff;margin:0;font-size:20px;">📚 SignVibe</h2>
          </div>
          <p style="color:#555;margin-top:12px;font-size:15px;">Your teacher account is ready!</p>
        </div>
        <p style="color:#333;font-size:15px;">Hi <strong>${full_name}</strong>,</p>
        <p style="color:#555;font-size:14px;">
          Your teacher account has been created. You are assigned to handle <strong>${section_handled}</strong>
          (Employee No: <strong>${employee_no}</strong>).
          Use the credentials below to log in to SignVibe:
        </p>
        <div style="background:#f0fafa;border:1px solid #b2dfdb;border-left:5px solid #008080;padding:20px;border-radius:10px;margin:24px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#555;font-size:13px;width:100px;"><strong>Username</strong></td>
              <td style="padding:8px 0;">
                <code style="background:#e0f4f4;color:#00695c;padding:4px 10px;border-radius:5px;font-size:14px;">${email}</code>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#555;font-size:13px;"><strong>Password</strong></td>
              <td style="padding:8px 0;">
                <code style="background:#e0f4f4;color:#00695c;padding:4px 10px;border-radius:5px;font-size:16px;letter-spacing:2px;font-weight:bold;">${password}</code>
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#fff8e1;border:1px solid #ffe082;padding:12px 16px;border-radius:8px;margin-bottom:20px;">
          <p style="margin:0;color:#78550a;font-size:13px;">
            ⚠️ <strong>Keep this confidential.</strong> Do not share your password with anyone.
            Please change your password after your first login.
          </p>
        </div>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:11px;text-align:center;margin:0;">
          This email was sent by SignVibe Admin. Do not reply to this email.
        </p>
      </div>`,
  });
};

// ─── Send Password Reset Link ─────────────────────────────────────────────────
export const sendPasswordResetEmail = async ({ full_name, email, reset_link }) => {
  await getTransporter().sendMail({
    from: `"SignVibe Admin" <${process.env.MAIL_USER}>`,
    to: email,
    subject: '🔐 SignVibe – Password Reset Request',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;border:1px solid #e0e0e0;border-radius:14px;">

        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:#008080;padding:12px 24px;border-radius:8px;">
            <h2 style="color:#fff;margin:0;font-size:20px;">📚 SignVibe</h2>
          </div>
          <p style="color:#555;margin-top:12px;font-size:15px;">Password Reset Request</p>
        </div>

        <p style="color:#333;font-size:15px;">Hi <strong>${full_name}</strong>,</p>
        <p style="color:#555;font-size:14px;">
          Your admin has requested a password reset for your SignVibe teacher account.
          Click the button below to set a new password:
        </p>

        <div style="text-align:center;margin:32px 0;">
          <a href="${reset_link}"
            style="display:inline-block;background:#008080;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;letter-spacing:0.5px;">
            🔐 Reset My Password
          </a>
        </div>

        <div style="background:#fff8e1;border:1px solid #ffe082;padding:12px 16px;border-radius:8px;margin-bottom:20px;">
          <p style="margin:0;color:#78550a;font-size:13px;">
            ⚠️ This link will <strong>expire in 1 hour</strong>. If you did not request this, please ignore this email.
            Your password will remain unchanged.
          </p>
        </div>

        <p style="color:#888;font-size:13px;text-align:center;">
          Or copy and paste this link in your browser:<br/>
          <a href="${reset_link}" style="color:#008080;word-break:break-all;font-size:12px;">${reset_link}</a>
        </p>

        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:11px;text-align:center;margin:0;">
          This email was sent by SignVibe Admin. Do not reply to this email.
        </p>
      </div>`,
  });
};