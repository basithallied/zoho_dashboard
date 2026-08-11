// API client for the MIS Agent mobile companion.
//
// Identity travels in the X-User-Email header, matching the web client. Replace
// it with the SSO token when the identity provider is wired up — every
// permission decision is made server-side.

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
const USER_EMAIL = process.env.EXPO_PUBLIC_USER_EMAIL || 'ceo@misagent.local';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': USER_EMAIL,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') detail = payload.detail;
    } catch (error) {
      // response carried no JSON body
    }
    throw new Error(detail);
  }
  return response.json();
}

export async function fetchMobileDashboardData() {
  const [dashboard, approvals, anomalies] = await Promise.all([
    request('/api/dashboard'),
    request('/api/approvals?status=pending'),
    request('/api/anomalies?status=active&limit=25'),
  ]);
  return { dashboard, approvals, anomalies };
}

export function openReport(runId) {
  // Serving report content is what records that a reviewer opened it, which is
  // the precondition the API enforces before it will accept an approval.
  return request(`/api/reports/runs/${runId}`);
}

export function approveReport(runId) {
  return request(`/api/approvals/runs/${runId}/approve`, { method: 'POST' });
}

export function rejectReport(runId, reason) {
  return request(`/api/approvals/runs/${runId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
