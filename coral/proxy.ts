/**
 * Black Pearl — Real Coral Integration Layer
 * 
 * This module connects to the Coral backend server running at localhost:3001.
 * In live mode, it fetches REAL cross-source data from Coral SQL queries
 * (GitHub PRs, Slack messages, Google Calendar events) and converts them
 * into the engine's TimeBlock and OperationalSignal types.
 */
import { fetchTodayEvents, eventsToTimeBlocks } from '../services/calendar';
import { deriveSignals } from '../services/signals';
import type { TimeBlock, OperationalSignal } from '../engine/types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const hostUri = Constants.expoConfig?.hostUri;
const serverIp = hostUri ? hostUri.split(':')[0] : (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
const CORAL_SERVER_URL = `https://blackpearl-dhjr.onrender.com`;

/** The actual Coral SQL queries that ran — shown in "Coral magic" UI */
export interface CoralQueryLogEntry {
  name: string;
  sql: string;
  elapsedMs: number;
  status: 'ok' | 'error';
  error?: string;
}

let _lastQueryLog: CoralQueryLogEntry[] = [];

export function getLastCoralQueryLog(): CoralQueryLogEntry[] {
  return _lastQueryLog;
}

export class CoralProxy {
  private accessToken: string | null = null;
  
  private cachedBlocks: TimeBlock[] | null = null;
  private cachedSignals: OperationalSignal[] | null = null;
  private lastFetch: number = 0;
  private cacheMaxAge = 60_000;

  constructor(accessToken?: string) {
    if (accessToken) {
      this.accessToken = accessToken;
    }
  }

  private invalidateCache() {
    this.cachedBlocks = null;
    this.cachedSignals = null;
    this.lastFetch = 0;
  }

  updateToken(token: string) {
    this.accessToken = token;
    this.invalidateCache();
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastFetch < this.cacheMaxAge && this.cachedBlocks !== null;
  }

  // ─── Real Coral Backend Integration ──────────────────────────────────────

  private async fetchFromCoralBackend(): Promise<{ 
    timeline: TimeBlock[]; 
    signals: OperationalSignal[];
  }> {
    const response = await fetch(`${CORAL_SERVER_URL}/api/operational`);
    if (!response.ok) {
      throw new Error(`Coral backend returned ${response.status}`);
    }
    const json = await response.json();

    // Store the query log for the "Coral magic" UI
    _lastQueryLog = json.queryLog || [];

    const timeline: TimeBlock[] = [];
    const signals: OperationalSignal[] = [];
    const now = new Date();

    // Dynamically parse all results
    for (const [queryName, result] of Object.entries(json.results || {})) {
      const data = (result as any).data;
      if (!Array.isArray(data)) continue;

      for (const row of data) {
        // If it looks like a calendar event, push to timeline
        if (row.start_time || row.start_date_time || row.summary || row.meeting) {
          const startTimeRaw = row.start_time || row.start_date_time;
          const endTimeRaw = row.end_time || row.end_date_time;
          const startTime = startTimeRaw ? new Date(startTimeRaw) : new Date();
          const endTime = endTimeRaw ? new Date(endTimeRaw) : new Date(startTime.getTime() + 30 * 60000);
          timeline.push({
            id: `coral-dyn-cal-${Math.random()}`,
            start: startTime,
            end: endTime,
            type: 'meeting',
            title: row.summary || row.meeting || 'Event',
            source: 'calendar',
            metadata: row,
          });
          continue;
        }

        // Determine source based on query name or columns
        const isSynthesis = queryName.toLowerCase().includes('synthesis') || queryName.toLowerCase().includes('cross') || queryName.toLowerCase().includes('join') || Object.keys(row).length > 4;
        const source = isSynthesis ? 'coral-synthesis' : (queryName.toLowerCase().includes('slack') ? 'slack' : (queryName.toLowerCase().includes('github') ? 'github' : 'custom'));
        
        let content = '';
        if (isSynthesis) {
          content = `Synthesis [${queryName}]: ` + Object.entries(row).map(([k, v]) => `${k}=${v}`).join(', ');
        } else {
          content = row.text || row.title || row.summary || row.name || JSON.stringify(row);
        }

        // Try to find a timestamp
        let timestamp = now;
        if (row.ts) timestamp = new Date(parseFloat(row.ts) * 1000);
        else if (row.created_at) timestamp = new Date(row.created_at);
        else if (row.updated_at) timestamp = new Date(row.updated_at);

        // Dynamically assess severity based on natural language urgency indicators
        const textLower = content.toLowerCase();
        // Base severity is 0.85 because the AI explicitly generated this query to find operational pressure. 
        // We consider all returned rows as operational insights.
        let calculatedSeverity = isSynthesis ? 0.9 : 0.85;
        let isUrgent = false;
        
        const urgentKeywords = ['urgent', 'critical', 'sev-1', 'sev1', 'sev-2', 'sev2', 'outage', 'blocking', 'breaking change', 'vulnerability', 'bug'];
        for (const kw of urgentKeywords) {
          if (textLower.includes(kw)) {
            calculatedSeverity = Math.max(calculatedSeverity, 0.95);
            isUrgent = true;
          }
        }

        signals.push({
          id: `coral-dyn-${Math.random()}`,
          source,
          type: (isSynthesis || isUrgent) ? 'cross-source' : 'operational',
          severity: calculatedSeverity,
          timestamp,
          content,
          metadata: row,
        });
      }
    }

    // Inject free blocks in gaps
    const enriched = injectFreeBlocks(timeline);
    
    // Sort signals by recency
    signals.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { timeline: enriched, signals };
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  async getTimeline(): Promise<TimeBlock[]> {
    if (this.isCacheValid() && this.cachedBlocks) {
      return this.cachedBlocks;
    }

    const { timeline } = await this.fetchFromCoralBackend();
    this.cachedBlocks = timeline;
    this.lastFetch = Date.now();
    return timeline;
  }

  async getSignals(): Promise<OperationalSignal[]> {
    if (this.isCacheValid() && this.cachedSignals) return this.cachedSignals;
    
    const { signals } = await this.fetchFromCoralBackend();
    this.cachedSignals = signals;
    return signals;
  }

  public async refresh(): Promise<{ timeline: TimeBlock[]; signals: OperationalSignal[] }> {
    if (this.isCacheValid()) {
      return { timeline: this.cachedBlocks!, signals: this.cachedSignals! };
    }

    try {
      const { timeline, signals } = await this.fetchFromCoralBackend();
      this.cachedBlocks = timeline;
      this.cachedSignals = signals;
      this.lastFetch = Date.now();
      return { timeline, signals };
    } catch (error) {
      console.error('Failed to fetch from Coral backend:', error);
      throw error;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function injectFreeBlocks(blocks: TimeBlock[]): TimeBlock[] {
  const now = new Date();
  const workStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  const workEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);

  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const result: TimeBlock[] = [];
  let cursor = workStart.getTime() < now.getTime() ? now : workStart;
  let gapIndex = 0;

  for (const block of sorted) {
    if (block.start.getTime() > cursor.getTime()) {
      const gapMin = (block.start.getTime() - cursor.getTime()) / 60_000;
      if (gapMin >= 15) {
        result.push({
          id: `free-${gapIndex++}`,
          start: new Date(cursor),
          end: new Date(block.start),
          type: 'focus',
          title: 'Available',
          source: 'derived',
          metadata: { derived: true, availableMinutes: Math.round(gapMin) },
        });
      }
    }
    result.push(block);
    if (block.end.getTime() > cursor.getTime()) {
      cursor = block.end;
    }
  }

  if (cursor.getTime() < workEnd.getTime()) {
    const gapMin = (workEnd.getTime() - cursor.getTime()) / 60_000;
    if (gapMin >= 15) {
      result.push({
        id: `free-${gapIndex++}`,
        start: new Date(cursor),
        end: workEnd,
        type: 'focus',
        title: 'Available',
        source: 'derived',
        metadata: { derived: true, availableMinutes: Math.round(gapMin) },
      });
    }
  }

  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: CoralProxy | null = null;

export function initCoral(accessToken?: string): CoralProxy {
  if (!_instance) {
    _instance = new CoralProxy(accessToken);
  } else if (accessToken) {
    _instance.updateToken(accessToken);
  }
  return _instance;
}

export function getCoral(): CoralProxy | null {
  return _instance;
}
