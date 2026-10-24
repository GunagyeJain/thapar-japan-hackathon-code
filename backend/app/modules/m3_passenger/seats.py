"""Seat and lookup helpers for m3. Plain functions, no database, so they are easy to test."""

# Judges sit in row 5 (business) first, then row 20 (economy). One seat per device.
JUDGE_SEATS: list[str] = [f"5{c}" for c in "ACDGHK"] + [f"20{c}" for c in "ACDEFGHK"]


class NoSeatLeft(Exception):
    pass


def next_judge_seat(taken: set[str]) -> str:
    """First seat in JUDGE_SEATS that nobody holds yet."""
    for seat in JUDGE_SEATS:
        if seat not in taken:
            return seat
    raise NoSeatLeft("All judge seats in rows 5 and 20 are taken")


def cabin_for(seat: str) -> str:
    """Rows 1 to 5 are business (C), everything else economy (Y)."""
    row = int("".join(ch for ch in seat if ch.isdigit()))
    return "C" if row <= 5 else "Y"


def clean_pnr(pnr: str) -> str:
    return "".join(pnr.split()).upper()


def clean_surname(surname: str) -> str:
    """'  Sharma ' and 'SHARMA/PRIYA' both become 'SHARMA'."""
    return surname.strip().split("/")[0].strip().upper()
