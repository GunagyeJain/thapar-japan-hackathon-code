"""Late-request matcher on the seeded JL740 load."""
import pytest
from sqlmodel import select

from app.core.db import new_session
from app.core.models import Alert, Notification, Passenger
from app.modules.m1_rules.engine import combine_presets
from app.modules.m6_matcher.solver import Candidate, Donor, greedy, solve

FLIGHT = "JL740-20261025"
MEHTA = "PX-0122"
JAIN = combine_presets(["jain"])
VEGAN = combine_presets(["vegan"])
HALAL = combine_presets(["halal"])


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


def economy_without_meal(n: int) -> list[str]:
    with new_session() as s:
        rows = s.exec(
            select(Passenger).where(Passenger.flight_id == FLIGHT, Passenger.cabin == "Y", Passenger.ssr_meal == None)  # noqa: E711
        ).all()
    return [p.id for p in rows if p.id != MEHTA][:n]


def add_business_judge(seat: str = "5A") -> str:
    with new_session() as s:
        s.add(Passenger(id="PX-9001", flight_id=FLIGHT, seat=seat, cabin="C", surname="JUDGE", given="A", title="MS", pnr="JDG001", is_judge=True))
        s.commit()
    return "PX-9001"


def late(client, pid, rules, source="gate"):
    res = client.post("/api/late-requests", json={"flight_id": FLIGHT, "passenger_id": pid, **rules, "source": source})
    assert res.status_code == 200, res.text
    return res.json()


def test_inventory_lists_the_load(client):
    body = client.get(f"/api/flights/{FLIGHT}/inventory").json()
    spares = {(i["spec_id"], i["galley"]) for i in body["items"] if i["kind"] == "spare"}
    assert {("SPEC-VJML", "G2"), ("SPEC-AVML", "G1"), ("SPEC-C-JAIN", "G1"), ("SPEC-C-CHANA", "G1")} <= spares
    backups = [i for i in body["items"] if i["kind"] == "backup"]
    assert len(backups) == 4 and {b["galley"] for b in backups} == {"G2"}
    assert sum(b["reserve"] for b in backups) == 2
    assert body["summary"]["free"] > 0 and body["summary"]["backup"] == 4


def test_mehta_gets_the_spare_vjml(client):
    result = late(client, MEHTA, JAIN)["match"]
    assert (result["status"], result["tier"]) == ("matched", "spare_special")
    assert (result["item"]["spec_id"], result["item"]["galley"]) == ("SPEC-VJML", "G2")
    assert result["solver"]["engine"] == "cp-sat"
    reasons = {r["spec_name"]["en"]: [f["tag"] for f in r["fired"]] for r in result["considered"]}
    assert "allium" in reasons["Paneer butter masala with rice"]
    assert "meat" in reasons["Chicken tikka masala with rice"]


def test_jains_after_mehta_get_backups_then_a_voucher(client):
    late(client, MEHTA, JAIN)
    second, third, fourth = economy_without_meal(3)
    assert late(client, second, JAIN)["match"]["tier"] == "backup"
    assert late(client, third, JAIN)["match"]["tier"] == "backup"
    last = late(client, fourth, JAIN)["match"]
    assert last["status"] == "voucher" and last["voucher"]["value_inr"] == 600
    assert last["voucher"]["code"].startswith("VCH-")
    held = [r for r in last["considered"] if r["tier"] == "backup"]
    assert held and held[0]["note"]["en"] == "Held for galley contingencies"


def test_vegan_judge_gets_business_vegan_spare_not_dairy_backup(client):
    judge = add_business_judge()
    result = late(client, judge, VEGAN, source="join")["match"]
    assert result["item"]["spec_id"] == "SPEC-C-CHANA"
    assert result["tier"] == "spare_special"


