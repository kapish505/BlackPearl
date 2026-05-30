/**
 * Black Pearl — Narrative Compression Engine
 *
 * Translates raw numbers into calm, grounded language.
 * This is the voice of Black Pearl.
 *
 * Rules:
 * - NEVER be verbose
 * - NEVER use AI-sounding language
 * - Be interpretive, not descriptive
 * - Sound like a trusted advisor who speaks in few words
 */

import type { InsightConfidence, ConfidenceLevel } from './types';

export interface NarrativeInput {
  survivability: number;
  fragmentationRisk: number;
  overloadRisk: number;
  escalations: { severity: number; description: string }[];
  interventionCount: number;
}

export interface NarrativeOutput {
  headline: string;
  subheadline: string;
  confidence: InsightConfidence;
}

// --- Headline pools ---

const HEADLINES_HIGH: string[] = [
  'Today is manageable.',
  'Focus window protected.',
  'Afternoon looks stable.',
  'Clear path ahead.',
  'Your day has room.',
];

const HEADLINES_MEDIUM: string[] = [
  'Your afternoon is unstable.',
  'Today is recoverable.',
  'Some fragmentation ahead.',
  'Day needs a small adjustment.',
  'A few things to watch.',
];

const HEADLINES_LOW: string[] = [
  'Today is fragmented.',
  'Focus unlikely without intervention.',
  'Operational overload risk.',
  'Day is under pressure.',
  'Not much deep work space today.',
];

// --- Subheadline generators ---

function buildSubheadline(state: NarrativeInput): string {
  const parts: string[] = [];

  // Fragmentation context
  if (state.fragmentationRisk > 0.7) {
    parts.push('High fragmentation across blocks');
  } else if (state.fragmentationRisk > 0.4) {
    parts.push('Moderate fragmentation');
  }

  // Escalation context
  if (state.escalations.length > 0) {
    const topEscalation = state.escalations.reduce((a, b) =>
      a.severity > b.severity ? a : b
    );
    if (topEscalation.severity > 0.7) {
      parts.push('Active escalation needs attention');
    } else {
      parts.push(`${state.escalations.length} topic${state.escalations.length > 1 ? 's' : ''} building across sources`);
    }
  }

  // Overload context
  if (state.overloadRisk > 0.7) {
    parts.push('Cognitive load is high');
  } else if (state.overloadRisk > 0.5) {
    parts.push('Attention may be stretched');
  }

  // Intervention context
  if (state.interventionCount > 0) {
    parts.push(
      `${state.interventionCount} thing${state.interventionCount > 1 ? 's' : ''} you can do`
    );
  }

  if (parts.length === 0) {
    // Calm day, nothing to call out
    if (state.survivability > 0.7) {
      return 'No action needed right now.';
    }
    return 'Watching for changes.';
  }

  // Take the two most relevant parts, join with em-dash
  return parts.slice(0, 2).join(' — ') + '.';
}

/**
 * Select a headline deterministically based on the survivability score.
 * Uses the fractional part of the score to index into the pool,
 * so the same state produces the same headline.
 */
function selectHeadline(pool: string[], seed: number): string {
  // Use the seed to pick deterministically
  const index = Math.abs(Math.round(seed * 100)) % pool.length;
  return pool[index];
}

function determineConfidence(state: NarrativeInput): InsightConfidence {
  const missing: string[] = [];

  // If survivability is exactly 0, we may be missing data
  if (state.survivability === 0 && state.interventionCount === 0) {
    missing.push('No survivability data — narrative is approximate');
  }

  // Determine narrative confidence from input data richness
  const hasFragmentation = state.fragmentationRisk > 0;
  const hasOverload = state.overloadRisk > 0;
  const hasEscalations = state.escalations.length > 0;
  const dataPoints = [hasFragmentation, hasOverload, hasEscalations].filter(
    Boolean
  ).length;

  let level: ConfidenceLevel;
  let explanation: string;

  if (dataPoints >= 2) {
    level = 'high';
    explanation = 'Multiple data sources inform this narrative.';
  } else if (dataPoints === 1) {
    level = 'medium';
    explanation = 'Narrative based on partial operational picture.';
  } else {
    level = 'low';
    explanation = 'Limited data — narrative is a rough sketch.';
    missing.push('More signals needed for accurate narrative');
  }

  return {
    level,
    explanation,
    ...(missing.length > 0 ? { missingContext: missing } : {}),
  };
}

// --- Main export ---

export function compressNarrative(state: NarrativeInput): NarrativeOutput {
  let pool: string[];
  let seed: number;

  if (state.survivability > 0.7) {
    pool = HEADLINES_HIGH;
    seed = state.survivability + state.fragmentationRisk;
  } else if (state.survivability >= 0.4) {
    pool = HEADLINES_MEDIUM;
    seed = state.survivability + state.overloadRisk;
  } else {
    pool = HEADLINES_LOW;
    seed = state.survivability + state.escalations.length * 0.1;
  }

  const headline = selectHeadline(pool, seed);
  const subheadline = buildSubheadline(state);
  const confidence = determineConfidence(state);

  return {
    headline,
    subheadline,
    confidence,
  };
}
