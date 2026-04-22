import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdminRequest } from '@/lib/admin-route-auth';

type RegistrationRow = {
  id: number;
  college_id: string;
  email: string;
  status: 'pending' | 'confirmed';
  created_at: string;
  confirmed_at: string | null;
};

type UserRow = {
  college_id: string;
  name: string;
  role: string;
  email: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { data: registrations, error: registrationsError } = await supabase
      .from('program_registrations')
      .select('id, college_id, email, status, created_at, confirmed_at')
      .order('created_at', { ascending: false });

    if (registrationsError) throw registrationsError;

    const typedRegistrations = (registrations ?? []) as RegistrationRow[];
    const uniqueCollegeIds = Array.from(new Set(typedRegistrations.map((row) => row.college_id)));

    const usersByCollegeId = new Map<string, UserRow>();
    if (uniqueCollegeIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('college_id, name, role, email')
        .in('college_id', uniqueCollegeIds);

      if (usersError) throw usersError;
      for (const user of (users ?? []) as UserRow[]) {
        usersByCollegeId.set(user.college_id, user);
      }
    }

    const registrationList = typedRegistrations.map((registration) => {
      const user = usersByCollegeId.get(registration.college_id);
      return {
        ...registration,
        user: {
          college_id: registration.college_id,
          name: user?.name ?? 'Unknown user',
          role: user?.role ?? null,
          email: user?.email ?? registration.email,
        },
      };
    });

    const confirmedCount = registrationList.filter((registration) => registration.status === 'confirmed').length;

    return NextResponse.json({
      total: registrationList.length,
      confirmed: confirmedCount,
      pending: registrationList.length - confirmedCount,
      registrations: registrationList,
    });
  } catch (error) {
    console.error(error);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST205') {
      return NextResponse.json(
        { error: 'Program registration storage is not initialized. Run the latest database schema update.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }
}
