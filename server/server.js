import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { pool, initDb } from './db.js';
import { requireAuth, requireManager, generateToken } from './authMiddleware.js';
import { validateUrlSafety } from './urlSafetyValidator.js';
import { executeHealthCheck } from './healthChecker.js';

// Middleware
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { validators, handleValidation } from './middleware/validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// In-memory rate limiting map for auth
const authAttempts = new Map();

function rateLimitAuth(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const record = authAttempts.get(ip) || { count: 0, resetTime: now + 60000 };

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + 60000;
  }

  record.count += 1;
  authAttempts.set(ip, record);

  if (record.count > 20) {
    return res.status(429).json({
      message: 'Too many authentication attempts from this IP address. Please wait 1 minute before retrying.',
    });
  }

  next();
}

// Global Set tracking in-flight health check probe executions
const activeCheckIds = new Set();

// =============================================================================
// 1. Health Probe Root Endpoint
// =============================================================================
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    system: 'APIVitals Telemetry Engine',
    timestamp: new Date().toISOString(),
  });
});

// =============================================================================
// 2. Authentication Routes (/api/auth)
// =============================================================================

// Public endpoint to get available managers (for developer registration dropdown)
app.get('/api/auth/managers', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, email FROM users WHERE role = 'MANAGER' AND status = 'APPROVED' ORDER BY username ASC`
    );
    res.json(rows.map(m => ({ id: m.id, name: m.username || m.email, email: m.email })));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load managers.' });
  }
});

// Register: Manager (Direct Approved) or Developer (Pending Manager Approval)
app.post('/api/auth/register', rateLimitAuth, validators.register, handleValidation, async (req, res) => {
  try {
    const { email, password, username, role, managerId } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ message: 'Email and password (minimum 8 characters) are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim() : cleanEmail.split('@')[0];
    const isDeveloper = role === 'DEVELOPER';

    // Verify email uniqueness
    const [existing] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'This email address is already registered.' });
    }

    let assignedManagerId = null;
    if (isDeveloper) {
      if (!managerId) {
        return res.status(400).json({ message: 'Please select a manager to submit your registration to.' });
      }
      const [mgr] = await pool.query(`SELECT id FROM users WHERE id = ? AND role = 'MANAGER'`, [managerId]);
      if (mgr.length === 0) {
        return res.status(400).json({ message: 'Selected manager does not exist.' });
      }
      assignedManagerId = Number(managerId);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Developers start as PENDING until approved by manager
    // Managers are directly APPROVED
    const initialStatus = isDeveloper ? 'PENDING' : 'APPROVED';
    const userRole = isDeveloper ? 'DEVELOPER' : 'MANAGER';

    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, status, manager_id) VALUES (?, ?, ?, ?, ?, ?)',
      [cleanUsername, cleanEmail, passwordHash, userRole, initialStatus, assignedManagerId]
    );

    if (isDeveloper) {
      return res.status(201).json({
        message: 'Registration submitted! Your account is pending approval by your manager. Once approved, your manager will provide your Unique Developer ID to log in.',
        pending: true,
      });
    }

    // Direct login for Manager
    const user = {
      id: result.insertId,
      email: cleanEmail,
      username: cleanUsername,
      role: 'MANAGER',
      status: 'APPROVED',
    };
    const token = generateToken(user);
    res.status(201).json({ token, ...user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'An internal server error occurred during registration.' });
  }
});

// Login: Supports Manager Email/Username OR Developer Unique ID
app.post('/api/auth/login', rateLimitAuth, validators.login, handleValidation, async (req, res) => {
  try {
    const idInput = (req.body.email || req.body.username || req.body.developerCode || req.body.developer_code || '').trim();
    const { password } = req.body;
    if (!idInput || !password) {
      return res.status(400).json({ message: 'Please enter your Developer ID or Email, and password.' });
    }

    const cleanId = idInput.toLowerCase();
    const [rows] = await pool.query(
      `SELECT u.*, m.email as manager_email, m.username as manager_username
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.developer_code = ? OR LOWER(u.email) = ? OR LOWER(u.username) = ?`,
      [idInput, cleanId, cleanId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid Developer ID, Email, or password.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Developer ID, Email, or password.' });
    }

    // Check Approval Status
    if (user.status === 'PENDING') {
      return res.status(403).json({
        message: 'Your account is pending approval by your manager. You can sign in once your manager approves your request and gives you your Developer ID.',
      });
    }
    if (user.status === 'REJECTED') {
      return res.status(403).json({
        message: 'Your developer account request was declined by the manager.',
      });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      developerCode: user.developer_code,
      managerId: user.manager_id,
    };

    const token = generateToken(tokenPayload);
    res.status(200).json({
      token,
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      developerCode: user.developer_code,
      managerId: user.manager_id,
      managerEmail: user.manager_email,
      managerUsername: user.manager_username,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'An internal server error occurred during login.' });
  }
});

// Profile / Current User
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.developer_code, u.manager_id, u.created_at,
              m.email as manager_email, m.username as manager_username
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const u = rows[0];
    let teamCount = 0;
    let pendingCount = 0;
    if (u.role === 'MANAGER') {
      const [approvedRows] = await pool.query(`SELECT COUNT(*) as count FROM users WHERE manager_id = ? AND status = 'APPROVED'`, [u.id]);
      const [pendingRows] = await pool.query(`SELECT COUNT(*) as count FROM users WHERE manager_id = ? AND status = 'PENDING'`, [u.id]);
      teamCount = approvedRows[0].count;
      pendingCount = pendingRows[0].count;
    }
    res.json({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      developerCode: u.developer_code,
      managerId: u.manager_id,
      managerEmail: u.manager_email,
      managerUsername: u.manager_username,
      teamCount,
      pendingCount,
      createdAt: u.created_at,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user profile.' });
  }
});

// =============================================================================
// 3. Manager Team & Developer Approval Routes (/api/manager)
// =============================================================================

// Get Manager's full team: Approved Developers + Pending Approval Requests
app.get('/api/manager/team', requireAuth, requireManager, async (req, res) => {
  try {
    const managerId = req.user.id;

    // Approved developers
    const [approved] = await pool.query(
      `SELECT u.id, u.username, u.email, u.developer_code, u.created_at,
              COUNT(e.id) as total_endpoints
       FROM users u
       LEFT JOIN monitored_endpoints e ON u.id = e.user_id
       WHERE u.manager_id = ? AND u.status = 'APPROVED'
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [managerId]
    );

    // Pending registration requests waiting for this manager's approval
    const [pending] = await pool.query(
      `SELECT id, username, email, created_at
       FROM users
       WHERE manager_id = ? AND status = 'PENDING'
       ORDER BY created_at ASC`,
      [managerId]
    );

    res.json({
      managerId,
      approved: approved.map(d => ({
        id: d.id,
        username: d.username,
        email: d.email,
        developerCode: d.developer_code,
        totalEndpoints: Number(d.total_endpoints),
        createdAt: d.created_at,
      })),
      pending: pending.map(p => ({
        id: p.id,
        username: p.username,
        email: p.email,
        createdAt: p.created_at,
      })),
    });
  } catch (err) {
    console.error('Fetch team error:', err);
    res.status(500).json({ message: 'Failed to retrieve team members.' });
  }
});

