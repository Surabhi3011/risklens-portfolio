import { create } from 'zustand';
import { loadAll } from '../lib/loadData';
import type { PortfolioAsset, Rules } from '../types';

type LoadState = { status: 'idle' | 'loading' | 'ready' } | { status: 'error'; message: string };

interface PortfolioState {
  load: LoadState;
  rules: Rules | null;
  assets: PortfolioAsset[];
  selectedId: string | null;
  init: () => Promise<void>;
  select: (assetId: string | null) => void;
}

export const usePortfolioStore = create<PortfolioState>()((set, get) => ({
  load: { status: 'idle' },
  rules: null,
  assets: [],
  selectedId: null,
  init: async () => {
    if (get().load.status !== 'idle') return;
    set({ load: { status: 'loading' } });
    try {
      const { rules, assets } = await loadAll();
      set({ rules, assets, load: { status: 'ready' } });
    } catch (err) {
      set({ load: { status: 'error', message: err instanceof Error ? err.message : String(err) } });
    }
  },
  select: (assetId) => {
    set({ selectedId: assetId });
  },
}));
