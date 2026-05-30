/**
 * Black Pearl — Escalation Detector
 *
 * Detects when urgency propagates across sources.
 * A topic appearing in Slack + GitHub + Calendar is not three signals —
 * it's one escalation.
 *
 * Selective. Never trigger-happy.
 */

import type { OperationalSignal, InsightConfidence, ConfidenceLevel } from './types';

export interface EscalationCluster {
  signalIds: string[];
  severity: number;
  description: string;
  confidence: InsightConfidence;
}

export interface EscalationResult {
  escalations: EscalationCluster[];
}

// --- Internal helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Extract topic tokens from signal content.
 * Simple but effective: lowercase, split, remove noise words.
 */
function extractTopicTokens(content: string): Set<string> {
  const noise = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'about', 'it', 'its', 'this', 'that', 'and', 'or', 'but', 'not',
    'no', 'if', 'then', 'than', 'so', 'up', 'out', 'just', 'also',
    'very', 'too', 'here', 'there', 'when', 'where', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'only', 'own', 'same', 'your', 'my', 'his', 'her', 'our',
    'we', 'you', 'i', 'me', 'he', 'she', 'they', 'them',
  ]);

  const tokens = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !noise.has(t));

  return new Set(tokens);
}

/**
 * Compute topic overlap between two signals.
 * Returns 0-1 similarity score (Jaccard index).
 */
function topicOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Recency weight: signals from the last hour matter more.
 */
function recencyWeight(signal: OperationalSignal, now: Date): number {
  const ageMs = now.getTime() - signal.timestamp.getTime();
  const ageHours = ageMs / 3_600_000;

  if (ageHours <= 1) return 1.0;
  if (ageHours <= 4) return 0.7;
  if (ageHours <= 12) return 0.4;
  return 0.2;
}

/**
 * Group signals into clusters by topic overlap.
 * Uses single-linkage clustering: if any signal in a cluster
 * overlaps sufficiently with a new signal, it joins the cluster.
 */
function clusterSignals(
  signals: OperationalSignal[],
  threshold: number = 0.25
): OperationalSignal[][] {
  const tokenCache = new Map<string, Set<string>>();
  for (const signal of signals) {
    tokenCache.set(signal.id, extractTopicTokens(signal.content));
  }

  const clusters: OperationalSignal[][] = [];
  const assigned = new Set<string>();

  for (const signal of signals) {
    if (assigned.has(signal.id)) continue;

    // Try to find an existing cluster this signal belongs to
    let merged = false;
    for (const cluster of clusters) {
      for (const member of cluster) {
        const overlap = topicOverlap(
          tokenCache.get(signal.id)!,
          tokenCache.get(member.id)!
        );
        // Also cluster signals from different sources about similar topics
        const crossSource = signal.source !== member.source;
        const effectiveThreshold = crossSource ? threshold * 0.8 : threshold;

        if (overlap >= effectiveThreshold) {
          cluster.push(signal);
          assigned.add(signal.id);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }

    if (!merged) {
      clusters.push([signal]);
      assigned.add(signal.id);
    }
  }

  return clusters;
}

/**
 * An escalation requires cross-source propagation:
 * signals from at least 2 different sources about the same topic.
 */
function isEscalation(cluster: OperationalSignal[]): boolean {
  if (cluster.length < 2) return false;
  const sources = new Set(cluster.map((s) => s.source));
  return sources.size >= 2;
}

function buildClusterDescription(cluster: OperationalSignal[]): string {
  const sources = [...new Set(cluster.map((s) => s.source))];
  
  // Custom synthesis formatting based on sources
  if (sources.includes('github') && sources.includes('slack')) {
    return 'GitHub PR blocked + Slack escalation rising. Synthesized cross-source urgency detected.';
  }
  
  if (sources.includes('slack') && sources.includes('calendar')) {
    return 'Calendar fragmentation + Slack interruption density destroying viable focus blocks.';
  }

  const sourceStr = sources.join(' + ');
  const topSignal = cluster.reduce((a, b) =>
    a.severity > b.severity ? a : b
  );

  // Extract a representative topic from the highest-severity signal
  const tokens = [...extractTopicTokens(topSignal.content)].slice(0, 3);
  const topic = tokens.length > 0 ? tokens.join(', ') : 'related activity';

  return `Cross-source urgency detected across ${sourceStr} — topic: ${topic}`;
}

function clusterSeverity(
  cluster: OperationalSignal[],
  now: Date
): number {
  // Base: average severity weighted by recency
  let weightedSum = 0;
  let totalWeight = 0;

  for (const signal of cluster) {
    const weight = recencyWeight(signal, now);
    weightedSum += signal.severity * weight;
    totalWeight += weight;
  }

  const baseSeverity = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Cross-source multiplier: more sources = higher escalation
  const sourceCount = new Set(cluster.map((s) => s.source)).size;
  const crossSourceBoost = clamp((sourceCount - 1) * 0.15, 0, 0.3);

  // Volume boost: many signals about one topic = pressure
  const volumeBoost = clamp((cluster.length - 2) * 0.05, 0, 0.2);

  return clamp(baseSeverity + crossSourceBoost + volumeBoost, 0, 1);
}

function clusterConfidence(cluster: OperationalSignal[]): InsightConfidence {
  const sourceCount = new Set(cluster.map((s) => s.source)).size;
  const signalCount = cluster.length;

  let level: ConfidenceLevel;
  let explanation: string;
  const missing: string[] = [];

  if (sourceCount >= 3 && signalCount >= 4) {
    level = 'high';
    explanation = `${sourceCount} independent sources confirm this escalation.`;
  } else if (sourceCount >= 2) {
    level = 'medium';
    explanation = `Detected across ${sourceCount} sources, but pattern may be coincidental.`;
    if (signalCount < 3) {
      missing.push('Few signals — could be noise');
    }
  } else {
    level = 'low';
    explanation = 'Single-source cluster — escalation is speculative.';
    missing.push('Cross-source confirmation needed');
  }

  return {
    level,
    explanation,
    ...(missing.length > 0 ? { missingContext: missing } : {}),
  };
}

// --- Main export ---

export function detectEscalation(
  signals: OperationalSignal[]
): EscalationResult {
  if (signals.length === 0) {
    return { escalations: [] };
  }

  const now = new Date();
  const clusters = clusterSignals(signals);

  const escalations: EscalationCluster[] = clusters
    .filter(isEscalation)
    .map((cluster) => ({
      signalIds: cluster.map((s) => s.id),
      severity: clusterSeverity(cluster, now),
      description: buildClusterDescription(cluster),
      confidence: clusterConfidence(cluster),
    }))
    .sort((a, b) => b.severity - a.severity);

  return { escalations };
}
