import { create } from 'zustand';
import type { OperationalState, Intervention, TimeBlock, OperationalSignal } from '../engine/types';
import type { GoogleUser } from '../services/auth';
import { CoralProxy, initCoral } from '../coral/proxy';
import { processOperationalState } from '../engine';
import { generateAsyncDraft } from '../services/calendar';

export type AppPhase = 'unauthenticated' | 'connecting-sources' | 'loading' | 'ready' | 'intervening' | 'resolved' | 'calibrating' | 'error';

interface OperationalStore {
  // Auth
  phase: AppPhase;
  user: GoogleUser | null;
  accessToken: string | null;

  // Core operational state (from real data)
  operationalState: OperationalState | null;
  timeline: TimeBlock[];
  signals: OperationalSignal[];
  interventions: Intervention[];

  // UI state
  resolvedInterventionIds: string[];
  selectedIntervention: Intervention | null;
  showReasoning: boolean;
  showAsyncDraft: boolean;
  showCalibration: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;

  // Connected sources
  connectedSources: string[];

  // Async draft (generated from real meeting data)
  asyncDraft: {
    to: string;
    subject: string;
    body: string;
    confidence: number;
  } | null;

  // Auth actions
  setAuthenticated: (token: string, user: GoogleUser) => void;
  setUnauthenticated: () => void;

  // Data actions
  loadOperationalState: () => Promise<void>;
  refresh: () => Promise<void>;

  // Interaction actions
  selectIntervention: (intervention: Intervention) => void;
  dismissIntervention: () => void;
  executeIntervention: (intervention: Intervention) => void;
  resolveIntervention: () => void;
  toggleReasoning: () => void;
  toggleAsyncDraft: () => void;
  triggerCalibration: () => void;
  dismissCalibration: () => void;
  submitCalibration: (data: { paceRating: number; accuracyRating: number }) => void;

  // Coral actions
  setLiveMode: () => void;
  addConnectedSource: (source: string) => void;

  // Coral proxy ref
  coral: CoralProxy | null;
}

