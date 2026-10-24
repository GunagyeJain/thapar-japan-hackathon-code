"""PNL/ADL Type-B text: our subset of the IATA layout (see docs/plan/modules/m4-watcher.md).

parse() turns a message into ManifestRow dicts (shared/api.md); render_pnl() does the reverse.
Pure functions: no database, so the reconciler and the simulator can both use them.
"""

import re
import unicodedata
from datetime import date

MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split()
GERMAN = str.maketrans({"Ä": "AE", "Ö": "OE", "Ü": "UE", "ß": "SS"})
TITLES = ("MSTR", "MISS", "MRS", "MR", "MS", "DR")  # longest first, so MRS never reads as MS
MAX_LINE = 64

HEADER = re.compile(r"^([A-Z0-9]{2}\d{1,4})/(\d{2})([A-Z]{3}) ([A-Z]{3}) PART(\d+)$")
CLASS_HEADER = re.compile(r"^-([A-Z]{3})(\d{3})([A-Z])$")
NAME = re.compile(r"^1([A-Z' -]+)/([A-Z' -]+?) \.L/([A-Z0-9]{6})$")
REMARK = re.compile(r"^\.R/([A-Z]{4}) HK1(?: (.*))?$")
GROUP = re.compile(r"^\.R/GRP (.+)$")
CONTINUATION = re.compile(r"^\.RN/(.+)$")
INBOUND = re.compile(r"^\.I/([A-Z0-9]{2}\d{1,4})([A-Z])(\d{2})([A-Z]{3})([A-Z]{3})$")


def type_b(name: str) -> str:
    """Names as Type-B carries them: A-Z only, the ICAO 9303 way (MÜLLER -> MUELLER, JOSÉ -> JOSE)."""
    name = unicodedata.normalize("NFKD", name.upper().translate(GERMAN))
    return "".join(c for c in name if not unicodedata.combining(c))


def split_title(given_title: str) -> tuple[str, str | None]:
    for title in TITLES:
        if given_title.endswith(title) and len(given_title) > len(title):
            return given_title[: -len(title)], title
    return given_title, None


def ddmmm(d: date) -> str:
    return f"{d.day:02d}{MONTHS[d.month - 1]}"


def parse(text: str, year: int) -> dict:
    """Return {kind, flight_no, date, origin, part, rows}. ADL rows also carry `action`: ADD, DEL or CHG.

    Each row keeps its raw `lines` as evidence.

    `year` comes from the flight: Type-B dates have no year.
    """
    lines = [ln.rstrip() for ln in text.strip().splitlines() if ln.strip()]
    kind = lines[0]
    if kind not in ("PNL", "ADL"):
        raise ValueError(f"not a PNL or ADL: {kind!r}")
    head = HEADER.match(lines[1])
    if not head:
        raise ValueError(f"bad header line: {lines[1]!r}")
    flight_no, day, mon, origin, part = head.groups()
    flight_date = date(year, MONTHS.index(mon) + 1, int(day))

    rows: list[dict] = []
    cabin = dest = action = None
    row = None
    for n, line in enumerate(lines[2:], start=3):
        if line.startswith("CFG/") or line == f"END{kind}" or line.startswith("ENDPART"):
            continue
        if line in ("ADD", "DEL", "CHG"):
            action = line
        elif m := CLASS_HEADER.match(line):
            dest, _, cabin = m.groups()
            action = None
        elif m := NAME.match(line):
            surname, given_title, pnr = m.groups()
            given, title = split_title(given_title)
            row = {"pnr": pnr, "surname": surname, "given": given, "title": title, "seat": None,
                   "cabin": cabin, "dest": dest, "ssr": [], "inbound": None, "group": None, "lines": [line]}
            if kind == "ADL":
                if not action:
                    raise ValueError(f"line {n}: name outside ADD/DEL/CHG: {line!r}")
                row["action"] = action
            rows.append(row)
        elif row is None:
            raise ValueError(f"line {n}: element before any name: {line!r}")
        else:
            row["lines"].append(line)
            if m := GROUP.match(line):
                row["group"] = m.group(1)
            elif m := REMARK.match(line):
                code, text_ = m.groups()
                if code == "SEAT":
                    row["seat"] = text_
                else:
                    row["ssr"].append({"code": code, "status": "HK1", "text": text_ or ""})
            elif m := CONTINUATION.match(line):
                if not row["ssr"]:
                    raise ValueError(f"line {n}: continuation with no remark before it: {line!r}")
                row["ssr"][-1]["text"] = f"{row['ssr'][-1]['text']} {m.group(1)}".strip()
            elif m := INBOUND.match(line):
                in_flight, _, in_day, in_from, _ = m.groups()
                # The inbound lands the day of departure or the day before; a day number above ours is last month.
                in_month = flight_date.month if int(in_day) <= flight_date.day else (flight_date.month - 2) % 12 + 1
                in_year = year if in_month <= flight_date.month else year - 1
                row["inbound"] = {"flight": in_flight, "from": in_from,
                                  "date": date(in_year, in_month, int(in_day)).isoformat()}
            else:
                raise ValueError(f"line {n}: unknown element: {line!r}")

    return {"kind": kind, "flight_no": flight_no, "date": flight_date.isoformat(), "origin": origin,
            "part": int(part), "rows": rows}


