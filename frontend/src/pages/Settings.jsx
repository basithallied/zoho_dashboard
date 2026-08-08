import React, { useState } from 'react';
import { Settings, Cpu, Key, Database, Globe, Save, Check, RefreshCw } from 'lucide-react';

const PROVIDER_VARIANTS = {
  kimi: [
    { value: 'kimi-k1.5', label: '🌙 Kimi k1.5 (Multimodal & Reasoning)' },
    { value: 'moonshot-v1-8k', label: '🌙 Moonshot v1 (8k Context)' },
    { value: 'moonshot-v1-32k', label: '🌙 Moonshot v1 (32k Context)' },
    { value: 'moonshot-v1-128k', label: '🌙 Moonshot v1 (128k Long Context)' },
  ],
  gemini: [
    { value: 'gemini-1.5-pro', label: '✨ Gemini 1.5 Pro (Recommended)' },
    { value: 'gemini-1.5-flash', label: '⚡ Gemini 1.5 Flash (Fast)' },
    { value: 'gemini-2.0-flash', label: '🚀 Gemini 2.0 Flash (Next Gen)' },
  ],
  openai: [
    { value: 'gpt-4o', label: '🤖 GPT-4o (Omnimodal Flagship)' },
    { value: 'gpt-4o-mini', label: '⚡ GPT-4o Mini (Lightweight)' },
    { value: 'o1', label: '🧠 OpenAI o1 (Reasoning)' },
    { value: 'o3-mini', label: '🚀 OpenAI o3-mini (High-speed Reasoning)' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-latest', label: '🧠 Claude 3.5 Sonnet (Flagship)' },
    { value: 'claude-3-5-haiku-latest', label: '⚡ Claude 3.5 Haiku (Fast)' },
    { value: 'claude-3-opus-latest', label: '🏰 Claude 3 Opus (Complex Analysis)' },
  ],
  deepseek: [
    { value: 'deepseek-reasoner', label: '⚡ DeepSeek R1 (Reasoning Engine)' },
    { value: 'deepseek-chat', label: '💬 DeepSeek V3 (General Chat)' },
  ]
};

const SettingsPage = () => {
  const [saved, setSaved] = useState(false);

  // LLM Settings
  const [llmProvider, setLlmProvider] = useState('kimi');
  const [modelName, setModelName] = useState(PROVIDER_VARIANTS.kimi[0].value);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [temperature, setTemperature] = useState(0.2);

  // Zoho Settings
  const [zohoMode, setZohoMode] = useState('mock'); // 'mock' or 'live'
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [region, setRegion] = useState('com'); // com, eu, in, com.au

  // General & Sync Settings
  const [currency, setCurrency] = useState('SAR');
  const [settingIntervalVal, setSettingIntervalVal] = useState(5);
  const [settingIntervalUnit, setSettingIntervalUnit] = useState('mins');

  const handleProviderChange = (newProvider) => {
    setLlmProvider(newProvider);
    setIsCustomModel(false);
    const defaultVariant = PROVIDER_VARIANTS[newProvider] ? PROVIDER_VARIANTS[newProvider][0].value : '';
    setModelName(defaultVariant);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={22} color="var(--primary-color)" /> System & API Settings
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Configure Multiple LLMs, Zoho API Connections, and Dashboard Preferences
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <Check size={18} /> : <Save size={18} />}
          {saved ? 'Saved!' : 'Save All Settings'}
        </button>
      </div>

      {/* 1. Multi-LLM Configuration Section */}
      <div className="glass glass-card slide-up" style={{ padding: '1.5rem', animationDelay: '100ms' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={20} color="var(--primary-color)" /> Multi-LLM Provider Provisioning
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Configure which Large Language Model powers the "Chat with Data" and dynamic KPI generation.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          
          {/* Active LLM Provider */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Active LLM Provider</label>
            <select 
              value={llmProvider} 
              onChange={e => handleProviderChange(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
            >
              <option value="kimi">Kimi AI (Moonshot)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="deepseek">DeepSeek AI</option>
            </select>
          </div>

          {/* Dynamic Model Variant Dropdown */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Model Variant (Auto-Listed)</label>
            <select 
              value={isCustomModel ? 'custom' : modelName} 
              onChange={e => {
                if (e.target.value === 'custom') {
                  setIsCustomModel(true);
                  setModelName('');
                } else {
                  setIsCustomModel(false);
                  setModelName(e.target.value);
                }
              }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none', fontWeight: 600 }}
            >
              {PROVIDER_VARIANTS[llmProvider] && PROVIDER_VARIANTS[llmProvider].map(variant => (
                <option key={variant.value} value={variant.value}>
                  {variant.label} ({variant.value})
                </option>
              ))}
              <option value="custom">➕ Add New Future Model Variant (Custom)...</option>
            </select>
          </div>

          {/* Custom Model Input if New Variant Selected */}
          {isCustomModel && (
            <div style={{ gridColumn: 'span 2' }} className="fade-in">
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                Enter New / Custom Model Variant ID
              </label>
              <input 
                type="text"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                placeholder="e.g. kimi-k2.0-pro, gpt-5, claude-4-opus"
                style={{ 
                  width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', 
                  border: '2px solid var(--primary-color)', marginTop: '0.25rem', outline: 'none',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)', fontWeight: 600
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                💡 Future-proof: Enter any new model identifier released by the provider.
              </span>
            </div>
          )}

          {/* Provider API Key */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{llmProvider.toUpperCase()} Provider API Key</label>
            <div style={{ position: 'relative', marginTop: '0.25rem' }}>
              <input 
                type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={`Enter your ${llmProvider.toUpperCase()} API key...`}
                style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', outline: 'none' }}
              />
              <Key size={18} color="var(--text-secondary)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
            </div>
          </div>

          {/* Temperature Slider */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <span>Temperature (Creativity): {temperature}</span>
              <span>0 = Strict SQL Parsing, 1 = Creative</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* 2. Zoho OAuth & API Configuration */}
      <div className="glass glass-card slide-up" style={{ padding: '1.5rem', animationDelay: '200ms' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={20} color="var(--primary-color)" /> Zoho API Connection & Data Sync
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Connect Zoho CRM, Zoho Projects, and Zoho Books OAuth credentials.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Sync Mode</label>
            <select 
              value={zohoMode} onChange={e => setZohoMode(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
            >
              <option value="mock">Mock Data Mode (Offline / Sandbox testing)</option>
              <option value="live">Live Zoho OAuth API Sync (PostgreSQL Sync)</option>
            </select>
          </div>

          {zohoMode === 'live' && (
            <>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Zoho Client ID</label>
                <input 
                  type="text" value={clientId} onChange={e => setClientId(e.target.value)}
                  placeholder="1000.XXXXXX..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Zoho Client Secret</label>
                <input 
                  type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                  placeholder="Secret key..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Zoho Data Region</label>
                <select 
                  value={region} onChange={e => setRegion(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
                >
                  <option value="com">Global (.com)</option>
                  <option value="eu">Europe (.eu)</option>
                  <option value="in">India (.in)</option>
                  <option value="com.au">Australia (.com.au)</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. Auto-Fetch & Data Sync Policy */}
      <div className="glass glass-card slide-up" style={{ padding: '1.5rem', animationDelay: '250ms' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} color="var(--primary-color)" /> Data Fetching & Polling Schedule Policy
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Set how frequently the dashboard automatically pulls fresh data from Zoho APIs / Database.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Auto-Fetch Interval Value</label>
            <input 
              type="number" min="1" max="1000"
              value={settingIntervalVal} onChange={e => setSettingIntervalVal(Number(e.target.value))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Interval Unit</label>
            <select 
              value={settingIntervalUnit} onChange={e => setSettingIntervalUnit(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none', fontWeight: 600 }}
            >
              <option value="secs">Seconds</option>
              <option value="mins">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Global Preferences */}
      <div className="glass glass-card slide-up" style={{ padding: '1.5rem', animationDelay: '300ms' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={20} color="var(--primary-color)" /> Regional & Currency Format
        </h3>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Default Currency Display</label>
          <select 
            value={currency} onChange={e => setCurrency(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
          >
            <option value="SAR">Saudi Riyal (SAR)</option>
            <option value="USD">US Dollar ($)</option>
            <option value="EUR">Euro (€)</option>
            <option value="AED">UAE Dirham (AED)</option>
          </select>
        </div>
      </div>

    </div>
  );
};

export default SettingsPage;
