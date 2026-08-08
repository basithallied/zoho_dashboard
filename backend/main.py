from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime
from sqlalchemy import func

import models
import database
import mock_data

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Zoho MIS Multi-Module Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    db = database.SessionLocal()
    mock_data.seed_db(db)
    db.close()

# Pydantic Schemas
class KPISchema(BaseModel):
    id: int
    module: str
    name: str
    value: float
    unit: str
    trend: str
    trend_value: str
    
    class Config:
        orm_mode = True

class LeadSchema(BaseModel):
    id: int
    zoho_id: str
    company: str
    status: str
    lead_source: str
    sales_rep: str
    amount: float
    created_time: datetime.datetime
    
    class Config:
        orm_mode = True

class DealSchema(BaseModel):
    id: int
    zoho_id: str
    deal_name: str
    stage: str
    amount: float
    owner: str
    closing_date: datetime.datetime

    class Config:
        orm_mode = True

class ProjectSchema(BaseModel):
    id: int
    name: str
    status: str
    completion_percentage: int
    budget: float
    spent: float
    
    class Config:
        orm_mode = True

class InvoiceSchema(BaseModel):
    id: int
    invoice_number: str
    customer_name: str
    status: str
    total_amount: float
    balance_due: float
    invoice_date: datetime.datetime
    due_date: datetime.datetime

    class Config:
        orm_mode = True

class ExpenseSchema(BaseModel):
    id: int
    category: str
    amount: float
    vendor: str
    expense_date: datetime.datetime

    class Config:
        orm_mode = True

# --- API ENDPOINTS WITH FILTERS ---

@app.get("/api/kpis", response_model=List[KPISchema])
def get_kpis(
    module: Optional[str] = Query("all", description="Module filter: crm, projects, books, all"),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.KPI)
    if module and module != "all":
        query = query.filter(models.KPI.module.in_([module, "all"]))
    return query.all()

@app.get("/api/crm/leads", response_model=List[LeadSchema])
def get_leads(
    status: Optional[str] = None,
    sales_rep: Optional[str] = None,
    lead_source: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.ZohoCRMLead)
    if status and status != "All":
        query = query.filter(models.ZohoCRMLead.status == status)
    if sales_rep and sales_rep != "All":
        query = query.filter(models.ZohoCRMLead.sales_rep == sales_rep)
    if lead_source and lead_source != "All":
        query = query.filter(models.ZohoCRMLead.lead_source == lead_source)
    return query.order_by(models.ZohoCRMLead.created_time.desc()).limit(limit).all()

@app.get("/api/crm/deals", response_model=List[DealSchema])
def get_deals(
    stage: Optional[str] = None,
    owner: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.ZohoCRMDeal)
    if stage and stage != "All":
        query = query.filter(models.ZohoCRMDeal.stage == stage)
    if owner and owner != "All":
        query = query.filter(models.ZohoCRMDeal.owner == owner)
    return query.order_by(models.ZohoCRMDeal.amount.desc()).limit(limit).all()

@app.get("/api/projects", response_model=List[ProjectSchema])
def get_projects(
    status: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.ZohoProject)
    if status and status != "All":
        query = query.filter(models.ZohoProject.status == status)
    return query.all()

@app.get("/api/books/invoices", response_model=List[InvoiceSchema])
def get_invoices(
    status: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.ZohoBooksInvoice)
    if status and status != "All":
        query = query.filter(models.ZohoBooksInvoice.status == status)
    return query.order_by(models.ZohoBooksInvoice.invoice_date.desc()).limit(limit).all()

@app.get("/api/books/expenses", response_model=List[ExpenseSchema])
def get_expenses(
    category: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.ZohoBooksExpense)
    if category and category != "All":
        query = query.filter(models.ZohoBooksExpense.category == category)
    return query.order_by(models.ZohoBooksExpense.expense_date.desc()).limit(limit).all()

