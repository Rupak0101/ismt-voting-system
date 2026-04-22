import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  getConfiguredAdminCredentials,
  isValidAdminCredentials,
} from "@/lib/admin-auth";

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const configuredCredentials = getConfiguredAdminCredentials();
  if (!configuredCredentials) {
    return NextResponse.json(
      { error: "Admin credentials are not configured on the server." },
      { status: 503 }
    );
  }

  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const username = payload.username?.trim() ?? "";
  const password = payload.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  if (!isValidAdminCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  const token = createAdminSessionToken(username);
  if (!token) {
    return NextResponse.json(
      { error: "Admin session secret is missing. Set ADMIN_SESSION_SECRET." },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(
    ADMIN_SESSION_COOKIE_NAME,
    token,
    getAdminSessionCookieOptions(ADMIN_SESSION_TTL_SECONDS)
  );
  return response;
}