export const useOperationalStore = create<OperationalStore>((set, get) => ({
  phase: 'unauthenticated',
  user: null,
  accessToken: null,
  operationalState: null,
  timeline: [],
  signals: [],
  interventions: [],
  resolvedInterventionIds: [],
  selectedIntervention: null,
  showReasoning: false,
  showAsyncDraft: false,
  showCalibration: false,
  isRefreshing: false,
  errorMessage: null,
  asyncDraft: null,
  coral: null,
  connectedSources: [],

  setAuthenticated: (token: string, user: GoogleUser) => {
    const coral = initCoral(token);
    set({ phase: 'connecting-sources', accessToken: token, user, coral, errorMessage: null });
  },

  setLiveMode: () => {
    const { coral } = get();
    if (coral) {
      set({ phase: 'loading' });
      get().loadOperationalState();
    }
  },

  addConnectedSource: (source: string) => {
    set((s) => ({
      connectedSources: [...new Set([...s.connectedSources, source])],
    }));
  },

  setUnauthenticated: () => {
    set({
      phase: 'unauthenticated',
      accessToken: null,
      user: null,
      coral: null,
      operationalState: null,
      timeline: [],
      signals: [],
      interventions: [],
      selectedIntervention: null,
      asyncDraft: null,
      errorMessage: null,
    });
  },

  loadOperationalState: async () => {
    const { coral } = get();
    if (!coral) {
      set({ phase: 'error', errorMessage: 'Not connected to data source' });
      return;
    }

    try {
      set({ isRefreshing: true, errorMessage: null });

      const { timeline, signals } = await coral.refresh();

      // Run the intelligence engine on real data
      const opState = processOperationalState(timeline, signals);
      const filteredInterventions = opState.interventions.filter(
        i => !get().resolvedInterventionIds.includes(i.id)
      );

      set({
        phase: 'ready',
        timeline,
        signals,
        operationalState: opState,
        interventions: filteredInterventions,
        isRefreshing: false,
      });
    } catch (error: any) {
      console.error('Failed to load operational state:', error);
      set({
        phase: 'error',
        isRefreshing: false,
        errorMessage: error?.message || 'Failed to load calendar data',
      });
    }
  },

  refresh: async () => {
    const { coral } = get();
    if (!coral) return;
    set({ isRefreshing: true });

    try {
      const { timeline, signals } = await coral.refresh();
      const opState = processOperationalState(timeline, signals);
      const filteredInterventions = opState.interventions.filter(
        i => !get().resolvedInterventionIds.includes(i.id)
      );

      set({
        timeline,
        signals,
        operationalState: opState,
        interventions: filteredInterventions,
        isRefreshing: false,
        phase: 'ready',
        errorMessage: null,
      });
    } catch (error: any) {
      set({ isRefreshing: false, errorMessage: error?.message || 'Refresh failed' });
    }
  },

  selectIntervention: (intervention: Intervention) => {
    set({ selectedIntervention: intervention, phase: 'intervening' });
  },

  dismissIntervention: () => {
    const { interventions } = get();
    const idToDismiss = interventions[0]?.id;
    if (!idToDismiss) return;
    
    set((s) => ({
      selectedIntervention: null,
      phase: 'ready',
      resolvedInterventionIds: [...s.resolvedInterventionIds, idToDismiss],
      interventions: s.interventions.filter(i => i.id !== idToDismiss)
    }));
  },

  executeIntervention: (intervention: Intervention) => {
    const { timeline } = get();
    const targetBlock = timeline.find((b) => b.id === intervention.targetBlockId);

    if (targetBlock && intervention.type === 'convert-async') {
      const draft = generateAsyncDraft(targetBlock);
      set({ asyncDraft: draft, showAsyncDraft: true });
    } else {
      // For protect-focus, escalate, or defer
      set({ selectedIntervention: intervention });
      get().resolveIntervention();
    }
  },

  resolveIntervention: () => {
    const { selectedIntervention, timeline } = get();
    if (!selectedIntervention) return;

    // Mark the target block as resolved in the timeline
    const updatedTimeline = timeline.map((block) => {
      if (block.id === selectedIntervention.targetBlockId) {
        return {
          ...block,
          type: 'focus' as const,
          title: `${block.title} → Async`,
          metadata: { ...block.metadata, resolved: true, wasConverted: true },
        };
      }
      return block;
    });

    set((s) => ({
      timeline: updatedTimeline,
      selectedIntervention: null,
      showAsyncDraft: false,
      phase: 'resolved',
      asyncDraft: null,
      resolvedInterventionIds: [...s.resolvedInterventionIds, selectedIntervention.id],
      interventions: s.interventions.filter(i => i.id !== selectedIntervention.id)
    }));

    // Recompute operational state with resolved timeline
    setTimeout(() => {
      const { signals, resolvedInterventionIds } = get();
      const opState = processOperationalState(updatedTimeline, signals);
      const filteredInterventions = opState.interventions.filter(
        i => !resolvedInterventionIds.includes(i.id)
      );
      
      set({
        operationalState: opState,
        interventions: filteredInterventions,
      });
    }, 300);
  },

  toggleReasoning: () => set((s) => ({ showReasoning: !s.showReasoning })),
  toggleAsyncDraft: () => set((s) => ({ showAsyncDraft: !s.showAsyncDraft })),

  triggerCalibration: () => set({ showCalibration: true, phase: 'calibrating' }),
  dismissCalibration: () => set({ showCalibration: false, phase: 'ready' }),

  submitCalibration: (_data: { paceRating: number; accuracyRating: number }) => {
    // In a real app, this would persist to AsyncStorage or a backend
    set({ showCalibration: false, phase: 'ready' });
  },
}));
