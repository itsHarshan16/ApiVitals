/**
 * EditEndpointModal — frontend/src/components/EditEndpointModal.jsx
 *
 * Developer B — Day 2
 * Commit: feat(api): create axios client instance with base configuration
 *
 * Modal dialog for editing an existing monitored endpoint.
 * Receives the endpoint object as a prop and calls onSave(updatedEndpoint)
 * on successful update. Calls onClose() to dismiss without saving.
 *
 * Props:
 *   endpoint  {object}   — The endpoint to edit (from API)
 *   onSave    {function} — Called with updated endpoint data after save
 *   onClose   {function} — Called when modal should close
 */

import { useState } from 'react';
import { updateEndpoint } from '../api/endpointsApi';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

export default function EditEndpointModal({ endpoint, onSave, onClose }) {
  const [form, setForm] = useState({
    name:                 endpoint.name                 || '',
    url:                  endpoint.url                  || '',
    httpMethod:           endpoint.httpMethod           || endpoint.http_method || 'GET',
    checkIntervalSeconds: endpoint.checkIntervalSeconds || endpoint.check_interval_seconds || 60,
    expectedStatusCode:   endpoint.expectedStatusCode   || endpoint.expected_status_code || '',
    isActive:             endpoint.isActive             ?? endpoint.is_active ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ── Client-side validation ────────────────────────────────────────────────
    if (!form.name.trim()) {
      setError('Endpoint name is required.');
      return;
    }
    if (!form.url.trim() || !/^https?:\/\/.+/.test(form.url.trim())) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }
    const interval = Number(form.checkIntervalSeconds);
    if (!interval || interval < 10 || interval > 86400) {
      setError('Check interval must be between 10 and 86400 seconds.');
      return;
    }
    const statusCode = form.expectedStatusCode === '' ? null : Number(form.expectedStatusCode);
    if (form.expectedStatusCode !== '' && (statusCode < 100 || statusCode > 599)) {
      setError('Expected status code must be between 100 and 599.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name:                 form.name.trim(),
        url:                  form.url.trim(),
        httpMethod:           form.httpMethod,
        checkIntervalSeconds: interval,
        expectedStatusCode:   statusCode,
        isActive:             form.isActive,
      };
      const response = await updateEndpoint(endpoint.id, payload);
      onSave(response.data.endpoint || response.data);
    } catch (err) {
      const msg = err.response?.data?.message
                || err.response?.data?.error
                || 'Failed to update endpoint. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
      {/* Backdrop click closes modal */}
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <h2 id="edit-modal-title" className="modal-title">Edit Endpoint</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="form-error-banner" role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">Display Name *</label>
            <input
              id="edit-name"
              name="name"
              type="text"
              className="form-input"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Production API"
              maxLength={100}
              required
            />
          </div>

          {/* URL */}
          <div className="form-group">
            <label htmlFor="edit-url" className="form-label">URL *</label>
            <input
              id="edit-url"
              name="url"
              type="url"
              className="form-input"
              value={form.url}
              onChange={handleChange}
              placeholder="https://api.example.com/health"
              maxLength={2048}
              required
            />
          </div>

          {/* HTTP Method + Interval in one row */}
          <div className="form-row">
            <div className="form-group form-group--half">
              <label htmlFor="edit-method" className="form-label">HTTP Method</label>
              <select
                id="edit-method"
                name="httpMethod"
                className="form-input form-select"
                value={form.httpMethod}
                onChange={handleChange}
              >
                {HTTP_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="form-group form-group--half">
              <label htmlFor="edit-interval" className="form-label">Check Every (seconds)</label>
              <input
                id="edit-interval"
                name="checkIntervalSeconds"
                type="number"
                className="form-input"
                value={form.checkIntervalSeconds}
                onChange={handleChange}
                min={10}
                max={86400}
              />
            </div>
          </div>

          {/* Expected Status Code */}
          <div className="form-group">
            <label htmlFor="edit-status" className="form-label">
              Expected Status Code
              <span className="form-label-hint"> (optional — blank = any 2xx)</span>
            </label>
            <input
              id="edit-status"
              name="expectedStatusCode"
              type="number"
              className="form-input"
              value={form.expectedStatusCode}
              onChange={handleChange}
              placeholder="200"
              min={100}
              max={599}
            />
          </div>

          {/* Active toggle */}
          <div className="form-group form-group--checkbox">
            <label className="form-checkbox-label">
              <input
                name="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={handleChange}
              />
              <span>Active (endpoint will be polled on schedule)</span>
            </label>
          </div>

          {/* Footer buttons */}
          <div className="modal-footer">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

