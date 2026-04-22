import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  username: string;
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

function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

export function getConfiguredAdminCredentials(): { username: string; password: string } | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

export function isValidAdminCredentials(username: string, password: string): boolean {
  const configured = getConfiguredAdminCredentials();
  if (!configured) return false;
  return secureEqual(username, configured.username) && secureEqual(password, configured.password);
}

function createSignature(payloadBase64Url: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadBase64Url).digest("base64url");
}

export function createAdminSessionToken(username: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const payload: AdminSessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  };

  const payloadBase64Url = encodeBase64Url(JSON.stringify(payload));
  const signature = createSignature(payloadBase64Url, secret);
  return `${payloadBase64Url}.${signature}`;
}

export function verifyAdminSessionToken(token: string): boolean {
  const secret = getSessionSecret();
  const configured = getConfiguredAdminCredentials();
  if (!secret || !configured) return false;

  const [payloadBase64Url, signature] = token.split(".");
  if (!payloadBase64Url || !signature) return false;

  const expectedSignature = createSignature(payloadBase64Url, secret);
  if (!secureEqual(signature, expectedSignature)) return false;

  let payload: AdminSessionPayload;
  try {
    payload = JSON.parse(decodeBase64Url(payloadBase64Url)) as AdminSessionPayload;
  } catch {
    return false;
  }

  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  return secureEqual(payload.username, configured.username);
}

export function getAdminSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
