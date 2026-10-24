"""m19 smart load: the universal plate, the newsvendor reserve, demand per diet family, sealed-cup spares."""
import pytest
from sqlmodel import select

from app.core.db import new_session
from app.core.models import MealItem, MealSpec, Passenger
from app.modules.m1_rules import engine
from app.modules.m17_passport import service as passport
from app.modules.m19_load import bento, demand, reserve
from app.modules.m19_load.stats import nb_quantile, poisson_cdf, poisson_quantile

FLIGHT = "JL740-20261025"


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


@pytest.fixture
def plan(client):
    res = client.get(f"/api/load/{FLIGHT}")
    assert res.status_code == 200, res.text
    return res.json()


def test_endpoint_shape_and_unknown_flight(client, plan):
    assert {"families", "reserve", "universal", "bento", "assumptions"} <= plan.keys()
    fam = plan["families"][0]
    assert {"family", "label", "known", "forecast", "p90", "loaded", "risk"} <= fam.keys()
    assert {"q", "cu", "co", "ratio"} <= plan["reserve"]["fresh"].keys() and "loaded" in plan["reserve"]
    cand = plan["universal"]["candidates"][0]
    assert {"id", "name", "covers", "matrix"} <= cand.keys() and len(cand["matrix"]) == len(plan["universal"]["profiles"])
    assert plan["bento"]["components"] and plan["bento"]["spares"]
    assert client.get("/api/load/JL999-20261025").status_code == 404


def test_universal_plate_covers_13_of_13(plan):
    table = plan["universal"]
    assert len(table["profiles"]) == 13
    covers = {c["id"]: (c["covers"], c["checks"]) for c in table["candidates"]}
    assert covers["universal"] == (13, 0)
    assert covers["jain_thali"] == (10, 0) and covers["vrat_plate"] == (9, 0) and covers["paneer_rice"] == (8, 0)
    assert covers["chicken_rice"] == (4, 1)  # uncertified chicken: halal needs a check
    universal = table["candidates"][0]
    assert universal["reserve"] and universal["name"]["en"].startswith("Universal plate")


def test_reserve_spec_is_the_universal_plate_and_safe_for_27d(client):
    with new_session() as s:
        spec = s.get(MealSpec, "SPEC-BACKUP")
        backups = s.exec(select(MealItem).where(MealItem.flight_id == FLIGHT, MealItem.kind == "backup")).all()
        shah = s.exec(select(Passenger).where(Passenger.flight_id == FLIGHT, Passenger.seat == "27D")).one()
        rules = passport.rules_for(s, shah.id)
    assert (spec.kind, spec.code) == ("backup", None)
    assert set(spec.tags) == {"samak", "makhana", "bottle_gourd", "rock_salt"}
    assert sorted(b.position for b in backups) == ["G2-B01", "G2-B02", "G2-B03", "G2-B04"]
    assert all(b.spec_id == "SPEC-BACKUP" for b in backups)
    assert engine.evaluate(rules["forbid"], spec.tags)["verdict"] == engine.SAFE
    for preset in ("jain", "jain_no_dairy", "vrat", "vegan"):
        assert engine.evaluate(engine.combine_presets([preset])["forbid"], spec.tags)["verdict"] == engine.SAFE


def test_pouch_reserve_covers_more_than_fresh(plan):
    r = plan["reserve"]
    fresh, pouch = r["fresh"], r["pouch"]
    assert r["lambda"] == pytest.approx(1.8 * 1.3 * 1.25, abs=0.001)  # base × m6 group factor × Sharad Purnima
    assert pouch["ratio"] > fresh["ratio"] and pouch["q"] >= fresh["q"]
    assert pouch["covered"] > fresh["covered"] > r["loaded_covered"]
    assert pouch["expected_waste"] == 0 and fresh["expected_waste"] > 0
    assert pouch["cost_per_flight"] < fresh["cost_per_flight"]
    assert r["loaded"] == 4


def test_newsvendor_is_the_critical_fractile():
    lam = 2.0
    out = reserve.newsvendor(lam, 35_000, 450, wasted=True)
    ratio = 35_000 / 35_450
    assert out["ratio"] == pytest.approx(ratio, abs=1e-4)
    assert poisson_cdf(lam, out["q"]) >= ratio > poisson_cdf(lam, out["q"] - 1)
    assert out["q"] == poisson_quantile(lam, ratio)


def test_families_sum_to_the_cabin(plan):
    fams = {f["family"]: f for f in plan["families"]}
    assert plan["passengers"] == 186 and plan["known"] + plan["unknown"] == 186
    assert sum(f["known"] for f in fams.values()) == plan["known"]
    assert sum(f["forecast"] for f in fams.values()) == pytest.approx(186, abs=0.6)
    assert all(f["p90"] >= f["known"] for f in fams.values())
    assert fams["vegetarian"]["risk"]  # vegetarians share the paneer with everyone who can eat it
    assert not fams["jain"]["risk"]  # specials plus the universal pouches
    assert fams["fasting"]["known"] >= 2  # 29H and the Purnima passenger fast on 25 Oct


def test_family_of_uses_rules_on_the_day():
    assert demand.family_of(engine.combine_presets(["vegetarian", "vrat"])["forbid"], []) == "fasting"
    assert demand.family_of(engine.combine_presets(["jain", "diabetic"])["forbid"], []) == "jain"
    assert demand.family_of(engine.combine_presets(["no_beef", "vegetarian"])["forbid"], []) == "vegetarian"
    assert demand.family_of(["beef"], []) == "no_beef" and demand.family_of([], []) == "non_veg"
    assert demand.family_of(["peanut"], ["peanut"]) == "allergy"
    sunday_vow = {"forbid": ["beef"], "allow": [], "time_rules": [{"id": "TR-1", "kind": "weekday", "weekdays": [6], "preset": "vegetarian"}]}
    assert demand.family_of(passport.rules_on(sunday_vow, "2026-10-25")["forbid"], []) == "vegetarian"


def test_bento_spares_cover_every_failing_cup():
    plan = bento.bento_plan(2.925)
    needs = {n["id"]: n for n in plan["needs"]}
    assert needs["jain"]["fails"] == ["main", "side"] and "base" in needs["vrat"]["fails"]
    spares = plan["spares"]
    cups = {c["id"]: c for c in plan["components"]}
    for nid, need in needs.items():
        forbid = engine.combine_presets(dict((n[0], n[2]) for n in bento.NEEDS)[nid])["forbid"]
        for slot in need["fails"]:
            swap = next(s for s in spares if s["slot"] == slot and nid in s["covers"])
            assert engine.evaluate(forbid, cups[swap["cup_id"]]["tags"])["verdict"] == engine.SAFE
    assert len(spares) == 5 and plan["total_cups"] <= plan["cups_if_stocked_apart"]


def test_negative_binomial_is_wider_than_its_mean():
    assert nb_quantile(0, 8, 0.9) == 0
    assert nb_quantile(10, 8, 0.9) > 10
    assert nb_quantile(10, 1e6, 0.9) == poisson_quantile(10, 0.9)
