import nodemailer, { type Transporter } from 'nodemailer';
import { EMAIL_VERIFICATION_WINDOW_MINUTES } from '@/lib/vote-verification';

let emailTransporter: Transporter | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`SMTP_ENV_MISSING:${name}`);
  }
  return value;
}

function getEmailTransporter(): Transporter {
  if (emailTransporter) {
    return emailTransporter;
  }

  const host = getRequiredEnv('SMTP_HOST');
  const port = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = getRequiredEnv('SMTP_USER');
  const pass = getRequiredEnv('SMTP_PASS');

  emailTransporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: { user, pass },
  });

  return emailTransporter;
}

export async function sendVoteVerificationLinkEmail(params: {
  toEmail: string;
  recipientName: string;
  eventTitle: string;
  verificationUrl: string;
}): Promise<void> {
  const transporter = getEmailTransporter();
  const from = process.env.SMTP_FROM ?? getRequiredEnv('SMTP_USER');
  const subject = `Verify your identity for ${params.eventTitle}`;
  const text = `Hi ${params.recipientName},

Use this link to verify your identity and continue voting:
${params.verificationUrl}

This link expires in ${EMAIL_VERIFICATION_WINDOW_MINUTES} minutes.
If you did not request this, you can ignore this email.`;

  await transporter.sendMail({
    from,
    to: params.toEmail,
    subject,
    text,
  });
}
