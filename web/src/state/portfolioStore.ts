import { create } from 'zustand';
import { type Filters, NO_FILTERS, type SortDir, type SortKey } from '../lib/filters';
import { loadAll } from '../lib/loadData';
import type { PortfolioAsset, Rules } from '../types';

type LoadState = { status: 'idle' | 'loading' | 'ready' } | { status: 'error'; message: string };

interface PortfolioState {
  load: LoadState;
  rules: Rules | null;
  assets: PortfolioAsset[];
  selectedId: string | null;
  filters: Filters;
  sort: { key: SortKey; dir: SortDir };
  init: () => Promise<void>;
  select: (assetId: string | null) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;
  sortBy: (key: SortKey) => void;
}

export const usePortfolioStore = create<PortfolioState>()((set, get) => ({
  load: { status: 'idle' },
  rules: null,
  assets: [],
  selectedId: null,
  filters: NO_FILTERS,
  sort: { key: 'tier', dir: 'asc' },
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
  setFilter: (key, value) => {
    set((s) => ({ filters: { ...s.filters, [key]: value } }));
  },
  resetFilters: () => {
    set({ filters: NO_FILTERS });
  },
  sortBy: (key) => {
    set((s) => ({
      sort: { key, dir: s.sort.key === key && s.sort.dir === 'asc' ? 'desc' : 'asc' },
    }));
  },
}));
