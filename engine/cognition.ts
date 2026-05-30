/**
 * Black Pearl — Cognitive Load Assessor
 *
 * Measures the invisible cost of a fragmented day:
 * context switches, meeting density, signal bombardment.
 *
 * These are the things that make you feel exhausted
 * without knowing why.
 */

import type {
  TimeBlock,
  OperationalSignal,
  InsightConfidence,
  ConfidenceLevel,
} from './types';

export interface CognitiveLoadResult {
  /** 0 = calm day, 1 = cognitive overload */
  overloadRisk: number;
  /** 0 = no switching cost, 1 = constant context thrashing */
  contextSwitchCost: number;
  /** 0 = stable attention, 1 = attention is fractured */
  attentionInstability: number;
  confidence: InsightConfidence;
}

// --- Internal helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the next 4 hours of timeline from now.
 */
function nextFourHoursWindow(
  timeline: TimeBlock[],
  now: Date
): TimeBlock[] {
  const cutoff = new Date(now.getTime() + 4 * 3_600_000);
  return timeline.filter((b) => b.start < cutoff && b.end > now);
}

/**
 * Count context switches: each transition between different block types.
 * A switch from focus → meeting → focus = 2 switches.
 */
function countContextSwitches(blocks: TimeBlock[]): number {
  if (blocks.length <= 1) return 0;

  const sorted = [...blocks].sort(
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
 * Context switch cost: normalized by expected switches in a healthy day.
 * 
 * Research suggests each context switch costs ~23 minutes of recovery.
 * We normalize against a "healthy" baseline of 3-4 switches per 4 hours.
 */
function calculateContextSwitchCost(switches: number): number {
  // 0-2 switches in 4 hours = minimal cost
  // 3-4 = moderate
  // 5+ = high
  // 8+ = extreme
  if (switches <= 2) return switches * 0.1;
  if (switches <= 4) return 0.2 + (switches - 2) * 0.15;
  return clamp(0.5 + (switches - 4) * 0.12, 0.5, 1);
}

/**
 * Meeting density: ratio of meeting time to total window.
 * Dense meetings leave no recovery time.
 */
function calculateMeetingDensity(
  blocks: TimeBlock[],
  windowMinutes: number
): number {
  if (windowMinutes <= 0) return 0;

  const meetingMinutes = blocks
    .filter((b) => b.type === 'meeting')
    .reduce((sum, b) => {
      const dur = (b.end.getTime() - b.start.getTime()) / 60_000;
      return sum + dur;
    }, 0);

  return clamp(meetingMinutes / windowMinutes, 0, 1);
}

/**
 * Signal pressure: volume of signals in the window,
 * weighted by severity.
 */
function calculateSignalPressure(
  signals: OperationalSignal[],
  now: Date
): number {
  const fourHoursAgo = new Date(now.getTime() - 4 * 3_600_000);
  const recent = signals.filter((s) => s.timestamp >= fourHoursAgo);

  if (recent.length === 0) return 0;

  const weightedVolume = recent.reduce((sum, s) => sum + s.severity, 0);

  // Normalize: 5 weighted signals = moderate, 10+ = high
  return clamp(weightedVolume / 10, 0, 1);
}

/**
 * Attention instability: combines meeting density, context switches,
 * and gap analysis. Lots of tiny gaps between blocks = unstable attention.
 */
function calculateAttentionInstability(
  blocks: TimeBlock[],
  contextSwitchCost: number,
  meetingDensity: number
): number {
  const sorted = [...blocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  // Count tiny gaps (< 15 min) between blocks
  let tinyGaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gapMinutes =
      (sorted[i].start.getTime() - sorted[i - 1].end.getTime()) / 60_000;
    if (gapMinutes > 0 && gapMinutes < 15) {
      tinyGaps++;
    }
  }

  const gapInstability = clamp(tinyGaps / 4, 0, 1);

  return clamp(
    contextSwitchCost * 0.4 + meetingDensity * 0.35 + gapInstability * 0.25,
    0,
    1
  );
}

function determineConfidence(
  blocks: TimeBlock[],
  signals: OperationalSignal[]
): InsightConfidence {
  const missing: string[] = [];

  if (blocks.length === 0) {
    missing.push('No timeline data for cognitive assessment');
  }
  if (signals.length === 0) {
    missing.push('No signal data — pressure estimate may be low');
  }

  // Check if we have enough variety in block types
  const types = new Set(blocks.map((b) => b.type));
  if (types.size <= 1 && blocks.length > 0) {
    missing.push('Monotonic timeline — context switch assessment limited');
  }

  let level: ConfidenceLevel;
  let explanation: string;

  if (missing.length === 0) {
    level = 'high';
    explanation = 'Full timeline and signal coverage for cognitive assessment.';
  } else if (missing.length === 1) {
    level = 'medium';
    explanation = 'Partial data — cognitive load estimate has gaps.';
  } else {
    level = 'low';
    explanation = 'Insufficient data for reliable cognitive load assessment.';
  }

  return {
    level,
    explanation,
    ...(missing.length > 0 ? { missingContext: missing } : {}),
  };
}

// --- Main export ---

export function assessCognitiveLoad(
  timeline: TimeBlock[],
  signals: OperationalSignal[]
): CognitiveLoadResult {
  const now = new Date();
  const upcomingBlocks = nextFourHoursWindow(timeline, now);
  const windowMinutes = Math.min(
    240,
    upcomingBlocks.length > 0
      ? (upcomingBlocks[upcomingBlocks.length - 1].end.getTime() -
          upcomingBlocks[0].start.getTime()) /
          60_000
      : 240
  );

  const switches = countContextSwitches(upcomingBlocks);
  const contextSwitchCost = calculateContextSwitchCost(switches);
  const meetingDensity = calculateMeetingDensity(upcomingBlocks, windowMinutes);
  const signalPressure = calculateSignalPressure(signals, now);
  const attentionInstability = calculateAttentionInstability(
    upcomingBlocks,
    contextSwitchCost,
    meetingDensity
  );

  // Overload risk: weighted composite
  const overloadRisk = clamp(
    contextSwitchCost * 0.3 +
      meetingDensity * 0.3 +
      signalPressure * 0.2 +
      attentionInstability * 0.2,
    0,
    1
  );

  const confidence = determineConfidence(upcomingBlocks, signals);

  return {
    overloadRisk,
    contextSwitchCost,
    attentionInstability,
    confidence,
  };
}
