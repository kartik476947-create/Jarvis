"""
Thin launcher — the full core agent with live telemetry lives at project root.
Run from repo root:  python core_agent.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core_agent import app  # noqa: E402, F401

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
