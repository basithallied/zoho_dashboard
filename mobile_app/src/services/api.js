// API service for React Native mobile app to connect to FastAPI backend

const BASE_URL = 'http://localhost:8000'; // For iOS Simulator / Web. For Android emulator use 10.0.2.2 or local LAN IP.

export const fetchMobileDashboardData = async () => {
  try {
    const [kpiRes, sumRes, forcRes, altRes, leadRes, cashRes, workRes] = await Promise.all([
      fetch(`${BASE_URL}/api/kpis?module=all`),
      fetch(`${BASE_URL}/api/analytics/summary`),
      fetch(`${BASE_URL}/api/analytics/ai-forecast`),
      fetch(`${BASE_URL}/api/alerts`),
      fetch(`${BASE_URL}/api/crm/leaderboard`),
      fetch(`${BASE_URL}/api/books/cashflow-timeline`),
      fetch(`${BASE_URL}/api/projects/workload`)
    ]);

    const kpis = kpiRes.ok ? await kpiRes.json() : [];
    const summary = sumRes.ok ? await sumRes.json() : null;
    const forecast = forcRes.ok ? await forcRes.json() : null;
    const alerts = altRes.ok ? await altRes.json() : [];
    const leaderboard = leadRes.ok ? await leadRes.json() : [];
    const cashflow = cashRes.ok ? await cashRes.json() : [];
    const workload = workRes.ok ? await workRes.json() : [];

    return { kpis, summary, forecast, alerts, leaderboard, cashflow, workload };
  } catch (error) {
    console.error('Error fetching data in React Native app:', error);
    return { kpis: [], summary: null, forecast: null, alerts: [], leaderboard: [], cashflow: [], workload: [] };
  }
};
