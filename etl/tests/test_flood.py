import pytest

from risklens_etl.flood import LIKELIHOOD_ORDER, ZONE_ORDER, map_band, worst_band

LIKELIHOOD_MAP = {"High": "high", "Medium": "medium", "Low": "low", "Very low": "very_low"}


def test_map_band() -> None:
    assert map_band("Very low", LIKELIHOOD_MAP) == "very_low"
    assert map_band(" High ", LIKELIHOOD_MAP) == "high"
    assert map_band("FZ3", {"FZ3": "3", "FZ2": "2"}) == "3"


@pytest.mark.parametrize("raw", ["Extreme", None, ""])
def test_map_band_rejects_unknown(raw: object) -> None:
    with pytest.raises(ValueError):
        map_band(raw, LIKELIHOOD_MAP)


def test_worst_band() -> None:
    assert worst_band(["low", "high", "very_low"], LIKELIHOOD_ORDER) == "high"
    assert worst_band([], LIKELIHOOD_ORDER) == "none"
    assert worst_band(["2", "3"], ZONE_ORDER) == "3"
    assert worst_band(["2"], ZONE_ORDER) == "2"
