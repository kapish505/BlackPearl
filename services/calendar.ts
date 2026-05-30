// Google Calendar API Client — fetches real calendar events
import type { TimeBlock } from '../engine/types';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  status: string;
  organizer?: { email: string; displayName?: string; self?: boolean };
  recurringEventId?: string;
  hangoutLink?: string;
  conferenceData?: any;
  colorId?: string;
}

/**
 * Fetch today's calendar events from Google Calendar API.
 */
export async function fetchTodayEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Calendar API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return (data.items || []).filter(
    (e: CalendarEvent) => e.status !== 'cancelled' && e.start?.dateTime
  );
}

/**
 * Convert Google Calendar events into Black Pearl TimeBlocks.
 * This is the core translation layer — it classifies each event
 * by analyzing attendees, title keywords, and duration.
 */
export function eventsToTimeBlocks(events: CalendarEvent[]): TimeBlock[] {
  return events.map((event) => {
    const start = new Date(event.start.dateTime!);
    const end = new Date(event.end.dateTime!);
    const durationMin = (end.getTime() - start.getTime()) / 60_000;
    const attendeeCount = event.attendees?.length ?? 0;
    const title = event.summary || 'Untitled';
    const titleLower = title.toLowerCase();

    // Classify the event type
    const type = classifyEvent(titleLower, attendeeCount, durationMin, event);

    // Determine metadata
    const metadata: Record<string, unknown> = {};

    if (attendeeCount > 0) {
      metadata.attendees = attendeeCount;
      metadata.attendeeNames = event.attendees
        ?.map((a) => a.displayName || a.email.split('@')[0])
        .slice(0, 5);
    }

    if (event.recurringEventId) {
      metadata.recurring = true;
    }

    if (event.hangoutLink || event.conferenceData) {
      metadata.hasVideoCall = true;
    }

    if (event.description) {
      metadata.description = event.description.substring(0, 200);
    }

    // Detect if this meeting could potentially be async
    // (small meetings with no video call, or meetings where all agenda items are informational)
    if (type === 'meeting') {
      const couldBeAsync = detectAsyncPotential(event, durationMin, attendeeCount);
      if (couldBeAsync) {
        metadata.canBeAsync = true;
      }
    }

    return {
      id: event.id,
      start,
      end,
      type,
      title,
      source: 'google-calendar',
      metadata,
    };
  });
}

function classifyEvent(
  titleLower: string,
  attendeeCount: number,
  durationMin: number,
  event: CalendarEvent
): 'focus' | 'meeting' | 'buffer' | 'break' {
  // Break detection
  const breakKeywords = ['lunch', 'break', 'walk', 'gym', 'workout', 'meditation', 'rest', 'nap'];
  if (breakKeywords.some((k) => titleLower.includes(k))) return 'break';

  // Focus / deep work detection
  const focusKeywords = [
    'focus', 'deep work', 'coding', 'writing', 'design time', 'heads down',
    'blocked', 'do not disturb', 'dnd', 'maker time', 'build', 'hack',
    'research', 'study', 'review time', 'solo',
  ];
  if (focusKeywords.some((k) => titleLower.includes(k))) return 'focus';

  // Buffer detection
  const bufferKeywords = ['buffer', 'flex', 'catch up', 'admin', 'inbox', 'emails', 'slack time'];
  if (bufferKeywords.some((k) => titleLower.includes(k))) return 'buffer';

  // If no attendees and not a known type, treat as focus
  if (attendeeCount <= 1 && !event.hangoutLink && !event.conferenceData) {
    return 'focus';
  }

  // Default: meeting
  return 'meeting';
}

function detectAsyncPotential(event: CalendarEvent, durationMin: number, attendeeCount: number): boolean {
  const titleLower = (event.summary || '').toLowerCase();

  // Short syncs with few people are often convertible
  if (durationMin <= 30 && attendeeCount <= 4) return true;

  // Review/update meetings are often async-able
  const asyncKeywords = ['review', 'update', 'sync', 'check-in', 'checkin', 'status', 'standup', 'stand-up', 'retro'];
  if (asyncKeywords.some((k) => titleLower.includes(k))) return true;

  // Informational meetings (no interactive keywords)
  const interactiveKeywords = ['workshop', 'brainstorm', 'planning', 'sprint', 'kickoff', 'interview', '1:1', 'one-on-one', '1-on-1'];
  if (!interactiveKeywords.some((k) => titleLower.includes(k)) && attendeeCount <= 6) return true;

  return false;
}

/**
 * Generate a real async draft message based on an actual meeting.
 */
export function generateAsyncDraft(meeting: TimeBlock): {
  to: string;
  subject: string;
  body: string;
  confidence: number;
} {
  const attendees = (meeting.metadata?.attendeeNames as string[]) || ['team'];
  const hasDescription = !!(meeting.metadata?.description);

  return {
    to: `${meeting.title} participants`,
    subject: `${meeting.title} — Async Update`,
    body: `Hi ${attendees.slice(0, 3).join(', ')}${attendees.length > 3 ? ` and ${attendees.length - 3} others` : ''},

I'd like to suggest we handle today's "${meeting.title}" asynchronously.

${hasDescription ? `The agenda items can be addressed via a quick thread:\n\n${(meeting.metadata?.description as string).substring(0, 150)}...\n` : 'I believe the topics can be covered efficiently in a thread.'}

Please reply with any updates or blockers. If anything needs live discussion, I'm happy to jump on a quick call.

Thanks`,
    confidence: hasDescription ? 0.82 : 0.65,
  };
}
