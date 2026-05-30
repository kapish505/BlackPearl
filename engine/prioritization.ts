/**
 * Black Pearl — Prioritization Engine
 *
 * Selects the interventions that matter most.
 * At most 3. Never more. Restraint is the point.
 *
 * Low confidence interventions are deprioritized, not hidden.
 */

import type { TimeBlock, OperationalSignal, Intervention } from './types';

const MAX_INTERVENTIONS = 3;

// --- Internal helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Confidence multiplier: maps confidence level to a priority weight.
 * Low confidence doesn't eliminate — it reduces.
 */
function confidenceMultiplier(level: 'high' | 'medium' | 'low'): number {
  switch (level) {
    case 'high':
      return 1.0;
    case 'medium':
      return 0.7;
    case 'low':
      return 0.4;
  }
}

/**
 * Urgency bonus: interventions of type 'escalate' or 'protect-focus'
 * get a slight bump because they're time-sensitive.
 */
function urgencyBonus(type: Intervention['type']): number {
  switch (type) {
    case 'escalate':
      return 0.15;
    case 'protect-focus':
      return 0.10;
    case 'convert-async':
      return 0.05;
    case 'defer':
      return 0.0;
    case 'notify':
      return 0.0;
  }
}

/**
 * Timeline pressure: if the timeline is dense with meetings
 * in the next 2 hours, protect-focus interventions matter more.
 */
function timelinePressure(timeline: TimeBlock[]): number {
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 3_600_000);

  const upcomingMeetings = timeline.filter(
    (b) => b.type === 'meeting' && b.start >= now && b.start <= twoHoursLater
  );

  // 0 meetings = no pressure, 3+ = maximum pressure
  return clamp(upcomingMeetings.length / 3, 0, 1);
}

/**
 * Signal volume factor: many active signals increase the value
 * of consolidation-type interventions (convert-async, defer).
 */
function signalVolumeFactor(signals: OperationalSignal[]): number {
  const now = new Date();
  const recentSignals = signals.filter(
    (s) => now.getTime() - s.timestamp.getTime() < 4 * 3_600_000
  );
  return clamp(recentSignals.length / 10, 0, 1);
}

/**
 * Compute the composite priority score for an intervention.
 */
function priorityScore(
  intervention: Intervention,
  pressure: number,
  volume: number
): number {
  const base = intervention.leverage;
  const conf = confidenceMultiplier(intervention.confidence.level);
  const urgency = urgencyBonus(intervention.type);

  // Context-sensitive adjustments
  let contextBoost = 0;
  if (intervention.type === 'protect-focus' && pressure > 0.5) {
    contextBoost = 0.1;
  }
  if (
    (intervention.type === 'convert-async' || intervention.type === 'defer') &&
    volume > 0.5
  ) {
    contextBoost = 0.08;
  }

  return clamp((base + urgency + contextBoost) * conf, 0, 1);
}

// --- Main export ---

export function calculatePrioritization(
  timeline: TimeBlock[],
  signals: OperationalSignal[],
  interventions: Intervention[]
): Intervention[] {
  if (interventions.length === 0) return [];

  const pressure = timelinePressure(timeline);
  const volume = signalVolumeFactor(signals);

  // Score and sort
  const scored = interventions
    .map((intervention) => ({
      intervention,
      score: priorityScore(intervention, pressure, volume),
    }))
    .sort((a, b) => b.score - a.score);

  // Take the top interventions, respecting the cap
  const selected = scored.slice(0, MAX_INTERVENTIONS).map((s) => s.intervention);

  // Mark deprioritized interventions in reasoning (non-destructive)
  // The caller retains the full list; we only return the actionable subset
  return selected;
}
