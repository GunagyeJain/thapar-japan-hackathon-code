import pytest

import story_v1

FLIGHT = "JL740-20261025"


@pytest.fixture(scope="module")
def story(client):
    """The whole demo, Acts 0 to 6, as the presenter's "Do it for me" would run it."""
    story_v1.run(client)
    rows = client.get(f"/api/flights/{FLIGHT}/passengers?with_promises=true").json()
    priya = next(p for p in rows if p["seat"] == "23C")
    return client.get(f"/api/promises/{priya['promise']['id']}/timeline").json()


def test_priya_timeline_c1_to_c5(story):
    steps = [(e["checkpoint"], e["result"]) for e in story["events"]]
    assert steps == [("C1", "ok"), ("C2", "fail"), ("C2", "fixed"), ("C3", "ok"), ("C4", "ok"), ("C5", "ok")]
    assert story["passenger"]["seat"] == "23C" and story["promise"]["status"] == "fixed"
    c2 = [e for e in story["events"] if e["checkpoint"] == "C2"]
    assert [(e["message"]["kind"], e["message"]["seq"]) for e in c2] == [("ADL", 2), ("ADL", 3)]
    assert all(e["message"] is None for e in story["events"] if e["checkpoint"] != "C2")


def test_breakpoint_is_the_codeshare_rebooking(story):
    bp = story["breakpoint"]
    # The sim clock runs in real time between steps, so compare to the minute (what the screen shows).
    assert (bp["checkpoint"], bp["at"][:16], bp["alert_type"]) == ("C2", "2026-10-24T23:02", "LOST_MEAL")
    assert bp["deadline_at"] == "2026-10-25T00:40:00+05:30"
    assert bp["fixed_at"][:16] == "2026-10-24T23:09" and bp["fix_action"] == "request_again"
    assert bp["fixed_by"]
    assert [a["action"] for a in story["actions"]] == ["request_again", "resolve"]


def test_unknown_promise_is_404(client):
    assert client.get("/api/promises/MP-NOPE/timeline").status_code == 404
