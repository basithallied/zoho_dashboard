import React, { useState } from 'react';
import { Filter, Calendar, Layers, RefreshCw } from 'lucide-react';

const FilterBar = ({ 
  selectedModule, 
  setSelectedModule, 
  statusFilter, 
  setStatusFilter,
  timeframe,
  setTimeframe,
  refreshInterval,
  setRefreshInterval,
  onRefresh
}) => {
  const [isCustomRefresh, setIsCustomRefresh] = useState(false);
  const [customVal, setCustomVal] = useState(5);
  const [customUnit, setCustomUnit] = useState('mins');

  return (
    <div className="glass" style={{ 
      padding: '1rem 1.5rem', 
      marginBottom: '1.5rem', 
      display: 'flex', 
      flexWrap: 'wrap', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      gap: '1rem'
    }}>
      {/* Module Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Layers size={16} /> Module:
        </span>
        {['all', 'crm', 'projects', 'books'].map((mod) => (
          <button
            key={mod}
            className={`btn ${selectedModule === mod ? 'btn-primary' : ''}`}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background: selectedModule !== mod ? 'rgba(255,255,255,0.4)' : '',
              color: selectedModule !== mod ? 'var(--text-primary)' : '',
              border: '1px solid var(--surface-border)'
            }}
            onClick={() => { setSelectedModule(mod); setStatusFilter('All'); }}
          >
            {mod === 'all' ? '📊 All Modules' : mod === 'crm' ? '🎯 Zoho CRM' : mod === 'projects' ? '📁 Zoho Projects' : '💰 Zoho Books'}
          </button>
        ))}
      </div>

      {/* Secondary Filters: Status, Timeframe & Auto-Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Filter size={16} color="var(--text-secondary)" />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              backgroundColor: 'rgba(255,255,255,0.6)',
              color: 'var(--text-primary)',
              fontWeight: 500,
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="All">All Statuses</option>
            {selectedModule === 'crm' && (
              <>
                <option value="New">New Leads</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Closed Won">Closed Won (Deals)</option>
              </>
            )}
            {selectedModule === 'projects' && (
              <>
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Completed">Completed</option>
              </>
            )}
            {selectedModule === 'books' && (
              <>
                <option value="Paid">Paid Invoices</option>
                <option value="Sent">Sent Invoices</option>
                <option value="Overdue">Overdue Invoices</option>
              </>
            )}
          </select>
        </div>

        {/* Timeframe Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Calendar size={16} color="var(--text-secondary)" />
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              backgroundColor: 'rgba(255,255,255,0.6)',
              color: 'var(--text-primary)',
              fontWeight: 500,
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">This Quarter</option>
            <option value="ytd">Year to Date (YTD)</option>
          </select>
        </div>

        {/* Auto Refresh Interval */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <RefreshCw size={15} color="var(--primary-color)" />
          <select 
            value={isCustomRefresh ? 'custom' : refreshInterval} 
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setIsCustomRefresh(true);
                setRefreshInterval(customVal * (customUnit === 'secs' ? 1000 : customUnit === 'mins' ? 60000 : 3600000));
              } else {
                setIsCustomRefresh(false);
                setRefreshInterval(Number(e.target.value));
              }
            }}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              backgroundColor: 'rgba(255,255,255,0.6)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value={0}>Auto-Fetch: Off (Manual)</option>
            <option value={10000}>Auto-Fetch: Every 10s (Realtime)</option>
            <option value={30000}>Auto-Fetch: Every 30s</option>
            <option value={60000}>Auto-Fetch: Every 1 min</option>
            <option value={300000}>Auto-Fetch: Every 5 min</option>
            <option value="custom">⏱️ Custom Interval (Mins / Hours / Secs)...</option>
          </select>

          {isCustomRefresh && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }} className="fade-in">
              <input 
                type="number"
                min="1"
                max="1000"
                value={customVal}
                onChange={(e) => {
                  const val = Math.max(1, Number(e.target.value));
                  setCustomVal(val);
                  const mult = customUnit === 'secs' ? 1000 : customUnit === 'mins' ? 60000 : 3600000;
                  setRefreshInterval(val * mult);
                }}
                placeholder="Val"
                style={{
                  width: '65px',
                  padding: '0.4rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--primary-color)',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <select
                value={customUnit}
                onChange={(e) => {
                  const unit = e.target.value;
                  setCustomUnit(unit);
                  const mult = unit === 'secs' ? 1000 : unit === 'mins' ? 60000 : 3600000;
                  setRefreshInterval(customVal * mult);
                }}
                style={{
                  padding: '0.4rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--primary-color)',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="secs">Seconds</option>
                <option value="mins">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          )}
        </div>

        {/* Manual Refresh Button */}
        <button 
          className="btn"
          style={{
            padding: '0.45rem',
            background: 'rgba(255,255,255,0.5)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)'
          }}
          onClick={onRefresh}
          title="Fetch Now"
        >
          <RefreshCw size={16} color="var(--text-primary)" />
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
