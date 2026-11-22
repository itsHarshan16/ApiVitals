/**
 * Input Validation Middleware — ESM version
 * D:\ApiVitals\server\middleware\validate.js
 *
 * Developer C — Day 2
 * Commit: feat(db): author initial database schema ddl with indexes and constraints
 */

import { body, param, query, validationResult } from 'express-validator';

// ── Collect validation errors → 400 response ─────────────────────────────────
export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error:   'Validation Error',
      message: 'One or more input fields are invalid.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ── Validator Chains ──────────────────────────────────────────────────────────
export const validators = {

  /** POST /api/auth/register */
  register: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Must be a valid email address')
      .isLength({ max: 100 }).withMessage('Email must not exceed 100 characters')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],

  /** POST /api/auth/login */
  login: [
    body().custom((value, { req }) => {
      const identifier = req.body.email || req.body.username;
      if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
        throw new Error('Email or username is required');
      }
      return true;
    }),
    body('password').notEmpty().withMessage('Password is required'),
  ],

  /** POST /api/endpoints */
  createEndpoint: [
    body('name').trim().notEmpty().withMessage('Endpoint name is required')
      .isLength({ min: 1, max: 100 }).withMessage('Name must be 1–100 characters'),

    body('url').trim().notEmpty().withMessage('URL is required')
      .isURL({ require_protocol: true, protocols: ['http', 'https'] })
      .withMessage('URL must start with http:// or https://')
      .isLength({ max: 2048 }).withMessage('URL must not exceed 2048 characters'),

    body('httpMethod').optional()
      .isIn(['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'])
      .withMessage('Invalid HTTP method'),

    body('checkIntervalSeconds').optional()
      .isInt({ min: 10, max: 86400 })
      .withMessage('Check interval must be between 10 and 86400 seconds'),

    body('expectedStatusCode').optional({ nullable: true })
      .isInt({ min: 100, max: 599 })
      .withMessage('Expected status code must be 100–599'),
  ],

  /** PUT /api/endpoints/:id */
  updateEndpoint: [
    param('id').isInt({ min: 1 }).withMessage('Endpoint ID must be a positive integer'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1–100 characters'),
    body('url').optional().trim()
      .isURL({ require_protocol: true, protocols: ['http', 'https'] })
      .withMessage('URL must start with http:// or https://'),
    body('httpMethod').optional()
      .isIn(['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'])
      .withMessage('Invalid HTTP method'),
    body('checkIntervalSeconds').optional()
      .isInt({ min: 10, max: 86400 })
      .withMessage('Check interval must be 10–86400 seconds'),
    body('expectedStatusCode').optional({ nullable: true })
      .isInt({ min: 100, max: 599 })
      .withMessage('Expected status code must be 100–599'),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
  ],

  /** GET /api/endpoints/:id/history */
  historyQuery: [
    param('id').isInt({ min: 1 }).withMessage('Endpoint ID must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be 1–500'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  ],

  /** DELETE /api/endpoints/:id */
  deleteEndpoint: [
    param('id').isInt({ min: 1 }).withMessage('Endpoint ID must be a positive integer'),
  ],
};