def test_halal_gets_a_vegetarian_spare(client):
    pid = economy_without_meal(1)[0]
    result = client.post("/api/match", json={"flight_id": FLIGHT, "passenger_id": pid, **HALAL}).json()
    assert result["item"]["spec_id"] == "SPEC-AVML"
    chicken = next(r for r in result["considered"] if r["spec_name"]["en"] == "Chicken tikka masala with rice")
    assert chicken["verdict"] == "NEEDS_HUMAN"


def test_reserve_tells_crew_and_passenger_and_is_idempotent(client):
    first = late(client, MEHTA, JAIN)
    again = late(client, MEHTA, JAIN)
    assert again["late_request"]["id"] == first["late_request"]["id"]
    inv = client.get(f"/api/flights/{FLIGHT}/inventory").json()
    item = next(i for i in inv["items"] if i["id"] == first["match"]["item"]["id"])
    assert item["assigned_passenger_id"] == MEHTA
    notes = client.get("/api/notifications", params={"to": MEHTA}).json()
    assert any("reserved" in n["title"] for n in notes)
    with new_session() as s:
        assert s.exec(select(Alert).where(Alert.type == "LATE_REQUEST", Alert.passenger_id == MEHTA)).first()
        assert s.exec(select(Notification).where(Notification.to == "crew:JL740")).first()
    got = client.get(f"/api/late-requests/{first['late_request']['id']}").json()
    assert got["match"]["item"]["id"] == item["id"]


def test_match_is_a_dry_run(client):
    client.post("/api/match", json={"flight_id": FLIGHT, "passenger_id": MEHTA, **JAIN})
    again = client.post("/api/match", json={"flight_id": FLIGHT, "passenger_id": MEHTA, **JAIN}).json()
    assert again["tier"] == "spare_special"


def test_bad_input(client):
    assert client.post("/api/match", json={"flight_id": FLIGHT, "forbid": ["nope"]}).status_code == 400
    assert client.post("/api/late-requests", json={"flight_id": FLIGHT, "forbid": ["meat"]}).status_code == 422
    assert client.post("/api/late-requests", json={"flight_id": FLIGHT, "passenger_id": "PX-0000", "forbid": ["meat"]}).status_code == 404
    assert client.get("/api/late-requests/LR-NOPE").status_code == 404


def test_solver_swaps_only_to_avoid_a_voucher():
    # Nothing free is safe for the requester; donor D holds S (safe for the requester) and can eat free spare F.
    donors = [Donor("D", own_item="S", can_take=("F",))]
    free = [Candidate("F", cost=1, rank=1)]
    sol = solve([], free, {}, donors)
    assert sol.item_id == "S" and sol.swaps == [{"passenger_id": "D", "from_item_id": "S", "to_item_id": "F"}]
    # With a safe backup free, the requester takes the backup and nobody's meal moves.
    with_backup = solve([Candidate("B", 5, 3)], [*free, Candidate("B", 5, 3)], {}, donors)
    assert (with_backup.item_id, with_backup.swaps) == ("B", [])


def test_solver_matches_greedy_without_swaps():
    cands = [Candidate("M", 3, 2, pool="Y"), Candidate("S", 1, 5), Candidate("B", 5, 1)]
    assert solve(cands, cands, {"Y": 1}, []).item_id == greedy(cands).item_id == "S"
    assert solve([Candidate("M", 3, 2, pool="Y")], [], {"Y": 0}, []).item_id is None


def test_backup_forecast_bumps_around_diwali(client):
    body = client.get("/api/backups/forecast", params={"flight_no": "JL740", "days": 16}).json()
    assert body["service_level"] == pytest.approx(0.95, abs=0.01)
    rows = {r["date"]: r for r in body["rows"]}
    assert len(rows) == 16 and rows["2026-10-26"]["recommended"] == 4
    assert rows["2026-11-08"]["recommended"] > rows["2026-10-27"]["recommended"]
    assert rows["2026-11-08"]["festival"]["en"] == "Diwali"
    assert client.get("/api/backups/forecast", params={"flight_no": "XX999"}).status_code == 404
    assert client.get("/api/backups/forecast", params={"days": 0}).status_code == 422
