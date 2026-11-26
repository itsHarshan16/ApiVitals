/**
 * Endpoints API Module — frontend/src/api/endpointsApi.js
 *
 * Developer B — Day 2
 * Commit: feat(api): create axios client instance with base configuration
 *
 * Provides typed, documented functions for every endpoints-related API call.
 * All functions use the shared axios instance from client.js which:
 *   - Automatically adds Authorization: Bearer <token> header
 *   - Redirects to /login on 401
 *   - Proxies /api → http://localhost:5000 (via vite.config.js)
 *
 * Usage:
 *   import { getEndpoints, addEndpoint } from '../api/endpointsApi';
 *   const { data } = await getEndpoints();
 */

import api from './client';

// ── Endpoints CRUD ────────────────────────────────────────────────────────────

/**
 * GET /api/endpoints
 * Returns all endpoints belonging to the logged-in user.
 * @returns {Promise<{data: {endpoints: Array}}>}
 */
export const getEndpoints = () => api.get('/api/endpoints');

/**
 * GET /api/endpoints/:id
 * Returns a single endpoint by ID (must belong to current user).
 * @param {number|string} id
 */
export const getEndpointById = (id) => api.get(`/api/endpoints/${id}`);

/**
 * POST /api/endpoints
 * Creates a new monitored endpoint.
 * @param {{ name: string, url: string, httpMethod?: string, checkIntervalSeconds?: number, expectedStatusCode?: number|null }} payload
 */
export const addEndpoint = (payload) => api.post('/api/endpoints', payload);

/**
 * PUT /api/endpoints/:id
 * Updates an existing endpoint. All fields are optional (partial update).
 * @param {number|string} id
 * @param {{ name?: string, url?: string, httpMethod?: string, checkIntervalSeconds?: number, expectedStatusCode?: number|null, isActive?: boolean }} updates
 */
export const updateEndpoint = (id, updates) => api.put(`/api/endpoints/${id}`, updates);

/**
 * DELETE /api/endpoints/:id
 * Soft-deletes (sets isActive=false) or hard-deletes depending on server config.
 * @param {number|string} id
 */
export const deleteEndpoint = (id) => api.delete(`/api/endpoints/${id}`);

/**
 * PATCH /api/endpoints/:id/toggle
 * Toggles the isActive state of an endpoint (activate / deactivate).
 * @param {number|string} id
 */
export const toggleEndpoint = (id) => api.patch(`/api/endpoints/${id}/toggle`);

// ── Monitoring History ────────────────────────────────────────────────────────

/**
 * GET /api/endpoints/:id/history
 * Returns paginated monitoring results for a specific endpoint.
 * @param {number|string} id
 * @param {{ page?: number, limit?: number }} params
 */
export const getEndpointHistory = (id, params = {}) =>
  api.get(`/api/endpoints/${id}/history`, { params });

/**
 * GET /api/endpoints/:id/stats
 * Returns uptime percentage and average response time for the last 24h / 7d / 30d.
 * @param {number|string} id
 */
export const getEndpointStats = (id) => api.get(`/api/endpoints/${id}/stats`);

// ── Dashboard ─────────────────────────────────────────────────────────────────

/**
 * GET /api/endpoints/summary
 * Returns aggregated stats for all user endpoints (total, up, down).
 */
export const getDashboardSummary = () => api.get('/api/endpoints/summary');

// ── Manager Team Management ───────────────────────────────────────────────────

/**
 * GET /api/manager/developers
 * Returns all developers under the logged-in manager.
 */
export const getDevelopers = () => api.get('/manager/developers');

/**
 * POST /api/manager/developers
 * Registers a new developer with unique Developer ID.
 */
export const createDeveloper = (payload) => api.post('/manager/developers', payload);

/**
 * DELETE /api/manager/developers/:id
 * Removes a developer from the manager's team.
 */
export const deleteDeveloper = (id) => api.delete(`/manager/developers/${id}`);

