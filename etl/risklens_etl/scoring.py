"""Asset scoring (ARCHITECTURE.md §4). Mirrored exactly in web/src/lib/scoring.ts.

Both implementations are checked against etl/tests/fixtures/scoring_cases.json. Keep them identical:
  - Dates are compared as ISO 'YYYY-MM-DD' strings and year arithmetic shifts the year field, so there's no timezone drift.
  - total uses integer half-up rounding, floor((sum(round(w*100) * score) + 50) / 100), so Python and
    JS agree on .5 cases. Python's round() rounds half to even.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Literal, TypedDict

BANDS = "ABCDEFG"
RULES_PATH = Path(__file__).resolve().parents[2] / "web" / "public" / "config" / "rules.json"

Status = Literal["compliant", "fails_future", "fails_current", "no_epc"]
Tier = Literal["low", "watch", "act"]
# Where the indicative upgrade cost comes from: summed EPC recommendation costs, the configured fallback average,
# no upgrade needed (compliant), or None when no cost is available.
CostSource = Literal["recommendations", "fallback", "not_required"]


class FloodInput(TypedDict):
    rofrs: str  # high | medium | low | very_low | none
    zone: str  # 3 | 2 | none
    rofsw: str  # high | medium | low | very_low | none


class ScoreInput(TypedDict):
    use: Literal["residential", "commercial"]
    tenure: Literal["rented", "owner_occupied"]
    match_level: Literal["uprn", "postcode", "none"]
    band_current: str | None
    floor_area_m2: float | None
    lodgement_date: str | None  # YYYY-MM-DD
    flood: FloodInput
    rec_costs_mid: list[float | None]


class Compliance(TypedDict):
    failing_rule_id: str | None
    deadline: str | None
    status: Status


class Scores(TypedDict):
    compliance: int
    flood: int
    data_quality: int
    total: int


class ScoreResult(TypedDict):
    compliance: Compliance
    scores: Scores
    tier: Tier
    upgrade_cost_mid_gbp: float | None
    upgrade_cost_source: CostSource | None


def load_rules(path: Path = RULES_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def shift_years(iso_date: str, years: int) -> str:
    """Shift an ISO date by whole years, clamping 29 Feb to 28 Feb."""
    y, m, d = (int(p) for p in iso_date[:10].split("-"))
    y += years
    if m == 2 and d == 29 and not (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)):
        d = 28
    return f"{y:04d}-{m:02d}-{d:02d}"


def is_expired(lodgement_date: str | None, as_of: str, valid_years: int) -> bool:
    """True if there is no date, or the certificate is more than valid_years old at as_of."""
    return lodgement_date is None or lodgement_date[:10] < shift_years(as_of, -valid_years)


def band_fails(band: str, min_band: str) -> bool:
    """True when band is worse (later letter) than min_band."""
    return BANDS.index(band) > BANDS.index(min_band)


def rule_applies(rule: dict[str, Any], a: ScoreInput) -> bool:
    if rule["use"] != a["use"] or rule["tenure"] != a["tenure"]:
        return False
    min_area = rule.get("min_floor_area_m2")
    if min_area is not None:
        # Unknown floor area: we can't show the size threshold is met, so the rule doesn't apply.
        return a["floor_area_m2"] is not None and a["floor_area_m2"] >= min_area
    return True


def score_compliance(a: ScoreInput, rules: dict[str, Any]) -> tuple[int, Compliance]:
    if a["tenure"] == "owner_occupied":
        return 0, {"failing_rule_id": None, "deadline": None, "status": "compliant"}
    valid_years = rules["data_quality"]["epc_valid_years"]
    if a["band_current"] is None or is_expired(a["lodgement_date"], rules["as_of"], valid_years):
        return 100, {"failing_rule_id": None, "deadline": None, "status": "no_epc"}
    failing = [r for r in rules["rules"] if rule_applies(r, a) and band_fails(a["band_current"], r["min_band"])]
    current = [r for r in failing if r["deadline"] is None]
    if current:
        return 100, {"failing_rule_id": current[0]["id"], "deadline": None, "status": "fails_current"}
    if failing:
        first = min(failing, key=lambda r: r["deadline"])
        return 50, {"failing_rule_id": first["id"], "deadline": first["deadline"], "status": "fails_future"}
    return 0, {"failing_rule_id": None, "deadline": None, "status": "compliant"}


def score_flood(f: FloodInput) -> int:
    if f["rofrs"] == "high" or f["zone"] == "3" or f["rofsw"] == "high":
        return 100
    if f["rofrs"] in ("medium", "low") or f["zone"] == "2" or f["rofsw"] == "medium":
        return 50
    return 0


def score_data_quality(a: ScoreInput, rules: dict[str, Any]) -> int:
    dq = rules["data_quality"]
    if a["match_level"] == "none" or a["band_current"] is None:
        return 100
    if is_expired(a["lodgement_date"], rules["as_of"], dq["epc_valid_years"]):
        return 100
    assert a["lodgement_date"] is not None
    fresh = a["lodgement_date"][:10] > shift_years(rules["as_of"], -dq["epc_fresh_years"])
    if a["match_level"] == "postcode" or not fresh:
        return 50
    return 0


def total_score(c: int, f: int, d: int, weights: dict[str, float]) -> int:
    pct = {k: round(v * 100) for k, v in weights.items()}
    return math.floor((pct["compliance"] * c + pct["flood"] * f + pct["data_quality"] * d + 50) / 100)


def tier_for(total: int, tiers: dict[str, int]) -> Tier:
    if total >= tiers["act"]:
        return "act"
    if total >= tiers["watch"]:
        return "watch"
    return "low"


def upgrade_cost(a: ScoreInput, status: Status, rules: dict[str, Any]) -> tuple[float | None, CostSource | None]:
    """Indicative upgrade cost and its source.

    0 when no rule is failed; otherwise the sum of recommendation cost_mid, then the configured fallback, else None.
    """
    if status == "compliant":
        return 0.0, "not_required"
    if status in ("fails_current", "fails_future"):
        costs = [c for c in a["rec_costs_mid"] if c is not None]
        if costs:
            return float(sum(costs)), "recommendations"
    fallback = rules["fallback_upgrade_cost_gbp"].get(a["use"])
    if isinstance(fallback, (int, float)) and not isinstance(fallback, bool):
        return float(fallback), "fallback"
    return None, None


def score_asset(a: ScoreInput, rules: dict[str, Any]) -> ScoreResult:
    c, compliance = score_compliance(a, rules)
    f = score_flood(a["flood"])
    d = score_data_quality(a, rules)
    total = total_score(c, f, d, rules["weights"])
    cost, cost_source = upgrade_cost(a, compliance["status"], rules)
    return {
        "compliance": compliance,
        "scores": {"compliance": c, "flood": f, "data_quality": d, "total": total},
        "tier": tier_for(total, rules["tiers"]),
        "upgrade_cost_mid_gbp": cost,
        "upgrade_cost_source": cost_source,
    }
