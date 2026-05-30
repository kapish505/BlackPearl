// Signal Derivation — generates OperationalSignals from real calendar data
// No mock data. Every signal is derived from actual events.

import type { OperationalSignal, TimeBlock } from '../engine/types';

/**
 * Analyze real calendar data and derive operational signals.
 * Each signal represents something the user should be aware of.
 * Severity is numeric: 0 = ambient noise, 1 = critical escalation.
 */
export function deriveSignals(blocks: TimeBlock[]): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  const now = new Date();

  // 1. Meeting density analysis
  const meetings = blocks.filter((b) => b.type === 'meeting');
  const focusBlocks = blocks.filter((b) => b.type === 'focus');

  if (meetings.length >= 4) {
    signals.push({
      id: 'sig-density-high',
      source: 'calendar-analysis',
      type: 'operational',
      severity: meetings.length >= 6 ? 0.9 : 0.6,
      timestamp: now,
      content: `${meetings.length} meetings today — ${calcMeetingHours(meetings)}h in meetings`,
      metadata: { meetingCount: meetings.length },
    });
  }

  // 2. Back-to-back meeting detection
  const backToBack = detectBackToBack(meetings);
  if (backToBack.length > 0) {
    signals.push({
      id: 'sig-back-to-back',
      source: 'calendar-analysis',
      type: 'operational',
      severity: backToBack.length >= 3 ? 0.8 : 0.5,
      timestamp: now,
      content: `${backToBack.length} back-to-back meetings with no buffer`,
      metadata: { pairs: backToBack },
    });
  }

  // 3. Focus time fragmentation
  const totalFocusMin = focusBlocks.reduce((sum, b) => {
    return sum + (b.end.getTime() - b.start.getTime()) / 60_000;
  }, 0);

  const totalMeetingMin = meetings.reduce((sum, b) => {
    return sum + (b.end.getTime() - b.start.getTime()) / 60_000;
  }, 0);

  if (totalMeetingMin > totalFocusMin && focusBlocks.length > 0) {
    signals.push({
      id: 'sig-focus-fragmented',
      source: 'calendar-analysis',
      type: 'operational',
      severity: 0.55,
      timestamp: now,
      content: `Focus time fragmented — ${Math.round(totalFocusMin)}min focus vs ${Math.round(totalMeetingMin)}min meetings`,
      metadata: { focusMin: totalFocusMin, meetingMin: totalMeetingMin },
    });
  }

  // 4. No focus blocks detected
  if (focusBlocks.length === 0 && meetings.length > 0) {
    signals.push({
      id: 'sig-no-focus',
      source: 'calendar-analysis',
      type: 'operational',
      severity: 0.8,
      timestamp: now,
      content: 'No dedicated focus time found today',
      metadata: {},
    });
  }

  // 5. Async-convertible meetings
  const asyncCandidates = blocks.filter(
    (b) => b.type === 'meeting' && b.metadata?.canBeAsync
  );
  if (asyncCandidates.length > 0) {
    const totalReclaimable = asyncCandidates.reduce((sum, b) => {
      return sum + (b.end.getTime() - b.start.getTime()) / 60_000;
    }, 0);

    signals.push({
      id: 'sig-async-opportunity',
      source: 'calendar-analysis',
      type: 'operational',
      severity: 0.3,
      timestamp: now,
      content: `${asyncCandidates.length} meeting${asyncCandidates.length > 1 ? 's' : ''} could be async — ${Math.round(totalReclaimable)}min reclaimable`,
      metadata: {
        candidates: asyncCandidates.map((c) => c.id),
        reclaimableMin: totalReclaimable,
      },
    });
  }

  // 6. Long meeting detection (> 1 hour)
  const longMeetings = meetings.filter((m) => {
    const dur = (m.end.getTime() - m.start.getTime()) / 60_000;
    return dur > 60;
  });
  if (longMeetings.length > 0) {
    signals.push({
      id: 'sig-long-meetings',
      source: 'calendar-analysis',
      type: 'operational',
      severity: 0.25,
      timestamp: now,
      content: `${longMeetings.length} meeting${longMeetings.length > 1 ? 's' : ''} over 1 hour`,
      metadata: { meetings: longMeetings.map((m) => m.title) },
    });
  }

  // 7. Afternoon density (post-lunch crunch)
  const afternoonMeetings = meetings.filter((m) => m.start.getHours() >= 13 && m.start.getHours() < 18);
  if (afternoonMeetings.length >= 3) {
    signals.push({
      id: 'sig-afternoon-crunch',
      source: 'calendar-analysis',
      type: 'operational',
      severity: 0.6,
      timestamp: now,
      content: `${afternoonMeetings.length} meetings packed in the afternoon`,
      metadata: { count: afternoonMeetings.length },
    });
  }

  // 8. Upcoming meeting alert (within 15 min)
  const upcoming = blocks.filter((b) => {
    if (b.type !== 'meeting') return false;
    const minutesUntil = (b.start.getTime() - now.getTime()) / 60_000;
    return minutesUntil > 0 && minutesUntil <= 15;
  });
  if (upcoming.length > 0) {
    signals.push({
      id: 'sig-upcoming',
      source: 'calendar-analysis',
      type: 'temporal',
      severity: 0.5,
      timestamp: now,
      content: `"${upcoming[0].title}" starts in ${Math.round((upcoming[0].start.getTime() - now.getTime()) / 60_000)} minutes`,
      metadata: { meetingId: upcoming[0].id },
    });
  }

  // 9. Gaps analysis — find unscheduled gaps that could be focus time
  const gaps = findGaps(blocks);
  if (gaps.length > 0) {
    const totalGapMin = gaps.reduce((s, g) => s + g.duration, 0);
    signals.push({
      id: 'sig-gaps-available',
      source: 'calendar-analysis',
      type: 'operational',
      severity: 0.15,
      timestamp: now,
      content: `${gaps.length} open gap${gaps.length > 1 ? 's' : ''} totaling ${Math.round(totalGapMin)}min available`,
      metadata: { gaps },
    });
  }

  return signals;
}

