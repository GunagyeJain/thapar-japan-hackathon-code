"""Pick a meal for one late request: CP-SAT, with a greedy fallback.

Objectives, in order (one weighted sum, weights far apart):
1. cover the requester, and keep every passenger whose meal we might move on a safe meal;
2. lowest tier cost: spare 1 · main 3 · backup 5 · voucher 50;
3. fewest swaps of other passengers' meals. Moving someone's booked meal also costs as much as a
   sealed backup, so a swap only wins when it avoids a voucher;
4. tie-break: the item listed first (galley position), so answers are repeatable.

A swap: a passenger already holding a meal that is safe for the requester moves to a free meal
that is safe for them, and the requester takes theirs.
"""
import time
from dataclasses import dataclass, field

from app.modules.m6_matcher.inventory import TIER_COST

TIME_LIMIT_S = 2.0
W_UNCOVERED, W_COST, W_SWAP = 10**9, 10**6, 10**4
SWAP_COST = TIER_COST["backup"]


@dataclass(frozen=True)
class Candidate:
    item_id: str
    cost: int
    rank: int
    pool: str | None = None  # main-menu cabin whose spare count this draws on


@dataclass(frozen=True)
class Donor:
    passenger_id: str
    own_item: str
    can_take: tuple[str, ...]  # free items that are safe for this passenger


@dataclass
class Solution:
    item_id: str | None
    engine: str
    ms: int
    swaps: list[dict] = field(default_factory=list)


def greedy(safe_free: list[Candidate]) -> Solution:
    """Cheapest safe free meal, first in galley order. No swaps. (m8 copies this offline.)"""
    start = time.perf_counter()
    best = min(safe_free, key=lambda c: (c.cost, c.rank), default=None)
    return Solution(best.item_id if best else None, "greedy", _ms(start))


def solve(safe_free: list[Candidate], free: list[Candidate], pools: dict[str, int], donors: list[Donor]) -> Solution:
    """safe_free: free items safe for the requester. free: every free item (donors may move to them)."""
    try:
        return _cp_sat(safe_free, free, pools, donors)
    except Exception:  # noqa: BLE001 - any solver failure falls back to greedy, never to an error
        return greedy(safe_free)


def _ms(start: float) -> int:
    return max(1, round((time.perf_counter() - start) * 1000))


def _cp_sat(safe_free, free, pools, donors) -> Solution:
    from ortools.sat.python import cp_model

    start = time.perf_counter()
    by_id = {c.item_id: c for c in [*free, *safe_free]}
    model = cp_model.CpModel()
    users: dict[str, list] = {}  # item -> vars that use it
    pool_use: dict[str, list] = {}

    def use(item_id, var):
        users.setdefault(item_id, []).append(var)
        cand = by_id.get(item_id)
        if cand and cand.pool:
            pool_use.setdefault(cand.pool, []).append(var)

    req = {c.item_id: model.new_bool_var(f"r_{c.item_id}") for c in safe_free}
    for item_id, var in req.items():
        use(item_id, var)
    for d in donors:
        req[d.own_item] = model.new_bool_var(f"r_{d.own_item}")
        use(d.own_item, req[d.own_item])

    cost_terms, moves = [], {}
    for d in donors:
        stay = model.new_bool_var(f"stay_{d.passenger_id}")
        use(d.own_item, stay)
        own_moves = {(d, j): model.new_bool_var(f"mv_{d.passenger_id}_{j}") for j in d.can_take}
        for (_, j), var in own_moves.items():
            use(j, var)
            cost_terms.append(by_id[j].cost * var)
        moves.update(own_moves)
        model.add_exactly_one([stay, *own_moves.values()])

    for vars_ in users.values():
        model.add_at_most_one(vars_)
    for cabin, vars_ in pool_use.items():
        model.add(sum(vars_) <= pools.get(cabin, 0))

    covered = sum(req.values())
    model.add(covered <= 1)
    uncovered = 1 - covered
    cost_terms += [by_id[i].cost * v for i, v in req.items() if i in by_id]
    rank_terms = [by_id[i].rank * v for i, v in req.items() if i in by_id]
    model.minimize(
        W_UNCOVERED * uncovered
        + W_COST * (sum(cost_terms) + TIER_COST["voucher"] * uncovered + SWAP_COST * sum(moves.values()))
        + W_SWAP * sum(moves.values())
        + sum(rank_terms)
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = TIME_LIMIT_S
    solver.parameters.num_workers = 1
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return greedy(safe_free)

    chosen = next((i for i, v in req.items() if solver.value(v)), None)
    swaps = [
        {"passenger_id": d.passenger_id, "from_item_id": d.own_item, "to_item_id": j}
        for (d, j), var in moves.items()
        if solver.value(var)
    ]
    return Solution(chosen, "cp-sat", _ms(start), swaps)
