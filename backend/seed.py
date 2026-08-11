"""Demonstration data.

This stands in for the ERP / CRM / HRMS connectors until they are wired up. It
is deterministic (fixed seed) so screenshots, anomaly counts and report figures
are stable between restarts, and it deliberately plants the exceptions the
anomaly rules are meant to catch.
"""

from __future__ import annotations

import datetime
import random

from sqlalchemy.orm import Session

import models
from services import anomaly_engine, approvals, calendar_rules, report_engine
from services.rbac import Principal

BUSINESS_UNITS = ["Trading", "Manufacturing", "Services", "Distribution"]
CUSTOMERS = [
    "Al Noor Holding", "King Road Developments", "Makkah Hospitality Group",
    "Dammam Logistics Co.", "Riyadh Residential Trust", "Arabian Facilities Co.",
    "Urban Build LLC", "Gulf Industrial Partners",
]
SALES_OWNERS = ["Ahmed Al-Mansoor", "Sarah Al-Rashid", "Tariq Mahmood", "Fatima Hassan"]
PROJECT_MANAGERS = ["Omar Al-Farsi", "Layla Haddad", "Yousef Rahman"]
EXPENSE_CATEGORIES = [
    "Software & Subscriptions", "Travel & Accommodation", "Subcontractors",
    "Marketing", "Office & Utilities", "Materials",
]
VENDORS = ["AWS", "Zoho", "Saudi Electricity", "Al Faisal Contracting", "Jarir", "Aramex"]


def _dt(days_ago: int, hour: int = 9) -> datetime.datetime:
    return (models.utcnow() - datetime.timedelta(days=days_ago)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )


def seed_all(db: Session, *, force: bool = False) -> None:
    if db.query(models.ReportTemplate).count() and not force:
        return

    random.seed(42)
    _clear(db)

    teams = _seed_teams(db)
    _seed_users(db, teams)
    _seed_data_sources(db)
    _seed_source_records(db)
    _seed_usage_events(db)
    _seed_anomaly_rules(db)
    templates = _seed_templates(db, teams)
    _seed_runs(db, templates)

    anomaly_engine.scan(db, actor_email="seed@misagent.local")


def _clear(db: Session) -> None:
    for model in (
        models.ChatMessage, models.Conversation, models.ReportAnnotation, models.Approval,
        models.ReportRun, models.ReportTemplate, models.Anomaly, models.AnomalyRule,
        models.AuditLog, models.SystemUsageEvent, models.HeadcountRecord, models.Expense,
        models.Invoice, models.ResourceAllocation, models.ProjectTask,
        models.ProjectMilestone, models.Project, models.CRMQuotation, models.CRMDeal,
        models.CRMLead, models.DataSource, models.User, models.Team,
    ):
        db.query(model).delete()
    db.commit()


def _seed_teams(db: Session) -> dict[str, models.Team]:
    definitions = [
        ("Top Management", ["finance", "crm", "projects", "hr", "procurement", "security"]),
        ("Finance", ["finance"]),
        ("Sales", ["crm"]),
        ("Operations", ["projects"]),
        ("HR", ["hr"]),
        ("Procurement", ["procurement"]),
        ("IT & Security", ["security"]),
    ]
    teams = {}
    for name, scope in definitions:
        team = models.Team(name=name, scope_modules=scope)
        db.add(team)
        teams[name] = team
    db.commit()
    return teams


def _seed_users(db: Session, teams: dict[str, models.Team]) -> None:
    people = [
        ("admin@misagent.local", "Admin User", "admin", "Top Management"),
        ("ceo@misagent.local", "Khalid Al-Otaibi", "top_management", "Top Management"),
        ("cfo@misagent.local", "Huda Al-Amri", "top_management", "Top Management"),
        ("finance.lead@misagent.local", "Fahad Al-Qahtani", "reviewer", "Finance"),
        ("sales.lead@misagent.local", "Sarah Al-Rashid", "reviewer", "Sales"),
        ("ops.lead@misagent.local", "Omar Al-Farsi", "reviewer", "Operations"),
        ("hr.lead@misagent.local", "Nada Siddiqui", "reviewer", "HR"),
        ("procurement.lead@misagent.local", "Bilal Haddad", "reviewer", "Procurement"),
        ("analyst@misagent.local", "Rania Khoury", "analyst", "Finance"),
        ("viewer@misagent.local", "Mansour Tayeb", "viewer", "Sales"),
    ]
    for email, name, role, team_name in people:
        db.add(models.User(
            email=email,
            full_name=name,
            hashed_password="not-a-real-credential-store",
            role=role,
            team_id=teams[team_name].id,
            last_login_at=_dt(random.randint(0, 3), random.randint(8, 18)),
        ))
    db.commit()


