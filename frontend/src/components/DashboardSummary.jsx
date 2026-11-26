import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import StatusBadge from './StatusBadge.jsx';

export default function DashboardSummary({ refreshKey }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    api.get('/dashboard/summary')
      .then((res) => {
        if (isMounted) {
          setSummary(res.data);
          setError('');
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [refreshKey]);

  if (loading && !summary) {
    return <div className="card"><p className="muted">Calculating real-time telemetry...</p></div>;
  }

  if (error) {
    return <div className="card"><p className="error">{error}</p></div>;
  }

  if (!summary) return null;

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>System Health &amp; Analytics (24h Overview)</h2>
        <span className="muted small-text">Auto-calculated from MySQL time-series</span>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{summary.totalEndpoints}</div>
          <div className="stat-label">Total Endpoints</div>
        </div>

        <div className="stat good">
          <div className="stat-value">{summary.healthyEndpoints}</div>
          <div className="stat-label">Healthy (UP)</div>
        </div>

        <div className={`stat ${summary.failingEndpoints > 0 ? 'bad' : ''}`}>
          <div className="stat-value">{summary.failingEndpoints}</div>
          <div className="stat-label">Failing / Error</div>
        </div>

        <div className="stat">
          <div className="stat-value">{summary.uncheckedEndpoints}</div>
          <div className="stat-label">Unchecked</div>
        </div>

        <div className="stat good">
          <div className="stat-value">
            {summary.uptimePercentLast24h !== null ? `${summary.uptimePercentLast24h}%` : '—'}
          </div>
          <div className="stat-label">24h Uptime SLA</div>
        </div>

        <div className="stat">
          <div className="stat-value">
            {summary.averageResponseTimeMsLast24h !== null ? `${summary.averageResponseTimeMsLast24h} ms` : '—'}
          </div>
          <div className="stat-label">Avg Latency (24h)</div>
        </div>
      </div>

      <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Recent Incident &amp; Failure Logs</h3>
      {summary.recentFailures.length === 0 ? (
        <p className="muted">All monitored endpoints are operating within normal operational parameters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Diagnostic Message</th>
            </tr>
          </thead>
          <tbody>
            {summary.recentFailures.map((failure, idx) => (
              <tr key={idx}>
                <td>{new Date(failure.checkedAt).toLocaleTimeString()}</td>
                <td>
                  <Link to={`/endpoints/${failure.endpointId}`}>{failure.endpointName}</Link>
                </td>
                <td><StatusBadge status={failure.status} /></td>
                <td className="muted" style={{ maxWidth: '350px' }}>{failure.errorMessage || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

