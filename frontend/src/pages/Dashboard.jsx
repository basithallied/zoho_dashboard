import React, { useEffect, useState } from 'react';
import KPICard from '../components/KPICard';
import FilterBar from '../components/FilterBar';
import SalesFunnel from '../components/SalesFunnel';
import AlertsBanner from '../components/AlertsBanner';
import AIPredictiveStudio from '../components/AIPredictiveStudio';
import PeriodComparisonStudio from '../components/PeriodComparisonStudio';
import DynamicKPICreatorModal from '../components/DynamicKPICreatorModal';
import ExecutiveAuditInsights from '../components/ExecutiveAuditInsights';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { PlusCircle, Printer } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const Dashboard = () => {
  const [selectedModule, setSelectedModule] = useState('all');
  const [statusFilter, setStatusFilter] = useState('All');
  const [timeframe, setTimeframe] = useState('30d');
  const [refreshInterval, setRefreshInterval] = useState(30000); // Default 30s auto-fetch
  
  const [kpis, setKpis] = useState([]);
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [funnelData, setFunnelData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [comparisonData, setComparisonData] = useState([]);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const kpiUrl = `http://localhost:8000/api/kpis?module=${selectedModule}`;
      const leadsUrl = `http://localhost:8000/api/crm/leads?status=${statusFilter}`;
      const dealsUrl = `http://localhost:8000/api/crm/deals?stage=${statusFilter}`;
      const projectsUrl = `http://localhost:8000/api/projects?status=${statusFilter}`;
      const invoicesUrl = `http://localhost:8000/api/books/invoices?status=${statusFilter}`;
      const expensesUrl = `http://localhost:8000/api/books/expenses`;
      const summaryUrl = `http://localhost:8000/api/analytics/summary`;
      const funnelUrl = `http://localhost:8000/api/analytics/funnel`;
      const alertsUrl = `http://localhost:8000/api/alerts`;
      const forecastUrl = `http://localhost:8000/api/analytics/ai-forecast`;
      const comparisonUrl = `http://localhost:8000/api/analytics/period-comparison`;

      const [kpiRes, leadsRes, dealsRes, projRes, invRes, expRes, sumRes, funRes, altRes, forcRes, compRes] = await Promise.all([
        fetch(kpiUrl),
        fetch(leadsUrl),
        fetch(dealsUrl),
        fetch(projectsUrl),
        fetch(invoicesUrl),
        fetch(expensesUrl),
        fetch(summaryUrl),
        fetch(funnelUrl),
        fetch(alertsUrl),
        fetch(forecastUrl),
        fetch(comparisonUrl)
      ]);

      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (dealsRes.ok) setDeals(await dealsRes.json());
      if (projRes.ok) setProjects(await projRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
      if (funRes.ok) setFunnelData(await funRes.json());
      if (altRes.ok) setAlerts(await altRes.json());
      if (forcRes.ok) setForecastData(await forcRes.json());
      if (compRes.ok) setComparisonData(await compRes.json());
    } catch (err) {
      console.error("Error connecting to FastAPI server:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-fetch polling interval if enabled (> 0)
    if (refreshInterval > 0) {
      const timer = setInterval(() => {
        fetchData();
      }, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [selectedModule, statusFilter, timeframe, refreshInterval]);

  // Aggregate deal stages for CRM Pie Chart
  const dealStageChartData = deals.reduce((acc, deal) => {
    const existing = acc.find(item => item.name === deal.stage);
    if (existing) {
      existing.value += deal.amount;
    } else {
      acc.push({ name: deal.stage, value: deal.amount });
    }
    return acc;
  }, []);

  // Aggregate expenses for Books Chart
  const expenseCategoryChartData = expenses.reduce((acc, exp) => {
    const existing = acc.find(item => item.name === exp.category);
    if (existing) {
      existing.value += exp.amount;
    } else {
      acc.push({ name: exp.category, value: exp.amount });
    }
    return acc;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner & Control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Live MIS Analytics</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Real-time cross-platform overview of Zoho CRM, Projects, and Books
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
          >
            <Printer size={16} /> Export Executive PDF
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input 
              type="checkbox" 
              checked={useMockData} 
              onChange={(e) => setUseMockData(e.target.checked)} 
            />
            <span style={{ fontWeight: 500 }}>Mock Data Active</span>
          </label>
        </div>
      </div>

      {/* Live Threshold Alerts Banner */}
      <AlertsBanner alerts={alerts} onRefreshAlerts={fetchData} />

      {/* Filter Bar Component */}
      <FilterBar 
        selectedModule={selectedModule}
        setSelectedModule={setSelectedModule}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        onRefresh={fetchData}
      />

      {/* Dynamic Module KPIs Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Key Performance Indicators
          </h3>
          <button 
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            onClick={() => setIsKpiModalOpen(true)}
          >
            <PlusCircle size={16} /> Add Custom KPI
          </button>
        </div>

        <div className="grid grid-cols-4">
          {loading ? (
            [1,2,3,4].map(i => <div key={i} className="glass glass-card" style={{ height: '120px', animation: 'pulse 1.5s infinite' }}></div>)
          ) : (
            kpis.map((kpi, index) => (
              <KPICard 
                key={kpi.id} 
                title={kpi.name} 
                value={kpi.value} 
                unit={kpi.unit} 
                trend={kpi.trend} 
                delay={index * 100} 
              />
            ))
          )}
        </div>
      </div>

      {/* Dynamic KPI Creator Modal */}
      <DynamicKPICreatorModal 
        isOpen={isKpiModalOpen} 
        onClose={() => setIsKpiModalOpen(false)} 
        onKpiCreated={fetchData} 
      />

      {/* AI Predictive Forecasting & Anomaly Engine */}
      <AIPredictiveStudio forecastData={forecastData} />

      {/* Sales & Lead Conversion Funnel */}
      <SalesFunnel funnelData={funnelData} />

      {/* Executive Business Analyst Insights: Leaderboard, Acquisition ROI & Cashflow */}
      <ExecutiveAuditInsights />

      {/* Period-over-Period (YoY / QoQ) Comparison Studio */}
      <PeriodComparisonStudio comparisonData={comparisonData} />

      {/* Comparative Graphs Section */}
      <div className="grid grid-cols-2" style={{ gap: '1.5rem' }}>
        
        {/* Chart 1: CRM Deals vs Project Budgets */}
        <div className="glass glass-card slide-up" style={{ animationDelay: '300ms', height: '380px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            {selectedModule === 'books' ? 'Expenses by Category' : 'Zoho CRM Deal Stage Distribution (SAR)'}
          </h3>
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              {selectedModule === 'books' ? (
                <BarChart data={expenseCategoryChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 11}} interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)'}} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px', backdropFilter: 'blur(12px)' }} />
                  <Bar dataKey="value" fill="var(--secondary-color)" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={dealStageChartData.length > 0 ? dealStageChartData : [{name: 'No Deals', value: 1}]}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {dealStageChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px', backdropFilter: 'blur(12px)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Projects Budget vs Spent */}
        <div className="glass glass-card slide-up" style={{ animationDelay: '400ms', height: '380px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Zoho Projects: Budget vs Spent (SAR)
          </h3>
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projects.slice(0, 6)} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 11}} interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)'}} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px', backdropFilter: 'blur(12px)' }} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="budget" name="Budget" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Filtered Multi-Module Data Tables */}
      <div className="glass glass-card slide-up" style={{ animationDelay: '500ms', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {selectedModule === 'books' ? '💰 Zoho Books: Invoices' : selectedModule === 'projects' ? '📁 Zoho Projects: Active List' : '🎯 Zoho CRM: Recent Leads & Deals'}
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing items matching status: <strong>{statusFilter}</strong>
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {selectedModule === 'books' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0' }}>Invoice #</th>
                  <th style={{ padding: '0.75rem 0' }}>Customer</th>
                  <th style={{ padding: '0.75rem 0' }}>Status</th>
                  <th style={{ padding: '0.75rem 0' }}>Total Amount</th>
                  <th style={{ padding: '0.75rem 0' }}>Balance Due</th>
                  <th style={{ padding: '0.75rem 0' }}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={{ padding: '0.85rem 0', fontWeight: '600' }}>{inv.invoice_number}</td>
                    <td style={{ padding: '0.85rem 0' }}>{inv.customer_name}</td>
                    <td style={{ padding: '0.85rem 0' }}>
                      <span style={{ 
                        padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500,
                        backgroundColor: inv.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : inv.status === 'Overdue' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: inv.status === 'Paid' ? 'var(--success)' : inv.status === 'Overdue' ? 'var(--danger)' : 'var(--warning)'
                      }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 0', fontWeight: 600 }}>SAR {inv.total_amount.toLocaleString()}</td>
                    <td style={{ padding: '0.85rem 0', color: inv.balance_due > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      SAR {inv.balance_due.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.85rem 0', color: 'var(--text-secondary)' }}>
                      {new Date(inv.due_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : selectedModule === 'projects' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0' }}>Project Name</th>
                  <th style={{ padding: '0.75rem 0' }}>Status</th>
                  <th style={{ padding: '0.75rem 0' }}>Completion</th>
                  <th style={{ padding: '0.75rem 0' }}>Budget</th>
                  <th style={{ padding: '0.75rem 0' }}>Spent</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((proj) => (
                  <tr key={proj.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={{ padding: '0.85rem 0', fontWeight: '600' }}>{proj.name}</td>
                    <td style={{ padding: '0.85rem 0' }}>
                      <span style={{ 
                        padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500,
                        backgroundColor: proj.status === 'Completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: proj.status === 'Completed' ? 'var(--success)' : 'var(--primary-color)'
                      }}>
                        {proj.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: '8px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                          <div style={{ width: `${proj.completion_percentage}%`, height: '100%', backgroundColor: 'var(--primary-color)' }}></div>
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{proj.completion_percentage}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 0' }}>SAR {proj.budget.toLocaleString()}</td>
                    <td style={{ padding: '0.85rem 0', color: proj.spent > proj.budget ? 'var(--danger)' : 'var(--text-primary)' }}>
                      SAR {proj.spent.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0' }}>Company</th>
                  <th style={{ padding: '0.75rem 0' }}>Sales Rep</th>
                  <th style={{ padding: '0.75rem 0' }}>Status</th>
                  <th style={{ padding: '0.75rem 0' }}>Source</th>
                  <th style={{ padding: '0.75rem 0' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={{ padding: '0.85rem 0', fontWeight: '600' }}>{lead.company}</td>
                    <td style={{ padding: '0.85rem 0' }}>{lead.sales_rep}</td>
                    <td style={{ padding: '0.85rem 0' }}>
                      <span style={{ 
                        padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500,
                        backgroundColor: lead.status === 'Qualified' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: lead.status === 'Qualified' ? 'var(--success)' : 'var(--primary-color)'
                      }}>
                        {lead.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 0', color: 'var(--text-secondary)' }}>{lead.lead_source}</td>
                    <td style={{ padding: '0.85rem 0', fontWeight: '600' }}>SAR {lead.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
