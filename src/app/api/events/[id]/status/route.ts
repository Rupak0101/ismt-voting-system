import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminRequest } from '@/lib/admin-route-auth';
import { fetchEventVotingStatus, updateEventVotingStatus, type VotingStatus } from '@/lib/event-voting-status';

type VotingAction = 'start' | 'pause' | 'unpause' | 'stop';

const NEXT_STATUS_BY_ACTION: Record<VotingAction, VotingStatus> = {
  start: 'running',
  pause: 'paused',
  unpause: 'running',
  stop: 'stopped',
};

function isTransitionAllowed(currentStatus: string, action: VotingAction): boolean {
  if (action === 'start') return currentStatus === 'not_started';
  if (action === 'pause') return currentStatus === 'running';
  if (action === 'unpause') return currentStatus === 'paused';
  if (action === 'stop') return currentStatus === 'running' || currentStatus === 'paused' || currentStatus === 'not_started';
  return false;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { id } = await context.params;
    const eventId = Number(id);
    if (Number.isNaN(eventId)) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { action } = (await request.json()) as { action?: VotingAction };
    if (!action || !(action in NEXT_STATUS_BY_ACTION)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const event = await fetchEventVotingStatus(eventId);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const currentStatus = event.voting_status ?? 'not_started';
    if (!isTransitionAllowed(currentStatus, action)) {
      return NextResponse.json(
        { error: `Cannot ${action} voting while event status is '${currentStatus}'.` },
        { status: 409 }
      );
    }

    const nextStatus = NEXT_STATUS_BY_ACTION[action];
    const updatedEvent = await updateEventVotingStatus(eventId, nextStatus);
    if (!updatedEvent) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    return NextResponse.json({
      success: true,
      action,
      voting_status: updatedEvent?.voting_status ?? nextStatus,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update voting status' }, { status: 500 });
  }
}
