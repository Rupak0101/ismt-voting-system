import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, getAdminSessionCookieOptions } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", getAdminSessionCookieOptions(0));
  return response;
}
