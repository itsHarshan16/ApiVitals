import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import AddEndpointForm from '../components/AddEndpointForm.jsx';
import DashboardSummary from '../components/DashboardSummary.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function EndpointsPage() {
  const navigate = useNavigate();
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Manager Team & Approvals State
  const [approvedDevs, setApprovedDevs] = useState([]);
  const [pendingDevs, setPendingDevs] = useState([]);
  const [activeTeamTab, setActiveTeamTab] = useState('active'); // 'active' | 'pending' | 'add'
  const [assignCodes, setAssignCodes] = useState({}); // devId -> custom code
  const [teamMsg, setTeamMsg] = useState({ type: '', text: '' });

  // Direct Add Developer Form
  const [newDevName, setNewDevName] = useState('');
  const [newDevEmail, setNewDevEmail] = useState('');
  const [newDevCode, setNewDevCode] = useState('');
  const [newDevPassword, setNewDevPassword] = useState('Dev@123!');
  const [devFormLoading, setDevFormLoading] = useState(false);

  const currentUserEmail = localStorage.getItem('email') || 'User';
  const currentRole = localStorage.getItem('role') || 'DEVELOPER';
  const currentDevCode = localStorage.getItem('developerCode');
  const currentManagerEmail = localStorage.getItem('managerEmail');

  const isManager = currentRole === 'MANAGER';

  const triggerDashboardRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const loadEndpoints = () => {
    api.get('/endpoints')
      .then((res) => {
        setEndpoints(res.data);
        setError('');
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  const loadTeamData = () => {
    if (isManager) {
      api.get('/manager/team')
        .then((res) => {
          setApprovedDevs(res.data.approved || []);
          setPendingDevs(res.data.pending || []);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    loadEndpoints();
    loadTeamData();
  }, [refreshKey]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleCheckNow = async (endpoint) => {
    setError('');
    setBusyId(endpoint.id);
    try {
      const response = await api.post(`/endpoints/${endpoint.id}/check`);
      setEndpoints((prev) =>
        prev.map((ep) =>
          ep.id === endpoint.id ? { ...ep, lastResult: response.data } : ep
        )
      );
      triggerDashboardRefresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteEndpoint = async (endpoint) => {
    if (!window.confirm(`Stop monitoring and delete "${endpoint.name}"?`)) {
      return;
    }

    setError('');
    setBusyId(endpoint.id);
    try {
      await api.delete(`/endpoints/${endpoint.id}`);
      setEndpoints((prev) => prev.filter((ep) => ep.id !== endpoint.id));
      triggerDashboardRefresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  // Manager: Approve Developer Request
  const handleApprove = async (devId) => {
    setTeamMsg({ type: '', text: '' });
    try {
      const customCode = assignCodes[devId];
      const res = await api.post(`/manager/approve/${devId}`, { developerCode: customCode });
      setTeamMsg({ type: 'success', text: res.data.message });
      loadTeamData();
      triggerDashboardRefresh();
    } catch (err) {
      setTeamMsg({ type: 'error', text: getErrorMessage(err) });
    }
  };

  // Manager: Reject Developer Request
  const handleReject = async (devId) => {
    if (!window.confirm('Reject this developer registration request?')) return;
    setTeamMsg({ type: '', text: '' });
    try {
      const res = await api.post(`/manager/reject/${devId}`);
      setTeamMsg({ type: 'info', text: res.data.message });
      loadTeamData();
    } catch (err) {
      setTeamMsg({ type: 'error', text: getErrorMessage(err) });
    }
  };

  // Manager: Direct Register Developer
  const handleDirectAddDeveloper = async (e) => {
    e.preventDefault();
    setTeamMsg({ type: '', text: '' });
    setDevFormLoading(true);

    try {
      const res = await api.post('/manager/developers', {
        username: newDevName.trim(),
        email: newDevEmail.trim(),
        password: newDevPassword,
        developerCode: newDevCode.trim() || undefined,
      });

      setTeamMsg({ type: 'success', text: res.data.message });
      setNewDevName('');
      setNewDevEmail('');
      setNewDevCode('');
      loadTeamData();
      setActiveTeamTab('active');
    } catch (err) {
      setTeamMsg({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setDevFormLoading(false);
    }
  };

  // Manager: Remove Developer
  const handleRemoveDev = async (dev) => {
    if (!window.confirm(`Remove developer ${dev.developerCode || dev.email} from your team?`)) return;
    try {
      await api.delete(`/manager/developers/${dev.id}`);
      loadTeamData();
      triggerDashboardRefresh();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div className="page">
      {/* Top Header */}
      <header className="top-bar">
        <div className="brand">
          <svg className="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <div>
            <span className="brand-title">APIVitals</span>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              {isManager ? 'Manager Workspace' : 'Developer Workspace'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
              {currentDevCode ? (
                <span>ID: <code style={{ color: '#2563eb', background: '#eff6ff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{currentDevCode}</code> ({currentUserEmail})</span>
              ) : (
                <span>{currentUserEmail}</span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
              {isManager ? (
                <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>MANAGER</span>
              ) : (
                <span>
                  <span className="badge badge-neutral">DEVELOPER</span>
                  {currentManagerEmail && ` • Reports to: ${currentManagerEmail}`}
                </span>
              )}
            </div>
          </div>
          <button className="secondary small" onClick={handleLogout}>Log Out</button>
        </div>
      </header>

      {error && <div className="card" style={{ background: '#fee2e2' }}><p className="error">{error}</p></div>}

      {/* =================================================================== */}
      {/* MANAGER: TEAM & DEVELOPER APPROVALS CARD                            */}
      {/* =================================================================== */}
      {isManager && (
        <section className="card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Team & Developer Approvals</h2>
              <span className="muted small-text">Supervise developers, approve registration requests, and issue Developer IDs.</span>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveTeamTab('active')}
                style={{
                  background: activeTeamTab === 'active' ? '#ffffff' : 'transparent',
                  color: activeTeamTab === 'active' ? '#0f172a' : '#64748b',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  boxShadow: activeTeamTab === 'active' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Active Developers ({approvedDevs.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTeamTab('pending')}
                style={{
                  background: activeTeamTab === 'pending' ? '#ffffff' : 'transparent',
                  color: activeTeamTab === 'pending' ? '#0f172a' : (pendingDevs.length > 0 ? '#b91c1c' : '#64748b'),
                  fontWeight: pendingDevs.length > 0 ? 700 : 500,
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  boxShadow: activeTeamTab === 'pending' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Pending Requests ({pendingDevs.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTeamTab('add')}
                style={{
                  background: activeTeamTab === 'add' ? '#ffffff' : 'transparent',
                  color: activeTeamTab === 'add' ? '#0f172a' : '#64748b',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  boxShadow: activeTeamTab === 'add' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                + Add Developer
              </button>
            </div>
          </div>

          {teamMsg.text && (
            <div style={{
              background: teamMsg.type === 'success' ? '#f0fdf4' : teamMsg.type === 'error' ? '#fef2f2' : '#eff6ff',
              border: `1px solid ${teamMsg.type === 'success' ? '#bbf7d0' : teamMsg.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
              color: teamMsg.type === 'success' ? '#166534' : teamMsg.type === 'error' ? '#991b1b' : '#1e40af',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              {teamMsg.text}
            </div>
          )}

          {/* TAB 1: Active Approved Developers */}
          {activeTeamTab === 'active' && (
            approvedDevs.length === 0 ? (
              <p className="muted" style={{ margin: '0.5rem 0' }}>No active developers yet. Developers can register and request your approval, or you can add them directly.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Unique Developer ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Endpoints</th>
                    <th>Approved On</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedDevs.map((dev) => (
                    <tr key={dev.id}>
                      <td>
                        <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                          {dev.developerCode}
                        </code>
                      </td>
                      <td><strong>{dev.username}</strong></td>
                      <td>{dev.email}</td>
                      <td>{dev.totalEndpoints} endpoint(s)</td>
                      <td>{new Date(dev.createdAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="small danger" onClick={() => handleRemoveDev(dev)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* TAB 2: Pending Approval Requests */}
          {activeTeamTab === 'pending' && (
            pendingDevs.length === 0 ? (
              <p className="muted" style={{ margin: '0.5rem 0' }}>No pending developer requests waiting for your approval.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Applicant Name</th>
                    <th>Email</th>
                    <th>Requested At</th>
                    <th>Assign Developer ID</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDevs.map((req) => (
                    <tr key={req.id}>
                      <td><strong>{req.username}</strong></td>
                      <td>{req.email}</td>
                      <td>{new Date(req.createdAt).toLocaleString()}</td>
                      <td>
                        <input
                          type="text"
                          placeholder="e.g. DEV-103 (auto if blank)"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', width: '180px' }}
                          value={assignCodes[req.id] || ''}
                          onChange={(e) => setAssignCodes({ ...assignCodes, [req.id]: e.target.value })}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            className="small"
                            onClick={() => handleApprove(req.id)}
                            style={{ background: '#16a34a' }}
                          >
                            Approve
                          </button>
                          <button
                            className="small secondary"
                            onClick={() => handleReject(req.id)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* TAB 3: Direct Add Developer */}
          {activeTeamTab === 'add' && (
            <form onSubmit={handleDirectAddDeveloper} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Create Developer Account</h3>
              <div className="form-row">
                <label>
                  Developer Name
                  <input
                    type="text"
                    placeholder="e.g. Alice Cooper"
                    value={newDevName}
                    onChange={(e) => setNewDevName(e.target.value)}
                    required
                  />
                </label>

                <label>
                  Developer Email
                  <input
                    type="email"
                    placeholder="alice@company.com"
                    value={newDevEmail}
                    onChange={(e) => setNewDevEmail(e.target.value)}
                    required
                  />
                </label>

                <label>
                  Developer ID (optional)
                  <input
                    type="text"
                    placeholder="e.g. DEV-105"
                    value={newDevCode}
                    onChange={(e) => setNewDevCode(e.target.value)}
                  />
                </label>

                <label>
                  Initial Password
                  <input
                    type="text"
                    value={newDevPassword}
                    onChange={(e) => setNewDevPassword(e.target.value)}
                    required
                  />
                </label>

                <button type="submit" disabled={devFormLoading} style={{ height: '42px', alignSelf: 'flex-end' }}>
                  {devFormLoading ? 'Adding...' : 'Create & Approve'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Analytics Summary */}
      <DashboardSummary refreshKey={refreshKey} />

      {/* Add New Endpoint */}
      <AddEndpointForm onEndpointAdded={() => {
        loadEndpoints();
        triggerDashboardRefresh();
      }} />

      {/* Monitored Endpoints Table */}
      <section className="card">
        <h2>
          {isManager ? `Team Monitored Endpoints (${endpoints.length})` : `My Monitored Endpoints (${endpoints.length})`}
        </h2>

        {loading && <p className="muted">Loading monitored endpoints...</p>}

        {!loading && endpoints.length === 0 && (
          <p className="muted">No endpoints registered yet. Use the form above to add an API to monitor.</p>
        )}

        {!loading && endpoints.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Endpoint Name</th>
                <th>Target URL</th>
                {isManager && <th>Owner (Dev ID)</th>}
                <th>Cadence</th>
                <th>Monitoring</th>
                <th>Last Probe Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => {
                const isBusy = busyId === ep.id;
                const result = ep.lastResult;
                const ownerCode = ep.owner?.developerCode || (ep.owner?.isSelf ? 'You (Manager)' : ep.owner?.email);
                return (
                  <tr key={ep.id}>
                    <td>
                      <Link to={`/endpoints/${ep.id}`} style={{ fontWeight: 600 }}>
                        {ep.name}
                      </Link>
                    </td>
                    <td className="url">{ep.url}</td>

                    {isManager && (
                      <td>
                        <span className={`badge ${ep.owner?.isSelf ? 'badge-up' : 'badge-neutral'}`}>
                          {ownerCode}
                        </span>
                      </td>
                    )}

                    <td>{ep.checkIntervalSeconds}s</td>
                    <td>
                      <span className="badge badge-neutral">
                        {ep.enabled ? 'Enabled' : 'Paused'}
                      </span>
                    </td>
                    <td>
                      {result ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <StatusBadge status={result.status} />
                          {result.responseTimeMs !== null && (
                            <span className="muted small-text">{result.responseTimeMs} ms</span>
                          )}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="small"
                          disabled={isBusy}
                          onClick={() => handleCheckNow(ep)}
                        >
                          {isBusy ? 'Checking...' : 'Check now'}
                        </button>
                        <button
                          className="small danger"
                          disabled={isBusy}
                          onClick={() => handleDeleteEndpoint(ep)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
