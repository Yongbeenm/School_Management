import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(email: string, rawToken: string): Promise<void> {
    const resetUrl = `${this.config.getOrThrow<string>('WEB_URL')}/auth/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;
    if (this.config.get<string>('EMAIL_PROVIDER') !== 'smtp') {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new InternalServerErrorException('Console email delivery is disabled in production');
      }
      this.logger.log(`Development password-reset URL for ${email}: ${resetUrl}`);
      return;
    }

    const transporter = this.getSmtpTransporter();
    await transporter.sendMail({
      from: this.config.getOrThrow<string>('EMAIL_FROM'),
      to: email,
      subject: 'Reset your School Management password',
      text: `Use this link to reset your password. It expires in one hour: ${resetUrl}`,
      html: `<p>Use the link below to reset your School Management password. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p>`,
    });
  }

  private getSmtpTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    if (!host || !user || !pass) throw new InternalServerErrorException('SMTP configuration is incomplete');
    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
    return this.transporter;
  }
}
