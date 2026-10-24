from sqlmodel import Session


def seed(session: Session) -> None:
    """Add this module's demo rows. Runs after m0 on every reset; add rows, don't commit."""