function calcMeetingHours(meetings: TimeBlock[]): string {
  const totalMin = meetings.reduce((sum, m) => {
    return sum + (m.end.getTime() - m.start.getTime()) / 60_000;
  }, 0);
  return (totalMin / 60).toFixed(1);
}

function detectBackToBack(meetings: TimeBlock[]): Array<{ first: string; second: string }> {
  const sorted = [...meetings].sort((a, b) => a.start.getTime() - b.start.getTime());
  const pairs: Array<{ first: string; second: string }> = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = (sorted[i + 1].start.getTime() - sorted[i].end.getTime()) / 60_000;
    if (gap < 5) {
      pairs.push({ first: sorted[i].title, second: sorted[i + 1].title });
    }
  }

  return pairs;
}

function findGaps(blocks: TimeBlock[]): Array<{ start: Date; end: Date; duration: number }> {
  const now = new Date();
  const workEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
  const sorted = [...blocks]
    .filter((b) => b.end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: Array<{ start: Date; end: Date; duration: number }> = [];
  let cursor = now;

  for (const block of sorted) {
    if (block.start.getTime() > cursor.getTime()) {
      const gapDuration = (block.start.getTime() - cursor.getTime()) / 60_000;
      if (gapDuration >= 15) {
        gaps.push({
          start: new Date(cursor),
          end: new Date(block.start),
          duration: gapDuration,
        });
      }
    }
    if (block.end.getTime() > cursor.getTime()) {
      cursor = block.end;
    }
  }

  // Gap between last event and end of work
  if (cursor.getTime() < workEnd.getTime()) {
    const gapDuration = (workEnd.getTime() - cursor.getTime()) / 60_000;
    if (gapDuration >= 15) {
      gaps.push({
        start: new Date(cursor),
        end: workEnd,
        duration: gapDuration,
      });
    }
  }

  return gaps;
}
