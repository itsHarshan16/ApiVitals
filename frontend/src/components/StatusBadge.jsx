import React from 'react';

const STATUS_CONFIG = {
  UP: { label: 'UP', className: 'badge-up' },
  HTTP_ERROR: { label: 'HTTP ERROR', className: 'badge-down' },
  TIMEOUT: { label: 'TIMEOUT', className: 'badge-down' },
  CONNECTION_ERROR: { label: 'CONN ERROR', className: 'badge-down' },
  BLOCKED: { label: 'BLOCKED (SSRF)', className: 'badge-blocked' },
};

export default function StatusBadge({ status }) {
  if (!status) {
    return <span className="muted">—</span>;
  }

  const config = STATUS_CONFIG[status] || { label: status, className: 'badge-neutral' };

  return (
    <span className={`badge ${config.className}`}>
      {config.label}
    </span>
  );
}

