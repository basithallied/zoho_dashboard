import datetime
import random
from sqlalchemy.orm import Session
import models

def seed_db(db: Session):
    # Clear existing tables to ensure clean re-seeding with rich data
    db.query(models.KPI).delete()
    db.query(models.ZohoCRMLead).delete()
    db.query(models.ZohoCRMDeal).delete()
    db.query(models.ZohoProject).delete()
    db.query(models.ZohoBooksInvoice).delete()
    db.query(models.ZohoBooksExpense).delete()
    db.query(models.KPIAlert).delete()
    db.query(models.User).delete()
    db.commit()

    print("Seeding database with rich multi-module mock data...")

    # Mock Users
    users = [
        models.User(email="admin@zoho.test", hashed_password="hashedsecret", role="admin"),
        models.User(email="sales@zoho.test", hashed_password="hashedsecret", role="sales"),
        models.User(email="finance@zoho.test", hashed_password="hashedsecret", role="finance"),
    ]
    db.add_all(users)

    sales_reps = ["Alice Johnson", "Bob Smith", "Charlie Davis", "Diana Prince", "Evan Wright"]
    companies = [
        "Acme Enterprises", "Globex Corp", "Initech LLC", "Umbrella Pharmaceuticals",
        "Wayne Tech", "Stark Industries", "Cyberdyne Systems", "Massive Dynamic",
        "Aperture Science", "Hooli", "Pied Piper", "E Corp"
    ]
    lead_sources = ["Organic Search", "Google Ads", "LinkedIn Campaign", "Partner Referral", "Webinar", "Direct Call"]

    # 1. Zoho CRM Leads (50 items)
    lead_statuses = ["New", "Attempted to Contact", "Contacted", "Qualified", "Unqualified"]
    leads = []
    for i in range(50):
        days_ago = random.randint(1, 120)
        leads.append(models.ZohoCRMLead(
            zoho_id=f"ZCRM-LEAD-{1000+i}",
            first_name=f"Contact_{i+1}",
            last_name="Executive",
            company=random.choice(companies),
            status=random.choice(lead_statuses),
            lead_source=random.choice(lead_sources),
            sales_rep=random.choice(sales_reps),
            amount=round(random.uniform(5000, 85000), 2),
            created_time=datetime.datetime.utcnow() - datetime.timedelta(days=days_ago)
        ))
    db.add_all(leads)

    # 2. Zoho CRM Deals (30 items)
    deal_stages = ["Qualification", "Needs Analysis", "Value Proposition", "Proposal/Price Quote", "Negotiation/Review", "Closed Won", "Closed Lost"]
    deals = []
    for i in range(30):
        days_offset = random.randint(-30, 90)
        deals.append(models.ZohoCRMDeal(
            zoho_id=f"ZCRM-DEAL-{2000+i}",
            deal_name=f"{random.choice(companies)} - Enterprise Expansion",
            stage=random.choice(deal_stages),
            amount=round(random.uniform(15000, 250000), 2),
            closing_date=datetime.datetime.utcnow() + datetime.timedelta(days=days_offset),
            owner=random.choice(sales_reps)
        ))
    db.add_all(deals)

    # 3. Zoho Projects (15 items)
    project_statuses = ["Planning", "In Progress", "In Review", "Completed", "On Hold"]
    projects = []
    for i in range(15):
        budget = round(random.uniform(20000, 150000), 2)
        status = random.choice(project_statuses)
        comp = 100 if status == "Completed" else (0 if status == "Planning" else random.randint(15, 90))
        spent = budget if status == "Completed" else round(budget * (comp / 100) * random.uniform(0.8, 1.1), 2)
        
        projects.append(models.ZohoProject(
            zoho_id=f"ZPRJ-{3000+i}",
            name=f"Portal Development for {companies[i % len(companies)]}",
            status=status,
            completion_percentage=comp,
            budget=budget,
            spent=spent,
            start_date=datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(20, 100)),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=random.randint(10, 80))
        ))
    db.add_all(projects)

    # 4. Zoho Books Invoices (40 items)
    invoice_statuses = ["Paid", "Sent", "Overdue", "Draft", "Partially Paid"]
    invoices = []
    for i in range(40):
        inv_amt = round(random.uniform(2500, 45000), 2)
        st = random.choice(invoice_statuses)
        bal = 0.0 if st == "Paid" else (inv_amt if st in ["Sent", "Overdue", "Draft"] else round(inv_amt * 0.4, 2))
        
        days_inv = random.randint(1, 90)
        invoices.append(models.ZohoBooksInvoice(
            invoice_number=f"INV-2026-{101+i}",
            customer_name=random.choice(companies),
            status=st,
            total_amount=inv_amt,
            balance_due=bal,
            invoice_date=datetime.datetime.utcnow() - datetime.timedelta(days=days_inv),
            due_date=datetime.datetime.utcnow() - datetime.timedelta(days=days_inv - 30)
        ))
    db.add_all(invoices)

    # 5. Zoho Books Expenses (35 items)
    categories = ["Software & Subscriptions", "Travel & Hosting", "Salaries & Contracting", "Marketing & Ads", "Office Equipment & Utilities"]
    vendors = ["AWS", "Google Cloud", "Slack", "Zoho One", "WeWork", "Delta Airlines", "Meta Ads", "GitHub"]
    expenses = []
    for i in range(35):
        expenses.append(models.ZohoBooksExpense(
            category=random.choice(categories),
            amount=round(random.uniform(200, 12000), 2),
            expense_date=datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(1, 60)),
            vendor=random.choice(vendors)
        ))
    db.add_all(expenses)

    # 6. Comprehensive KPIs
    kpis = [
        # Overall / Cross-module
        models.KPI(module="all", name="Total Pipeline Value", value=2845000.0, unit="SAR ", trend="up", trend_value="+14.2%"),
        models.KPI(module="all", name="Monthly Billed Revenue", value=382400.0, unit="SAR ", trend="up", trend_value="+8.5%"),
        models.KPI(module="all", name="Active Projects", value=12.0, unit="", trend="neutral", trend_value="0%"),
        models.KPI(module="all", name="Overdue Receivables", value=64200.0, unit="SAR ", trend="down", trend_value="-5.1%"),
        
        # CRM KPIs
        models.KPI(module="crm", name="Open Deals", value=24.0, unit="", trend="up", trend_value="+4"),
        models.KPI(module="crm", name="Lead Win Rate", value=32.8, unit="%", trend="up", trend_value="+3.2%"),
        models.KPI(module="crm", name="Avg Deal Size", value=54200.0, unit="SAR ", trend="up", trend_value="+11.0%"),
        models.KPI(module="crm", name="New Leads (This Month)", value=142.0, unit="", trend="up", trend_value="+22"),

        # Projects KPIs
        models.KPI(module="projects", name="Active Projects", value=12.0, unit="", trend="neutral", trend_value="0"),
        models.KPI(module="projects", name="On-Time Delivery Rate", value=88.5, unit="%", trend="up", trend_value="+2.5%"),
        models.KPI(module="projects", name="Resource Utilization", value=85.2, unit="%", trend="up", trend_value="+4.1%"),
        models.KPI(module="projects", name="Budget Utilization", value=74.2, unit="%", trend="up", trend_value="+4.0%"),
        models.KPI(module="projects", name="Completed Milestones", value=48.0, unit="", trend="up", trend_value="+12"),

        # Books / Accounts KPIs
        models.KPI(module="books", name="Total Revenue (YTD)", value=1450000.0, unit="SAR ", trend="up", trend_value="+18.4%"),
        models.KPI(module="books", name="Total Expenses (YTD)", value=620000.0, unit="SAR ", trend="down", trend_value="-2.1%"),
        models.KPI(module="books", name="Net Profit Margin", value=57.2, unit="%", trend="up", trend_value="+5.3%"),
        models.KPI(module="books", name="Days Sales Outstanding (DSO)", value=28.4, unit=" Days", trend="down", trend_value="-3.2 Days"),
        models.KPI(module="books", name="Outstanding Invoices", value=128400.0, unit="SAR ", trend="down", trend_value="-8.2%"),
    ]
    # 7. Default Threshold Alert Rules
    alerts = [
        models.KPIAlert(
            kpi_name="Overdue Receivables",
            condition="greater_than",
            threshold_value=50000.0,
            channel="Dashboard Banner",
            is_triggered=True,
            message="⚠️ Overdue Receivables has exceeded SAR 50,000 threshold! (Current: SAR 64,200)"
        ),
        models.KPIAlert(
            kpi_name="Lead Win Rate",
            condition="less_than",
            threshold_value=35.0,
            channel="Email",
            is_triggered=True,
            message="⚠️ Lead Win Rate has dropped below 35.0% target! (Current: 32.8%)"
        )
    ]
    db.add_all(alerts)

    db.commit()
    print("Rich mock data seeded successfully.")