def _seed_data_sources(db: Session) -> None:
    sources = [
        ("ERP", "erp", "Odoo", 15, 48210),
        ("CRM", "crm", "Zoho CRM", 5, 12480),
        ("HRMS", "hrms", "Zoho People", 60, 1840),
        ("Database", "database", "MySQL", 10, 96500),
    ]
    for name, kind, vendor, interval, records in sources:
        db.add(models.DataSource(
            name=name,
            kind=kind,
            vendor=vendor,
            status="connected",
            access_mode="read_only",
            last_sync_at=models.utcnow() - datetime.timedelta(minutes=random.randint(2, 20)),
            sync_interval_minutes=interval,
            record_count=records,
        ))
    db.commit()


def _seed_source_records(db: Session) -> None:
    today = datetime.date.today()

    # --- projects, milestones, tasks, allocations --------------------------
    project_specs = [
        ("Al Noor Tower", "Al Noor Holding", "Services", 1_250_000, 980_000, 62),
        ("King Road Villas", "King Road Developments", "Manufacturing", 2_400_000, 1_950_000, 71),
        ("Makkah Hotel Fit-out", "Makkah Hospitality Group", "Services", 1_800_000, 1_400_000, 48),
        ("Warehouse — Dammam", "Dammam Logistics Co.", "Distribution", 900_000, 720_000, 88),
        ("Residential Compound", "Riyadh Residential Trust", "Trading", 3_100_000, 2_450_000, 35),
        ("Corporate HQ Refit", "Gulf Industrial Partners", "Services", 640_000, 500_000, 100),
    ]
    projects: list[models.Project] = []
    for index, (name, customer, unit, contract, budget, completion) in enumerate(project_specs):
        status = "completed" if completion >= 100 else "in_progress"
        # King Road Villas is deliberately 15% over budget.
        overrun = 1.15 if name == "King Road Villas" else random.uniform(0.75, 1.02)
        baseline_end = today + datetime.timedelta(days=90 - index * 12)
        project = models.Project(
            source_id=f"PRJ-{1000 + index}",
            name=name,
            customer=customer,
            status=status,
            manager=PROJECT_MANAGERS[index % len(PROJECT_MANAGERS)],
            business_unit=unit,
            completion_percentage=completion,
            contract_value=contract,
            budget=budget,
            actual_cost=round(budget * completion / 100 * overrun, 2),
            start_date=_dt(180 - index * 10),
            baseline_end_date=datetime.datetime.combine(baseline_end, datetime.time()),
            forecast_end_date=datetime.datetime.combine(
                baseline_end + datetime.timedelta(days=random.choice([0, 0, 3, 14])),
                datetime.time(),
            ),
        )
        db.add(project)
        projects.append(project)
    db.commit()

    milestones: list[models.ProjectMilestone] = []
    for project in projects:
        stages = [("Design", 0.15), ("Structure", 0.35), ("MEP", 0.30), ("Handover", 0.20)]
        for order, (stage, share) in enumerate(stages):
            reached = project.completion_percentage >= (order + 1) * 25
            # Two completed milestones are left uninvoiced on purpose.
            uninvoiced = project.name in ("Al Noor Tower", "Warehouse — Dammam") and stage == "Structure"
            milestone = models.ProjectMilestone(
                source_id=f"MS-{project.source_id}-{order + 1}",
                project_id=project.id,
                name=f"{stage} 100%" if reached else stage,
                completion_percentage=100 if reached else min(project.completion_percentage, 90),
                value=round(project.contract_value * share, 2),
                planned_completion=(project.start_date + datetime.timedelta(days=45 * (order + 1))).date(),
                actual_completion=(
                    (project.start_date + datetime.timedelta(days=45 * (order + 1) + random.randint(-3, 6))).date()
                    if reached else None
                ),
                is_invoiced=reached and not uninvoiced,
            )
            db.add(milestone)
            milestones.append(milestone)
    db.commit()

    task_names = ["Site mobilisation", "Structural works", "MEP installation", "Finishes", "Snagging"]
    for project in projects:
        for order, task_name in enumerate(task_names):
            baseline = (project.start_date + datetime.timedelta(days=40 * (order + 1))).date()
            # Makkah Hotel MEP slips well past baseline.
            slip = 12 if (project.name == "Makkah Hotel Fit-out" and task_name == "MEP installation") else random.choice([0, 0, 2, 4])
            db.add(models.ProjectTask(
                source_id=f"TSK-{project.source_id}-{order + 1}",
                project_id=project.id,
                name=task_name,
                owner=project.manager,
                status="completed" if baseline < today - datetime.timedelta(days=20) else "in_progress",
                baseline_end=baseline,
                forecast_end=baseline + datetime.timedelta(days=slip),
            ))
    db.commit()

    week_start = today - datetime.timedelta(days=today.weekday())
    resources = [
        ("Civil Team 2", "Civil"), ("MEP Crew 1", "MEP"), ("Design Studio", "Design"),
        ("QA & Commissioning", "Quality"), ("Site Supervision", "Supervision"),
    ]
    for resource_name, discipline in resources:
        # Civil Team 2 is booked at 120% across two projects.
        allocations = (
            [(projects[0], 70), (projects[1], 50)]
            if resource_name == "Civil Team 2"
            else [(random.choice(projects), random.randint(40, 80))]
        )
        for project, percentage in allocations:
            db.add(models.ResourceAllocation(
                resource_name=resource_name,
                discipline=discipline,
                project_id=project.id,
                allocation_percentage=percentage,
                week_starting=week_start,
            ))
    db.commit()

    # --- CRM ---------------------------------------------------------------
    lead_statuses = ["new", "contacted", "qualified", "converted", "lost"]
    for index in range(60):
        created = _dt(random.randint(1, 150))
        status = random.choice(lead_statuses)
        # A handful of open leads go quiet for well over a month.
        idle_days = (
            random.choices([2, 5, 12, 45, 70], weights=[35, 25, 20, 12, 8])[0]
            if status in ("new", "contacted", "qualified") else 2
        )
        db.add(models.CRMLead(
            source_id=f"LEAD-{2000 + index}",
            company=random.choice(CUSTOMERS),
            contact_name=f"Contact {index + 1}",
            status=status,
            lead_source=random.choice(["Referral", "Website", "Exhibition", "Cold call", "Campaign"]),
            owner=random.choice(SALES_OWNERS),
            business_unit=random.choice(BUSINESS_UNITS),
            amount=round(random.uniform(40_000, 900_000), 2),
            created_at=created,
            last_activity_at=models.utcnow() - datetime.timedelta(days=idle_days),
        ))

    stages = ["qualification", "needs_analysis", "proposal", "negotiation", "closed_won", "closed_lost"]
    for index in range(80):
        stage = random.choice(stages)
        closing = _dt(random.randint(-60, 520))
        db.add(models.CRMDeal(
            source_id=f"DEAL-{3000 + index}",
            name=f"{random.choice(CUSTOMERS)} — {random.choice(['expansion', 'fit-out', 'supply', 'maintenance'])}",
            customer=random.choice(CUSTOMERS),
            stage=stage,
            amount=round(random.uniform(120_000, 2_400_000), 2),
            probability=random.choice([10, 25, 50, 75, 90]),
            owner=random.choice(SALES_OWNERS),
            business_unit=random.choice(BUSINESS_UNITS),
            closing_date=closing,
            created_at=closing - datetime.timedelta(days=random.randint(30, 120)),
        ))

    for index in range(18):
        sent = _dt(random.randint(2, 60))
        # Roughly a third are left without a follow-up for weeks.
        followed_up = random.random() > 0.35
        db.add(models.CRMQuotation(
            source_id=f"QTN-2026-{800 + index}",
            customer=random.choice(CUSTOMERS),
            amount=round(random.uniform(60_000, 1_200_000), 2),
            status=random.choice(["sent", "sent", "accepted", "rejected"]),
            owner=random.choice(SALES_OWNERS),
            sent_at=sent,
            last_followup_at=sent + datetime.timedelta(days=random.randint(1, 5)) if followed_up else None,
        ))
    db.commit()

    # --- finance -----------------------------------------------------------
    for index in range(220):
        invoice_date = _dt(random.randint(1, 520))
        status = random.choices(
            ["paid", "sent", "overdue", "draft", "partially_paid"],
            weights=[45, 20, 18, 7, 10],
        )[0]
        total = round(random.uniform(35_000, 620_000), 2)
        balance = {
            "paid": 0.0,
            "partially_paid": round(total * 0.4, 2),
        }.get(status, total)
        db.add(models.Invoice(
            source_id=f"INV-2026-{1000 + index}",
            customer=random.choice(CUSTOMERS),
            status=status,
            business_unit=random.choice(BUSINESS_UNITS),
            total_amount=total,
            balance_due=balance,
            invoice_date=invoice_date,
            due_date=invoice_date + datetime.timedelta(days=30),
        ))

    for index in range(300):
        db.add(models.Expense(
            source_id=f"EXP-2026-{4000 + index}",
            category=random.choice(EXPENSE_CATEGORIES),
            vendor=random.choice(VENDORS),
            business_unit=random.choice(BUSINESS_UNITS),
            amount=round(random.uniform(2_500, 180_000), 2),
            expense_date=_dt(random.randint(1, 520)),
        ))
    db.commit()

    # --- HR ----------------------------------------------------------------
    departments = ["Operations", "Sales", "Finance", "HR", "Procurement", "IT"]
    for months_ago in range(23, -1, -1):
        month = (today.replace(day=1) - datetime.timedelta(days=30 * months_ago)).replace(day=1)
        for department in departments:
            db.add(models.HeadcountRecord(
                department=department,
                month=month,
                headcount=random.randint(8, 45),
                joiners=random.randint(0, 4),
                leavers=random.randint(0, 3),
            ))
    db.commit()


