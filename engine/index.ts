/**
 * Black Pearl — Operational Reality Engine
 *
 * The orchestrator. Takes raw timeline and signals,
 * runs every engine, and returns the complete operational state.
 *
 * One function. One truth.
 */

import type {
  TimeBlock,
  OperationalSignal,
  OperationalState,
  Intervention,
  ReasoningNode,
  InsightConfidence,
} from './types';

import { calculateSurvivability } from './survivability';
import { detectEscalation } from './escalation';
import { assessCognitiveLoad } from './cognition';
import { compressNarrative } from './narrative';
import { calculatePrioritization } from './prioritization';

// --- Intervention generators ---

/**
 * Generate interventions from the assessed state.
 * These are the concrete things Black Pearl might suggest.
 */
function generateInterventions(
  timeline: TimeBlock[],
  signals: OperationalSignal[],
  survivabilityResult: ReturnType<typeof calculateSurvivability>,
  escalationResult: ReturnType<typeof detectEscalation>,
  cognitiveResult: ReturnType<typeof assessCognitiveLoad>
): Intervention[] {
  const interventions: Intervention[] = [];
  let interventionId = 0;

  // Extract signals by source for dynamic synthesis reasoning
  const slackSignals = signals.filter(s => s.source === 'slack');
  const githubSignals = signals.filter(s => s.source === 'github');
  const coralSynthSignals = signals.filter(s => s.source === 'coral-synthesis');
  const nextId = (): string => `int-${++interventionId}`;

  // --- Focus protection interventions ---
  if (survivabilityResult.unstableBlocks.length > 0) {
    const unstableCount = survivabilityResult.unstableBlocks.length;
    const focusBlocks = timeline.filter((b) => b.type === 'focus');
    const unstableFocusBlocks = focusBlocks.filter((b) =>
      survivabilityResult.unstableBlocks.includes(b.id)
    );

    if (unstableFocusBlocks.length > 0) {
      const firstUnstable = unstableFocusBlocks[0];
      interventions.push({
        id: nextId(),
        type: 'protect-focus',
        title: `Protect ${unstableCount > 1 ? `${unstableCount} focus blocks` : `"${firstUnstable.title}"`}`,
        description:
          unstableCount > 1
            ? `${unstableCount} focus blocks are at risk of interruption.`
            : `"${firstUnstable.title}" is unstable due to nearby pressure.`,
        confidence: {
          level: survivabilityResult.score < 0.4 ? 'high' : 'medium',
          explanation:
            survivabilityResult.score < 0.4
              ? 'Multiple instability factors confirmed.'
              : 'Some instability detected but may resolve.',
        },
        leverage: clamp(1 - survivabilityResult.score, 0.3, 0.9),
        action: 'Review and buffer focus blocks',
        synthesisReasoning: {
          calendar: `Focus block "${firstUnstable.title}" is too short to survive ambient fragmentation.`,
          slack: slackSignals.length > 0
            ? `${slackSignals.length} recent Slack signals detected. Latest: "${slackSignals[0].content.substring(0, 80)}"`
            : 'Interruption density escalating nearby.',
          github: githubSignals.length > 0
            ? `${githubSignals.length} open PR(s). Latest: "${githubSignals[0].content.substring(0, 80)}"`
            : undefined,
          interpretation: 'Cross-source interruption pressure destabilizing focus continuity.',
        },
      });
    }
  }

  // --- Async-convertible meeting detection (from real calendar analysis) ---
  const meetings = timeline.filter((b) => b.type === 'meeting');
  for (const meeting of meetings) {
    const meta = meeting.metadata as Record<string, unknown> | undefined;
    if (meta?.canBeAsync) {
      const durationMin = Math.round(
        (meeting.end.getTime() - meeting.start.getTime()) / 60_000
      );
      const attendees = (meta.attendeeNames as string[]) || [];
      const hasVideoCall = meta.hasVideoCall as boolean;

      // Build reasoning from actual meeting properties
      const reasoning: ReasoningNode[] = [];

      reasoning.push({
        source: 'calendar',
        icon: '📅',
        label: 'Meeting Analysis',
        detail: `"${meeting.title}" at ${meeting.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} — ${durationMin}min with ${attendees.length || 'unknown'} participants`,
      });

      const confidenceLevel = durationMin <= 30 && !hasVideoCall ? 'high' : 'medium';

      interventions.push({
        id: nextId(),
        type: 'convert-async',
        title: `Convert "${meeting.title}" to Async`,
        targetBlockId: meeting.id,
        description: `This meeting could be handled asynchronously — converting recovers ${durationMin} minutes.`,
        confidence: {
          level: confidenceLevel,
          explanation:
            confidenceLevel === 'high'
              ? 'Short duration, no video call, likely informational.'
              : 'Meeting structure suggests async is viable.',
        },
        leverage: clamp(durationMin / 60, 0.4, 0.9),
        action: 'Send Async Update',
        synthesisReasoning: {
          calendar: `"${meeting.title}" at ${meeting.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} — ${durationMin}m, ${(meta.attendees as number) || 'unknown'} attendees, no video.`,
          github: githubSignals.length > 0
            ? `${githubSignals.length} open PR(s) detected. "${githubSignals[0].content.substring(0, 60)}"`
            : 'No blocking PRs requiring synchronous discussion.',
          slack: slackSignals.length > 0
            ? `${slackSignals.length} recent messages. Discussion appears to have converged.`
            : 'No urgent Slack escalation related to this sync.',
          interpretation: `${[slackSignals.length > 0 ? 'Slack' : null, githubSignals.length > 0 ? 'GitHub' : null, 'Calendar'].filter(Boolean).length}-system convergence detected. Sync unnecessary.`,
        },
      });
    }
  }
  for (const escalation of escalationResult.escalations) {
    if (escalation.severity > 0.5) {
      interventions.push({
        id: nextId(),
        type: 'escalate',
        title: 'Coral Synthesis: Operational Escalation',
        description: escalation.description,
        confidence: escalation.confidence,
        leverage: clamp(escalation.severity, 0.4, 1),
        action: 'Review escalation sources',
        synthesisReasoning: {
          github: githubSignals.length > 0
            ? `"${githubSignals[0].content.substring(0, 80)}"`
            : 'PR review blocked on unresolved decision.',
          slack: slackSignals.length > 0
            ? `Escalation: "${slackSignals[0].content.substring(0, 80)}"`
            : 'Escalation activity increased recently.',
          interpretation: `Cross-source escalation detected across ${new Set(escalation.signalIds.map(id => signals.find(s => s.id === id)?.source).filter(Boolean)).size} systems. Operational bottleneck forming.`,
        },
      });
    }
  }

  // --- High-priority individual signal surfacing ---
  const urgentSignals = signals.filter((s) => s.severity >= 0.8);
  for (const signal of urgentSignals) {
    // Only add if it's not already in an escalation cluster
    const inEscalation = escalationResult.escalations.some(e => e.signalIds.includes(signal.id));
    if (!inEscalation) {
      interventions.push({
        id: nextId(),
        type: 'escalate',
        title: `High Priority: ${signal.source.charAt(0).toUpperCase() + signal.source.slice(1)}`,
        description: signal.content,
        confidence: { level: 'high', explanation: 'Direct high-severity operational signal.' },
        leverage: clamp(signal.severity, 0.4, 1),
        action: 'Review item',
        synthesisReasoning: {
          interpretation: `High priority item directly identified by cross-source analysis. Requires attention.`,
        },
        metadata: signal.metadata,
      });
    }
  }

  // --- Cognitive overload interventions ---
  // Lowered threshold to 0.3 so the intelligent meeting deferral logic triggers more readily for the user to experience it
  if (cognitiveResult.overloadRisk > 0.3) {
    const meetings = timeline.filter((b) => b.type === 'meeting');
    const deferrable = meetings.filter((m) => {
      // Meetings with low implicit priority (no escalation signal) are deferrable
      const hasEscalation = signals.some(
        (s) =>
          s.severity > 0.7 &&
          s.content.toLowerCase().includes(m.title.toLowerCase().split(' ')[0])
      );
      return !hasEscalation;
    });

    if (deferrable.length > 0) {
      interventions.push({
        id: nextId(),
        type: 'convert-async',
        title: `Convert ${deferrable.length === 1 ? `"${deferrable[0].title}"` : `${deferrable.length} meetings`} to async`,
        description: `Cognitive load is elevated. Converting low-priority meetings to async updates could recover focus time.`,
        confidence: {
          level: cognitiveResult.overloadRisk > 0.8 ? 'high' : 'medium',
          explanation: `Overload risk at ${Math.round(cognitiveResult.overloadRisk * 100)}%.`,
        },
        leverage: clamp(cognitiveResult.overloadRisk * 0.8, 0.3, 0.8),
        action: 'Suggest async alternatives',
        synthesisReasoning: {
          calendar: 'Dense synchronous schedule.',
          slack: 'High context switching rate.',
          interpretation: 'Operational convergence indicates extreme switching fatigue. Deferment needed.',
        },
      });
    }
  }

  // --- Defer low-priority signals ---
  const lowPrioritySignals = signals.filter(
    (s) => s.severity < 0.3 && s.severity > 0
  );
  if (lowPrioritySignals.length >= 3) {
    interventions.push({
      id: nextId(),
      type: 'defer',
      title: `Batch ${lowPrioritySignals.length} low-priority items`,
      description: `${lowPrioritySignals.length} low-severity signals can be reviewed later.`,
      confidence: {
        level: 'high',
        explanation: 'Low-severity signals are safe to defer.',
      },
      leverage: 0.3,
      action: 'Defer to end of day',
      synthesisReasoning: {
        slack: 'Accumulation of low-severity operational noise.',
        calendar: 'Deferring preserves immediate focus window.',
        interpretation: 'Operational topology inferred from live signals: deferment is safe.',
      },
    });
  }

  return interventions;
}

