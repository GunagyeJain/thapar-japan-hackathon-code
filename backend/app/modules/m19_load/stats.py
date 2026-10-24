"""Counting distributions for demand: Poisson (late needs) and negative binomial (a family's share of the cabin)."""
import math

from app.modules.m6_matcher.forecast import poisson_quantile

__all__ = ["poisson_quantile", "poisson_pmf", "poisson_cdf", "nb_quantile", "leftover_and_short"]

MAX_TERMS = 500


def poisson_pmf(lam: float, n_max: int) -> list[float]:
    """P(N = 0..n_max) for N ~ Poisson(lam)."""
    term = math.exp(-lam)
    out = [term]
    for n in range(1, n_max + 1):
        term *= lam / n
        out.append(term)
    return out


def poisson_cdf(lam: float, q: int) -> float:
    return sum(poisson_pmf(lam, q)) if q >= 0 else 0.0


def nb_quantile(mean: float, size: float, level: float) -> int:
    """Smallest n with P(N <= n) >= level for N ~ NegBin(mean, size): variance mean + mean²/size."""
    if mean <= 0:
        return 0
    p = size / (size + mean)
    term = p**size
    cdf, n = term, 0
    while cdf < level and n < MAX_TERMS:
        term *= (n + size) / (n + 1) * (1 - p)
        n += 1
        cdf += term
    return n


def leftover_and_short(lam: float, q: int) -> tuple[float, float]:
    """Expected unused units E[(q - N)+] and expected unmet needs E[(N - q)+] when loading q for N ~ Poisson(lam)."""
    pmf = poisson_pmf(lam, q)
    leftover = sum((q - n) * p for n, p in enumerate(pmf))
    short = leftover - (q - lam)  # E[(N-q)+] = E[(q-N)+] - (q - E[N])
    return leftover, max(short, 0.0)