def _seed_usage_events(db: Session) -> None:
    """Telemetry that the software-usage rules run against."""
    users = [
        "analyst@misagent.local", "sales.lead@misagent.local", "viewer@misagent.local",
        "finance.lead@misagent.local", "ops.lead@misagent.local",
    ]

    # Routine traffic, inside business hours so it does not trip the rules.
    for _ in range(150):
        moment = models.utcnow() - datetime.timedelta(hours=random.randint(1, 168))
        db.add(models.SystemUsageEvent(
            at=moment.replace(hour=random.randint(8, 17)),
            user_email=random.choice(users),
            event_type=random.choice(["login_success", "record_edited"]),
            system=random.choice(["ERP", "CRM", "HRMS"]),
            ip_address=f"37.60.{random.randint(1, 254)}.{random.randint(1, 254)}",
            country="SA",
        ))

    # A burst of failed logins on one account.
    burst_start = models.utcnow() - datetime.timedelta(hours=6)
    for offset in range(27):
        db.add(models.SystemUsageEvent(
            at=burst_start + datetime.timedelta(minutes=offset),
            user_email="finance.lead@misagent.local",
            event_type="login_failed",
            system="ERP",
            ip_address="185.220.101.44",
            country="NL",
        ))

    # Out-of-geography sign-in.
    db.add(models.SystemUsageEvent(
        at=models.utcnow() - datetime.timedelta(hours=9),
        user_email="analyst@misagent.local",
        event_type="login_success",
        system="ERP",
        ip_address="103.86.49.12",
        country="SG",
    ))

    # Off-hours sign-in.
    db.add(models.SystemUsageEvent(
        at=(models.utcnow() - datetime.timedelta(days=1)).replace(hour=2, minute=40),
        user_email="viewer@misagent.local",
        event_type="login_success",
        system="CRM",
        ip_address="37.60.12.9",
        country="SA",
    ))

    # Bulk delete.
    db.add(models.SystemUsageEvent(
        at=models.utcnow() - datetime.timedelta(hours=30),
        user_email="sales.lead@misagent.local",
        event_type="record_deleted",
        system="CRM",
        ip_address="37.60.44.2",
        country="SA",
        entity_type="Lead",
        record_count=112,
    ))

    # Permission change.
    db.add(models.SystemUsageEvent(
        at=models.utcnow() - datetime.timedelta(days=2),
        user_email="admin@misagent.local",
        event_type="permission_changed",
        system="ERP",
        ip_address="37.60.5.5",
        country="SA",
        entity_type="User",
        entity_id="viewer@misagent.local",
        details={"change": "granted Finance module write access"},
    ))

    # Edit inside a closed accounting period.
    db.add(models.SystemUsageEvent(
        at=models.utcnow() - datetime.timedelta(days=3),
        user_email="analyst@misagent.local",
        event_type="record_edited",
        system="ERP",
        ip_address="37.60.9.31",
        country="SA",
        entity_type="Invoice",
        entity_id="INV-2026-1004",
        period_closed=True,
        details={"amount": 184_500, "field": "total_amount"},
    ))
    db.commit()


