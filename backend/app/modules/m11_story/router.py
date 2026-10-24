"""m11 endpoints: the demo scenario and the step runner."""
from collections.abc import Callable

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import clock
from app.modules.m11_story import actions, state
from app.modules.m11_story.steps import BY_N, STEPS

router = APIRouter(prefix="/api", tags=["m11 · story engine"])

# Step n -> (runs every time, runs only with auto=true: the presenter's click)
RUNS: dict[int, tuple[Callable | None, Callable | None]] = {
    0: (None, None),
    1: (None, actions.priya_passport),
    2: (actions.radar_scan, actions.radar_yes),
    3: (None, actions.chaos_run),
    4: (None, actions.crew_events),
    5: (None, None),
}


class StepIn(BaseModel):
    n: int = Field(ge=0, le=len(STEPS) - 1)
    auto: bool = False


@router.get("/demo/scenario")
def get_scenario() -> dict:
    ran = set(state.done())
    return {
        "current": state.current(),
        "steps": [
            {
                "n": s.n,
                "act": s.act,
                "title": s.title,
                "sim_time": s.sim_time.isoformat(),
                "screen": s.screen,
                "cue": s.cue,
                "auto": s.auto,
                "done": s.n in ran,
            }
            for s in STEPS
        ],
    }


@router.post("/demo/step")
def post_step(body: StepIn) -> dict:
    """Run step n: set the sim clock, do the step's own work and, with auto, the presenter's action too."""
    step = BY_N[body.n]
    did: list[str] = []
    try:
        if step.n == 0:
            actions.fresh_start(did)
        clock.set(step.sim_time)
        always, presenter = RUNS[step.n]
        if always:
            always(did)
        if body.auto and presenter:
            presenter(did)
    except actions.StepError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    state.mark(step.n)
    return {"current": step.n, "clock": clock.now().isoformat(), "did": did}
