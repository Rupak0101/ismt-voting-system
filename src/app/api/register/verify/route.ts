import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  EMAIL_VERIFICATION_WINDOW_SECONDS,
  generateConfirmationToken,
  normalizeEmail,
} from '@/lib/vote-verification';
import { fetchRegisteredUserByEmail } from '@/lib/vote-access';
import { sendRegistrationConfirmationLinkEmail } from '@/lib/verification-email';

export const runtime = 'nodejs';
const DEFAULT_REGISTRATION_RETRY_AFTER_SECONDS = 60;
const PROGRAM_TITLE = process.env.PROGRAM_TITLE?.trim() || 'ISMT FRESTival 2026';

async function getRetryAfterSeconds(email: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('program_registrations')
    .select('created_at, status')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.created_at || data.status === 'confirmed') return null;

  const createdAtMs = Date.parse(data.created_at);
  if (Number.isNaN(createdAtMs)) return null;

  const elapsedSeconds = Math.floor((Date.now() - createdAtMs) / 1_000);
  const remainingSeconds = DEFAULT_REGISTRATION_RETRY_AFTER_SECONDS - elapsedSeconds;
  return remainingSeconds > 0 ? remainingSeconds : null;
}

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    const normalizedEmail = email ? normalizeEmail(email) : '';

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { user, duplicate } = await fetchRegisteredUserByEmail(normalizedEmail);
    if (!user) {
      if (duplicate) {
        return NextResponse.json(
          { error: 'This email is linked to multiple accounts. Please contact admin.', code: 'DUPLICATE_EMAIL' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Only admin pre-registered users can register for this program.', code: 'INVALID_USER' },
        { status: 401 }
      );
    }

    const { data: existingRegistration, error: existingError } = await supabase
      .from('program_registrations')
      .select('id, status')
      .eq('college_id', user.college_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingRegistration?.status === 'confirmed') {
      return NextResponse.json({
        already_registered: true,
        user: { name: user.name, role: user.role },
      });
    }

    const retryAfterSeconds = await getRetryAfterSeconds(normalizedEmail);
    if (retryAfterSeconds) {
      return NextResponse.json(
        {
          error: `Please wait ${retryAfterSeconds}s before requesting another confirmation link.`,
          retry_after_seconds: retryAfterSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const confirmationToken = generateConfirmationToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_WINDOW_SECONDS * 1_000).toISOString();
    const now = new Date().toISOString();

    if (existingRegistration) {
      const { error: updateError } = await supabase
        .from('program_registrations')
        .update({
          email: normalizedEmail,
          confirmation_token: confirmationToken,
          status: 'pending',
          expires_at: expiresAt,
          created_at: now,
          confirmed_at: null,
        })
        .eq('id', existingRegistration.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from('program_registrations').insert([
        {
          college_id: user.college_id,
          email: normalizedEmail,
          confirmation_token: confirmationToken,
          status: 'pending',
          expires_at: expiresAt,
        },
      ]);

      if (insertError) throw insertError;
    }

    const origin = new URL(request.url).origin;
    const confirmUrl = new URL('/api/register/verify/confirm', origin);
    confirmUrl.searchParams.set('registration_token', confirmationToken);
    confirmUrl.searchParams.set('email', normalizedEmail);

    await sendRegistrationConfirmationLinkEmail({
      toEmail: normalizedEmail,
      recipientName: user.name,
      eventTitle: PROGRAM_TITLE,
      verificationUrl: confirmUrl.toString(),
    });

    return NextResponse.json({
      verification_sent: true,
      expires_in_seconds: EMAIL_VERIFICATION_WINDOW_SECONDS,
      retry_after_seconds: DEFAULT_REGISTRATION_RETRY_AFTER_SECONDS,
      user: { name: user.name, role: user.role },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message.startsWith('SMTP_ENV_MISSING:')) {
      const missingVarName = error.message.replace('SMTP_ENV_MISSING:', '');
      return NextResponse.json(
        { error: `SMTP is not configured. Missing ${missingVarName}.` },
        { status: 500 }
      );
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST205') {
      return NextResponse.json(
        { error: 'Program registration storage is not initialized. Run the latest database schema update.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Registration verification failed' }, { status: 500 });
  }
}
