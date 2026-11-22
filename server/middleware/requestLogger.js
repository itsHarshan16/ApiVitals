/**
 * Request Logger Middleware — ESM version
 * D:\ApiVitals\server\middleware\requestLogger.js
 *
 * Developer C — Day 2
 */

export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const time   = new Date().toLocaleTimeString('en-US', { hour12: false });
    const color  = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : status >= 300 ? '\x1b[36m' : '\x1b[32m';
    const reset  = '\x1b[0m';
    console.log(`${color}[${time}] ${method.padEnd(6)} ${originalUrl.padEnd(40)} → ${status}  ${ms}ms  (${ip})${reset}`);
  });

  next();
}