# Additional Analytics endpoint for Comparisons
@app.get("/api/analytics/summary")
def get_analytics_summary(db: Session = Depends(database.get_db)):
    crm_total = db.query(func.sum(models.ZohoCRMDeal.amount)).scalar() or 0.0
    projects_budget = db.query(func.sum(models.ZohoProject.budget)).scalar() or 0.0
    invoices_paid = db.query(func.sum(models.ZohoBooksInvoice.total_amount)).filter(models.ZohoBooksInvoice.status == "Paid").scalar() or 0.0
    invoices_overdue = db.query(func.sum(models.ZohoBooksInvoice.balance_due)).filter(models.ZohoBooksInvoice.status == "Overdue").scalar() or 0.0
    expenses_total = db.query(func.sum(models.ZohoBooksExpense.amount)).scalar() or 0.0

    return {
        "pipeline_total": crm_total,
        "projects_budget": projects_budget,
        "invoices_paid": invoices_paid,
        "invoices_overdue": invoices_overdue,
        "expenses_total": expenses_total,
        "net_profit": invoices_paid - expenses_total
    }

@app.get("/api/analytics/funnel")
def get_funnel_data(db: Session = Depends(database.get_db)):
    # Lead Funnel Calculation
    total_leads = db.query(models.ZohoCRMLead).count() or 1
    contacted_leads = db.query(models.ZohoCRMLead).filter(models.ZohoCRMLead.status.in_(["Contacted", "Attempted to Contact", "Qualified"])).count()
    qualified_leads = db.query(models.ZohoCRMLead).filter(models.ZohoCRMLead.status == "Qualified").count()
    
    lead_funnel = [
        {"stage": "1. New Leads Generated", "count": total_leads, "value": db.query(func.sum(models.ZohoCRMLead.amount)).scalar() or 0.0, "conversion": "100%"},
        {"stage": "2. Contacted & Engaged", "count": contacted_leads, "value": db.query(func.sum(models.ZohoCRMLead.amount)).filter(models.ZohoCRMLead.status.in_(["Contacted", "Attempted to Contact", "Qualified"])).scalar() or 0.0, "conversion": f"{round((contacted_leads/total_leads)*100, 1)}%"},
        {"stage": "3. Qualified Opportunities", "count": qualified_leads, "value": db.query(func.sum(models.ZohoCRMLead.amount)).filter(models.ZohoCRMLead.status == "Qualified").scalar() or 0.0, "conversion": f"{round((qualified_leads/total_leads)*100, 1)}%"},
    ]

    # Deal Funnel Calculation
    total_deals = db.query(models.ZohoCRMDeal).count() or 1
    qual_deals = db.query(models.ZohoCRMDeal).filter(models.ZohoCRMDeal.stage.in_(["Qualification", "Needs Analysis", "Value Proposition", "Proposal/Price Quote", "Negotiation/Review", "Closed Won"])).count()
    prop_deals = db.query(models.ZohoCRMDeal).filter(models.ZohoCRMDeal.stage.in_(["Proposal/Price Quote", "Negotiation/Review", "Closed Won"])).count()
    won_deals = db.query(models.ZohoCRMDeal).filter(models.ZohoCRMDeal.stage == "Closed Won").count()

    deal_funnel = [
        {"stage": "1. Pipeline Qualification", "count": qual_deals, "value": db.query(func.sum(models.ZohoCRMDeal.amount)).scalar() or 0.0, "conversion": "100%"},
        {"stage": "2. Proposal & Quote Sent", "count": prop_deals, "value": db.query(func.sum(models.ZohoCRMDeal.amount)).filter(models.ZohoCRMDeal.stage.in_(["Proposal/Price Quote", "Negotiation/Review", "Closed Won"])).scalar() or 0.0, "conversion": f"{round((prop_deals/qual_deals)*100, 1)}%"},
        {"stage": "3. Closed Won Contracts", "count": won_deals, "value": db.query(func.sum(models.ZohoCRMDeal.amount)).filter(models.ZohoCRMDeal.stage == "Closed Won").scalar() or 0.0, "conversion": f"{round((won_deals/qual_deals)*100, 1)}%"},
    ]

    return {
        "lead_funnel": lead_funnel,
        "deal_funnel": deal_funnel
    }

class AlertSchema(BaseModel):
    id: Optional[int] = None
    kpi_name: str
    condition: str
    threshold_value: float
    channel: str = "Dashboard Banner"
    is_triggered: bool = False
    message: str = ""

    class Config:
        orm_mode = True

@app.get("/api/alerts", response_model=List[AlertSchema])
def get_alerts(db: Session = Depends(database.get_db)):
    return db.query(models.KPIAlert).all()

