/**
 * Black Pearl — Survivability Engine
 *
 * Calculates the probability that today's focus blocks will survive
 * the pressure of meetings, signals, and context switches.
 *
 * A calm assessment. Never alarmist.
 */

import type {
  TimeBlock,
  OperationalSignal,
  InsightConfidence,
  ConfidenceLevel,
} from './types';

export interface SurvivabilityResult {
  /** 0 = day is lost, 1 = day is fully protected */
  score: number;
  confidence: InsightConfidence;
  /** 0 = solid blocks, 1 = completely shattered */
  fragmentationRisk: number;
  /** IDs of focus blocks likely to fail */
  unstableBlocks: string[];
}

// --- Internal helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function minutesBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 60_000;
}

function durationMinutes(block: TimeBlock): number {
  return (block.end.getTime() - block.start.getTime()) / 60_000;
}

/**
 * A focus block is "unstable" when:
 *  - It's shorter than 25 minutes (already fragmented)
 *  - A meeting starts within 15 minutes of its start
 *  - There's a high-severity signal within its window
 */
function assessBlockStability(
  block: TimeBlock,
  meetings: TimeBlock[],
  signals: OperationalSignal[]
): { stable: boolean; instabilityFactors: string[] } {
  const factors: string[] = [];
  const dur = durationMinutes(block);

  // Short blocks are inherently fragile
  if (dur < 25) {
    factors.push(`Duration ${Math.round(dur)}min < 25min threshold`);
  }

  // Meeting proximity threat
  for (const meeting of meetings) {
    const gap = minutesBetween(block.start, meeting.start);
    if (gap <= 15 && meeting.start >= block.start) {
      factors.push(`Meeting "${meeting.title}" starts within ${Math.round(gap)}min`);
    }
    // Meeting ending right before focus = context switch cost
    if (
      meeting.end <= block.start &&
      minutesBetween(meeting.end, block.start) < 10
    ) {
      factors.push(`Meeting "${meeting.title}" ends ${Math.round(minutesBetween(meeting.end, block.start))}min before focus`);
    }
  }

  // Signal pressure during block window
  const blockSignals = signals.filter(
    (s) => s.timestamp >= block.start && s.timestamp <= block.end && s.severity > 0.6
  );
  if (blockSignals.length > 0) {
    factors.push(`${blockSignals.length} high-severity signal(s) during block`);
  }

  return { stable: factors.length === 0, instabilityFactors: factors };
}

/**
 * Count context switches: transitions between different block types
 * in sequence. Each switch costs cognitive capacity.
 */
function countContextSwitches(timeline: TimeBlock[]): number {
  if (timeline.length <= 1) return 0;

  const sorted = [...timeline].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  let switches = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].type !== sorted[i - 1].type) {
      switches++;
    }
  }
  return switches;
}

/**
 * Fragmentation risk: ratio of tiny gaps and short blocks
 * to total scheduled time.
 */
function calculateFragmentationRisk(
  focusBlocks: TimeBlock[],
  meetings: TimeBlock[],
  contextSwitches: number
): number {
  if (focusBlocks.length === 0) return 1;

  const totalFocusMinutes = focusBlocks.reduce(
    (sum, b) => sum + durationMinutes(b),
    0
  );
  const shortBlocks = focusBlocks.filter((b) => durationMinutes(b) < 25);
  const shortRatio = shortBlocks.length / focusBlocks.length;

  // Context switch density: switches per hour of focus
  const focusHours = totalFocusMinutes / 60 || 1;
  const switchDensity = clamp(contextSwitches / focusHours / 4, 0, 1);

  // Meeting sandwiching: focus blocks between meetings
  const sandwichedBlocks = focusBlocks.filter((focus) => {
    const meetingBefore = meetings.some(
      (m) => m.end <= focus.start && minutesBetween(m.end, focus.start) < 15
    );
    const meetingAfter = meetings.some(
      (m) => m.start >= focus.end && minutesBetween(focus.end, m.start) < 15
    );
    return meetingBefore && meetingAfter;
  });
  const sandwichRatio =
    focusBlocks.length > 0 ? sandwichedBlocks.length / focusBlocks.length : 0;

  return clamp(shortRatio * 0.4 + switchDensity * 0.35 + sandwichRatio * 0.25, 0, 1);
}

function determineConfidence(
  timeline: TimeBlock[],
  signals: OperationalSignal[]
): InsightConfidence {
  const missing: string[] = [];

  if (timeline.length === 0) {
    missing.push('No calendar data available');
  }
  if (signals.length === 0) {
    missing.push('No operational signals available');
  }

  const focusBlocks = timeline.filter((b) => b.type === 'focus');
  if (focusBlocks.length === 0 && timeline.length > 0) {
    missing.push('No focus blocks detected in timeline');
  }

  let level: ConfidenceLevel;
  let explanation: string;

  if (missing.length >= 2) {
    level = 'low';
    explanation = 'Limited data — survivability is an estimate at best.';
  } else if (missing.length === 1) {
    level = 'medium';
    explanation = 'Partial picture — some inputs are missing.';
  } else {
    level = 'high';
    explanation = 'Full timeline and signal data available.';
  }

  return {
    level,
    explanation,
    ...(missing.length > 0 ? { missingContext: missing } : {}),
  };
}

// --- Main export ---

export function calculateSurvivability(
  timeline: TimeBlock[],
  signals: OperationalSignal[]
): SurvivabilityResult {
  const focusBlocks = timeline.filter((b) => b.type === 'focus');
  const meetings = timeline.filter((b) => b.type === 'meeting');
  const confidence = determineConfidence(timeline, signals);

  // Edge case: no focus blocks
  if (focusBlocks.length === 0) {
    return {
      score: 0,
      confidence: {
        level: 'low',
        explanation: 'No focus blocks found — nothing to protect.',
        missingContext: ['No focus blocks in timeline'],
      },
      fragmentationRisk: timeline.length > 0 ? 1 : 0,
      unstableBlocks: [],
    };
  }

  const contextSwitches = countContextSwitches(timeline);
  const unstableBlocks: string[] = [];
  let stabilitySum = 0;

  for (const block of focusBlocks) {
    const { stable } = assessBlockStability(block, meetings, signals);
    if (!stable) {
      unstableBlocks.push(block.id);
      stabilitySum += 0;
    } else {
      stabilitySum += 1;
    }
  }

  const baseScore = stabilitySum / focusBlocks.length;

  // Signal pressure penalty: high-severity recent signals erode survivability
  const recentHighSignals = signals.filter((s) => s.severity > 0.7);
  const signalPenalty = clamp(recentHighSignals.length * 0.08, 0, 0.3);

  // Context switch penalty
  const switchPenalty = clamp(contextSwitches * 0.04, 0, 0.25);

  const score = clamp(baseScore - signalPenalty - switchPenalty, 0, 1);
  const fragmentationRisk = calculateFragmentationRisk(
    focusBlocks,
    meetings,
    contextSwitches
  );

  return {
    score,
    confidence,
    fragmentationRisk,
    unstableBlocks,
  };
}
