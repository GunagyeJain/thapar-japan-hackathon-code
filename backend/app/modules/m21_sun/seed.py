from sqlmodel import Session


def seed(session: Session) -> None:
    """Nothing to add: m21 computes from the flight and the sun, and reads passengers' rules from m17."""
