import { randomBytes, randomInt } from 'crypto';

export const EMAIL_VERIFICATION_WINDOW_MINUTES = 10;
export const EMAIL_VERIFICATION_WINDOW_SECONDS = EMAIL_VERIFICATION_WINDOW_MINUTES * 60;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function generateConfirmationToken(): string {
  return randomBytes(24).toString('hex');
}

export function isExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now();
}
