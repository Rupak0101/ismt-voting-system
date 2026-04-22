import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdminRequest } from '@/lib/admin-route-auth';

type UpdateUserPayload = {
  name?: string;
  role?: string;
  email?: string;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ college_id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { college_id } = await context.params;
    if (!college_id) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

    const payload = (await request.json()) as UpdateUserPayload;
    const updatePayload: Record<string, string> = {};

    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      updatePayload.name = name;
    }

    if (payload.role !== undefined) {
      const role = payload.role.trim().toLowerCase();
      if (!role) return NextResponse.json({ error: 'Role is required' }, { status: 400 });
      updatePayload.role = role;
    }

    if (payload.email !== undefined) {
      const email = payload.email.trim().toLowerCase();
      if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

      const { data: duplicateEmailRows, error: duplicateEmailError } = await supabase
        .from('users')
        .select('college_id')
        .eq('email', email)
        .neq('college_id', college_id)
        .limit(1);

      if (duplicateEmailError) throw duplicateEmailError;
      if (duplicateEmailRows && duplicateEmailRows.length > 0) {
        return NextResponse.json({ error: 'Another participant already uses this email.' }, { status: 409 });
      }

      updatePayload.email = email;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('college_id', college_id)
      .select('college_id, name, role, email')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ college_id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { college_id } = await context.params;
    if (!college_id) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

    const { data, error } = await supabase.from('users').delete().eq('college_id', college_id).select('college_id').maybeSingle();
    if (error) {
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Cannot delete this participant because they already have related voting records.' },
          { status: 409 }
        );
      }
      throw error;
    }
    if (!data) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete participant' }, { status: 500 });
  }
}
