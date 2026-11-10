import copy
import json
from pathlib import Path
from typing import Any

import pytest

from risklens_etl.scoring import load_rules, score_asset, shift_years

FIXTURE = Path(__file__).parent / "fixtures" / "scoring_cases.json"
DOC = json.loads(FIXTURE.read_text(encoding="utf-8"))
RULES = load_rules()


def test_fixture_matches_rules_as_of() -> None:
    assert DOC["rules_as_of"] == RULES["as_of"], "rules.json as_of changed: re-check the hand-computed cases"


@pytest.mark.parametrize("case", DOC["cases"], ids=[c["name"] for c in DOC["cases"]])
def test_scoring_case(case: dict[str, Any]) -> None:
    assert score_asset(case["input"], RULES) == case["expected"]


def test_numeric_fallback_cost_is_used_when_configured() -> None:
    rules = copy.deepcopy(RULES)
    rules["fallback_upgrade_cost_gbp"] = {"residential": 1234, "commercial": 5678}
    case = next(c for c in DOC["cases"] if c["name"] == "commercial_C_1500m2_fails_2031")
    assert score_asset(case["input"], rules)["upgrade_cost_mid_gbp"] == 5678.0


def test_shift_years_leap_day() -> None:
    assert shift_years("2024-02-29", -1) == "2023-02-28"
    assert shift_years("2026-11-09", -10) == "2016-11-09"
