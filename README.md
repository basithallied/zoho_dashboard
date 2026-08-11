# MIS Agent

An AI agent that reads the connected ERP, CRM, HRMS and databases, generates the
daily / weekly / monthly / quarterly MIS packs, routes them through team approval
before management sees them, answers questions about the data, and flags
anomalies before they cost money.

It is a **reporting layer**: it reads from the source systems and never posts
entries back into them.

See [`docs/DESIGN_REVIEW.md`](docs/DESIGN_REVIEW.md) for the review of the BRD
against the previous implementation, and what was reworked.

---

## Running it

**Backend** (Python 3.11+):

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

First start seeds a demonstration dataset (deterministic) and runs an initial
anomaly scan. API docs at <http://localhost:8000/docs>.

**Frontend** (Node 20+), in a second terminal:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The API must be running before the front end is useful — there is no mock-data
fallback, so every screen shows a connection banner without it. If port 5173 is
taken Vite moves to the next free port; that is fine, the API accepts any
localhost port unless `MIS_ALLOWED_ORIGINS` pins the list.

**Everything, in containers:**

```bash
cp .env.example .env   # set POSTGRES_PASSWORD
docker compose up --build
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./sql_app.db` | Postgres URL in deployment |
| `MIS_SCHEDULER_ENABLED` | `1` (`0` in Docker) | Run the scheduler inside the API process |
| `MIS_SCHEDULER_INTERVAL` | `900` | Seconds between scheduler cycles |
| `MIS_ALLOWED_ORIGINS` | unset — any `localhost` / `127.0.0.1` port | CORS allow-list. Set it in deployment to pin exact origins |
| `VITE_API_URL` | `/api` in production builds | API base for the front end |

Run the scheduler as its own process wherever the API has more than one worker:

```bash
cd backend && python -m scheduler
```

### Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest                 # 21 end-to-end checks against a throwaway database
```

---

## How it fits together

```
Source systems ──▶ source tables ──▶ metric registry ──┬──▶ report engine ──▶ approvals ──▶ publication
 (ERP/CRM/HRMS)     (read-only)      services/metrics  │
                                                       ├──▶ chat agent
                          anomaly engine ◀─────────────┘
                                    │
                              audit log (every action)
```

**The metric registry is the single source of every figure.** Reports, dashboard
tiles and chat answers all resolve through it, and each result carries the source
records behind it — so a number in a report and the same number in chat cannot
disagree, and any figure can be opened.

### Backend layout

```
backend/
  main.py                    API app, routers, optional in-process scheduler
  scheduler.py               Standalone scheduler process
  models.py                  Source mirrors, agent state, governance tables
  seed.py                    Demonstration data (stands in for connectors)
  services/
    metrics.py               Metric registry — every figure originates here
    calendar_rules.py        Cadence arithmetic and period resolution
    report_engine.py         Run generation; commentary written from figures only
    approvals.py             draft → in_review → approved → published
    anomaly_engine.py        12 business-data and software-usage rules
    chat_agent.py            Question → metric/period/breakdown → structured answer
    rbac.py, audit.py        Permissions and the audit trail
  routers/                   reports, approvals, anomalies, chat, platform
```

### Front end layout

```
frontend/src/
  App.jsx                    Shell and navigation
  api.js                     API client, identity header, formatting
  components/                Design system, report viewer, source drill-through
  pages/                     One per navigation item
```

---

## The rules the API enforces

These are behaviours, not UI conventions — they hold for any client:

- A reviewer cannot approve a report they have not opened.
- A rejection requires a written reason.
- Only an approved run can be published.
- A metric outside the caller's permitted modules is refused, and the refusal
  says which module and role blocked it.
- A question the agent cannot resolve returns a clarification request, not a
  guess.
- Every one of the above is written to the audit log.

## Identity in this build

Identity arrives as an `X-User-Email` header and resolves to a `Principal`; the
top-bar persona switcher uses it to demonstrate role behaviour. **Replace this
with your identity provider before deploying** — every permission decision reads
the `Principal`, so the change is confined to `services/rbac.py`.
