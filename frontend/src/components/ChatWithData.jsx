import React, { useState } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

const ChatWithData = () => {
  const [selectedModel, setSelectedModel] = useState('kimi-k1.5');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: 'Hello! I am Kimi AI, connected to your Zoho MIS data (CRM, Projects & Books). Ask me anything!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now(), type: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, model: selectedModel })
      });
      
      const data = await response.json();
      setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: "Error connecting to the AI backend. Please make sure the FastAPI server is running." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass glass-card slide-up" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'calc(100vh - 200px)',
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* Chat Header with Model Selector */}
      <div style={{ 
        padding: '1.25rem 1.5rem', 
        borderBottom: '1px solid var(--surface-border)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '40px', height: '40px', borderRadius: '10px', 
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Bot size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Zoho AI Assistant</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Chat with CRM, Projects & Books Data</p>
          </div>
        </div>

        {/* Model Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Model:</span>
          <select
            value={isCustomModel ? 'custom' : selectedModel}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setIsCustomModel(true);
                setSelectedModel('');
              } else {
                setIsCustomModel(false);
                setSelectedModel(e.target.value);
              }
            }}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <optgroup label="🌙 Kimi / Moonshot">
              <option value="kimi-k1.5">Kimi k1.5 (Reasoning & Multimodal)</option>
              <option value="moonshot-v1-128k">Moonshot v1 (128k Long Context)</option>
              <option value="moonshot-v1-32k">Moonshot v1 (32k Context)</option>
            </optgroup>
            <optgroup label="✨ Google Gemini">
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            </optgroup>
            <optgroup label="🤖 OpenAI">
              <option value="gpt-4o">GPT-4o Omnimodal</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="o1">OpenAI o1 Reasoning</option>
            </optgroup>
            <optgroup label="🧠 Anthropic">
              <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
            </optgroup>
            <optgroup label="⚡ DeepSeek">
              <option value="deepseek-reasoner">DeepSeek R1</option>
              <option value="deepseek-chat">DeepSeek V3</option>
            </optgroup>
            <option value="custom">➕ Custom Future Model ID...</option>
          </select>

          {isCustomModel && (
            <input 
              type="text"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder="e.g. kimi-k2.0, gpt-5"
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--primary-color)',
                backgroundColor: 'rgba(255,255,255,0.9)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                outline: 'none',
                width: '140px'
              }}
            />
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {messages.map(msg => (
          <div key={msg.id} className="fade-in" style={{ 
            display: 'flex', 
            justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
            gap: '1rem'
          }}>
            {msg.type === 'bot' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={16} />
              </div>
            )}
            
            <div style={{ 
              maxWidth: '75%',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: msg.type === 'user' ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.4)',
              color: msg.type === 'user' ? 'white' : 'var(--text-primary)',
              border: msg.type === 'user' ? 'none' : '1px solid var(--surface-border)',
              boxShadow: 'var(--shadow-sm)',
              lineHeight: '1.5'
            }}>
              {msg.text}
            </div>

            {msg.type === 'user' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--secondary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={16} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="fade-in" style={{ display: 'flex', justifyContent: 'flex-start', gap: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={16} />
            </div>
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.4)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
              <Loader2 className="animate-spin" size={20} style={{ animation: 'spin 2s linear infinite' }} />
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div style={{ 
        padding: '1.5rem', 
        borderTop: '1px solid var(--surface-border)',
        backgroundColor: 'rgba(255, 255, 255, 0.2)'
      }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about revenue pipeline, active projects..." 
            style={{ 
              flex: 1, 
              padding: '1rem', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: '1rem',
              backdropFilter: 'blur(4px)'
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0 1.5rem' }}>
            <Send size={20} />
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ChatWithData;