def _seed_anomaly_rules(db: Session) -> None:
    rules = [
        ("INVOICE_NOT_RAISED", "Invoice not raised for completed work", "business", "projects",
         "Milestone at 100% completion with no invoice raised against it.",
         "high", {"grace_days": 2}, True),
        ("PROJECT_COST_OVERRUN", "Project cost exceeds budget", "business", "projects",
         "Actual cost is above the approved budget beyond tolerance.",
         "high", {"overrun_ratio": 0.10}, True),
        ("LEAD_DORMANT", "Lead inactive for an extended period", "business", "crm",
         "An open lead with no recorded activity.", "medium", {"idle_days": 30}, False),
        ("RESOURCE_OVERALLOCATION", "Resource overallocation", "business", "projects",
         "A resource is assigned beyond available capacity in a week.",
         "medium", {"max_allocation_pct": 100}, False),
        ("SCHEDULE_SLIPPAGE", "Task delayed beyond baseline", "business", "projects",
         "Forecast completion is later than the baseline date.",
         "medium", {"slip_days": 7}, False),
        ("QUOTATION_NOT_FOLLOWED_UP", "Quotation not followed up", "business", "crm",
         "A sent quotation with no follow-up activity.", "low", {"idle_days": 14}, False),
        ("LOGIN_FAILURE_BURST", "High system login failures", "software_usage", "security",
         "Repeated failed logins for one account in a short window.",
         "high", {"min_attempts": 10, "window_minutes": 30, "lookback_hours": 24}, True),
        ("OFF_HOURS_ACCESS", "Off-hours system access", "software_usage", "security",
         "Successful sign-in outside business hours.",
         "medium", {"business_hours": [7, 19], "lookback_hours": 72}, False),
        ("OUT_OF_GEOGRAPHY_ACCESS", "Access from an unexpected country", "software_usage", "security",
         "Sign-in from outside the approved operating geography.",
         "high", {"allowed_countries": ["SA"], "lookback_hours": 72}, True),
        ("BULK_DELETE", "Bulk record deletion", "software_usage", "security",
         "A single operation deleted a large number of records.",
         "high", {"min_records": 25, "lookback_hours": 72}, True),
        ("PERMISSION_CHANGE", "Permission change", "software_usage", "security",
         "Access rights were changed on an account.", "medium", {"lookback_hours": 168}, False),
        ("CLOSED_PERIOD_EDIT", "Edit to a closed accounting period", "software_usage", "finance",
         "A record inside an already-closed period was edited.",
         "high", {"lookback_hours": 168}, True),
    ]
    for code, name, domain, module, description, severity, params, alert in rules:
        db.add(models.AnomalyRule(
            code=code, name=name, domain=domain, module=module, description=description,
            enabled=True, base_severity=severity, params=params, alert_immediately=alert,
        ))
    db.commit()


