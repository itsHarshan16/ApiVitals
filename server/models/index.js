/**
 * Sequelize initialiser — models/index.js
 *
 * Developer C — Day 2
 * Commit: feat(db): author initial database schema ddl with indexes and constraints
 *
 * Loads all model definitions, runs associations, and exports a single
 * { sequelize, Sequelize, User, MonitoredEndpoint, MonitoringResult } object.
 *
 * Usage in server.js / route files:
 *   const { User, MonitoredEndpoint } = require('./models');
 *
 * NOTE: Sequelize is used for structured queries only.
 *       The raw mysql2 pool in db.js is still used for schema verification
 *       and health-check probes.  Both can coexist.
 */

'use strict';

const path       = require('path');
const Sequelize  = require('sequelize');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const {
  DB_HOST     = 'localhost',
  DB_PORT     = '3306',
  DB_NAME     = 'apivitals_db',
  DB_USER     = 'root',
  DB_PASSWORD = '',
} = process.env;

// ── Connection ──────────────────────────────────────────────────────────────
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host:    DB_HOST,
  port:    parseInt(DB_PORT, 10),
  dialect: 'mysql',

  pool: {
    max:     10,
    min:     2,
    acquire: 30_000,  // ms to wait before throwing error
    idle:    10_000,  // ms a connection can be idle before release
  },

  define: {
    underscored:  true,   // snake_case column names by default
    freezeTableName: true,
    charset:  'utf8mb4',
    collate:  'utf8mb4_unicode_ci',
  },

  logging: process.env.NODE_ENV === 'development'
    ? (sql) => console.log(`[Sequelize] ${sql}`)
    : false,

  dialectOptions: {
    charset: 'utf8mb4',
    // Required for MySQL 8+ public key retrieval
    ssl: false,
  },
  timezone: '+00:00',  // Store all timestamps as UTC
});

// ── Model loading ────────────────────────────────────────────────────────────
const modelFiles = [
  './User',
  './MonitoredEndpoint',
  './MonitoringResult',
];

const db = { sequelize, Sequelize };

for (const file of modelFiles) {
  const modelDefiner = require(file);
  const model = modelDefiner(sequelize);
  db[model.name] = model;
}

// ── Associations ─────────────────────────────────────────────────────────────
for (const modelName of Object.keys(db)) {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
}

// ── Connectivity test (non-fatal at startup) ─────────────────────────────────
sequelize.authenticate()
  .then(() => console.log('[Sequelize] ORM connected to apivitals_db'))
  .catch(err => console.warn('[Sequelize] ORM connection warning:', err.message));

module.exports = db;

