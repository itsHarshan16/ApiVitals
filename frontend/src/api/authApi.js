/**
 * Auth API Module — frontend/src/api/authApi.js
 *
 * Developer B — Day 2
 * Commit: feat(api): create axios client instance with base configuration
 */

import api from './client';

/** POST /api/auth/register */
export const register = (username, email, password) =>
  api.post('/api/auth/register', { username, email, password });

/** POST /api/auth/login */
export const login = (username, password) =>
  api.post('/api/auth/login', { username, password });

/** POST /api/auth/logout  (optional server-side token blacklist) */
export const logout = () => api.post('/api/auth/logout').catch(() => {});

/** GET /api/auth/me — returns current user profile */
export const getMe = () => api.get('/api/auth/me');

/** PATCH /api/auth/change-password */
export const changePassword = (currentPassword, newPassword) =>
  api.patch('/api/auth/change-password', { currentPassword, newPassword });