def _seed_templates(db: Session, teams: dict[str, models.Team]) -> list[models.ReportTemplate]:
    definitions = [
        {
            "code": "SALES_DAILY", "name": "Sales Summary Report", "module": "crm",
            "cadence": "daily", "owner": "Sales", "reviewer": "Sales", "escalation": "Top Management",
            "description": "Yesterday's bookings, pipeline movement and lead flow.",
            "sections": [
                {"key": "bookings", "title": "Bookings", "metrics": ["deals_won_value", "deals_won_count", "avg_deal_size"], "comparison": "prior_period"},
                {"key": "pipeline", "title": "Pipeline", "metrics": ["pipeline_value", "new_leads", "win_rate"], "comparison": "prior_period"},
            ],
            "thresholds": {"win_rate": 30.0},
            "recipients": ["ceo@misagent.local", "sales.lead@misagent.local"],
        },
        {
            "code": "OPS_DAILY", "name": "Operations Status Report", "module": "projects",
            "cadence": "daily", "owner": "Operations", "reviewer": "Operations", "escalation": "Top Management",
            "description": "Project progress, cost position and resource load.",
            "sections": [
                {"key": "delivery", "title": "Delivery", "metrics": ["active_projects", "milestones_completed", "on_time_delivery"], "comparison": "prior_period"},
                {"key": "cost", "title": "Cost", "metrics": ["project_budget", "project_cost", "budget_variance"], "comparison": "none"},
            ],
            "thresholds": {"on_time_delivery": 85.0},
            "recipients": ["ceo@misagent.local", "ops.lead@misagent.local"],
        },
        {
            "code": "FIN_DAILY", "name": "Finance Snapshot", "module": "finance",
            "cadence": "daily", "owner": "Finance", "reviewer": "Finance", "escalation": "Top Management",
            "description": "Invoicing, collections and receivables position.",
            "sections": [
                {"key": "revenue", "title": "Revenue", "metrics": ["revenue_invoiced", "collections", "unbilled_completed_work"], "comparison": "prior_period"},
                {"key": "receivables", "title": "Receivables", "metrics": ["overdue_receivables", "dso"], "comparison": "prior_period"},
            ],
            "thresholds": {"overdue_receivables": 1_500_000, "dso": 35},
            "recipients": ["cfo@misagent.local", "finance.lead@misagent.local"],
        },
        {
            "code": "PROC_WEEKLY", "name": "Procurement Report", "module": "finance",
            "cadence": "weekly", "owner": "Procurement", "reviewer": "Procurement", "escalation": "Finance",
            "description": "Weekly committed spend by category and vendor.",
            "sections": [
                {"key": "spend", "title": "Spend", "metrics": ["expenses_total"], "comparison": "prior_period"},
            ],
            "thresholds": {},
            "recipients": ["cfo@misagent.local", "procurement.lead@misagent.local"],
        },
        {
            "code": "HR_WEEKLY", "name": "HR Headcount Report", "module": "hr",
            "cadence": "weekly", "owner": "HR", "reviewer": "HR", "escalation": "Top Management",
            "description": "Headcount position by department.",
            "sections": [
                {"key": "people", "title": "People", "metrics": ["headcount"], "comparison": "none"},
            ],
            "thresholds": {},
            "recipients": ["ceo@misagent.local", "hr.lead@misagent.local"],
        },
        {
            "code": "FIN_MONTHLY", "name": "Monthly Finance Report", "module": "finance",
            "cadence": "monthly", "owner": "Finance", "reviewer": "Finance", "escalation": "Top Management",
            "description": "Full monthly P&L view with prior-period comparison.",
            "sections": [
                {"key": "revenue", "title": "Revenue", "metrics": ["revenue_invoiced", "collections"], "comparison": "prior_period"},
                {"key": "cost", "title": "Cost & margin", "metrics": ["expenses_total", "net_profit", "net_margin"], "comparison": "prior_period"},
                {"key": "receivables", "title": "Receivables", "metrics": ["overdue_receivables", "dso", "unbilled_completed_work"], "comparison": "prior_period"},
            ],
            "thresholds": {"net_margin": 15.0, "dso": 35},
            "recipients": ["ceo@misagent.local", "cfo@misagent.local"],
        },
        {
            "code": "EXEC_MONTHLY", "name": "Executive Dashboard Report", "module": "all",
            "cadence": "monthly", "owner": "Top Management", "reviewer": "Finance", "escalation": "Top Management",
            "description": "Cross-module executive pack.",
            "sections": [
                {"key": "financial", "title": "Financial", "metrics": ["revenue_invoiced", "net_margin", "overdue_receivables"], "comparison": "prior_period"},
                {"key": "commercial", "title": "Commercial", "metrics": ["deals_won_value", "pipeline_value", "win_rate"], "comparison": "prior_period"},
                {"key": "delivery", "title": "Delivery", "metrics": ["active_projects", "on_time_delivery", "budget_variance"], "comparison": "none"},
            ],
            "thresholds": {"net_margin": 15.0, "on_time_delivery": 85.0},
            "recipients": ["ceo@misagent.local", "cfo@misagent.local", "ops.lead@misagent.local"],
        },
        {
            "code": "QBR", "name": "Quarterly Business Review", "module": "all",
            "cadence": "quarterly", "owner": "Top Management", "reviewer": "Finance", "escalation": "Top Management",
            "description": "Quarterly performance against the prior quarter and prior year.",
            "sections": [
                {"key": "financial", "title": "Financial", "metrics": ["revenue_invoiced", "expenses_total", "net_profit", "net_margin"], "comparison": "prior_year"},
                {"key": "commercial", "title": "Commercial", "metrics": ["deals_won_value", "win_rate", "avg_deal_size"], "comparison": "prior_year"},
                {"key": "people", "title": "People", "metrics": ["headcount"], "comparison": "none"},
            ],
            "thresholds": {"net_margin": 18.0},
            "recipients": ["ceo@misagent.local", "cfo@misagent.local"],
        },
    ]

    now = models.utcnow()
    templates = []
    for definition in definitions:
        template = models.ReportTemplate(
            code=definition["code"],
            name=definition["name"],
            description=definition["description"],
            module=definition["module"],
            cadence=definition["cadence"],
            delivery_hour=7 if definition["cadence"] == "daily" else 9,
            sections=definition["sections"],
            thresholds=definition["thresholds"],
            owner_team_id=teams[definition["owner"]].id,
            reviewer_team_id=teams[definition["reviewer"]].id,
            escalation_team_id=teams[definition["escalation"]].id,
            recipients=definition["recipients"],
            next_run_at=calendar_rules.next_run_at(definition["cadence"], now, 7),
        )
        db.add(template)
        templates.append(template)
    db.commit()
    return templates


