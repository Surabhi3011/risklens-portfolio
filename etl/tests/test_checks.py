from risklens_etl.checks import address_like


def test_address_like_catches_street_addresses() -> None:
    assert address_like("5, Ackland Close") == ["5, Ackland Close"]
    assert address_like("Flat 2, 14 Queens Gate Terrace") == ["14 Queens Gate Terrace"]


def test_address_like_ignores_recommendation_text() -> None:
    for text in ["Increase loft insulation to 270 mm", "Floor insulation", "Solar water heating",
                 "Replace boiler with new condensing boiler", "YO30 5NJ", "RL-0001"]:
        assert address_like(text) == []