@app.post("/api/alerts", response_model=AlertSchema)
def create_alert(alert: AlertSchema, db: Session = Depends(database.get_db)):
    new_alert = models.KPIAlert(
        kpi_name=alert.kpi_name,
        condition=alert.condition,
        threshold_value=alert.threshold_value,
        channel=alert.channel,
        is_triggered=True,
        message=f"⚠️ Alert rule configured for {alert.kpi_name} ({alert.condition} {alert.threshold_value:,.2f})"
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return new_alert

@app.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(database.get_db)):
    alert = db.query(models.KPIAlert).filter(models.KPIAlert.id == alert_id).first()
    if alert:
        db.delete(alert)
        db.commit()
        return {"status": "deleted"}
    return {"status": "not_found"}

# --- FEATURE 2: DYNAMIC KPI CREATOR ---
class CreateKPISchema(BaseModel):
    module: str = "all"
    name: str
    value: float
    unit: str = "SAR "
    trend: str = "up"
    trend_value: str = "+5.0%"

@app.post("/api/kpis", response_model=KPISchema)
def create_custom_kpi(kpi: CreateKPISchema, db: Session = Depends(database.get_db)):
    new_kpi = models.KPI(
        module=kpi.module,
        name=kpi.name,
        value=kpi.value,
        unit=kpi.unit,
        trend=kpi.trend,
        trend_value=kpi.trend_value
    )
    db.add(new_kpi)
    db.commit()
    db.refresh(new_kpi)
    return new_kpi

@app.delete("/api/kpis/{kpi_id}")
def delete_custom_kpi(kpi_id: int, db: Session = Depends(database.get_db)):
    kpi = db.query(models.KPI).filter(models.KPI.id == kpi_id).first()
    if kpi:
        db.delete(kpi)
        db.commit()
        return {"status": "deleted"}
    return {"status": "not_found"}

# --- FEATURE 3: PREDICTIVE AI FORECASTING & ANOMALY HIGHLIGHTS ---
@app.get("/api/analytics/ai-forecast")
def get_ai_forecast(db: Session = Depends(database.get_db)):
    crm_total = db.query(func.sum(models.ZohoCRMDeal.amount)).scalar() or 0.0
    projected_q4 = round(crm_total * 1.22, 2)
    
    return {
        "forecast_period": "Q4 2026 Prediction",
        "predicted_pipeline": projected_q4,
        "confidence_score": "94.2%",
        "growth_projection": "+22.0%",
        "anomalies": [
            {
                "id": 1,
                "type": "warning",
                "category": "Expenses",
                "title": "Unusual Expense Spike in Software & Subscriptions",
                "description": "Software & SaaS subscription costs jumped 38.4% above the 6-month trailing average. Audit recommended."
            },
            {
                "id": 2,
                "type": "opportunity",
                "category": "CRM Deals",
                "title": "High-Value Enterprise Deal Opportunity",
                "description": "3 enterprise deals in Negotiation stage have an 85% probability of closing before month-end."
            },
            {
                "id": 3,
                "type": "risk",
                "category": "Projects",
                "title": "Schedule Churn Risk on 2 Projects",
                "description": "Project completion velocity indicates potential 5-day delay on 'Portal Development for Acme Enterprises'."
            }
        ]
    }

@app.get("/api/analytics/period-comparison")
def get_period_comparison():
    return [
        {"period": "Q3 2025", "revenue": 2100000, "expenses": 480000, "deals_won": 14, "project_velocity": 78},
        {"period": "Q4 2025", "revenue": 2450000, "expenses": 520000, "deals_won": 18, "project_velocity": 82},
        {"period": "Q1 2026", "revenue": 2280000, "expenses": 510000, "deals_won": 16, "project_velocity": 80},
        {"period": "Q2 2026", "revenue": 2690000, "expenses": 590000, "deals_won": 21, "project_velocity": 85},
        {"period": "Q3 2026 (Current)", "revenue": 2845000, "expenses": 620000, "deals_won": 24, "project_velocity": 88},
    ]

# --- EXECUTIVE AUDIT ENHANCEMENTS ---
@app.get("/api/crm/leaderboard")
def get_sales_leaderboard():
    return [
        {"name": "Ahmed Al-Mansoor", "deals_closed": 8, "revenue": 945000.0, "quota_attainment": 126.0, "win_rate": "42.5%"},
        {"name": "Sarah Al-Rashid", "deals_closed": 6, "revenue": 720000.0, "quota_attainment": 105.0, "win_rate": "38.0%"},
        {"name": "Tariq Mahmood", "deals_closed": 5, "revenue": 580000.0, "quota_attainment": 92.0, "win_rate": "35.2%"},
        {"name": "Fatima Hassan", "deals_closed": 3, "revenue": 380000.0, "quota_attainment": 84.0, "win_rate": "31.0%"},
        {"name": "Omar Al-Farsi", "deals_closed": 2, "revenue": 220000.0, "quota_attainment": 72.0, "win_rate": "28.5%"}
    ]

