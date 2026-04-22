import { supabase } from '@/lib/supabase';
import {
  EMAIL_VERIFICATION_WINDOW_SECONDS,
  generateConfirmationToken,
  normalizeEmail,
} from '@/lib/vote-verification';

export type RegisteredUser = {
  college_id: string;
  name: string;
  role: string;
  email: string;
};

export async function fetchRegisteredUserByEmail(email: string): Promise<{
  user: RegisteredUser | null;
  duplicate: boolean;
}> {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from('users')
    .select('college_id, name, role, email')
    .eq('email', normalizedEmail)
    .limit(2);

  if (error) throw error;
  if (!data || data.length === 0) return { user: null, duplicate: false };
  if (data.length > 1) return { user: null, duplicate: true };

  const row = data[0];
  if (!row.email) return { user: null, duplicate: false };

  return {
    duplicate: false,
    user: {
      college_id: row.college_id,
      name: row.name,
      role: row.role,
      email: normalizeEmail(row.email),
    },
  };
}

export async function hasAlreadyVoted(eventId: number, collegeId: string): Promise<boolean> {
  const { data: vote, error } = await supabase
    .from('vote_log')
    .select('id')
    .eq('college_id', collegeId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(vote);
}

export async function createVerifiedVoteToken(params: {
  eventId: number;
  collegeId: string;
  email: string;
  source: string;
}): Promise<string> {
  const confirmationToken = generateConfirmationToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_WINDOW_SECONDS * 1000).toISOString();
  const now = new Date().toISOString();

  const { error } = await supabase.from('vote_email_verifications').insert([
    {
      event_id: params.eventId,
      college_id: params.collegeId,
      email: normalizeEmail(params.email),
      verification_code: params.source,
      confirmation_token: confirmationToken,
      expires_at: expiresAt,
      status: 'verified',
      verified_at: now,
    },
  ]);

  if (error) throw error;
  return confirmationToken;
}

export async function createPendingVoteVerification(params: {
  eventId: number;
  collegeId: string;
  email: string;
  source: string;
}): Promise<{ confirmationToken: string; expiresAt: string }> {
  const confirmationToken = generateConfirmationToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_WINDOW_SECONDS * 1000).toISOString();

  const { error } = await supabase.from('vote_email_verifications').insert([
    {
      event_id: params.eventId,
      college_id: params.collegeId,
      email: normalizeEmail(params.email),
      verification_code: params.source,
      confirmation_token: confirmationToken,
      expires_at: expiresAt,
      status: 'pending',
    },
  ]);

  if (error) throw error;
  return { confirmationToken, expiresAt };
}
