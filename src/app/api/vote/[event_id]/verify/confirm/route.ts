import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseAuthClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { isExpired, normalizeEmail } from '@/lib/vote-verification';
import {
  createVerifiedVoteToken,
  fetchRegisteredUserByEmail,
  hasConfirmedProgramRegistration,
  hasAlreadyVoted,
} from '@/lib/vote-access';

export const runtime = 'nodejs';

const SUPABASE_EXPIRED_ERROR_CODES = new Set(['otp_expired', 'flow_state_expired']);

function parseOtpType(typeParam: string | null): EmailOtpType {
  if (
    typeParam === 'signup' ||
    typeParam === 'invite' ||
    typeParam === 'magiclink' ||
    typeParam === 'recovery' ||
    typeParam === 'email_change' ||
    typeParam === 'email'
  ) {
    return typeParam;
  }
  return 'magiclink';
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export async function GET(request: Request, context: { params: Promise<{ event_id: string }> }) {
  const { event_id } = await context.params;
  const eventId = Number(event_id);
  const requestUrl = new URL(request.url);
  const votePageUrl = new URL(`/vote/${event_id}`, requestUrl.origin);
  const redirectWithState = (state: string, email?: string | null) => {
    votePageUrl.searchParams.set('verification', state);
    if (email) {
      votePageUrl.searchParams.set('email', email);
    }
    return NextResponse.redirect(votePageUrl);
  };

  if (Number.isNaN(eventId)) {
    return redirectWithState('failed');
  }

  const queryErrorCode = requestUrl.searchParams.get('error_code');
  if (queryErrorCode && SUPABASE_EXPIRED_ERROR_CODES.has(queryErrorCode)) {
    return redirectWithState('expired');
  }

  const tokenHash = requestUrl.searchParams.get('token_hash');
  const token = requestUrl.searchParams.get('token');
  const code = requestUrl.searchParams.get('code');
  const verificationToken = requestUrl.searchParams.get('verification_token')?.trim() ?? null;
  const queryEmail = requestUrl.searchParams.get('email')?.trim().toLowerCase() ?? null;

  if (!tokenHash && !token && !code && !verificationToken) {
    return redirectWithState('missing', queryEmail);
  }

  try {
    if (verificationToken) {
      const { data: verification, error: verificationError } = await supabase
        .from('vote_email_verifications')
        .select('id, college_id, email, status, expires_at')
        .eq('event_id', eventId)
        .eq('confirmation_token', verificationToken)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (verificationError) throw verificationError;
      if (!verification) {
        return redirectWithState('missing', queryEmail);
      }

      const verificationEmail = normalizeEmail(verification.email);
      if (queryEmail && queryEmail !== verificationEmail) {
        return redirectWithState('failed', queryEmail);
      }
      if (verification.status === 'consumed') {
        return redirectWithState('already_used', verificationEmail);
      }
      if (verification.status !== 'pending' && verification.status !== 'verified') {
        return redirectWithState('failed', verificationEmail);
      }
      if (isExpired(verification.expires_at)) {
        return redirectWithState('expired', verificationEmail);
      }

      const { user, duplicate } = await fetchRegisteredUserByEmail(verificationEmail);
      if (!user) {
        return redirectWithState(duplicate ? 'failed' : 'missing', verificationEmail);
      }
      if (user.college_id !== verification.college_id) {
        return redirectWithState('failed', verificationEmail);
      }
      const hasConfirmedRegistration = await hasConfirmedProgramRegistration(user.college_id);
      if (!hasConfirmedRegistration) {
        return redirectWithState('not_registered', verificationEmail);
      }

      const alreadyVoted = await hasAlreadyVoted(eventId, user.college_id);
      if (alreadyVoted) {
        return redirectWithState('already_voted', verificationEmail);
      }

      if (verification.status === 'pending') {
        const { error: updateError } = await supabase
          .from('vote_email_verifications')
          .update({
            status: 'verified',
            verified_at: new Date().toISOString(),
          })
          .eq('id', verification.id);

        if (updateError) throw updateError;
      }

      votePageUrl.searchParams.set('verification', 'success');
      votePageUrl.searchParams.set('verification_token', verificationToken);
      return NextResponse.redirect(votePageUrl);
    }

    const otpType = parseOtpType(requestUrl.searchParams.get('type'));
    const supabaseAuth = getSupabaseAuthClient();
    let authEmail: string | null = null;
    let authError: unknown = null;

    if (code) {
      const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code);
      authError = error;
      authEmail = data.user?.email?.trim().toLowerCase() ?? null;
    } else if (tokenHash) {
      const { data, error } = await supabaseAuth.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      authError = error;
      authEmail = data.user?.email?.trim().toLowerCase() ?? null;
    } else if (token && queryEmail) {
      const { data, error } = await supabaseAuth.auth.verifyOtp({
        token,
        type: otpType,
        email: queryEmail,
      });
      authError = error;
      authEmail = data.user?.email?.trim().toLowerCase() ?? queryEmail;
    } else {
      return redirectWithState('missing', queryEmail);
    }

    if (authError) {
      const authErrorCode = getErrorCode(authError);
      if (authErrorCode && SUPABASE_EXPIRED_ERROR_CODES.has(authErrorCode)) {
        return redirectWithState('expired', queryEmail);
      }
      return redirectWithState('failed', queryEmail);
    }

    if (!authEmail) {
      return redirectWithState('failed', queryEmail);
    }

    const { user, duplicate } = await fetchRegisteredUserByEmail(authEmail);
    if (!user) {
      return redirectWithState(duplicate ? 'failed' : 'missing', authEmail);
    }
    const hasConfirmedRegistration = await hasConfirmedProgramRegistration(user.college_id);
    if (!hasConfirmedRegistration) {
      return redirectWithState('not_registered', authEmail);
    }

    const alreadyVoted = await hasAlreadyVoted(eventId, user.college_id);
    if (alreadyVoted) {
      return redirectWithState('already_voted', authEmail);
    }

    const confirmedVoteToken = await createVerifiedVoteToken({
      eventId,
      collegeId: user.college_id,
      email: authEmail,
      source: 'SUPABASE_MAGIC_LINK',
    });

    votePageUrl.searchParams.set('verification', 'success');
    votePageUrl.searchParams.set('verification_token', confirmedVoteToken);
    return NextResponse.redirect(votePageUrl);
  } catch (error) {
    console.error(error);
    return redirectWithState('failed', queryEmail);
  }
}
