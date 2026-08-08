from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
import datetime

from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="user")

class ZohoCRMLead(Base):
    __tablename__ = "zoho_crm_leads"

    id = Column(Integer, primary_key=True, index=True)
    zoho_id = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    company = Column(String)
    status = Column(String)
    lead_source = Column(String)
    sales_rep = Column(String)
    amount = Column(Float, default=0.0)
    created_time = Column(DateTime, default=datetime.datetime.utcnow)

class ZohoCRMDeal(Base):
    __tablename__ = "zoho_crm_deals"

    id = Column(Integer, primary_key=True, index=True)
    zoho_id = Column(String, unique=True, index=True)
    deal_name = Column(String)
    stage = Column(String)
    amount = Column(Float)
    closing_date = Column(DateTime)
    owner = Column(String)

class ZohoProject(Base):
    __tablename__ = "zoho_projects"

    id = Column(Integer, primary_key=True, index=True)
    zoho_id = Column(String, unique=True, index=True)
    name = Column(String)
    status = Column(String)
    completion_percentage = Column(Integer, default=0)
    budget = Column(Float, default=0.0)
    spent = Column(Float, default=0.0)
    start_date = Column(DateTime)
    end_date = Column(DateTime)

class ZohoBooksInvoice(Base):
    __tablename__ = "zoho_books_invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True)
    customer_name = Column(String)
    status = Column(String)
    total_amount = Column(Float)
    balance_due = Column(Float)
    invoice_date = Column(DateTime)
    due_date = Column(DateTime)

class ZohoBooksExpense(Base):
    __tablename__ = "zoho_books_expenses"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    amount = Column(Float)
    expense_date = Column(DateTime)
    vendor = Column(String)

class KPI(Base):
    __tablename__ = "kpis"

    id = Column(Integer, primary_key=True, index=True)
    module = Column(String, default="all")
    name = Column(String)
    value = Column(Float)
    unit = Column(String)
    trend = Column(String)
    trend_value = Column(String, default="+0%")

class KPIAlert(Base):
    __tablename__ = "kpi_alerts"

    id = Column(Integer, primary_key=True, index=True)
    kpi_name = Column(String)
    condition = Column(String) # "greater_than", "less_than", "equals"
    threshold_value = Column(Float)
    channel = Column(String, default="Dashboard Banner") # "Email", "Slack", "Dashboard Banner"
    is_triggered = Column(Boolean, default=False)
    message = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
