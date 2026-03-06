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
