def average(total: float, count: float) -> float:
    return total / count


def parse_quantity(raw: str) -> int:
    return int(raw)


def country_code(account: dict[str, str]) -> str:
    return account["country"]