// Manager Approves a Developer Registration and assigns Unique Developer ID
app.post('/api/manager/approve/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const devId = Number(req.params.id);
    const { developerCode } = req.body;

    const [rows] = await pool.query(
      `SELECT id, email, username FROM users WHERE id = ? AND manager_id = ? AND status = 'PENDING'`,
      [devId, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Pending developer request not found in your team.' });
    }

    const assignedCode = developerCode && developerCode.trim()
      ? developerCode.trim().toUpperCase()
      : `DEV-${Math.floor(100 + Math.random() * 900)}`;

    // Verify code uniqueness
    const [conflict] = await pool.query(
      `SELECT id FROM users WHERE developer_code = ? AND id != ?`,
      [assignedCode, devId]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ message: `Developer ID ${assignedCode} is already in use. Please specify another.` });
    }

    await pool.query(
      `UPDATE users SET status = 'APPROVED', developer_code = ? WHERE id = ?`,
      [assignedCode, devId]
    );

    res.json({
      message: `Developer approved! Assigned Developer ID: ${assignedCode}. Share this ID with the developer to sign in.`,
      developerId: devId,
      developerCode: assignedCode,
    });
  } catch (err) {
    console.error('Approve developer error:', err);
    res.status(500).json({ message: 'Failed to approve developer.' });
  }
});

