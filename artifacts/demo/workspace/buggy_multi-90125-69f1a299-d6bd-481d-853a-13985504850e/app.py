def divide(a: float, b: float) -> float:
    return a / b


def parse_discount(value: str) -> int:
    return int(value)


def preferred_region(profile: dict[str, str]) -> str:
    return profile["region"]
