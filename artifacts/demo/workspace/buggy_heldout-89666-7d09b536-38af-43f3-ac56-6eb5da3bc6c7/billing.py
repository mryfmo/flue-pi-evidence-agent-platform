def average(total: float, count: float) -> float:
    if count == 0:
        raise ValueError("division by zero")
    return total / count


def parse_quantity(raw: str) -> int:
    normalized = raw.strip()
    if not normalized.isdigit():
        raise ValueError("quantity must be a non-negative integer")
    return int(normalized)


def country_code(account: dict[str, str]) -> str:
    return account.get("country", "ZZ")
