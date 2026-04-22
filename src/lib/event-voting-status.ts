import { supabase } from '@/lib/supabase';

export type VotingStatus = 'not_started' | 'running' | 'paused' | 'stopped';

type EventWithVotingStatus = {
  id: number;
  voting_status: VotingStatus | null;
};

type LegacyEventSchedule = {
  id: number;
  start_time: string;
  end_time: string;
};

const LEGACY_RUNNING_EXTENSION_MS = 60 * 60 * 1000;
const STATUS_TIME_BUFFER_MS = 1_000;

function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function getErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('message' in error)) return '';
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

function isMissingVotingStatusColumnError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  const referencesMissingVotingStatus = message.toLowerCase().includes('voting_status');

  return code === 'PGRST204' || (code === '42703' && referencesMissingVotingStatus);
}

function normalizeVotingStatus(status: string | null | undefined): VotingStatus {
  if (status === 'running' || status === 'paused' || status === 'stopped' || status === 'not_started') {
    return status;
  }
  return 'not_started';
}

function deriveVotingStatusFromSchedule(startTime: string, endTime: string): VotingStatus {
  const startMs = Date.parse(startTime);
  const endMs = Date.parse(endTime);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'running';
  if (startMs > endMs) return 'paused';

  const now = Date.now();
  if (now < startMs) return 'not_started';
  if (now > endMs) return 'stopped';
  return 'running';
}

export async function fetchEventVotingStatus(eventId: number): Promise<EventWithVotingStatus | null> {
  const { data, error } = await supabase.from('events').select('id, voting_status').eq('id', eventId).maybeSingle();

  if (!error) {
    if (!data) return null;
    const event = data as EventWithVotingStatus;
    return {
      id: event.id,
      voting_status: normalizeVotingStatus(event.voting_status),
    };
  }

  if (!isMissingVotingStatusColumnError(error)) {
    throw error;
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from('events')
    .select('id, start_time, end_time')
    .eq('id', eventId)
    .maybeSingle();

  if (legacyError) throw legacyError;
  if (!legacyData) return null;

  const legacyEvent = legacyData as LegacyEventSchedule;
  return {
    id: legacyEvent.id,
    voting_status: deriveVotingStatusFromSchedule(legacyEvent.start_time, legacyEvent.end_time),
  };
}

async function updateLegacyEventVotingStatus(
  eventId: number,
  nextStatus: VotingStatus
): Promise<EventWithVotingStatus | null> {
  const { data: legacyData, error: legacyError } = await supabase
    .from('events')
    .select('id, start_time, end_time')
    .eq('id', eventId)
    .maybeSingle();

  if (legacyError) throw legacyError;
  if (!legacyData) return null;

  const legacyEvent = legacyData as LegacyEventSchedule;
  const now = Date.now();
  let startMs = Date.parse(legacyEvent.start_time);
  let endMs = Date.parse(legacyEvent.end_time);

  if (Number.isNaN(startMs)) startMs = now - STATUS_TIME_BUFFER_MS;
  if (Number.isNaN(endMs)) endMs = now + LEGACY_RUNNING_EXTENSION_MS;

  if (nextStatus === 'running') {
    if (endMs <= now) endMs = now + LEGACY_RUNNING_EXTENSION_MS;
    if (startMs > endMs) startMs = now - STATUS_TIME_BUFFER_MS;
    startMs = Math.min(startMs, now - STATUS_TIME_BUFFER_MS);
  } else if (nextStatus === 'paused') {
    if (endMs <= now) endMs = now + LEGACY_RUNNING_EXTENSION_MS;
    startMs = endMs + STATUS_TIME_BUFFER_MS;
  } else if (nextStatus === 'stopped') {
    endMs = now - STATUS_TIME_BUFFER_MS;
    startMs = Math.min(startMs, endMs);
  } else {
    startMs = now + STATUS_TIME_BUFFER_MS;
    if (endMs <= startMs) endMs = startMs + LEGACY_RUNNING_EXTENSION_MS;
  }

  const { error: updateError } = await supabase
    .from('events')
    .update({
      start_time: new Date(startMs).toISOString(),
      end_time: new Date(endMs).toISOString(),
    })
    .eq('id', eventId);

  if (updateError) throw updateError;
  return { id: legacyEvent.id, voting_status: nextStatus };
}

export async function updateEventVotingStatus(
  eventId: number,
  nextStatus: VotingStatus
): Promise<EventWithVotingStatus | null> {
  const { data, error } = await supabase
    .from('events')
    .update({ voting_status: nextStatus })
    .eq('id', eventId)
    .select('id, voting_status')
    .maybeSingle();

  if (!error) {
    if (!data) return null;
    const updatedEvent = data as EventWithVotingStatus;
    return {
      id: updatedEvent.id,
      voting_status: normalizeVotingStatus(updatedEvent.voting_status ?? nextStatus),
    };
  }

  if (!isMissingVotingStatusColumnError(error)) {
    throw error;
  }

  return updateLegacyEventVotingStatus(eventId, nextStatus);
}