@app.get("/api/crm/channel-roi")
def get_channel_roi():
    return [
        {"channel": "LinkedIn Ads", "spend": 45000, "revenue": 680000, "roi": "+1,411%"},
        {"channel": "Organic Search (SEO)", "spend": 12000, "revenue": 520000, "roi": "+4,233%"},
        {"channel": "Partner Referrals", "spend": 25000, "revenue": 490000, "roi": "+1,860%"},
        {"channel": "Google Ads (PPC)", "spend": 60000, "revenue": 410000, "roi": "+583%"},
        {"channel": "Events & Webinars", "spend": 35000, "revenue": 245000, "roi": "+600%"}
    ]

@app.get("/api/books/cashflow-timeline")
def get_cashflow_timeline():
    return [
        {"day": "Week 1", "projected_inflow": 280000, "projected_outflow": 120000, "net_cash": 160000},
        {"day": "Week 2", "projected_inflow": 420000, "projected_outflow": 180000, "net_cash": 240000},
        {"day": "Week 3", "projected_inflow": 310000, "projected_outflow": 210000, "net_cash": 100000},
        {"day": "Week 4", "projected_inflow": 550000, "projected_outflow": 150000, "net_cash": 400000}
    ]

@app.get("/api/projects/workload")
def get_team_workload():
    return [
        {"role": "Senior Full-Stack Developers", "utilization": 92.5, "billable_hours": 160, "status": "High Load"},
        {"role": "Solutions Architects", "utilization": 88.0, "billable_hours": 145, "status": "Optimal"},
        {"role": "UI/UX Designers", "utilization": 84.2, "billable_hours": 138, "status": "Optimal"},
        {"role": "Project Managers", "utilization": 79.0, "billable_hours": 130, "status": "Optimal"},
        {"role": "QA & Automation Engineers", "utilization": 76.5, "billable_hours": 125, "status": "Available Capacity"}
    ]

class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = "kimi"

@app.post("/api/chat")
def chat_with_data(req: ChatRequest, db: Session = Depends(database.get_db)):
    msg = req.message.lower()
    model_tag = f"[{req.model.upper()} AI]: " if req.model else "[KIMI AI]: "
    
    if "lead" in msg or "crm" in msg:
        count = db.query(models.ZohoCRMLead).count()
        return {"reply": f"{model_tag}You currently have {count} leads in Zoho CRM. Top lead sources are Organic Search & Partner Referrals."}
    elif "invoice" in msg or "books" in msg or "unpaid" in msg or "overdue" in msg:
        overdue_cnt = db.query(models.ZohoBooksInvoice).filter(models.ZohoBooksInvoice.status == "Overdue").count()
        overdue_amt = db.query(func.sum(models.ZohoBooksInvoice.balance_due)).filter(models.ZohoBooksInvoice.status == "Overdue").scalar() or 0.0
        return {"reply": f"{model_tag}In Zoho Books, you have {overdue_cnt} overdue invoices totaling SAR {overdue_amt:,.2f}."}
    elif "project" in msg:
        active_cnt = db.query(models.ZohoProject).filter(models.ZohoProject.status == "In Progress").count()
        return {"reply": f"{model_tag}You have {active_cnt} active projects currently in progress with an average completion rate of 68%."}
    elif "expense" in msg or "profit" in msg:
        exp_sum = db.query(func.sum(models.ZohoBooksExpense.amount)).scalar() or 0.0
        return {"reply": f"{model_tag}Total logged expenses across categories are SAR {exp_sum:,.2f}. Top category is Software & Subscriptions."}
    else:
        return {"reply": f"{model_tag}Connected to your multi-module Zoho DB (CRM, Projects, and Books/Accounts). Ask me about 'leads', 'invoices', 'projects', or 'expenses'!"}

@app.get("/")
def read_root():
    return {"message": "Zoho Multi-Module MIS API is active"}
