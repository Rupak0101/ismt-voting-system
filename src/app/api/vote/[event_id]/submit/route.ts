import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isExpired } from '@/lib/vote-verification';
import { fetchEventVotingStatus } from '@/lib/event-voting-status';

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

export async function POST(request: Request, context: { params: Promise<{ event_id: string }> }) {
  try {
    const { event_id } = await context.params;
    const eventId = Number(event_id);
    const { candidate_id, verification_token } = (await request.json()) as {
      candidate_id?: number;
      verification_token?: string;
    };
    const normalizedVerificationToken = verification_token?.trim();
    const candidateId = Number(candidate_id);

    if (!normalizedVerificationToken || Number.isNaN(candidateId)) {
      return NextResponse.json({ error: 'Missing information' }, { status: 400 });
    }
    if (Number.isNaN(eventId)) {
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
    }

    const event = await fetchEventVotingStatus(eventId);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const votingStatusError = getVotingStatusError(event.voting_status ?? 'not_started');
    if (votingStatusError) {
      return NextResponse.json(votingStatusError, { status: 403 });
    }

    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id')
      .eq('id', candidateId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (candidateError) throw candidateError;
    if (!candidate) {
      return NextResponse.json({ error: 'Invalid candidate selection.' }, { status: 400 });
    }

    const { data: verification, error: verificationError } = await supabase
      .from('vote_email_verifications')
      .select('id, college_id, status, expires_at')
      .eq('event_id', eventId)
      .eq('confirmation_token', normalizedVerificationToken)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verificationError) throw verificationError;
    if (!verification) {
      return NextResponse.json({ error: 'Please verify your email before voting.', code: 'NOT_VERIFIED' }, { status: 401 });
    }
    if (verification.status === 'consumed') {
      return NextResponse.json({ error: 'This verification has already been used.', code: 'VERIFICATION_USED' }, { status: 401 });
    }
    if (verification.status !== 'verified' || isExpired(verification.expires_at)) {
      return NextResponse.json(
        { error: 'Email verification expired. Please verify your email again.', code: 'VERIFICATION_EXPIRED' },
        { status: 401 }
      );
    }

    const { error } = await supabase.from('vote_log').insert([
      { college_id: verification.college_id, event_id: eventId, candidate_id: candidateId },
    ]);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already voted in this event.', code: 'ALREADY_VOTED' }, { status: 403 });
      }
      throw error;
    }

    const { error: consumeError } = await supabase
      .from('vote_email_verifications')
      .update({
        status: 'consumed',
        consumed_at: new Date().toISOString(),
      })
      .eq('id', verification.id);

    if (consumeError) throw consumeError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
  }
}
