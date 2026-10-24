from sqlmodel import Session


def seed(session: Session) -> None:
    """No rows: after a reset nobody has been asked yet."""
