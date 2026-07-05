import pytest
from app import divide, parse_discount


def test_divide_normal_case():
    assert divide(8, 2) == 4


def test_divide_rejects_zero():
    with pytest.raises(ValueError):
        divide(8, 0)


def test_parse_discount_accepts_digits_with_space():
    assert parse_discount(" 25 ") == 25


def test_parse_discount_rejects_invalid_text():
    with pytest.raises(ValueError):
        parse_discount("2O")
