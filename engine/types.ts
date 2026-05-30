/**
 * Black Pearl — Shared Engine Types
 *
 * The foundational type system for operational cognition.
 * Every insight carries confidence. Every intervention carries reasoning.
 */

// --- Confidence ---

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface InsightConfidence {
  level: ConfidenceLevel;
  explanation: string;
  missingContext?: string[];
}

// --- Timeline ---

export type TimeBlockType = 'focus' | 'meeting' | 'buffer' | 'break';

export interface TimeBlock {
  id: string;
  start: Date;
  end: Date;
  type: TimeBlockType;
  title: string;
  source: string;
  metadata?: Record<string, unknown>;
}

// --- Signals ---

export interface OperationalSignal {
  id: string;
  source: string;
  type: string;
  /** 0 = ambient noise, 1 = critical escalation */
  severity: number;
  timestamp: Date;
  content: string;
  metadata?: Record<string, unknown>;
}

// --- Reasoning ---

export interface ReasoningNode {
  source: string;
  icon: string;
  label: string;
  detail: string;
}

// --- Interventions ---

export type InterventionType =
  | 'convert-async'
  | 'defer'
  | 'protect-focus'
  | 'escalate'
  | 'notify';

export interface Intervention {
  id: string;
  type: InterventionType;
  title: string;
  /** The ID of the TimeBlock this intervention targets (e.g., a meeting to convert) */
  targetBlockId?: string;
  description: string;
  confidence: InsightConfidence;
  /** 0 = negligible impact, 1 = transforms the day */
  leverage: number;
  action: string;
  synthesisReasoning: {
    calendar?: string;
    slack?: string;
    github?: string;
    interpretation: string;
  };
  metadata?: Record<string, any>;
}

// --- Operational State ---

export interface OperationalState {
  headline: string;
  subheadline: string;
  /** 0 = day is lost, 1 = day is protected */
  survivability: number;
  confidence: InsightConfidence;
  interventions: Intervention[];
  timeline: TimeBlock[];
  /** 0 = solid blocks, 1 = completely fragmented */
  fragmentationRisk: number;
  /** Structured narrative for components */
  narrative?: {
    headline: string;
    subheadline: string;
    confidence: InsightConfidence;
  };
}
