import { create } from 'zustand';
import { Account } from './types';

interface AppStore {
  accounts: Account[];
  hasHexData: boolean;
  hasZendeskData: boolean;
  isLoaded: boolean;
  setAccounts: (accounts: Account[]) => void;
  setHasHexData: (v: boolean) => void;
  setHasZendeskData: (v: boolean) => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  accounts: [],
  hasHexData: false,
  hasZendeskData: false,
  isLoaded: false,
  setAccounts: (accounts) => set({ accounts, isLoaded: true }),
  setHasHexData: (hasHexData) => set({ hasHexData }),
  setHasZendeskData: (hasZendeskData) => set({ hasZendeskData }),
  reset: () => set({ accounts: [], hasHexData: false, hasZendeskData: false, isLoaded: false }),
}));

// ── CSM Profile (persisted in localStorage) ───────────────────────────────────

export interface CSMProfile {
  name: string;
  email: string;
  sfOwnerName: string; // exact name as it appears in Salesforce "Owner" field
  team: string;
}

const PROFILE_KEY = 'csm_profile';

export function loadProfile(): CSMProfile {
  if (typeof window === 'undefined') return { name: '', email: '', sfOwnerName: '', team: '' };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : { name: '', email: '', sfOwnerName: '', team: '' };
  } catch {
    return { name: '', email: '', sfOwnerName: '', team: '' };
  }
}

export function saveProfile(profile: CSMProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
