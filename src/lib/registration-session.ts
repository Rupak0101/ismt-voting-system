import { createHmac, timingSafeEqual } from "node:crypto";

export const PROGRAM_REGISTRATION_SESSION_COOKIE_NAME = "program_registration_session";
export const PROGRAM_REGISTRATION_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type ProgramRegistrationSessionPayload = {
  college_id: string;
  email: string;
  exp: number;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function secureEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function getProgramRegistrationSessionSecret(): string | null {
  const registrationSecret = process.env.PROGRAM_REGISTRATION_SESSION_SECRET?.trim();
  if (registrationSecret) return registrationSecret;

  const fallbackAdminSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  return fallbackAdminSecret && fallbackAdminSecret.length > 0 ? fallbackAdminSecret : null;
}

function createSignature(payloadBase64Url: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadBase64Url).digest("base64url");
}

export function createProgramRegistrationSessionToken(params: {
  collegeId: string;
  email: string;
}): string | null {
  const secret = getProgramRegistrationSessionSecret();
  if (!secret) return null;

  const payload: ProgramRegistrationSessionPayload = {
    college_id: params.collegeId,
    email: params.email,
    exp: Math.floor(Date.now() / 1000) + PROGRAM_REGISTRATION_SESSION_TTL_SECONDS,
  };

  const payloadBase64Url = encodeBase64Url(JSON.stringify(payload));
  const signature = createSignature(payloadBase64Url, secret);
  return `${payloadBase64Url}.${signature}`;
}

export function verifyProgramRegistrationSessionToken(token: string): ProgramRegistrationSessionPayload | null {
  const secret = getProgramRegistrationSessionSecret();
  if (!secret) return null;

  const [payloadBase64Url, signature] = token.split(".");
  if (!payloadBase64Url || !signature) return null;

  const expectedSignature = createSignature(payloadBase64Url, secret);
  if (!secureEqual(signature, expectedSignature)) return null;

  let payload: ProgramRegistrationSessionPayload;
  try {
    payload = JSON.parse(decodeBase64Url(payloadBase64Url)) as ProgramRegistrationSessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.exp !== "number" ||
    typeof payload.college_id !== "string" ||
    typeof payload.email !== "string" ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return payload;
}

export function getProgramRegistrationSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
