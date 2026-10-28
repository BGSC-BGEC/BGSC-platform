import nodemailer from 'nodemailer';
import { config } from '@bgsc/shared';

/** Minutes a mailed code stays valid; the mail says so, so it lives here beside the text. */
export const MAIL_CODE_TTL_MIN = 10;

let transport: nodemailer.Transporter | null = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      // 465 is implicit TLS; 587 upgrades with STARTTLS, which nodemailer requires once offered.
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

/** Selfcheck seam: swap in nodemailer's jsonTransport (or null) without an SMTP server. */
export function useTransport(t: nodemailer.Transporter | null): void {
  transport = t;
}

/** Called at boot: a production auth-service without mail would leave every signup unverifiable. */
export function assertMailConfigured(): void {
  if (config.nodeEnv === 'production' && !transport) {
    throw new Error('Refusing to start in production: SMTP_HOST is not set, so no verification or reset code could be sent.');
  }
}

async function sendCode(userId: string, toEmail: string, subject: string, intro: string, code: string): Promise<void> {
  const text = `${intro}\n\n${code}\n\nThe code expires in ${MAIL_CODE_TTL_MIN} minutes. If you did not ask for it, ignore this email.`;

  if (!transport) {
    // The live-check reads these lines (To / Subject / Code), so keep their shape.
    console.log('----------------------------------------------------');
    console.log(`📧 [DEV EMAIL] To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Code: ${code}`);
    console.log('----------------------------------------------------');
    return;
  }

  await transport.sendMail({
    from: config.smtp.from,
    to: toEmail,
    subject,
    text,
    html: `<p>${intro}</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>The code expires in ${MAIL_CODE_TTL_MIN} minutes. If you did not ask for it, ignore this email.</p>`,
  });
  // User id, never the address: production logs are not a place for PII.
  console.log(`[auth-service] mail "${subject}" sent to user ${userId}`);
}

export class MailerService {
  static sendVerificationEmail(userId: string, toEmail: string, code: string): Promise<void> {
    return sendCode(userId, toEmail, 'Verify your BGSC email', 'Your BGSC email verification code:', code);
  }

  static sendPasswordResetEmail(userId: string, toEmail: string, code: string): Promise<void> {
    return sendCode(userId, toEmail, 'Reset your BGSC password', 'Your BGSC password reset code:', code);
  }
}
