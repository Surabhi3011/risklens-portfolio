// Shared types. Mirrors ARCHITECTURE.md §3.3 (enriched asset) and §4 (rules.json).

export type Band = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type Use = 'residential' | 'commercial';
export type Tenure = 'rented' | 'owner_occupied';
export type MatchLevel = 'uprn' | 'postcode' | 'none';
export type Likelihood = 'high' | 'medium' | 'low' | 'very_low' | 'none';
export type FloodZone = '3' | '2' | 'none';
export type ComplianceStatus = 'compliant' | 'fails_future' | 'fails_current' | 'no_epc';
export type Tier = 'low' | 'watch' | 'act';
export type ScoreValue = 0 | 50 | 100;

export interface Recommendation {
  summary: string;
  cost_low: number | null;
  cost_high: number | null;
}

export interface Asset {
  asset_id: string;
  uprn: string | null;
  postcode: string | null;
  la_code: string;
  la_name: string;
  use: Use;
  tenure: Tenure;
  match_level: MatchLevel;
  epc: {
    band_current: Band | null;
    band_potential: Band | null;
    score_current: number | null;
    floor_area_m2: number | null;
    lodgement_date: string | null;
    expired: boolean;
  };
  flood: { rofrs: Likelihood; zone: FloodZone; rofsw: Likelihood };
  compliance: { failing_rule_id: string | null; deadline: string | null; status: ComplianceStatus };
  scores: { compliance: ScoreValue; flood: ScoreValue; data_quality: ScoreValue; total: number };
  tier: Tier;
  recommendations: Recommendation[];
  upgrade_cost_mid_gbp: number | null;
  value_gbp: number | null;
  value_source: 'client' | 'hpi' | null;
}

/** An asset plus its map position (from the GeoJSON point geometry). */
export interface PortfolioAsset extends Asset {
  lon: number;
  lat: number;
}

export interface AssetFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Asset;
}

export interface AssetFeatureCollection {
  type: 'FeatureCollection';
  features: AssetFeature[];
}

export type RuleStatus = 'in_force' | 'confirmed_policy' | 'announced';

export interface Rule {
  id: string;
  use: Use;
  tenure: Tenure;
  min_band: Band;
  min_floor_area_m2?: number;
  deadline: string | null;
  status: RuleStatus;
  note?: string;
}

/** A configured fallback cost, or the literal "TODO" while no source-backed figure exists. */
export type FallbackCost = number | 'TODO';

export interface Rules {
  as_of: string;
  rules: Rule[];
  weights: { compliance: number; flood: number; data_quality: number };
  tiers: { watch: number; act: number };
  data_quality: { epc_fresh_years: number; epc_valid_years: number };
  fallback_upgrade_cost_gbp: Record<Use, FallbackCost>;
}
