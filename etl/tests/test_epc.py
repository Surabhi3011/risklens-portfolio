import pandas as pd
import pytest

from risklens_etl.epc import (
    forbidden_columns,
    is_expired,
    latest_per_key,
    normalise_band,
    normalise_tenure,
    parse_cost,
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("£100 - £350", (100.0, 350.0, 225.0)),
        ("£800 - £1,200", (800.0, 1200.0, 1000.0)),
        ("£4,000  -  £14,000", (4000.0, 14000.0, 9000.0)),
        ("Â£100 - Â£350", (100.0, 350.0, 225.0)),
        ("?50 - ?100", (50.0, 100.0, 75.0)),
        ("£500", (500.0, 500.0, 500.0)),
        ("200", (200.0, 200.0, 200.0)),
        ("£10.50 - £20.50", (10.5, 20.5, 15.5)),
        ("-£45", (45.0, 45.0, 45.0)),
        (None, (None, None, None)),
        (float("nan"), (None, None, None)),
        ("Not applicable", (None, None, None)),
    ],
)
def test_parse_cost(text: object, expected: tuple[float | None, ...]) -> None:
    assert parse_cost(text) == expected


def test_normalise_band() -> None:
    aliases = {"A+": "A"}
    assert normalise_band("c", aliases) == "C"
    assert normalise_band("A+", aliases) == "A"
    assert normalise_band("INVALID!", aliases) is None
    assert normalise_band(None, aliases) is None


def test_normalise_tenure() -> None:
    assert normalise_tenure("Rented (private)") == "rented (private)"
    assert normalise_tenure("Unknown") is None
    assert normalise_tenure(float("nan")) is None


def test_is_expired_boundary() -> None:
    as_of = pd.Timestamp("2026-11-09")
    dates = pd.Series(pd.to_datetime(["2016-11-08", "2016-11-09", "2020-01-01", None]))
    assert is_expired(dates, as_of).tolist() == [True, False, False, True]


def test_latest_per_key_keeps_newest_and_drops_null_keys() -> None:
    df = pd.DataFrame(
        {
            "lmk_key": ["a", "b", "c", "d"],
            "uprn": ["1", "1", "2", None],
            "lodgement_date": pd.to_datetime(["2015-01-01", "2020-01-01", "2019-01-01", "2024-01-01"]),
        }
    )
    out = latest_per_key(df, ["uprn"])
    assert sorted(out["lmk_key"]) == ["b", "c"]


def test_forbidden_columns() -> None:
    cols = ["uprn", "postcode", "ADDRESS1", "posttown", "band_current"]
    assert forbidden_columns(cols, ["address", "posttown"]) == ["ADDRESS1", "posttown"]
