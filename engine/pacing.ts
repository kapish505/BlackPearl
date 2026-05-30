/**
 * Black Pearl — Intervention Pacer
 *
 * Black Pearl is patient. It speaks rarely.
 * When it does, it matters.
 *
 * This module enforces restraint: rate limits, quiet hours,
 * confidence gates. The opposite of notification spam.
 */

import type { Intervention } from './types';

export interface PacerConfig {
  maxInterventionsPerHour: number;
  minConfidenceThreshold: number;
  quietHours: { start: number; end: number };
}

const DEFAULT_CONFIG: PacerConfig = {
  maxInterventionsPerHour: 2,
  minConfidenceThreshold: 0.4,
  quietHours: { start: 22, end: 7 },
};

/**
 * Maps confidence level to a numeric value for threshold comparison.
 */
function confidenceToNumeric(level: 'high' | 'medium' | 'low'): number {
  switch (level) {
    case 'high':
      return 1.0;
    case 'medium':
      return 0.6;
    case 'low':
      return 0.3;
  }
}

export class InterventionPacer {
  private config: PacerConfig;
  private interventionLog: Date[] = [];

  constructor(config?: Partial<PacerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Can we intervene right now?
   * Checks rate limits and quiet hours.
   */
  canIntervene(now?: Date): boolean {
    const current = now ?? new Date();

    if (this.isQuietHours(current)) {
      return false;
    }

    return this.recentInterventionCount(current) < this.config.maxInterventionsPerHour;
  }

  /**
   * Record that an intervention was delivered.
   * Call this after actually showing an intervention to the user.
   */
  recordIntervention(timestamp?: Date): void {
    this.interventionLog.push(timestamp ?? new Date());
    this.pruneOldEntries();
  }

  /**
   * Is it quiet hours? Black Pearl rests too.
   * Quiet hours span overnight: e.g., 22:00 → 07:00.
   */
  isQuietHours(now?: Date): boolean {
    const current = now ?? new Date();
    const hour = current.getHours();
    const { start, end } = this.config.quietHours;

    if (start > end) {
      // Overnight span: 22 → 7 means quiet when hour >= 22 OR hour < 7
      return hour >= start || hour < end;
    }
    // Same-day span (unusual but supported): e.g., 12 → 14
    return hour >= start && hour < end;
  }

  /**
   * Should this specific intervention be suppressed?
   *
   * Reasons to suppress:
   * - Quiet hours
   * - Rate limit exceeded
   * - Confidence below threshold
   * - Low leverage during high-volume periods
   */
  shouldSuppress(intervention: Intervention, now?: Date): boolean {
    const current = now ?? new Date();

    // Quiet hours: suppress everything except escalations
    if (this.isQuietHours(current)) {
      // Only escalations break through quiet hours — and only if high severity
      if (intervention.type === 'escalate' && intervention.leverage > 0.8) {
        return false;
      }
      return true;
    }

    // Rate limit: too many recent interventions
    if (!this.canIntervene(current)) {
      // Escalations can still break through rate limits
      if (intervention.type === 'escalate' && intervention.leverage > 0.7) {
        return false;
      }
      return true;
    }

    // Confidence gate
    const numericConfidence = confidenceToNumeric(intervention.confidence.level);
    if (numericConfidence < this.config.minConfidenceThreshold) {
      return true;
    }

    // Low-leverage interventions during busy periods
    if (intervention.leverage < 0.2) {
      const recentCount = this.recentInterventionCount(current);
      if (recentCount >= 1) {
        // Already showed something this hour — skip the trivial stuff
        return true;
      }
    }

    return false;
  }

  /**
   * Get the current pacer state for debugging/transparency.
   */
  getState(now?: Date): {
    recentCount: number;
    canIntervene: boolean;
    isQuietHours: boolean;
    nextAvailableSlot: Date | null;
  } {
    const current = now ?? new Date();
    const recentCount = this.recentInterventionCount(current);
    const quiet = this.isQuietHours(current);
    const available = this.canIntervene(current);

    let nextAvailableSlot: Date | null = null;
    if (!available && !quiet) {
      // Find when the oldest intervention in the window will expire
      const oneHourAgo = new Date(current.getTime() - 3_600_000);
      const recentEntries = this.interventionLog
        .filter((t) => t >= oneHourAgo)
        .sort((a, b) => a.getTime() - b.getTime());

      if (recentEntries.length > 0) {
        nextAvailableSlot = new Date(
          recentEntries[0].getTime() + 3_600_000
        );
      }
    }

    return {
      recentCount,
      canIntervene: available,
      isQuietHours: quiet,
      nextAvailableSlot,
    };
  }

  // --- Private ---

  private recentInterventionCount(now: Date): number {
    const oneHourAgo = new Date(now.getTime() - 3_600_000);
    return this.interventionLog.filter((t) => t >= oneHourAgo).length;
  }

  private pruneOldEntries(): void {
    const cutoff = new Date(Date.now() - 24 * 3_600_000);
    this.interventionLog = this.interventionLog.filter((t) => t >= cutoff);
  }
}
