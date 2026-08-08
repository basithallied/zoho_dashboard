import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import SettingsPage from './pages/Settings';
import ChatWithData from './components/ChatWithData';
import MobileDashboard from './pages/MobileDashboard';
import { LayoutDashboard, MessageSquare, Settings, Users, LogOut, Menu, Smartphone } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`glass sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ color: 'var(--primary-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutDashboard size={24} />
            Zoho MIS
          </h2>
          <button 
            className="mobile-only btn" 
            style={{ padding: '0.5rem', background: 'transparent' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={24} />
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }} className="nav-menu">
          <button 
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', background: activeTab !== 'dashboard' ? 'transparent' : '', color: activeTab !== 'dashboard' ? 'var(--text-secondary)' : '' }}
            onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>

          <button 
            className={`btn ${activeTab === 'mobile' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', background: activeTab !== 'mobile' ? 'transparent' : '', color: activeTab !== 'mobile' ? 'var(--text-secondary)' : '' }}
            onClick={() => { setActiveTab('mobile'); setMobileMenuOpen(false); }}
          >
            <Smartphone size={20} />
            Mobile App View
          </button>
          
          <button 
            className={`btn ${activeTab === 'chat' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', background: activeTab !== 'chat' ? 'transparent' : '', color: activeTab !== 'chat' ? 'var(--text-secondary)' : '' }}
            onClick={() => { setActiveTab('chat'); setMobileMenuOpen(false); }}
          >
            <MessageSquare size={20} />
            Chat with Data
          </button>

          <button 
            className={`btn ${activeTab === 'users' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', background: activeTab !== 'users' ? 'transparent' : '', color: activeTab !== 'users' ? 'var(--text-secondary)' : '' }}
            onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
          >
            <Users size={20} />
            Users
          </button>

          <button 
            className={`btn ${activeTab === 'settings' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', background: activeTab !== 'settings' ? 'transparent' : '', color: activeTab !== 'settings' ? 'var(--text-secondary)' : '' }}
            onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }}
          >
            <Settings size={20} />
            Settings
          </button>
        </nav>

        <div style={{ marginTop: 'auto' }} className="nav-menu">
          <button 
            className="btn"
            style={{ justifyContent: 'flex-start', background: 'transparent', color: 'var(--danger)', width: '100%' }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content fade-in">
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>
              {activeTab === 'dashboard' && 'Overview'}
              {activeTab === 'mobile' && 'Executive Mobile Companion App'}
              {activeTab === 'chat' && 'AI Data Assistant'}
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'settings' && 'System Configuration'}
            </h1>
            <p>Welcome back, Admin</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              AD
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'mobile' && <MobileDashboard />}
        {activeTab === 'chat' && <ChatWithData />}
        {activeTab === 'users' && <UsersPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
      
      <style>{`
        @media (max-width: 768px) {
          .nav-menu {
            display: ${mobileMenuOpen ? 'flex' : 'none'} !important;
            position: absolute;
            top: 70px;
            left: 0;
            right: 0;
            background: var(--surface-color);
            backdrop-filter: blur(12px);
            padding: 1rem;
            border-bottom: 1px solid var(--surface-border);
            z-index: 20;
          }
          .mobile-only {
            display: block;
          }
        }
        @media (min-width: 769px) {
          .mobile-only {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