def name_line(p) -> str:
    return f"1{type_b(p.surname)}/{type_b(p.given)}{p.title or ''} .L/{p.pnr}"


def passenger_lines(p, origin: str) -> list[str]:
    """One passenger's block: name line, then group, meal, seat and inbound elements."""
    out = [name_line(p)]
    if p.group:
        out.append(f".R/GRP {p.group}")
    if p.ssr_meal:
        out.append(f".R/{p.ssr_meal} HK1" + (f" {p.ssr_note}" if p.ssr_note else ""))
    if p.seat:
        out.append(f".R/SEAT HK1 {p.seat}")
    if p.inbound:
        ib = p.inbound
        out.append(f".I/{ib['flight']}{p.cabin}{date.fromisoformat(ib['date']).day:02d}{ib['from']}{origin}")
    return out


def wrap(line: str) -> list[str]:
    """A remark longer than a Type-B line goes on .RN/ continuation lines, split between words."""
    if len(line) <= MAX_LINE or not line.startswith(".R/"):
        return [line]
    out, cur = [], ""
    for word in line.split(" "):
        candidate = f"{cur} {word}" if cur else word
        if len(candidate) > MAX_LINE and cur and cur not in (".RN/",):
            out.append(cur)
            cur = f".RN/{word}"
        else:
            cur = candidate
    out.append(cur)
    return out


def finish(out: list[str]) -> str:
    out = [part for line in out for part in wrap(line)]
    too_long = [ln for ln in out if len(ln) > MAX_LINE]
    if too_long:
        raise ValueError(f"lines over {MAX_LINE} characters: {too_long}")
    return "\n".join(out) + "\n"


def header(flight) -> str:
    return f"{flight.flight_no}/{ddmmm(date.fromisoformat(str(flight.date)[:10]))} {flight.origin} PART1"


def render_pnl(flight, passengers) -> str:
    """Build the PNL for `flight` from Passenger rows (anything with the Passenger fields as attributes)."""
    out = ["PNL", header(flight),
           "CFG/" + "".join(f"{flight.cabins[c]['seats']:03d}{c}" for c in ("C", "Y"))]
    for c in ("C", "Y"):
        booked = sorted((p for p in passengers if p.cabin == c), key=lambda p: (p.surname, p.given, p.pnr))
        out.append(f"-{flight.dest}{len(booked):03d}{c}")
        for p in booked:
            out += passenger_lines(p, flight.origin)
    out.append("ENDPNL")
    return finish(out)


def render_adl(flight, cabin: str, booked: int, sections: list[tuple[str, list[str]]]) -> str:
    """Build a one-class ADL. `sections` is [(ADD|DEL|CHG, lines)] in order."""
    out = ["ADL", header(flight), f"-{flight.dest}{booked:03d}{cabin}"]
    for action, lines in sections:
        out += [action, *lines]
    out.append("ENDADL")
    return finish(out)
