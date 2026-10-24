from sqlmodel import Session


def seed(session: Session) -> None:
    """No rows: a reset gives an empty change log. The standby bank's stock is config (windows.STANDBY_BANK) minus
    what the log has used."""
