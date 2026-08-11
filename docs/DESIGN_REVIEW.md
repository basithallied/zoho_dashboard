# MIS Agent — design review and rework

Reviewed against `MIS_Agent_BRD.pdf` (v0.1 draft, 11 August 2026) and the four
product-concept screens (Dashboard, Reports & Schedules, Chat with Data,
Anomalies).

---

## 1. What the concept asks for

The BRD describes an agent with four capabilities and one non-negotiable
property underneath all of them.

| # | Capability | The part that carries the risk |
|---|------------|--------------------------------|
| 1 | Scheduled reports | Templates are configuration; the AI writes commentary, never the numbers |
| 2 | Approval routing | Nothing reaches management without a logged approval by a named reviewer |
| 3 | Chat with data | Every figure opens the records behind it; permission-aware; says when it does not know |
| 4 | Anomaly detection | Each item explains itself, is severity-ranked and routed, and tunes on false positives |

The success criteria are stated as: **100% of figures traceable to a source
record**, **0 reports reaching management without a logged approval**, **<20%
anomaly false-positive rate after tuning**.

Those three numbers are what made this a rework rather than a re-skin. They are
properties of the data path, not of the screens.

---

## 2. What existed before

The repository held a Zoho dashboard: a KPI grid, filter bar, charts, and a chat
box. Measured against the BRD:

| BRD capability | Previous state |
|---|---|
| Scheduled reports | **Absent.** No template, no schedule, no run, no cadence arithmetic |
| Approval routing | **Absent.** No reviewer, no state machine, no record of who signed off |
| Chat with data | **Keyword match.** `if "lead" in msg` returned a hardcoded sentence. No chart, no table, no sources, no follow-up context |
| Anomaly detection | **Three hardcoded strings** in `/api/analytics/ai-forecast`, including a fabricated "94.2% confidence" |
| Traceability | **None.** No figure could be opened |
| Audit trail | **None** |
| Permissions | **None.** A `role` column existed on `users` and was never read |

Other findings worth recording:

- `mock_data.py` built a `kpis` list and never added it to the session, so the
  KPI cards on the dashboard were reading an empty table.
- `/api/crm/leaderboard`, `/api/crm/channel-roi`, `/api/books/cashflow-timeline`
  and `/api/projects/workload` returned invented literals presented to the user
  as company performance. Under a BRD that promises every figure is traceable,
  these are not placeholders — they are the failure mode the document is written
  to prevent.
- `database.py` hardcoded SQLite while `docker-compose.yml` passed a
  `DATABASE_URL` that nothing read.
- CORS was `allow_origins=["*"]` with `allow_credentials=True`.

The dashboard was a reasonable prototype of a *dashboard*. It was not a
prototype of the agent in the BRD, and roughly none of it could be extended into
one, because the missing pieces (a metric layer, a run lifecycle, an audit trail)
sit underneath everything the old code did rather than beside it.

---

## 3. What was built

### 3.1 One metric layer under everything

`backend/services/metrics.py` is a registry of metric definitions — label,
module, unit, synonyms, dimensions, and a compute function. Every figure in the
system resolves through it: scheduled reports, dashboard tiles and chat answers
all call the same code.

Each result carries `source_refs` — the rows the number came from — and a
`query_description`. `GET /api/records/{entity_type}/{entity_id}` opens any of
them, and the UI makes every figure clickable through to that record.

This is what makes "100% traceable" a structural property rather than a promise:
there is no second path by which a number can reach a screen.

### 3.2 Report engine (`services/report_engine.py`, `services/calendar_rules.py`)

- Four cadences with the BRD's calendar arithmetic: daily T+1 07:00, weekly
  Monday, monthly 3rd working day, quarterly 5th working day. Working days skip
  weekends and a configurable holiday list.
- Templates are rows, not code: `sections`, `metrics`, `comparison` and
  `thresholds` are JSON columns, editable through `PATCH /api/reports/schedules/{id}`.
- `build_figures` computes the figures; `write_commentary` receives **only the
  already-computed figures** and returns prose. That separation is the seam where
  a language model plugs in, and it is deliberately unable to change a number.
- Delivery as interactive HTML (`export.html`) and CSV/Excel (`export.csv`) off
  the same payload.

### 3.3 Approval routing (`services/approvals.py`)

`draft → in_review → approved → published`, with `rejected` as a branch.

Two BRD rules are enforced in the API rather than the UI, because the UI is not
the only client:

- **A reviewer cannot approve a report they have not opened.** `opened_at` is
  stamped by the endpoint that serves report content; `approve()` returns 409
  without it.
- **A rejection without a reason is not a rejection** (422 under 10 characters).

Publishing requires `approved`, and it is the only path that sets
`published_at` — that is the mechanism behind "0 reports reaching management
without a logged approval". Line-item annotations, a routing matrix
(owner / reviewer / escalation team + recipients) and SLA escalation are all in.

### 3.4 Anomaly engine (`services/anomaly_engine.py`)

Twelve rules over real data, in the two families the BRD names:

