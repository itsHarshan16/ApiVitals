import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function HistoryPage() {
  const { id } = useParams();
  const [endpoint, setEndpoint] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.get(`/endpoints/${id}`),
      api.get(`/endpoints/${id}/history`),
    ])
      .then(([epRes, histRes]) => {
        if (isMounted) {
          setEndpoint(epRes.data);
          setHistory(histRes.data);
          setError('');
        }
      })
      .catch((err) => {
        if (isMounted) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [id]);

  return (
    <div className="page">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/endpoints" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
          ← Back to All Monitored Endpoints
        </Link>
      </div>

      {loading && <p className="muted">Retrieving historical telemetry...</p>}
      {error && <div className="card" style={{ background: '#fee2e2' }}><p className="error">{error}</p></div>}

      {endpoint && (
        <section className="card">
          <h2>{endpoint.name}</h2>
          <p className="url" style={{ fontSize: '1rem', color: '#1f2937' }}>{endpoint.url}</p>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
            <span className="muted small-text">
              Status: <strong>{endpoint.enabled ? 'Active Monitoring' : 'Paused'}</strong>
            </span>
            <span className="muted small-text">
              Cadence: <strong>Every {endpoint.checkIntervalSeconds} seconds</strong>
            </span>
          </div>
        </section>
      )}

      {endpoint && (
        <section className="card">
          <h2>Historical Probe Logs (Latest 50 Checks)</h2>
          {history.length === 0 ? (
            <p className="muted">
              No probe executions recorded yet. Return to the dashboard and click &quot;Check now&quot; to execute an initial test.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Status</th>
                  <th>HTTP Code</th>
                  <th>Response Time</th>
                  <th>Diagnostic Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>{new Date(record.checkedAt).toLocaleString()}</td>
                    <td><StatusBadge status={record.status} /></td>
                    <td>{record.httpStatusCode ?? '—'}</td>
                    <td>{record.responseTimeMs !== null ? `${record.responseTimeMs} ms` : '—'}</td>
                    <td className="muted" style={{ maxWidth: '350px' }}>{record.errorMessage || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

