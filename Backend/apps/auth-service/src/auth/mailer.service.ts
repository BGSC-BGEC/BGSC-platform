import { config } from '@bgsc/shared';

export class MailerService {
  /**
   * Sends an email verification link.
   * In development, prints the link to stdout so local devs are not blocked.
   */
  static async sendVerificationEmail(userId: string, toEmail: string, token: string): Promise<void> {
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;

    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      console.log('----------------------------------------------------');
      console.log(`📧 [DEV EMAIL] To: ${toEmail}`);
      console.log(`Subject: Verify your BGSC Platform email`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log(`Token: ${token}`);
      console.log('----------------------------------------------------');
      return;
    }

    // In production, integrate SMTP or third-party email provider (Resend/SES).
    // User id, never the address: production logs are not a place for PII.
    console.log(`[PROD EMAIL STUB] Verification sent to user ${userId}`);
  }

  /**
   * Sends a password reset email.
   */
  static async sendPasswordResetEmail(userId: string, toEmail: string, token: string): Promise<void> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      console.log('----------------------------------------------------');
      console.log(`📧 [DEV EMAIL] To: ${toEmail}`);
      console.log(`Subject: Reset your BGSC Platform password`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log(`Token: ${token}`);
      console.log('----------------------------------------------------');
      return;
    }

    console.log(`[PROD EMAIL STUB] Password reset sent to user ${userId}`);
  }
}