// Manager Rejects a Developer Registration Request
app.post('/api/manager/reject/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const devId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND manager_id = ? AND status = 'PENDING'`,
      [devId, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Pending request not found.' });
    }

    await pool.query(`UPDATE users SET status = 'REJECTED' WHERE id = ?`, [devId]);
    res.json({ message: 'Registration request rejected.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject request.' });
  }
});

// Manager directly creates an already-approved Developer
app.post('/api/manager/developers', requireAuth, requireManager, async (req, res) => {
  try {
    const { username, email, password, developerCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Developer email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim() : cleanEmail.split('@')[0];
    const cleanCode = developerCode ? developerCode.trim().toUpperCase() : `DEV-${Math.floor(100 + Math.random() * 900)}`;

    const [existing] = await pool.query(
      'SELECT id, email, developer_code FROM users WHERE email = ? OR developer_code = ?',
      [cleanEmail, cleanCode]
    );

    if (existing.length > 0) {
      if (existing.some(e => e.email === cleanEmail)) {
        return res.status(409).json({ message: 'This email is already registered.' });
      }
      return res.status(409).json({ message: `Developer ID ${cleanCode} is already assigned. Please choose another.` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, status, developer_code, manager_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cleanUsername, cleanEmail, passwordHash, 'DEVELOPER', 'APPROVED', cleanCode, req.user.id]
    );

    res.status(201).json({
      message: `Developer added! Share Developer ID "${cleanCode}" with the developer to sign in.`,
      developer: {
        id: result.insertId,
        username: cleanUsername,
        email: cleanEmail,
        developerCode: cleanCode,
        managerId: req.user.id,
      },
    });
  } catch (err) {
    console.error('Create developer error:', err);
    res.status(500).json({ message: 'Failed to create developer account.' });
  }
});

// Manager removes developer from team
app.delete('/api/manager/developers/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const devId = Number(req.params.id);
    const [rows] = await pool.query('SELECT id FROM users WHERE id = ? AND manager_id = ?', [devId, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Developer not found in your team.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [devId]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove developer.' });
  }
});

// =============================================================================
// 4. Monitored Endpoints Routes (/api/endpoints)
// =============================================================================

async function getAccessibleEndpoint(endpointId, user) {
  if (user.role === 'MANAGER') {
    const [rows] = await pool.query(
      `SELECT e.*, u.email as owner_email, u.username as owner_username, u.developer_code as owner_dev_code, u.role as owner_role
       FROM monitored_endpoints e
       JOIN users u ON e.user_id = u.id
       WHERE e.id = ? AND (e.user_id = ? OR u.manager_id = ?)`,
      [endpointId, user.id, user.id]
    );
    return rows[0] || null;
  }

  const [rows] = await pool.query(
    `SELECT e.*, u.email as owner_email, u.username as owner_username, u.developer_code as owner_dev_code, u.role as owner_role
     FROM monitored_endpoints e
     JOIN users u ON e.user_id = u.id
     WHERE e.id = ? AND e.user_id = ?`,
    [endpointId, user.id]
  );
  return rows[0] || null;
}

// Fetch endpoints (Managers see their own + team's endpoints)
app.get('/api/endpoints', requireAuth, async (req, res) => {
  try {
    let query = '';
    let params = [];

    if (req.user.role === 'MANAGER') {
      query = `
        SELECT e.*, u.email as owner_email, u.username as owner_username, u.developer_code as owner_dev_code, u.role as owner_role
        FROM monitored_endpoints e
        JOIN users u ON e.user_id = u.id
        WHERE e.user_id = ? OR u.manager_id = ?
        ORDER BY e.created_at DESC
      `;
      params = [req.user.id, req.user.id];
    } else {
      query = `
        SELECT e.*, u.email as owner_email, u.username as owner_username, u.developer_code as owner_dev_code, u.role as owner_role
        FROM monitored_endpoints e
        JOIN users u ON e.user_id = u.id
        WHERE e.user_id = ?
        ORDER BY e.created_at DESC
      `;
      params = [req.user.id];
    }

    const [endpoints] = await pool.query(query, params);

    const resultList = await Promise.all(
      endpoints.map(async (ep) => {
        const [results] = await pool.query(
          'SELECT * FROM monitoring_results WHERE endpoint_id = ? ORDER BY checked_at DESC LIMIT 1',
          [ep.id]
        );
        return {
          id: ep.id,
          name: ep.name,
          url: ep.url,
          enabled: Boolean(ep.enabled),
          checkIntervalSeconds: ep.check_interval_seconds,
          createdAt: ep.created_at,
          owner: {
            email: ep.owner_email,
            username: ep.owner_username,
            developerCode: ep.owner_dev_code,
            role: ep.owner_role,
            isSelf: ep.user_id === req.user.id,
          },
          lastResult: results[0] ? {
            id: results[0].id,
            status: results[0].status,
            httpStatusCode: results[0].http_status_code,
            responseTimeMs: results[0].response_time_ms,
            checkedAt: results[0].checked_at,
          } : null,
        };
      })
    );

    res.json(resultList);
  } catch (err) {
    console.error('Fetch endpoints error:', err);
    res.status(500).json({ message: 'Failed to retrieve monitored endpoints.' });
  }
});

// Create Endpoint
app.post('/api/endpoints', requireAuth, validators.createEndpoint, handleValidation, async (req, res) => {
  try {
    const { name, url, checkIntervalSeconds } = req.body;
    if (!name || !url) {
      return res.status(400).json({ message: 'Name and URL are required.' });
    }

    const cleanUrl = url.trim();
    await validateUrlSafety(cleanUrl);

    const interval = Math.min(Math.max(Number(checkIntervalSeconds) || 300, 10), 86400);

    const [result] = await pool.query(
      'INSERT INTO monitored_endpoints (user_id, name, url, check_interval_seconds) VALUES (?, ?, ?, ?)',
      [req.user.id, name.trim(), cleanUrl, interval]
    );

    res.status(200).json({
      id: result.insertId,
      name: name.trim(),
      url: cleanUrl,
      enabled: true,
      checkIntervalSeconds: interval,
      createdAt: new Date().toISOString(),
      owner: {
        email: req.user.email,
        developerCode: req.user.developerCode,
        role: req.user.role,
        isSelf: true,
      },
    });
  } catch (err) {
    console.error('Create endpoint error:', err);
    res.status(400).json({ message: err.message || 'Failed to create monitored endpoint.' });
  }
});

// Single Endpoint Details
app.get('/api/endpoints/:id', requireAuth, async (req, res) => {
  try {
    const ep = await getAccessibleEndpoint(req.params.id, req.user);
    if (!ep) {
      return res.status(404).json({ message: 'Endpoint not found or unauthorized.' });
    }
    res.json({
      id: ep.id,
      name: ep.name,
      url: ep.url,
      enabled: Boolean(ep.enabled),
      checkIntervalSeconds: ep.check_interval_seconds,
      createdAt: ep.created_at,
      owner: {
        email: ep.owner_email,
        developerCode: ep.owner_dev_code,
        role: ep.owner_role,
        isSelf: ep.user_id === req.user.id,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch endpoint details.' });
  }
});

// Update Endpoint
app.put('/api/endpoints/:id', requireAuth, validators.updateEndpoint, handleValidation, async (req, res) => {
  try {
    const ep = await getAccessibleEndpoint(req.params.id, req.user);
    if (!ep) {
      return res.status(404).json({ message: 'Endpoint not found or unauthorized.' });
    }

    const { name, url, checkIntervalSeconds, enabled } = req.body;
    const newName = name !== undefined ? name.trim() : ep.name;
    const newUrl = url !== undefined ? url.trim() : ep.url;
    if (url !== undefined) {
      await validateUrlSafety(newUrl);
    }
    const newInterval = checkIntervalSeconds !== undefined ? Number(checkIntervalSeconds) : ep.check_interval_seconds;
    const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : ep.enabled;

    await pool.query(
      'UPDATE monitored_endpoints SET name = ?, url = ?, check_interval_seconds = ?, enabled = ? WHERE id = ?',
      [newName, newUrl, newInterval, newEnabled, ep.id]
    );

    res.json({
      id: ep.id,
      name: newName,
      url: newUrl,
      enabled: Boolean(newEnabled),
      checkIntervalSeconds: newInterval,
      createdAt: ep.created_at,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to update endpoint.' });
  }
});

// Delete Endpoint
app.delete('/api/endpoints/:id', requireAuth, async (req, res) => {
  try {
    const ep = await getAccessibleEndpoint(req.params.id, req.user);
    if (!ep) {
      return res.status(404).json({ message: 'Endpoint not found or unauthorized.' });
    }

    await pool.query('DELETE FROM monitored_endpoints WHERE id = ?', [ep.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete endpoint.' });
  }
});

// Trigger Health Check
app.post('/api/endpoints/:id/check', requireAuth, async (req, res) => {
  const endpointId = Number(req.params.id);
  if (activeCheckIds.has(endpointId)) {
    return res.status(429).json({ message: 'A health check probe is already in progress for this endpoint.' });
  }

  try {
    const ep = await getAccessibleEndpoint(endpointId, req.user);
    if (!ep) {
      return res.status(404).json({ message: 'Endpoint not found or unauthorized.' });
    }

    activeCheckIds.add(endpointId);
    const result = await executeHealthCheck(ep);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Probe execution failed: ' + err.message });
  } finally {
    activeCheckIds.delete(endpointId);
  }
});

// Telemetry History
app.get('/api/endpoints/:id/history', requireAuth, async (req, res) => {
  try {
    const ep = await getAccessibleEndpoint(req.params.id, req.user);
    if (!ep) {
      return res.status(404).json({ message: 'Endpoint not found or unauthorized.' });
    }

    const [history] = await pool.query(
      `SELECT id, status, http_status_code AS httpStatusCode, response_time_ms AS responseTimeMs,
              error_message AS errorMessage, checked_at AS checkedAt
       FROM monitoring_results
       WHERE endpoint_id = ?
       ORDER BY checked_at DESC LIMIT 50`,
      [ep.id]
    );

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch telemetry history.' });
  }
});

// =============================================================================
// 5. Analytics Dashboard Summary (/api/dashboard/summary)
// =============================================================================
app.get('/api/dashboard/summary', requireAuth, async (req, res) => {
  try {
    const isManager = req.user.role === 'MANAGER';
    const userId = req.user.id;

    let epQuery = 'SELECT id, name FROM monitored_endpoints WHERE user_id = ?';
    let epParams = [userId];

    if (isManager) {
      epQuery = `
        SELECT e.id, e.name 
        FROM monitored_endpoints e 
        JOIN users u ON e.user_id = u.id 
        WHERE e.user_id = ? OR u.manager_id = ?
      `;
      epParams = [userId, userId];
    }

    const [endpoints] = await pool.query(epQuery, epParams);
    const totalEndpoints = endpoints.length;
    let healthyEndpoints = 0;
    let failingEndpoints = 0;
    let uncheckedEndpoints = 0;

    for (const ep of endpoints) {
      const [lastResult] = await pool.query(
        'SELECT status FROM monitoring_results WHERE endpoint_id = ? ORDER BY checked_at DESC LIMIT 1',
        [ep.id]
      );
      if (lastResult.length === 0) {
        uncheckedEndpoints += 1;
      } else if (lastResult[0].status === 'UP') {
        healthyEndpoints += 1;
      } else {
        failingEndpoints += 1;
      }
    }

    // 24-hour aggregate telemetry
    let recentQuery = `
      SELECT r.status, r.response_time_ms
      FROM monitoring_results r
      JOIN monitored_endpoints e ON r.endpoint_id = e.id
      WHERE e.user_id = ? AND r.checked_at >= NOW() - INTERVAL 24 HOUR
    `;
    let recentParams = [userId];

    if (isManager) {
      recentQuery = `
        SELECT r.status, r.response_time_ms
        FROM monitoring_results r
        JOIN monitored_endpoints e ON r.endpoint_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE (e.user_id = ? OR u.manager_id = ?) AND r.checked_at >= NOW() - INTERVAL 24 HOUR
      `;
      recentParams = [userId, userId];
    }

    const [recentChecks] = await pool.query(recentQuery, recentParams);

    let uptimePercentLast24h = null;
    let averageResponseTimeMsLast24h = null;

    if (recentChecks.length > 0) {
      const upCount = recentChecks.filter(r => r.status === 'UP').length;
      uptimePercentLast24h = Math.round((upCount * 1000) / recentChecks.length) / 10;

      const validLatencies = recentChecks
        .filter(r => r.response_time_ms !== null)
        .map(r => Number(r.response_time_ms));

      if (validLatencies.length > 0) {
        const sum = validLatencies.reduce((acc, curr) => acc + curr, 0);
        averageResponseTimeMsLast24h = Math.round(sum / validLatencies.length);
      }
    }

    // Top 5 recent failures
    let failQuery = `
      SELECT r.endpoint_id AS endpointId, e.name AS endpointName, r.status,
              r.error_message AS errorMessage, r.checked_at AS checkedAt
      FROM monitoring_results r
      JOIN monitored_endpoints e ON r.endpoint_id = e.id
      WHERE e.user_id = ? AND r.status != 'UP'
      ORDER BY r.checked_at DESC LIMIT 5
    `;
    let failParams = [userId];

    if (isManager) {
      failQuery = `
        SELECT r.endpoint_id AS endpointId, e.name AS endpointName, r.status,
                r.error_message AS errorMessage, r.checked_at AS checkedAt
        FROM monitoring_results r
        JOIN monitored_endpoints e ON r.endpoint_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE (e.user_id = ? OR u.manager_id = ?) AND r.status != 'UP'
        ORDER BY r.checked_at DESC LIMIT 5
      `;
      failParams = [userId, userId];
    }

    const [failures] = await pool.query(failQuery, failParams);

    res.json({
      totalEndpoints,
      healthyEndpoints,
      failingEndpoints,
      uncheckedEndpoints,
      uptimePercentLast24h,
      averageResponseTimeMsLast24h,
      recentFailures: failures,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ message: 'Failed to compute dashboard metrics.' });
  }
});

// =============================================================================
// 6. Automated Background Monitoring Engine
// =============================================================================
async function runScheduledChecks() {
  try {
    const [dueEndpoints] = await pool.query(`
      SELECT e.*, MAX(r.checked_at) AS last_checked
      FROM monitored_endpoints e
      LEFT JOIN monitoring_results r ON e.id = r.endpoint_id
      WHERE e.enabled = TRUE
      GROUP BY e.id
      HAVING last_checked IS NULL OR TIMESTAMPADD(SECOND, e.check_interval_seconds, last_checked) <= NOW()
    `);

    if (dueEndpoints.length > 0) {
      for (const ep of dueEndpoints) {
        if (!activeCheckIds.has(ep.id)) {
          activeCheckIds.add(ep.id);
          executeHealthCheck(ep)
            .catch((err) => console.error(`[Background Poller] Error on Endpoint ${ep.id}:`, err.message))
            .finally(() => activeCheckIds.delete(ep.id));
        }
      }
    }
  } catch (err) {
    console.error('[Background Poller] Scheduler loop error:', err.message);
  }
}

setInterval(runScheduledChecks, 30000);

// Start Server
initDb().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` APIVitals Server running on http://localhost:${PORT}`);
    console.log(` Database: MySQL apivitals_db`);
    console.log(` Architecture: Manager-Developer Hierarchy & Approval Flow`);
    console.log(` Background health check poller active (every 30s)`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server Error] Port ${PORT} is already in use. Set a different port in .env.`);
      process.exit(1);
    } else {
      console.error('[Server Error]', err);
    }
  });
});

app.use(errorHandler);