def _seed_runs(db: Session, templates: list[models.ReportTemplate]) -> None:
    """Generate history so the queue shows every state of the flow."""
    system = Principal(
        email="seed@misagent.local", full_name="Seed", role="admin",
        team_id=None, team_name=None,
        modules=("finance", "crm", "projects", "hr", "procurement", "security"),
    )
    reviewer = Principal(
        email="finance.lead@misagent.local", full_name="Fahad Al-Qahtani", role="reviewer",
        team_id=None, team_name="Finance",
        modules=("finance", "crm", "projects", "hr", "procurement", "security"),
    )

    now = models.utcnow()
    for template in templates:
        # A few historic runs, published, so delivery statistics are meaningful.
        for days_ago in (3, 2):
            run = report_engine.generate_run(
                db, template, actor_email="scheduler@misagent.local",
                as_of=now - datetime.timedelta(days=days_ago),
            )
            if run.status != "in_review":
                continue
            approvals.mark_opened(db, run, reviewer)
            approvals.approve(db, run, reviewer)
            approvals.publish(db, run, system)

        # The current run stays in review, which is what fills the queue.
        report_engine.generate_run(
            db, template, actor_email="scheduler@misagent.local", as_of=now,
        )

    # One rejected run, so the rejected state and its reason are represented.
    rejected_template = next((t for t in templates if t.code == "PROC_WEEKLY"), None)
    if rejected_template:
        run = report_engine.generate_run(
            db, rejected_template, actor_email="scheduler@misagent.local",
            as_of=now - datetime.timedelta(days=7),
        )
        if run.status == "in_review":
            approvals.mark_opened(db, run, reviewer)
            approvals.reject(
                db, run, reviewer,
                "Vendor accruals for Al Faisal Contracting are missing — re-run after the "
                "accrual entry is posted.",
            )
    db.commit()
