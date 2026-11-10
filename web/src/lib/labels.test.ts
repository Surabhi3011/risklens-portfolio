import { describe, expect, it } from 'vitest';
import type { Rule } from '../types';
import { epcAge, ruleDescription } from './labels';

describe('epcAge', () => {
  it('formats years and months relative to as_of', () => {
    expect(epcAge('2023-09-01', '2026-11-09')).toBe('3 years 2 months');
    expect(epcAge('2025-11-09', '2026-11-09')).toBe('1 year');
    expect(epcAge('2026-10-10', '2026-11-09')).toBe('0 months');
    expect(epcAge('2016-11-10', '2026-11-09')).toBe('9 years 11 months');
    expect(epcAge(null, '2026-11-09')).toBeNull();
  });
});

describe('ruleDescription', () => {
  it('describes domestic and size-limited non-domestic rules', () => {
    const dom: Rule = { id: 'x', use: 'residential', tenure: 'rented', min_band: 'C', deadline: '2030-10-01', status: 'confirmed_policy' };
    const nd: Rule = { ...dom, use: 'commercial', min_band: 'B', min_floor_area_m2: 1000, status: 'announced' };
    expect(ruleDescription(dom)).toBe('Domestic rented: minimum EPC C');
    expect(ruleDescription(nd)).toBe('Non-domestic rented (1000 m² and over): minimum EPC B');
  });
});
