import { pool } from './db.js';
import { validateUrlSafety } from './urlSafetyValidator.js';

/**
 * Executes a single health check probe against an endpoint.
 * Persists the result into monitoring_results and returns the saved record.
 */
export async function executeHealthCheck(endpoint) {
  const startTime = performance.now();
  let status = 'UP';
  let httpStatusCode = null;
  let responseTimeMs = null;
  let errorMessage = null;

  try {
    // Edge case 1: SSRF Validation
    await validateUrlSafety(endpoint.url);

    // Edge case 2: Timeouts (5-second hard limit via AbortController)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(endpoint.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'APIVitals-Monitor/1.0',
        'Accept': '*/*',
      },
      redirect: 'manual', // Edge case 3: Prevent silent unsafe open redirect following
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - startTime);
    responseTimeMs = duration;
    httpStatusCode = response.status;

    if (response.status >= 200 && response.status < 400) {
      status = 'UP';
    } else {
      status = 'HTTP_ERROR';
      errorMessage = `Server responded with HTTP status ${response.status} ${response.statusText || ''}`.trim();
    }
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    responseTimeMs = duration;

    if (err.name === 'AbortError') {
      status = 'TIMEOUT';
      errorMessage = 'Connection timed out after 5000ms';
    } else if (err.message && err.message.startsWith('SSRF Protection:')) {
      status = 'BLOCKED';
      errorMessage = err.message;
    } else {
      status = 'CONNECTION_ERROR';
      errorMessage = err.message || 'Connection failed';
    }
  }

  // Persist probe execution into MySQL monitoring_results
  try {
    const [insertResult] = await pool.query(
      `INSERT INTO monitoring_results (endpoint_id, status, http_status_code, response_time_ms, error_message, checked_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [endpoint.id, status, httpStatusCode, responseTimeMs, errorMessage ? errorMessage.substring(0, 500) : null]
    );

    return {
      id: insertResult.insertId,
      endpointId: endpoint.id,
      status,
      httpStatusCode,
      responseTimeMs,
      errorMessage,
      checkedAt: new Date().toISOString(),
    };
  } catch (dbErr) {
    console.error(`[HealthChecker] Failed to persist check for endpoint #${endpoint.id}:`, dbErr.message);
    return {
      id: 0,
      endpointId: endpoint.id,
      status,
      httpStatusCode,
      responseTimeMs,
      errorMessage,
      checkedAt: new Date().toISOString(),
    };
  }
}

