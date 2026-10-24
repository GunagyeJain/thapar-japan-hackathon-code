import importlib.util
from pathlib import Path

import pytest

# Load the module by path so this test runs before the app package exists.
_path = Path(__file__).resolve().parents[1] / "app" / "modules" / "m3_passenger" / "seats.py"
_spec = importlib.util.spec_from_file_location("m3_seats", _path)
seats = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(seats)


def test_first_two_judges_get_5a_then_5c():
    taken: set[str] = set()
    first = seats.next_judge_seat(taken)
    taken.add(first)
    second = seats.next_judge_seat(taken)
    assert (first, second) == ("5A", "5C")


def test_row_5_fills_before_row_20():
    taken = {f"5{c}" for c in "ACDGHK"}
    assert seats.next_judge_seat(taken) == "20A"


def test_skips_seats_already_held_by_passengers():
    assert seats.next_judge_seat({"5A", "5D"}) == "5C"


def test_no_seat_left():
    with pytest.raises(seats.NoSeatLeft):
        seats.next_judge_seat(set(seats.JUDGE_SEATS))


def test_cabin_for_seat():
    assert seats.cabin_for("5K") == "C"
    assert seats.cabin_for("20A") == "Y"
    assert seats.cabin_for("23C") == "Y"


def test_lookup_input_is_forgiving():
    assert seats.clean_pnr(" 6xk2qp ") == "6XK2QP"
    assert seats.clean_surname(" Sharma ") == "SHARMA"
    assert seats.clean_surname("sharma/priya ms") == "SHARMA"
