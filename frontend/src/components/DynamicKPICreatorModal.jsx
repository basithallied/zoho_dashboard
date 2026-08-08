import React, { useState } from 'react';
import { PlusCircle, X, Check, Sparkles } from 'lucide-react';
import { API_BASE } from '../apiConfig';

const DynamicKPICreatorModal = ({ isOpen, onClose, onKpiCreated }) => {
  const [name, setName] = useState('');
  const [module, setModule] = useState('all');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('SAR ');
  const [trend, setTrend] = useState('up');
  const [trendValue, setTrendValue] = useState('+10.0%');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAiSuggest = (preset) => {
    if (preset === 'ratio') {
      setName('Expense-to-Revenue Ratio');
      setModule('books');
      setValue('42.8');
      setUnit('%');
      setTrend('down');
      setTrendValue('-3.1%');
    } else if (preset === 'cac') {
      setName('Customer Acquisition Cost (CAC)');
      setModule('crm');
      setValue('4200');
      setUnit('SAR ');
      setTrend('down');
      setTrendValue('-8.5%');
    } else if (preset === 'cycle') {
      setName('Avg Deal Cycle Time');
      setModule('crm');
      setValue('21');
      setUnit(' Days');
      setTrend('down');
      setTrendValue('-4 Days');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !value) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/kpis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          module,
          value: parseFloat(value),
          unit,
          trend,
          trend_value: trendValue
        })
      });

      if (res.ok) {
        onKpiCreated();
        onClose();
        setName('');
        setValue('');
      }
    } catch (err) {
      console.error("Error creating custom KPI:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="glass glass-card fade-in" style={{ width: '460px', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <PlusCircle size={22} color="var(--primary-color)" /> Dynamic KPI Card Creator
          </h3>
          <button className="btn" style={{ background: 'transparent' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* AI Quick Auto-Fill Bar */}
        <div style={{ 
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', 
          backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)',
          marginBottom: '1rem'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
            <Sparkles size={14} /> AI Auto-Suggest Presets (Kimi Assistant)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            <button type="button" className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.7)' }} onClick={() => handleAiSuggest('ratio')}>
              📊 Expense/Rev Ratio
            </button>
            <button type="button" className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.7)' }} onClick={() => handleAiSuggest('cac')}>
              🎯 Customer Acq Cost (CAC)
            </button>
            <button type="button" className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.7)' }} onClick={() => handleAiSuggest('cycle')}>
              ⏱️ Deal Cycle Time
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>KPI Metric Name</label>
            <input 
              type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Expense-to-Revenue Ratio, Avg Deal Cycle"
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Module Target</label>
              <select value={module} onChange={e => setModule(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}>
                <option value="all">📊 All Modules</option>
                <option value="crm">🎯 Zoho CRM</option>
                <option value="projects">📁 Zoho Projects</option>
                <option value="books">💰 Zoho Books</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Currency / Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}>
                <option value="SAR ">SAR (Saudi Riyal)</option>
                <option value="%">% Percentage</option>
                <option value="">Count / Numeric</option>
                <option value=" Days"> Days</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Metric Value</label>
              <input type="number" step="any" required value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 125000 or 42.5" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Trend Direction</label>
              <select value={trend} onChange={e => setTrend(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}>
                <option value="up">📈 Upward Trend</option>
                <option value="down">📉 Downward Trend</option>
                <option value="neutral">➡️ Neutral / Stable</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.6)' }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Check size={18} /> Save Dynamic KPI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DynamicKPICreatorModal;
