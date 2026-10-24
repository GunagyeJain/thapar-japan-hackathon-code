"""m9 eval table: the hand-labelled set, the committed model answers, and the numbers."""
from fastapi.testclient import TestClient

from app.main import app
from app.modules.m1_rules import engine
from app.modules.m9_recipes import evaluation

client = TestClient(app)


def test_eval_set_is_labelled_with_vegetarian_families():
    data = evaluation.load()
    families = set(engine.rules().diets[data["diet"]]["forbid"])
    ids = [d["id"] for d in data["dishes"]]
    assert len(ids) == len(set(ids)) and len(ids) >= 20
    for dish in data["dishes"]:
        assert evaluation.sheet_text(dish).startswith("料理名：")
        assert set(dish["truth"]) <= families, dish["id"]
        assert dish["why"], dish["id"]


def test_readers_are_compared_on_the_same_dishes():
    """Sheets the model hasn't read yet (fill with `python -m app.modules.m9_recipes.evaluation --fill`)
    are left out of all three rows, so the numbers stay comparable."""
    t = evaluation.table()
    read = [r for r in t["rows"] if r["model"] is not None]
    assert t["compared"] == len(read) == len(t["rows"]), "an eval sheet lost its cached model answer"
    assert {m["dishes"] for m in t["metrics"].values()} == {len(read)}


def test_dictionary_traps_show_up_as_false_alarms_and_misses():
    rows = {r["id"]: r for r in evaluation.table()["rows"]}
    assert rows["miso_soup"]["dictionary"] == ["seafood"]
    # 精進だし contains だし, so the dictionary reads bonito; ちくわ isn't in the dictionary at all.
    assert rows["shojin_nimono"]["dictionary"] == ["seafood"]
    assert rows["takikomi_gohan"]["dictionary"] == []


def test_metrics_count_hits_misses_and_false_alarms():
    rows = [
        {"truth": ["meat"], "x": ["meat", "seafood"]},
        {"truth": ["egg", "seafood"], "x": ["egg"]},
        {"truth": [], "x": []},
        {"truth": [], "x": ["meat"]},
    ]
    m = evaluation._metrics(rows, "x")
    assert (m["hits"], m["misses"], m["false_alarms"]) == (2, 1, 2)
    assert m["recall"] == round(2 / 3, 3) and m["precision"] == 0.5
    assert (m["unsafe_dishes_caught"], m["unsafe_dishes"], m["safe_dishes_flagged"], m["safe_dishes"]) == (2, 2, 1, 2)


def test_eval_endpoint_returns_three_readers():
    res = client.get("/api/recipes/eval")
    assert res.status_code == 200
    body = res.json()
    assert set(body["metrics"]) == {"dictionary", "model", "combined"}
    assert all(body["metrics"][k]["recall"] is not None for k in body["metrics"])
    assert {"id", "dish", "truth", "dictionary", "model", "combined"} <= set(body["rows"][0])
