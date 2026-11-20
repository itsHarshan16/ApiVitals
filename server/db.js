import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root',
  database: process.env.DB_NAME || 'apivitals_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

async function addColumnIfMissing(connection, tableName, columnName, columnDef) {
  try {
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    if (cols.length === 0) {
      await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`[MySQL] Successfully added column ${columnName} to ${tableName}`);
    }
  } catch (err) {
    console.warn(`[MySQL] Column check note on ${tableName}.${columnName}:`, err.message);
  }
}

// Auto-verify database connection, schema, and Manager-Developer hierarchy
export async function initDb() {
  try {
    const connection = await pool.getConnection();
    console.log('[MySQL] Successfully connected to database:', process.env.DB_NAME || 'apivitals_db');

    // 1. Users table (Strict Manager-Developer Model, NO Super Admin)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        role ENUM('MANAGER', 'DEVELOPER') NOT NULL DEFAULT 'DEVELOPER',
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
        developer_code VARCHAR(50) NULL,
        manager_id BIGINT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_users_email UNIQUE (email),
        INDEX idx_users_dev_code (developer_code),
        INDEX idx_users_manager (manager_id),
        INDEX idx_users_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure columns exist on existing databases
    await addColumnIfMissing(connection, 'users', 'username', 'VARCHAR(50) NULL AFTER id');
    await addColumnIfMissing(connection, 'users', 'role', "ENUM('MANAGER', 'DEVELOPER') NOT NULL DEFAULT 'DEVELOPER' AFTER password_hash");
    await addColumnIfMissing(connection, 'users', 'status', "ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER role");
    await addColumnIfMissing(connection, 'users', 'developer_code', 'VARCHAR(50) NULL AFTER status');
    await addColumnIfMissing(connection, 'users', 'manager_id', 'BIGINT NULL AFTER developer_code');

    // Update ENUMs
    try {
      await connection.query(`
        ALTER TABLE users 
        MODIFY COLUMN role ENUM('MANAGER', 'DEVELOPER') NOT NULL DEFAULT 'DEVELOPER',
        MODIFY COLUMN status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED'
      `);
    } catch (_) {}

    // Ensure index on developer_code
    try {
      await connection.query(`CREATE INDEX idx_users_dev_code ON users(developer_code)`);
    } catch (_) {}

    // 2. Monitored Endpoints table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS monitored_endpoints (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name VARCHAR(100) NOT NULL,
        url VARCHAR(2048) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        check_interval_seconds INT NOT NULL DEFAULT 300,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_endpoints_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        INDEX idx_endpoints_user_created (user_id, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Monitoring Results table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS monitoring_results (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        endpoint_id BIGINT NOT NULL,
        checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        http_status_code INT NULL,
        response_time_ms BIGINT NOT NULL DEFAULT 0,
        error_message VARCHAR(500) NULL,
        CONSTRAINT fk_results_endpoint FOREIGN KEY (endpoint_id) REFERENCES monitored_endpoints (id) ON DELETE CASCADE,
        INDEX idx_result_endpoint_time (endpoint_id, checked_at DESC),
        INDEX idx_results_checked_at (checked_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    connection.release();
    console.log('[MySQL] Schema verification complete. Manager-Developer hierarchy with Approval Workflow ready.');
    return true;
  } catch (error) {
    console.error('[MySQL] Initialization error:', error.message);
    return false;
  }
}
