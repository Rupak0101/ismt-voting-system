import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { EMAIL_VERIFICATION_WINDOW_SECONDS, normalizeEmail } from '@/lib/vote-verification';
import {
  createPendingVoteVerification,
  fetchRegisteredUserByEmail,
  hasAlreadyVoted,
} from '@/lib/vote-access';
import { sendVoteVerificationLinkEmail } from '@/lib/verification-email';

export const runtime = 'nodejs';
const DEFAULT_OTP_RETRY_AFTER_SECONDS = 60;

async function getRetryAfterSeconds(eventId: number, email: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('vote_email_verifications')
    .select('created_at')
    .eq('event_id', eventId)
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.created_at) return null;

  const createdAtMs = Date.parse(data.created_at);
  if (Number.isNaN(createdAtMs)) return null;

  const elapsedSeconds = Math.floor((Date.now() - createdAtMs) / 1_000);
  const remainingSeconds = DEFAULT_OTP_RETRY_AFTER_SECONDS - elapsedSeconds;
  return remainingSeconds > 0 ? remainingSeconds : null;
}

export async function POST(request: Request, context: { params: Promise<{ event_id: string }> }) {
  try {
    const { event_id } = await context.params;
    const eventId = Number(event_id);
    const { email } = (await request.json()) as { email?: string };
    const normalizedEmail = email ? normalizeEmail(email) : '';

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (Number.isNaN(eventId)) return NextResponse.json({ error: 'Verification failed' }, { status: 500 });

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { user, duplicate } = await fetchRegisteredUserByEmail(normalizedEmail);
    if (!user) {
      if (duplicate) {
        return NextResponse.json(
          { error: 'This email is linked to multiple accounts. Please contact admin.', code: 'DUPLICATE_EMAIL' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Email is not registered. Identity not verified.', code: 'INVALID_USER' }, { status: 401 });
    }
    const alreadyVoted = await hasAlreadyVoted(eventId, user.college_id);
    if (alreadyVoted) return NextResponse.json({ error: 'You have already voted in this event.', code: 'ALREADY_VOTED' }, { status: 403 });

    const retryAfterSeconds = await getRetryAfterSeconds(eventId, normalizedEmail);
    if (retryAfterSeconds) {
      return NextResponse.json(
        { error: `Please wait ${retryAfterSeconds}s before requesting another link.`, retry_after_seconds: retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const { confirmationToken } = await createPendingVoteVerification({
      eventId,
      collegeId: user.college_id,
      email: normalizedEmail,
      source: 'EMAIL_LINK',
    });

    const origin = new URL(request.url).origin;
    const confirmUrl = new URL(`/api/vote/${eventId}/verify/confirm`, origin);
    confirmUrl.searchParams.set('verification_token', confirmationToken);
    confirmUrl.searchParams.set('email', normalizedEmail);

    await sendVoteVerificationLinkEmail({
      toEmail: normalizedEmail,
      recipientName: user.name,
      eventTitle: event.title,
      verificationUrl: confirmUrl.toString(),
    });

    return NextResponse.json({
      verification_sent: true,
      expires_in_seconds: EMAIL_VERIFICATION_WINDOW_SECONDS,
      retry_after_seconds: DEFAULT_OTP_RETRY_AFTER_SECONDS,
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
        { error: 'Verification storage is not initialized. Run the latest database schema update.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
