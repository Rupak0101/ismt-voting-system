import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('*')
      .eq('event_id', eventId);

    if (candidatesError) throw candidatesError;

    return NextResponse.json({ event, candidates: candidates ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}
