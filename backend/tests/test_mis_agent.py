"""End-to-end checks for the four BRD capabilities and the rules underneath them.

Runs against a throwaway SQLite database seeded by the app's own startup path,
so it exercises generation, routing, detection and the audit trail together
rather than mocking them apart.

    cd backend && pip install -r requirements-dev.txt && pytest
"""

from __future__ import annotations

import datetime
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["MIS_SCHEDULER_ENABLED"] = "0"
os.environ.setdefault(
    "DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test_mis_agent.db"
)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

ADMIN = {"X-User-Email": "admin@misagent.local"}
VIEWER = {"X-User-Email": "viewer@misagent.local"}


@pytest.fixture(scope="session")
def client():
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def pending_runs(client):
    return client.get("/api/approvals", headers=ADMIN).json()


# --------------------------------------------------------------------------- #
# Seeding
# --------------------------------------------------------------------------- #

def test_seed_produces_a_working_system(client):
    health = client.get("/api/health").json()
    assert health["status"] == "ok"
    assert health["templates"] == 8
    assert health["runs"] > 20
    assert health["anomalies"] > 10


# --------------------------------------------------------------------------- #
# Traceability — "100% of figures traceable to a source record"
# --------------------------------------------------------------------------- #

def test_headline_figures_carry_their_source_records(client):
    metrics = client.get("/api/dashboard", headers=ADMIN).json()["headline_metrics"]
    assert metrics
    for metric in metrics:
        assert metric["record_count"] == 0 or metric["source_refs"]


def test_a_source_reference_opens_the_underlying_record(client):
    metric = client.get("/api/dashboard", headers=ADMIN).json()["headline_metrics"][0]
    ref = metric["source_refs"][0]
    response = client.get(
        f"/api/records/{ref['entity_type']}/{ref['entity_id']}", headers=ADMIN
    )
    assert response.status_code == 200
    assert response.json()["fields"]


def test_published_runs_reference_source_records(client):
    runs = client.get("/api/reports/runs?limit=50", headers=ADMIN).json()
    published = [run for run in runs if run["status"] == "published"]
    assert published
    assert all(run["source_record_count"] > 0 for run in published)


# --------------------------------------------------------------------------- #
# Approval routing — "0 reports reaching management without a logged approval"
# --------------------------------------------------------------------------- #

def test_reviewer_must_open_a_report_before_approving(client, pending_runs):
    run_id = pending_runs[0]["run_id"]
    refused = client.post(f"/api/approvals/runs/{run_id}/approve", headers=ADMIN)
    assert refused.status_code == 409

    content = client.get(f"/api/reports/runs/{run_id}", headers=ADMIN).json()
    assert content["figures"]["sections"]

    approved = client.post(f"/api/approvals/runs/{run_id}/approve", headers=ADMIN)
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"


def test_only_an_approved_run_can_be_published(client, pending_runs):
    run_id = pending_runs[0]["run_id"]      # approved by the test above
    published = client.post(f"/api/approvals/runs/{run_id}/publish", headers=ADMIN)
    assert published.status_code == 200
    assert published.json()["status"] == "published"

    again = client.post(f"/api/approvals/runs/{run_id}/publish", headers=ADMIN)
    assert again.status_code == 409


