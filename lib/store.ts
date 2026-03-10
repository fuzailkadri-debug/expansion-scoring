import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Account, Note } from './types';

interface AppStore {
  accounts: Account[];
  hasHexData: boolean;
  hasZendeskData: boolean;
  isLoaded: boolean;
  setAccounts: (accounts: Account[]) => void;
  setHasHexData: (v: boolean) => void;
  setHasZendeskData: (v: boolean) => void;
  reset: () => void;

  // Notes — persisted, keyed by opportunityName
  notes: Record<string, Note[]>;
  addNote: (opportunityName: string, text: string) => void;
  deleteNote: (opportunityName: string, id: string) => void;

  // Quota tracking — persisted
  quotaTarget: number;
  quotaWon: number;
  setQuotaTarget: (n: number) => void;
  addQuotaWon: (amount: number) => void;
  resetQuota: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // ── Accounts (in-memory only) ──
      accounts: [],
      hasHexData: false,
      hasZendeskData: false,
      isLoaded: false,
      setAccounts: (accounts) => set({ accounts, isLoaded: true }),
      setHasHexData: (hasHexData) => set({ hasHexData }),
      setHasZendeskData: (hasZendeskData) => set({ hasZendeskData }),
      reset: () => set({ accounts: [], hasHexData: false, hasZendeskData: false, isLoaded: false }),

      // ── Notes ──
      notes: {},
      addNote: (opportunityName, text) =>
        set((state) => {
          const existing = state.notes[opportunityName] ?? [];
          const note: Note = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text,
            timestamp: Date.now(),
          };
          return { notes: { ...state.notes, [opportunityName]: [note, ...existing] } };
        }),
      deleteNote: (opportunityName, id) =>
        set((state) => {
          const existing = state.notes[opportunityName] ?? [];
          return {
            notes: {
              ...state.notes,
              [opportunityName]: existing.filter((n) => n.id !== id),
            },
          };
        }),

      // ── Quota ──
      quotaTarget: 54060,
      quotaWon: 0,
      setQuotaTarget: (quotaTarget) => set({ quotaTarget }),
      addQuotaWon: (amount) => set((state) => ({ quotaWon: state.quotaWon + amount })),
      resetQuota: () => set({ quotaWon: 0 }),
    }),
    {
      name: 'cs-intelligence-store',
      // Only persist notes and quota — accounts re-upload each session
      partialize: (state) => ({
        notes: state.notes,
        quotaTarget: state.quotaTarget,
        quotaWon: state.quotaWon,
      }),
    },
  ),
);

// ── CSM Profile (persisted in localStorage) ───────────────────────────────────

export interface CSMProfile {
  name: string;
  email: string;
  sfOwnerName: string;
  team: string;
  projectsSheetUrl: string;
  quotaTargetAmount: string; // stored as string for form input
}

const PROFILE_KEY = 'csm_profile';

export function loadProfile(): CSMProfile {
  if (typeof window === 'undefined') return { name: '', email: '', sfOwnerName: '', team: '', projectsSheetUrl: '', quotaTargetAmount: '54060' };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? { projectsSheetUrl: '', quotaTargetAmount: '54060', ...JSON.parse(raw) } : { name: '', email: '', sfOwnerName: '', team: '', projectsSheetUrl: '', quotaTargetAmount: '54060' };
  } catch {
    return { name: '', email: '', sfOwnerName: '', team: '', projectsSheetUrl: '', quotaTargetAmount: '54060' };
  }
}

export function saveProfile(profile: CSMProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
