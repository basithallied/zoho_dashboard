/**
 * API client.
 *
 * Identity travels in the X-User-Email header so the demo can switch personas;
 * a production build swaps this for the SSO token and nothing else changes,
 * because permission decisions are made on the server.
 */

export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000/api'
    : '/api');

const IDENTITY_KEY = 'mis-agent-user';

export function currentIdentity() {
  return localStorage.getItem(IDENTITY_KEY) || 'admin@misagent.local';
}

export function setIdentity(email) {
  localStorage.setItem(IDENTITY_KEY, email);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': currentIdentity(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') detail = payload.detail;
      else if (Array.isArray(payload.detail)) detail = payload.detail.map((d) => d.msg).join('; ');
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  exportUrl: (path) => `${API_BASE}${path}`,
};

/* ------------------------------ formatting ------------------------------- */

export function formatCurrency(value, { compact = false } = {}) {
  if (value === null || value === undefined) return '—';
  if (compact && Math.abs(value) >= 1000) {
    const units = [
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K'],
    ];
    for (const [size, suffix] of units) {
      if (Math.abs(value) >= size) return `SAR ${(value / size).toFixed(1)}${suffix}`;
    }
  }
  return `SAR ${Math.round(value).toLocaleString('en-US')}`;
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-US');
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function relativeTime(value) {
  if (!value) return '—';
  const diffMinutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

export function initials(nameOrEmail = '') {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0].replace(/[._]/g, ' ') : nameOrEmail;
  return base
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const ACRONYMS = new Set(['crm', 'hr', 'it', 'erp', 'hrms', 'dso', 'mep', 'kpi', 'mis', 'ai', 'qa']);

export function titleCase(value = '') {
  return value
    .replace(/[_.]/g, ' ')
    .split(' ')
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}
