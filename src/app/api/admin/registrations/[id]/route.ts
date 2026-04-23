import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdminRequest } from '@/lib/admin-route-auth';

type UpdateRegistrationPayload = {
  status?: 'pending' | 'confirmed';
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { id } = await context.params;
    const registrationId = Number(id);

    if (Number.isNaN(registrationId)) {
      return NextResponse.json({ error: 'Invalid registration ID' }, { status: 400 });
    }

    const payload = (await request.json()) as UpdateRegistrationPayload;
    const updatePayload: Record<string, string | null> = {};

    if (payload.status !== undefined) {
      if (!['pending', 'confirmed'].includes(payload.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updatePayload.status = payload.status;
      if (payload.status === 'confirmed') {
        updatePayload.confirmed_at = new Date().toISOString();
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('program_registrations')
      .update(updatePayload)
      .eq('id', registrationId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { id } = await context.params;
    const registrationId = Number(id);

    if (Number.isNaN(registrationId)) {
      return NextResponse.json({ error: 'Invalid registration ID' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('program_registrations')
      .delete()
      .eq('id', registrationId)
      .select('id')
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete registration' }, { status: 500 });
  }
}
