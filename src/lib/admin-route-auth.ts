import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";

export function requireAdminRequest(request: NextRequest): NextResponse | null {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifyAdminSessionToken(sessionToken)) {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  return null;
}
