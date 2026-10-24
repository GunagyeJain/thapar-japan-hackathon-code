"""m19 has no tables: the load plan is computed live from the core seed, m17's passports and m1's rules."""
from sqlmodel import Session


def seed(session: Session) -> None:  # noqa: ARG001 - every module has a seed(); m19 adds no rows
    """Nothing to add. The universal-plate reserve spec (SPEC-BACKUP) lives in the core seed."""
