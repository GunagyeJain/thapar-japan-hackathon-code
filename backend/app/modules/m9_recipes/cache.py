"""Model answers keyed by the sheet's sha256. Committed to git, so the demo runs with Wi-Fi off.

Only Gemini's answers are cached: a dictionary-only read is cheap and should be retried
with the model as soon as there is a key.
"""
import json
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parent / "cache"


def _path(source_hash: str) -> Path:
    return CACHE_DIR / f"{source_hash}.json"


def get(source_hash: str) -> dict | None:
    path = _path(source_hash)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))["result"]
    except (ValueError, KeyError):
        return None


def put(source_hash: str, result: dict, *, model: str, source: str) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"model": model, "source": source, "result": result}
    _path(source_hash).write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
