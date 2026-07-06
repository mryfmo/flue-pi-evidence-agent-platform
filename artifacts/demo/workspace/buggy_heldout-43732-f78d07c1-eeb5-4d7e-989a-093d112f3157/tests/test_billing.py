import pytest
from billing import average, country_code, parse_quantity


def test_average_normal_case():
    assert average(9, 3) == 3


def test_average_rejects_zero_count():
    with pytest.raises(ValueError):
        average(9, 0)


def test_parse_quantity_accepts_digits_with_space():
    assert parse_quantity(" 7 ") == 7


def test_parse_quantity_rejects_invalid_text():
    with pytest.raises(ValueError):
        parse_quantity("7x")


def test_country_code_defaults_when_missing():
    assert country_code({}) == "ZZ"
