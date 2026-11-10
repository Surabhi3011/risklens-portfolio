// Tier presentation. Colour is never the only signal: labels are always shown alongside.
import type { Tier } from '../types';

export const TIER_ORDER: readonly Tier[] = ['act', 'watch', 'low'];

export const TIER_LABEL: Record<Tier, string> = {
  act: 'Act now',
  watch: 'Watch',
  low: 'Low',
};

// Matches --red / --amber / --green in index.css.
export const TIER_COLOUR: Record<Tier, string> = {
  act: '#b3261e',
  watch: '#b26a00',
  low: '#2e7d4f',
};

export const NO_DATA_COLOUR = '#8a949c';
