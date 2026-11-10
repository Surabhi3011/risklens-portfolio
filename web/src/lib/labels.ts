// Human-readable labels shared by the table, drawer and exports.
import type { Asset, ComplianceStatus, FloodZone, Likelihood, Rules } from '../types';
import { milestoneLabel } from './aggregate';

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  fails_current: 'Fails now',
  no_epc: 'No valid EPC',
  fails_future: 'Fails by deadline',
  compliant: 'Compliant',
};

export const LIKELIHOOD_LABEL: Record<Likelihood, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  very_low: 'Very low',
  none: 'None',
};

export const ZONE_LABEL: Record<FloodZone, string> = { '3': 'Zone 3', '2': 'Zone 2', none: 'Outside zones' };

export const FLOOD_SCORE_LABEL: Record<0 | 50 | 100, string> = { 100: 'High', 50: 'Medium', 0: 'Low' };

/** Deadline text for an asset's failing rule. Announced rules show the year only, with "(announced)". */
export function deadlineText(a: Asset, rules: Rules): string {
  const id = a.compliance.failing_rule_id;
  if (a.compliance.status === 'fails_current') return 'In force now';
  if (a.compliance.status === 'no_epc') return a.tenure === 'rented' ? 'EPC needed now' : '—';
  if (!id || !a.compliance.deadline) return '—';
  const rule = rules.rules.find((r) => r.id === id);
  const announced = rule?.status === 'announced';
  return `${milestoneLabel(a.compliance.deadline, announced)}${announced ? ' (announced)' : ''}`;
}
