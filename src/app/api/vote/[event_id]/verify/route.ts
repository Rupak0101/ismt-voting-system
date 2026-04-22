import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { normalizeEmail } from '@/lib/vote-verification';
import {
  createVerifiedVoteToken,
  fetchRegisteredUserByCollegeId,
  fetchRegisteredUserByEmail,
  hasConfirmedProgramRegistration,
  hasAlreadyVoted,
} from '@/lib/vote-access';
import { fetchEventVotingStatus } from '@/lib/event-voting-status';
import {
  PROGRAM_REGISTRATION_SESSION_COOKIE_NAME,
  verifyProgramRegistrationSessionToken,
} from '@/lib/registration-session';

export const runtime = 'nodejs';

function getVotingStatusError(votingStatus: string): { error: string; code: string } | null {
  if (votingStatus === 'running') return null;
  if (votingStatus === 'paused') {
    return { error: 'Voting is currently paused by admin.', code: 'VOTING_PAUSED' };
  }
  if (votingStatus === 'stopped') {
    return { error: 'Voting has been stopped by admin.', code: 'VOTING_STOPPED' };
  }
  return { error: 'Voting has not started yet.', code: 'VOTING_NOT_STARTED' };
}

export async function POST(request: NextRequest, context: { params: Promise<{ event_id: string }> }) {
  try {
    const { event_id } = await context.params;
    const eventId = Number(event_id);
    if (Number.isNaN(eventId)) return NextResponse.json({ error: 'Verification failed' }, { status: 500 });

    const parsedBody = (await request.json().catch(() => ({}))) as { email?: string };
    const normalizedEmail = parsedBody.email ? normalizeEmail(parsedBody.email) : '';
    const sessionToken = request.cookies.get(PROGRAM_REGISTRATION_SESSION_COOKIE_NAME)?.value ?? '';
    const sessionPayload = sessionToken ? verifyProgramRegistrationSessionToken(sessionToken) : null;
    const sessionEmail = sessionPayload ? normalizeEmail(sessionPayload.email) : '';
    const canUseSessionForRequest = Boolean(sessionPayload && (!normalizedEmail || normalizedEmail === sessionEmail));

    const event = await fetchEventVotingStatus(eventId);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const votingStatusError = getVotingStatusError(event.voting_status ?? 'not_started');
    if (votingStatusError) {
      return NextResponse.json(votingStatusError, { status: 403 });
    }

    let user = null as Awaited<ReturnType<typeof fetchRegisteredUserByCollegeId>> | null;
    let verificationSource: 'PROGRAM_SESSION' | 'EMAIL_LOOKUP' = 'EMAIL_LOOKUP';

    if (canUseSessionForRequest && sessionPayload) {
      user = await fetchRegisteredUserByCollegeId(sessionPayload.college_id);
      if (user) verificationSource = 'PROGRAM_SESSION';
    }

    if (!user && normalizedEmail) {
      const byEmail = await fetchRegisteredUserByEmail(normalizedEmail);
      if (!byEmail.user) {
        if (byEmail.duplicate) {
          return NextResponse.json(
            { error: 'This email is linked to multiple accounts. Please contact admin.', code: 'DUPLICATE_EMAIL' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          {
            error: 'Email is not registered. Only pre-registered users can vote.',
            code: 'INVALID_USER',
          },
          { status: 401 }
        );
      }
      user = byEmail.user;
      verificationSource = 'EMAIL_LOOKUP';
    }

    if (!user) {
      return NextResponse.json(
        {
          error: 'You must complete registration first. Scan registration QR and confirm your email.',
          code: 'NOT_REGISTERED',
        },
        { status: 403 }
      );
    }

    const hasConfirmedRegistration = await hasConfirmedProgramRegistration(user.college_id);
    if (!hasConfirmedRegistration) {
      return NextResponse.json(
        {
          error: 'You must complete registration first. Scan registration QR and confirm your email.',
          code: 'NOT_REGISTERED',
        },
        { status: 403 }
      );
    }

    const alreadyVoted = await hasAlreadyVoted(eventId, user.college_id);
    if (alreadyVoted) {
      return NextResponse.json({ error: 'You have already voted in this event.', code: 'ALREADY_VOTED' }, { status: 403 });
    }

    const confirmationToken = await createVerifiedVoteToken({
      eventId,
      collegeId: user.college_id,
      email: user.email,
      source: verificationSource,
    });

    return NextResponse.json({
      verified: true,
      verification_token: confirmationToken,
      user: { name: user.name, role: user.role },
    });
  } catch (error) {
    console.error(error);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST205') {
      return NextResponse.json(
        { error: 'Voting access storage is not initialized. Run the latest database schema update.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
