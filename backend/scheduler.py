"""Standalone scheduler process.

The API can run this loop in-process (`MIS_SCHEDULER_ENABLED=1`), which is
convenient for development. Under gunicorn with several workers that would mean
several schedulers racing to generate the same period, so a real deployment runs
this module as its own single-replica process and starts the API with
`MIS_SCHEDULER_ENABLED=0`.

    python -m scheduler
"""

from __future__ import annotations

import os
import time

import database
import models
from services import anomaly_engine, report_engine

INTERVAL_SECONDS = int(os.getenv("MIS_SCHEDULER_INTERVAL", "900"))


def run_cycle() -> dict:
    db = database.SessionLocal()
    try:
        runs = report_engine.run_due_templates(db)
        escalated = report_engine.escalate_stale_reviews(db)
        scan = anomaly_engine.scan(db)
        return {
            "generated": [run.id for run in runs],
            "escalated": len(escalated),
            "anomalies": scan,
        }
    finally:
        db.close()


def main() -> None:
    models.Base.metadata.create_all(bind=database.engine)
    print(f"[scheduler] started, cycle every {INTERVAL_SECONDS}s")
    while True:
        try:
            result = run_cycle()
            print(
                f"[scheduler] generated={len(result['generated'])} "
                f"escalated={result['escalated']} "
                f"anomalies_created={result['anomalies']['created']}"
            )
        except Exception as exc:  # a bad cycle must not kill the loop
            print(f"[scheduler] cycle failed: {type(exc).__name__}: {exc}")
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
