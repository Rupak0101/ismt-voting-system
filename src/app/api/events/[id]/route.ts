import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdminRequest } from '@/lib/admin-route-auth';
import { fetchEventVotingStatus } from '@/lib/event-voting-status';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const eventId = Number(id);

    if (Number.isNaN(eventId)) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const eventVotingStatus = await fetchEventVotingStatus(eventId);
    const eventWithStatus = {
      ...event,
      voting_status: eventVotingStatus?.voting_status ?? 'not_started',
    };

    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('*')
      .eq('event_id', eventId);

    if (candidatesError) throw candidatesError;

    return NextResponse.json({ event: eventWithStatus, candidates: candidates ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

type UpdateEventPayload = {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { id } = await context.params;
    const eventId = Number(id);
    if (Number.isNaN(eventId)) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const payload = (await request.json()) as UpdateEventPayload;
    const updatePayload: Record<string, string | null> = {};

    if (payload.title !== undefined) {
      const title = payload.title.trim();
      if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
      updatePayload.title = title;
    }
    if (payload.description !== undefined) {
      updatePayload.description = payload.description.trim() || null;
    }
    if (payload.start_time !== undefined) {
      if (Number.isNaN(Date.parse(payload.start_time))) {
        return NextResponse.json({ error: 'Invalid start time' }, { status: 400 });
      }
      updatePayload.start_time = payload.start_time;
    }
    if (payload.end_time !== undefined) {
      if (Number.isNaN(Date.parse(payload.end_time))) {
        return NextResponse.json({ error: 'Invalid end time' }, { status: 400 });
      }
      updatePayload.end_time = payload.end_time;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    if (updatePayload.start_time || updatePayload.end_time) {
      const { data: existingEventTimes, error: existingEventTimesError } = await supabase
        .from('events')
        .select('id, start_time, end_time')
        .eq('id', eventId)
        .maybeSingle();

      if (existingEventTimesError) throw existingEventTimesError;
      if (!existingEventTimes) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

      const effectiveStartTime = updatePayload.start_time ?? existingEventTimes.start_time;
      const effectiveEndTime = updatePayload.end_time ?? existingEventTimes.end_time;
      if (Date.parse(effectiveEndTime) <= Date.parse(effectiveStartTime)) {
        return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
      }
    }

    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!updatedEvent) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { id } = await context.params;
    const eventId = Number(id);
    if (Number.isNaN(eventId)) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data, error } = await supabase.from('events').delete().eq('id', eventId).select('id').maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
