/**
 * Centralised Error Handler Middleware — ESM version
 * D:\ApiVitals\server\middleware\errorHandler.js
 *
 * Developer C — Day 2
 * Must be the LAST middleware: app.use(errorHandler)
 */

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Validation (express-validator custom)
  if (err.type === 'validation') {
    return res.status(400).json({ error: 'Validation Error', message: 'Invalid input.', details: err.errors });
  }

  // JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or malformed token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token has expired. Please log in again.' });
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Conflict', message: 'Duplicate entry — this record already exists.' });
  }

  // Custom app errors with statusCode
  if (err.statusCode && err.statusCode < 500) {
    return res.status(err.statusCode).json({ error: err.error || 'Client Error', message: err.message });
  }

  // Generic server error
  const statusCode = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  console.error('[Unhandled Error]', err);
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'An unexpected error occurred.',
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Helper: throw createError(404, 'Not Found', 'Endpoint not found')
 */
export function createError(statusCode, error, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.error = error;
  return err;
}
