import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, context: { params: Promise<{ event_id: string }> }) {
  try {
    const { event_id } = await context.params;
    const eventId = Number(event_id);

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

    const { data: votes, error: votesError } = await supabase
      .from('vote_log')
      .select('candidate_id')
      .eq('event_id', eventId);

    if (votesError) throw votesError;

    const voteCounter = new Map<number, number>();
    for (const vote of votes ?? []) {
      voteCounter.set(vote.candidate_id, (voteCounter.get(vote.candidate_id) ?? 0) + 1);
    }

    const results = (candidates ?? [])
      .map((candidate) => ({
        ...candidate,
        vote_count: voteCounter.get(candidate.id) ?? 0,
      }))
      .sort((a, b) => b.vote_count - a.vote_count);

    return NextResponse.json({ event, results });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
