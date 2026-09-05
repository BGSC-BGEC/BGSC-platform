import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('auth.smtp.from')!;
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('auth.smtp.host'),
      port: this.configService.get<number>('auth.smtp.port') || 587,
      secure: false,
      auth: {
        user: this.configService.get<string>('auth.smtp.user'),
        pass: this.configService.get<string>('auth.smtp.password'),
      },
    });
  }

  async sendRegistrationCode(to: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verify your BGSC Platform email',
      text: `Your BGSC Platform verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your BGSC Platform verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    const resetLink = `https://bgsc-platform.in/reset-password?token=${rawToken}`;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Reset your BGSC Platform password',
      text: `Use this link to reset your password. It expires in 1 hour: ${resetLink}`,
      html: `<p>Use this link to reset your password. It expires in 1 hour:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    });
  }
}