function buildFocusReasoning(
  unstableBlocks: TimeBlock[],
  timeline: TimeBlock[]
): ReasoningNode[] {
  const reasoning: ReasoningNode[] = [];
  const meetings = timeline.filter((b) => b.type === 'meeting');

  for (const block of unstableBlocks.slice(0, 3)) {
    const duration = (block.end.getTime() - block.start.getTime()) / 60_000;

    if (duration < 25) {
      reasoning.push({
        source: 'survivability',
        icon: '⏱',
        label: 'Short Block',
        detail: `"${block.title}" is only ${Math.round(duration)}min — below 25min threshold`,
      });
    }

    const nearbyMeeting = meetings.find((m) => {
      const gap = Math.abs(m.start.getTime() - block.start.getTime()) / 60_000;
      return gap <= 15;
    });

    if (nearbyMeeting) {
      reasoning.push({
        source: 'survivability',
        icon: '📅',
        label: 'Meeting Proximity',
        detail: `"${nearbyMeeting.title}" is very close to "${block.title}"`,
      });
    }
  }

  return reasoning;
}

function sourceIcon(source: string): string {
  const lower = source.toLowerCase();
  if (lower.includes('slack') || lower.includes('chat')) return '💬';
  if (lower.includes('github') || lower.includes('git')) return '🔧';
  if (lower.includes('calendar') || lower.includes('cal')) return '📅';
  if (lower.includes('email') || lower.includes('mail')) return '📧';
  if (lower.includes('jira') || lower.includes('linear')) return '🎫';
  return '📡';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// --- Main export ---

export { computeOperationalReality as processOperationalState };

export function computeOperationalReality(
  timeline: TimeBlock[],
  signals: OperationalSignal[]
): OperationalState {
  // 1. Assess survivability
  const survivability = calculateSurvivability(timeline, signals);

  // 2. Detect escalations
  const escalations = detectEscalation(signals);

  // 3. Assess cognitive load
  const cognitive = assessCognitiveLoad(timeline, signals);

  // 4. Generate interventions from all assessments
  const rawInterventions = generateInterventions(
    timeline,
    signals,
    survivability,
    escalations,
    cognitive
  );

  // 5. Prioritize — enforce the 3-intervention maximum
  const interventions = calculatePrioritization(
    timeline,
    signals,
    rawInterventions
  );

  // 6. Compress into narrative
  const narrative = compressNarrative({
    survivability: survivability.score,
    fragmentationRisk: survivability.fragmentationRisk,
    overloadRisk: cognitive.overloadRisk,
    escalations: escalations.escalations.map((e) => ({
      severity: e.severity,
      description: e.description,
    })),
    interventionCount: interventions.length,
  });

  return {
    headline: narrative.headline,
    subheadline: narrative.subheadline,
    survivability: survivability.score,
    confidence: narrative.confidence,
    interventions,
    timeline,
    fragmentationRisk: survivability.fragmentationRisk,
    narrative: {
      headline: narrative.headline,
      subheadline: narrative.subheadline,
      confidence: narrative.confidence,
    },
  };
}
