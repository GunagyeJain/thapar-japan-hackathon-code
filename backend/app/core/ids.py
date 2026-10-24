import secrets

# No 0/O/1/I, so ids read cleanly off a label.
ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def new_id(prefix: str, length: int = 8) -> str:
    return f"{prefix}-" + "".join(secrets.choice(ALPHABET) for _ in range(length))
