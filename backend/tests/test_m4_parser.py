from pathlib import Path
from types import SimpleNamespace as NS

import pytest

from app.modules.m4_watcher.parser import parse, render_pnl, split_title

MESSAGES = Path(__file__).resolve().parents[2] / "shared" / "seed" / "messages"

FLIGHT = NS(flight_no="JL740", date="2026-10-25", origin="DEL", dest="NRT", cabins={"C": 30, "Y": 156})


def pax(seat, cabin, surname, given, title, pnr, ssr_meal=None, ssr_note=None, inbound=None, group=None):
    return NS(seat=seat, cabin=cabin, surname=surname, given=given, title=title, pnr=pnr,
              ssr_meal=ssr_meal, ssr_note=ssr_note, inbound=inbound, group=group)


CAST = [
    pax("23C", "Y", "SHARMA", "PRIYA", "MS", "6XK2QP", "AVML", "NO ONION NO GARLIC",
        {"flight": "6E5318", "from": "BOM", "date": "2026-10-24"}),
    pax("02A", "C", "JAIN", "SUSHILA", "MRS", "4QZ8NW", "VJML", "DIABETIC"),
    pax("31K", "Y", "MEHTA", "RAMESH", "MR", "7HN3RD"),
    pax("33D", "Y", "DESAI", "ARJUN", "MSTR", "9TT4KP", "VJML", group="MANGAL YATRA TOURS"),
    pax("05A", "C", "RAO", "LEELA", "DR", "2BB7XC", inbound={"flight": "AI9", "from": "BLR", "date": "2026-09-30"}),
]


@pytest.mark.parametrize("raw,expected", [
    ("PRIYAMS", ("PRIYA", "MS")), ("SUSHILAMRS", ("SUSHILA", "MRS")), ("ARJUNMSTR", ("ARJUN", "MSTR")),
    ("ASHAMISS", ("ASHA", "MISS")), ("RAMESHMR", ("RAMESH", "MR")), ("LEELADR", ("LEELA", "DR")),
])
def test_split_title(raw, expected):
    assert split_title(raw) == expected


def test_pnl_roundtrip():
    text = render_pnl(FLIGHT, CAST)
    msg = parse(text, 2026)
    assert (msg["kind"], msg["flight_no"], msg["date"], msg["origin"]) == ("PNL", "JL740", "2026-10-25", "DEL")
    assert "CFG/030C156Y" in text and "-NRT002C" in text and "-NRT003Y" in text
    rows = {r["pnr"]: r for r in msg["rows"]}
    assert len(rows) == len(CAST)
    for p in CAST:
        r = rows[p.pnr]
        assert (r["seat"], r["cabin"], r["surname"], r["given"], r["title"], r["group"]) == \
            (p.seat, p.cabin, p.surname, p.given, p.title, p.group)
        assert r["ssr"] == ([{"code": p.ssr_meal, "status": "HK1", "text": p.ssr_note or ""}] if p.ssr_meal else [])
        assert r["inbound"] == p.inbound


def test_parse_spec_example():
    text = """PNL
JL740/25OCT DEL PART1
CFG/030C156Y
-NRT030C
1JAIN/SUSHILAMRS .L/4QZ8NW
.R/VJML HK1 DIABETIC
.R/SEAT HK1 02A
-NRT156Y
1SHARMA/PRIYAMS .L/6XK2QP
.R/AVML HK1 NO ONION NO GARLIC
.R/SEAT HK1 23C
.I/6E5318Y24BOMDEL
ENDPNL
"""
    jain, priya = parse(text, 2026)["rows"]
    assert (jain["cabin"], jain["seat"], jain["ssr"][0]["code"]) == ("C", "02A", "VJML")
    assert priya["inbound"] == {"flight": "6E5318", "from": "BOM", "date": "2026-10-24"}


def test_adl_rebook_fixture():
    msg = parse((MESSAGES / "adl_rebook_23C.txt").read_text(), 2026)
    dropped, added = msg["rows"]
    assert (dropped["action"], dropped["pnr"]) == ("DEL", "6XK2QP")
    assert (added["action"], added["pnr"], added["seat"], added["ssr"]) == ("ADD", "8MZ2TN", "23C", [])
    assert added["inbound"]["flight"] == "6E5102"


def test_adl_restore_fixture():
    (row,) = parse((MESSAGES / "adl_restore_23C.txt").read_text(), 2026)["rows"]
    assert (row["action"], row["pnr"]) == ("CHG", "8MZ2TN")
    assert row["ssr"] == [{"code": "AVML", "status": "HK1", "text": "NO ONION NO GARLIC"}]


@pytest.mark.parametrize("text", [
    "XYZ\nJL740/25OCT DEL PART1\n",
    "PNL\nJL740 25OCT DEL\n",
    "PNL\nJL740/25OCT DEL PART1\n.R/AVML HK1\n",
    "ADL\nJL740/25OCT DEL PART1\n-NRT156Y\n1SHARMA/PRIYAMS .L/6XK2QP\n",
    "PNL\nJL740/25OCT DEL PART1\n-NRT156Y\n1SHARMA/PRIYAMS .L/6XK2QP\n.Q/WHAT\n",
])
def test_bad_messages_fail_loudly(text):
    with pytest.raises(ValueError):
        parse(text, 2026)


def test_render_rejects_long_lines():
    with pytest.raises(ValueError):
        render_pnl(FLIGHT, [pax("20A", "Y", "X", "Y", "MR", "AAAAAA", "AVML", "N" * 70)])
