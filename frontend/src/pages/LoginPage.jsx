import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [registerRole, setRegisterRole] = useState('DEVELOPER'); // 'DEVELOPER' or 'MANAGER'

  // Form Fields
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');

  // Managers List for Developer Signup
  const [managers, setManagers] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isRegister) {
      api.get('/auth/managers')
        .then((res) => {
          const mgrList = res.data || [];
          setManagers(mgrList);
          if (mgrList.length > 0) {
            setSelectedManagerId(String(mgrList[0].id));
          } else {
            // If no manager exists yet, default to Manager registration
            setRegisterRole('MANAGER');
          }
        })
        .catch(() => {});
    }
  }, [isRegister]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email: identifier.trim(),
        password,
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('email', response.data.email);
      localStorage.setItem('username', response.data.username || '');
      localStorage.setItem('role', response.data.role);

      if (response.data.developerCode) {
        localStorage.setItem('developerCode', response.data.developerCode);
      } else {
        localStorage.removeItem('developerCode');
      }

      if (response.data.managerEmail) {
        localStorage.setItem('managerEmail', response.data.managerEmail);
      } else {
        localStorage.removeItem('managerEmail');
      }

      navigate('/endpoints');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (registerRole === 'DEVELOPER' && (!selectedManagerId || managers.length === 0)) {
      setError('Please select a supervising manager. If no manager exists yet, register as a Manager first.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        username: username.trim(),
        email: email.trim(),
        password,
        role: registerRole,
        managerId: registerRole === 'DEVELOPER' ? Number(selectedManagerId) : undefined,
      };

      const response = await api.post('/auth/register', payload);

      if (response.data.pending) {
        setSuccessMsg(response.data.message);
        setUsername('');
        setEmail('');
        setPassword('');
      } else {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('email', response.data.email);
        localStorage.setItem('role', response.data.role);
        navigate('/endpoints');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <svg style={{ width: '32px', height: '32px', color: '#2563eb' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>APIVitals</h1>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            {isRegister ? 'Create an account to join or manage a team' : 'API Telemetry & Health Monitoring'}
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
            {successMsg}
          </div>
        )}

        {!isRegister ? (
          /* ================================================================= */
          /* CLEAN SIGN IN FORM                                               */
          /* ================================================================= */
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <label>
              Developer ID or Email
              <input
                type="text"
                placeholder="Enter Developer ID or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', height: '44px' }}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* ================================================================= */
          /* REGISTRATION FORM                                                */
          /* ================================================================= */
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Role Toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setRegisterRole('DEVELOPER')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  background: registerRole === 'DEVELOPER' ? '#ffffff' : 'transparent',
                  color: registerRole === 'DEVELOPER' ? '#1e293b' : '#64748b',
                  boxShadow: registerRole === 'DEVELOPER' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Developer
              </button>
              <button
                type="button"
                onClick={() => setRegisterRole('MANAGER')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  background: registerRole === 'MANAGER' ? '#ffffff' : 'transparent',
                  color: registerRole === 'MANAGER' ? '#1e293b' : '#64748b',
                  boxShadow: registerRole === 'MANAGER' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Manager
              </button>
            </div>

            <label>
              Full Name
              <input
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

            <label>
              Email Address
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            {registerRole === 'DEVELOPER' && (
              <label>
                Select Your Supervising Manager
                {managers.length > 0 ? (
                  <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    required
                  >
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: '#475569', marginTop: '0.35rem' }}>
                    No active managers found yet. Please switch above and register as a <strong>Manager</strong> first.
                  </div>
                )}
              </label>
            )}

            <label>
              Password (min 8 characters)
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>

            <button 
              type="submit" 
              disabled={loading || (registerRole === 'DEVELOPER' && managers.length === 0)} 
              style={{ marginTop: '0.5rem', height: '44px' }}
            >
              {loading 
                ? 'Submitting...' 
                : (registerRole === 'DEVELOPER' 
                    ? (managers.length > 0 ? 'Request Manager Approval' : 'Manager Required First') 
                    : 'Register as Manager')}
            </button>
          </form>
        )}

        {/* Toggle Mode */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setSuccessMsg('');
            }}
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register here"}
          </button>
        </div>
      </div>
    </div>
  );
}
