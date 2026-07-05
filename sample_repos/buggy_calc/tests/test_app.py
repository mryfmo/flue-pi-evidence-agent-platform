import pytest
from app import divide


def test_divide_normal():
    assert divide(8, 2) == 4


def test_divide_zero_rejected():
    with pytest.raises(ValueError):
        divide(8, 0)