def test_rejection_requires_a_written_reason(client, pending_runs):
    run_id = pending_runs[1]["run_id"]
    client.get(f"/api/reports/runs/{run_id}", headers=ADMIN)
    assert client.post(
        f"/api/approvals/runs/{run_id}/reject", json={"reason": "no"}, headers=ADMIN
    ).status_code == 422
    accepted = client.post(
        f"/api/approvals/runs/{run_id}/reject",
        json={"reason": "Accruals for the period are not posted yet."},
        headers=ADMIN,
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "rejected"


def test_a_viewer_cannot_decide_on_a_report(client, pending_runs):
    run_id = pending_runs[2]["run_id"]
    assert client.post(f"/api/approvals/runs/{run_id}/approve", headers=VIEWER).status_code == 403


def test_every_lifecycle_step_is_audited(client):
    entries = client.get("/api/audit-logs?days=1&limit=500", headers=ADMIN).json()
    actions = {entry["action"] for entry in entries}
    assert {
        "report.generated", "report.viewed", "report.approved",
        "report.published", "report.rejected",
    } <= actions


def test_commentary_is_written_from_figures_not_instead_of_them(client, pending_runs):
    run_id = pending_runs[3]["run_id"]
    run = client.get(f"/api/reports/runs/{run_id}", headers=ADMIN).json()
    assert run["commentary"]["written_by"] == "agent"
    # Commentary sections mirror the figure sections; it cannot introduce a section
    # (and therefore a number) of its own.
    figure_keys = {section["key"] for section in run["figures"]["sections"]}
    assert set(run["commentary"]["sections"]) <= figure_keys


# --------------------------------------------------------------------------- #
# Chat with data
# --------------------------------------------------------------------------- #

def test_chat_answers_with_figures_charts_and_sources(client):
    response = client.post(
        "/api/chat/ask",
        json={"message": "total sales for this month vs last month"},
        headers=ADMIN,
    ).json()
    answer = response["answer"]
    assert answer["metric"] == "revenue_invoiced"
    assert answer["kpis"] and answer["table"]["rows"]
    assert answer["sources"]
    assert answer["confidence"] in ("high", "medium", "low")


def test_chat_carries_context_across_turns(client):
    first = client.post(
        "/api/chat/ask", json={"message": "revenue this quarter"}, headers=ADMIN
    ).json()
    follow_up = client.post(
        "/api/chat/ask",
        json={"message": "now split that by business unit", "conversation_id": first["conversation_id"]},
        headers=ADMIN,
    ).json()["answer"]
    assert follow_up["metric"] == "revenue_invoiced"
    assert follow_up["chart"]["type"] == "bar"
    assert len(follow_up["table"]["rows"]) > 1


def test_chat_asks_instead_of_guessing(client):
    answer = client.post(
        "/api/chat/ask", json={"message": "what is the vibe of the company"}, headers=ADMIN
    ).json()["answer"]
    assert answer["needs_clarification"] is True
    assert answer["suggestions"]


def test_chat_refuses_data_outside_the_callers_scope(client):
    answer = client.post(
        "/api/chat/ask", json={"message": "what are the overdue receivables"}, headers=VIEWER
    ).json()["answer"]
    assert answer.get("permission_denied") is True
    assert "finance" in answer["answer"]


# --------------------------------------------------------------------------- #
# Anomaly detection
# --------------------------------------------------------------------------- #

def test_every_anomaly_explains_itself(client):
    listed = client.get("/api/anomalies?status=active", headers=ADMIN).json()
    assert listed
    for item in listed[:5]:
        detail = client.get(f"/api/anomalies/{item['id']}", headers=ADMIN).json()
        assert detail["what_happened"]
        assert detail["why_it_matters"]
        assert detail["recommended_actions"]
        assert detail["source_refs"]


def test_both_rule_families_fire(client):
    listed = client.get("/api/anomalies?status=active&limit=200", headers=ADMIN).json()
    domains = {item["domain"] for item in listed}
    assert {"business", "software_usage"} <= domains


def test_rescanning_updates_rather_than_duplicates(client):
    result = client.post("/api/anomalies/scan", headers=ADMIN).json()
    assert result["created"] == 0
    assert result["updated"] > 0


def test_marking_a_false_positive_suppresses_it_and_tunes_the_rule(client):
    target = client.get("/api/anomalies?status=active", headers=ADMIN).json()[0]
    client.patch(
        f"/api/anomalies/{target['id']}/status",
        json={"status": "false_positive", "note": "known and accepted"},
        headers=ADMIN,
    )
    rescan = client.post("/api/anomalies/scan", headers=ADMIN).json()
    assert rescan["suppressed"] >= 1

    rules = {rule["code"]: rule for rule in client.get("/api/anomalies/rules/list", headers=ADMIN).json()}
    assert rules[target["rule_code"]]["sensitivity"] > 1.0


# --------------------------------------------------------------------------- #
# Delivery formats
# --------------------------------------------------------------------------- #

def test_runs_export_as_html_and_csv(client, pending_runs):
    run_id = pending_runs[0]["run_id"]
    assert client.get(f"/api/reports/runs/{run_id}/export.html", headers=ADMIN).status_code == 200
    csv = client.get(f"/api/reports/runs/{run_id}/export.csv", headers=ADMIN)
    assert csv.status_code == 200
    assert csv.text.splitlines()[0].startswith("section,metric,value")


# --------------------------------------------------------------------------- #
# Reporting calendar
# --------------------------------------------------------------------------- #

def test_cadences_follow_the_brd_calendar():
    from services.calendar_rules import next_run_at, period_for

    friday = datetime.datetime(2026, 8, 7, 12, 0)
    assert next_run_at("daily", friday) == datetime.datetime(2026, 8, 8, 7, 0)
    assert next_run_at("weekly", friday).weekday() == 0

    mid_august = datetime.datetime(2026, 8, 20, 12, 0)
    monthly = next_run_at("monthly", mid_august)
    assert (monthly.month, monthly.day) == (9, 3)          # 3rd working day
    assert next_run_at("quarterly", mid_august).month == 10  # next quarter

    assert period_for("daily", friday).label == "06 Aug 2026"
    assert period_for("monthly", mid_august).label == "Jul 2026"


def test_working_day_arithmetic_skips_weekends_and_holidays():
    from services.calendar_rules import nth_working_day, set_holidays

    # November 2026 starts on a Sunday: 2nd is the first working day.
    assert nth_working_day(2026, 11, 3) == datetime.date(2026, 11, 4)
    set_holidays(["2026-11-03"])
    assert nth_working_day(2026, 11, 3) == datetime.date(2026, 11, 5)
    set_holidays([])
