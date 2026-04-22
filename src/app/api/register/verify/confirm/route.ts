import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isExpired, normalizeEmail } from '@/lib/vote-verification';
import { fetchRegisteredUserByEmail } from '@/lib/vote-access';
import {
  createProgramRegistrationSessionToken,
  getProgramRegistrationSessionCookieOptions,
  PROGRAM_REGISTRATION_SESSION_COOKIE_NAME,
  PROGRAM_REGISTRATION_SESSION_TTL_SECONDS,
} from '@/lib/registration-session';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const registrationPageUrl = new URL('/register', requestUrl.origin);
  const redirectWithState = (state: string, email?: string | null, cookie?: { collegeId: string; email: string }) => {
    registrationPageUrl.searchParams.set('registration', state);
    if (email) {
      registrationPageUrl.searchParams.set('email', email);
    }
    const response = NextResponse.redirect(registrationPageUrl);
    if (cookie) {
      const sessionToken = createProgramRegistrationSessionToken({
        collegeId: cookie.collegeId,
        email: cookie.email,
      });
      if (sessionToken) {
        response.cookies.set(
          PROGRAM_REGISTRATION_SESSION_COOKIE_NAME,
          sessionToken,
          getProgramRegistrationSessionCookieOptions(PROGRAM_REGISTRATION_SESSION_TTL_SECONDS)
        );
      }
    }
    return response;
  };

  const registrationToken = requestUrl.searchParams.get('registration_token')?.trim() ?? null;
  const queryEmail = requestUrl.searchParams.get('email')?.trim().toLowerCase() ?? null;
  if (!registrationToken) {
    return redirectWithState('missing', queryEmail);
  }

  try {
    const { data: registration, error: registrationError } = await supabase
      .from('program_registrations')
      .select('id, college_id, email, status, expires_at')
      .eq('confirmation_token', registrationToken)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (registrationError) throw registrationError;
    if (!registration) {
      return redirectWithState('missing', queryEmail);
    }

    const registrationEmail = normalizeEmail(registration.email);
    if (queryEmail && queryEmail !== registrationEmail) {
      return redirectWithState('failed', queryEmail);
    }

    if (registration.status === 'confirmed') {
      return redirectWithState('already', registrationEmail, {
        collegeId: registration.college_id,
        email: registrationEmail,
      });
    }
    if (registration.status !== 'pending') {
      return redirectWithState('failed', registrationEmail);
    }
    if (isExpired(registration.expires_at)) {
      return redirectWithState('expired', registrationEmail);
    }

    const { user, duplicate } = await fetchRegisteredUserByEmail(registrationEmail);
    if (!user) {
      return redirectWithState(duplicate ? 'failed' : 'missing', registrationEmail);
    }
    if (user.college_id !== registration.college_id) {
      return redirectWithState('failed', registrationEmail);
    }

    const { error: updateError } = await supabase
      .from('program_registrations')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', registration.id);

    if (updateError) throw updateError;
    return redirectWithState('success', registrationEmail, {
      collegeId: registration.college_id,
      email: registrationEmail,
    });
  } catch (error) {
    console.error(error);
    return redirectWithState('failed', queryEmail);
  }
}
