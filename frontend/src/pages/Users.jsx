import React, { useState } from 'react';
import { Users, UserPlus, Shield, CheckCircle, XCircle, Edit, Trash2 } from 'lucide-react';

const initialUsers = [
  { id: 1, name: "Admin User", email: "admin@zoho.test", role: "Admin", status: "Active", lastLogin: "Just now" },
  { id: 2, name: "Sales Manager", email: "sales@zoho.test", role: "Sales Rep", status: "Active", lastLogin: "2 hours ago" },
  { id: 3, name: "Finance Director", email: "finance@zoho.test", role: "Finance Manager", status: "Active", lastLogin: "Yesterday" },
  { id: 4, name: "Project Lead", email: "pm@zoho.test", role: "Project Lead", status: "Inactive", lastLogin: "3 days ago" },
];

const UsersPage = () => {
  const [userList, setUserList] = useState(initialUsers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('Sales Rep');

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;

    const newUser = {
      id: Date.now(),
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      status: "Active",
      lastLogin: "Never"
    };

    setUserList([...userList, newUser]);
    setNewUserName('');
    setNewUserEmail('');
    setShowAddModal(false);
  };

  const toggleUserStatus = (id) => {
    setUserList(userList.map(u => u.id === id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header & Add Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={22} color="var(--primary-color)" /> User Management & RBAC
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Manage dashboard user roles, access permissions, and account status
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <UserPlus size={18} /> Add New User
        </button>
      </div>

      {/* Role Access Summary Cards */}
      <div className="grid grid-cols-4">
        {[
          { role: 'Admin', count: userList.filter(u => u.role === 'Admin').length, desc: 'Full system access & settings' },
          { role: 'Sales Rep', count: userList.filter(u => u.role === 'Sales Rep').length, desc: 'CRM leads & deals view' },
          { role: 'Finance Manager', count: userList.filter(u => u.role === 'Finance Manager').length, desc: 'Zoho Books & Invoices access' },
          { role: 'Project Lead', count: userList.filter(u => u.role === 'Project Lead').length, desc: 'Zoho Projects & task tracking' },
        ].map((r, i) => (
          <div key={i} className="glass glass-card slide-up" style={{ animationDelay: `${i * 100}ms` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{r.role}</span>
              <Shield size={16} color="var(--primary-color)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.count} User(s)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* User Table */}
      <div className="glass glass-card slide-up" style={{ padding: '1.5rem', animationDelay: '300ms' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Registered System Users</h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0' }}>User</th>
                <th style={{ padding: '0.75rem 0' }}>Role</th>
                <th style={{ padding: '0.75rem 0' }}>Status</th>
                <th style={{ padding: '0.75rem 0' }}>Last Login</th>
                <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <td style={{ padding: '0.85rem 0' }}>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '0.85rem 0' }}>
                    <span style={{ 
                      padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500,
                      backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-color)'
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 0' }}>
                    <span style={{ 
                      padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500,
                      backgroundColor: u.status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: u.status === 'Active' ? 'var(--success)' : 'var(--danger)',
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                      {u.status === 'Active' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 0', color: 'var(--text-secondary)' }}>{u.lastLogin}</td>
                  <td style={{ padding: '0.85rem 0', textAlign: 'right' }}>
                    <button 
                      className="btn"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.5)', marginRight: '0.5rem' }}
                      onClick={() => toggleUserStatus(u.id)}
                    >
                      Toggle Status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass glass-card fade-in" style={{ width: '420px', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Add New Dashboard User</h3>
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Full Name</label>
                <input 
                  type="text" required value={newUserName} onChange={e => setNewUserName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email Address</label>
                <input 
                  type="email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="sarah@company.com"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Role</label>
                <select 
                  value={newUserRole} onChange={e => setNewUserRole(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.25rem', outline: 'none' }}
                >
                  <option value="Admin">Admin</option>
                  <option value="Sales Rep">Sales Rep</option>
                  <option value="Finance Manager">Finance Manager</option>
                  <option value="Project Lead">Project Lead</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.6)' }} onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default UsersPage;
