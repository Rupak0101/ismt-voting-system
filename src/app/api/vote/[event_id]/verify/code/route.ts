import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Verification code login is disabled. Please use the verification link sent to your email.',
      code: 'CODE_VERIFICATION_DISABLED',
    },
    { status: 410 }
  );
}
