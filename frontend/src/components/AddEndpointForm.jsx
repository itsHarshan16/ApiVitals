import React, { useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';

export default function AddEndpointForm({ onEndpointAdded }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState(300);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('Endpoint URL must start with http:// or https://');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/endpoints', {
        name: name.trim(),
        url: url.trim(),
        checkIntervalSeconds: Number(interval),
      });

      onEndpointAdded(response.data);
      setName('');
      setUrl('');
      setInterval(300);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Register New Monitored Endpoint</h2>
      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}
      <form onSubmit={handleSubmit} className="form-row">
        <label>
          Endpoint Name
          <input
            type="text"
            placeholder="e.g. Payment Gateway Health"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </label>

        <label style={{ flex: 2 }}>
          Target URL
          <input
            type="url"
            placeholder="https://api.github.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>

        <label className="small">
          Check Every (sec)
          <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
            <option value="600">10 minutes</option>
            <option value="1800">30 minutes</option>
          </select>
        </label>

        <button type="submit" disabled={loading} style={{ alignSelf: 'flex-end', height: '42px' }}>
          {loading ? 'Adding...' : '+ Add Endpoint'}
        </button>
      </form>
    </div>
  );
}

