"""What is on board for JL740 and what a late request may use.

Free for a late request:
- spare special meals nobody holds;
- main-menu meals above the count still owed to passengers without a special meal (per cabin);
- sealed backups, except the last BACKUP_RESERVE, which stay for galley contingencies.
Business-menu meals (spec ids SPEC-C-…) go only to business passengers.
"""
from dataclasses import dataclass, field

from sqlmodel import Session, select

from app.core.models import MealItem, MealSpec, Passenger

BACKUP_RESERVE = 2
TIER_OF_KIND = {"spare": "spare_special", "main": "main_menu", "backup": "backup"}
TIER_COST = {"spare_special": 1, "main_menu": 3, "backup": 5, "voucher": 50}
USABLE_STATUS = ("planned", "loaded")


def menu_cabin(spec_id: str) -> str | None:
    """C for the business menu, Y for economy, None for meals any cabin can have."""
    if spec_id.startswith("SPEC-C-"):
        return "C"
    if spec_id.startswith("SPEC-Y-"):
        return "Y"
    return None


@dataclass
class Inventory:
    flight_id: str
    items: list[MealItem]
    specs: dict[str, MealSpec]
    passengers: dict[str, Passenger]
    free_ids: set[str] = field(default_factory=set)
    reserve_ids: set[str] = field(default_factory=set)
    main_pool: dict[str, int] = field(default_factory=dict)

    def tier(self, item: MealItem) -> str | None:
        return TIER_OF_KIND.get(item.kind)

    def holder_of(self) -> dict[str, MealItem]:
        """passenger_id -> the item they hold."""
        return {i.assigned_passenger_id: i for i in self.items if i.assigned_passenger_id}


def load(session: Session, flight_id: str) -> Inventory:
    items = sorted(session.exec(select(MealItem).where(MealItem.flight_id == flight_id)).all(), key=lambda i: i.position)
    specs = {s.id: s for s in session.exec(select(MealSpec)).all()}
    passengers = {p.id: p for p in session.exec(select(Passenger).where(Passenger.flight_id == flight_id)).all()}
    inv = Inventory(flight_id, items, specs, passengers)
    open_items = [i for i in items if i.assigned_passenger_id is None and i.status in USABLE_STATUS]

    backups = [i for i in open_items if i.kind == "backup"]
    inv.reserve_ids = {i.id for i in backups[-BACKUP_RESERVE:]} if BACKUP_RESERVE else set()

    holders = {i.assigned_passenger_id for i in items if i.assigned_passenger_id}
    for cabin in ("C", "Y"):
        mains = [i for i in open_items if i.kind == "main" and menu_cabin(i.spec_id) == cabin]
        owed = sum(1 for p in passengers.values() if p.cabin == cabin and p.id not in holders)
        inv.main_pool[cabin] = max(0, len(mains) - owed)

    for i in open_items:
        if i.kind == "spare" or (i.kind == "backup" and i.id not in inv.reserve_ids):
            inv.free_ids.add(i.id)
        elif i.kind == "main" and inv.main_pool.get(menu_cabin(i.spec_id) or "Y", 0) > 0:
            inv.free_ids.add(i.id)
    return inv


def item_payload(inv: Inventory, item: MealItem) -> dict:
    spec = inv.specs.get(item.spec_id)
    return {
        **item.model_dump(),
        "spec": spec.model_dump() if spec else None,
        "tier": inv.tier(item),
        "cabin": menu_cabin(item.spec_id),
        "free": item.id in inv.free_ids,
        "reserve": item.id in inv.reserve_ids,
    }


def inventory_payload(inv: Inventory) -> dict:
    open_ = [i for i in inv.items if i.assigned_passenger_id is None and i.status in USABLE_STATUS]
    spares = sum(1 for i in open_ if i.kind == "spare")
    backups = [i for i in open_ if i.kind == "backup"]
    usable_backups = sum(1 for i in backups if i.id not in inv.reserve_ids)
    return {
        "items": [item_payload(inv, i) for i in inv.items],
        "summary": {
            "special": sum(1 for i in inv.items if i.kind == "special"),
            "spare": spares,
            "main": sum(1 for i in open_ if i.kind == "main"),
            "backup": len(backups),
            "free": spares + sum(inv.main_pool.values()) + usable_backups,
            "main_free": inv.main_pool,
            "backup_reserve": len(inv.reserve_ids),
        },
    }
