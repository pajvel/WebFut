from itertools import combinations
from typing import Iterable, Iterator, Sequence, TypeVar

T = TypeVar("T")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def mean(values: Iterable[float]) -> float:
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)


def pairs(items: Sequence[T]) -> Iterator[tuple[T, T]]:
    return combinations(items, 2)
