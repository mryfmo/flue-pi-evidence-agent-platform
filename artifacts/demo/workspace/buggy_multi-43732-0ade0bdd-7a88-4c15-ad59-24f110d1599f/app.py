def divide(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("division by zero")
    return a / b


def parse_discount(value: str) -> int:
    normalized = value.strip()
    if not normalized.isdigit():
        raise ValueError("discount must be a non-negative integer")
    return int(normalized)


def preferred_region(profile: dict[str, str]) -> str:
    return profile.get("region", "unknown")