*Business data* — invoice not raised for completed work, project cost over
budget, dormant leads, resource overallocation, schedule slippage, quotations
not followed up.

*Software usage* — failed-login bursts, off-hours access, out-of-geography
access, bulk deletes, permission changes, edits to closed accounting periods.

Every finding carries what happened, why it matters, the financial impact, the
recommended actions, an owner and its source records — a rule that cannot supply
those does not fire. Findings are keyed deterministically, so a re-scan updates
rather than duplicates; critical items with `alert_immediately` are stamped as
alerted at detection instead of waiting for the next report.

Marking a false positive suppresses the item and raises the rule's `sensitivity`
multiplier, which scales its thresholds on the next scan. The false-positive
rate per rule and overall is reported on the Anomalies screen, against the BRD's
<20% target.

### 3.5 Chat with data (`services/chat_agent.py`)

Resolves a question to a metric, a period and an optional breakdown dimension,
then answers from the registry: narrative, KPI cards, chart, table, source
records, and a stated confidence.

- **Follow-ups carry context** — "now split that by business unit" reuses the
  previous metric and period from the conversation row.
- **Permission-aware** — a metric outside the caller's modules is refused
  explicitly, naming the module and the role, rather than silently returning
  nothing.
- **Honest about limits** — an unmatched question returns `needs_clarification`
  with suggestions instead of a guess; a month-to-date window compared against a
  full prior month says so; an as-of figure (open pipeline, overdue balance)
  suppresses a period-over-period line that would be meaningless.

### 3.6 Governance

`AuditLog` records generation, viewing, approval, rejection, publication,
annotation, anomaly triage, rule changes, source syncs, record views and every
chat answer. Roles map to actions, teams map to readable modules, and both are
enforced server-side in one place (`services/rbac.py`).

### 3.7 Front end

Rebuilt to the concept screens: dark navy rail, light canvas, indigo accent, and
the nine-item information architecture — Dashboard, Reports & Schedules,
Approvals, Chat with Data, Anomalies, Data Sources, Users & Teams, Settings,
Audit Logs. Glassmorphism, the mock-data toggle, the model picker and the
"Mobile App View" tab are gone.

---

## 4. Decisions worth challenging

1. **Identity is a header (`X-User-Email`), not a login.** There was no auth in
   the repository and inventing one would have been a larger, separate change.
   Every permission decision is server-side and reads a `Principal`, so wiring
   SSO means replacing one function. The persona switcher in the top bar exists
   to demonstrate the role behaviour. **This is not deployable to production as
   is** — anyone can set the header.
2. **Commentary is deterministic today.** `write_commentary` produces sentences
   from the figures. It has the exact input an LLM would receive. I did not add a
   model call because the BRD's hard constraint is that the AI never touches the
   numbers, and the value of this rework is the seam that guarantees it.
3. **Delivery is recorded, not sent.** Publishing marks recipients as delivered
   and logs it; no SMTP client is wired up.
4. **Seeded data, not connectors.** `seed.py` stands in for the ERP/CRM/HRMS
   connectors and deliberately plants the exceptions the rules catch. The source
   tables are shaped as read-only mirrors, which is the shape a connector fills.
5. **The scheduler is a separate process.** In-process scheduling under four
   gunicorn workers means four schedulers generating the same period. The API
   defaults to `MIS_SCHEDULER_ENABLED=0` in Docker and `python -m scheduler`
   runs as its own single-replica service.

---

## 5. Still open

| Gap | Why it matters |
|---|---|
| Authentication and SSO | The header-based identity is a demo affordance |
| Live ERP / CRM / HRMS connectors | Everything else is built against the shape they will fill |
| Email/Slack delivery | Publication is logged but nothing leaves the system |
| PDF export | HTML and CSV are in; PDF needs a renderer |
| Row-level permissions | Scope is per module; the BRD says "exactly as they would in the source system", which is per record |
| LLM commentary and NL parsing | Both seams exist; neither is connected |
| Report builder UI | Templates are editable over the API, and read-only in the UI |
| Database migrations | `create_all` is fine for a prototype, not for a schema that will change |
| Test depth | `backend/tests/test_mis_agent.py` covers the four capabilities and the guards end to end (21 tests). Unit coverage of individual rules and metrics is thin, and the front end has none |

---

## 6. Verification performed

```
cd backend && pip install -r requirements-dev.txt && pytest    # 21 passed
```

- API smoke run across every endpoint (dashboard, schedules, runs, approvals,
  anomalies, rules, chat, audit, sources, records).
- Governance guards exercised end to end: approve-before-open → 409;
  short rejection reason → 422; publish before approval → 409; viewer approving
  → 403; publish twice → 409.
- Chat: metric resolution, follow-up context, breakdowns, permission refusal for
  a viewer asking a finance question, and clarification on an unanswerable
  question.
- Anomalies: scan → triage → false-positive suppression confirmed on re-scan
  (`created: 0, suppressed: 1`) with the rule's sensitivity tightening.
- All nine screens rendered in Chromium at 1512×1000 with no console errors, and
  the source-record drill-through opened from a chat answer.
