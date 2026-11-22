SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- TABLE: users
-- Supports Manager-Developer hierarchical team management
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
    username      VARCHAR(50)       NOT NULL,
    email         VARCHAR(100)      NOT NULL,
    password_hash VARCHAR(255)      NOT NULL COMMENT 'BCrypt hash, cost=12',
    role          ENUM('ADMIN','MANAGER','DEVELOPER') NOT NULL DEFAULT 'DEVELOPER',
    developer_code VARCHAR(50)      NULL COMMENT 'Unique ID assigned by Manager for login',
    manager_id    BIGINT UNSIGNED   NULL COMMENT 'Foreign key to supervising manager',
    created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_users           PRIMARY KEY (id),
    CONSTRAINT uk_users_email     UNIQUE KEY  (email),
    CONSTRAINT uk_users_dev_code  UNIQUE KEY  (developer_code),
    CONSTRAINT fk_users_manager   FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,

    INDEX idx_users_role (role),
    INDEX idx_users_manager (manager_id),
    INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hierarchical User Accounts';

-- TABLE: monitored_endpoints
CREATE TABLE IF NOT EXISTS monitored_endpoints (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                BIGINT UNSIGNED NOT NULL,
    name                   VARCHAR(100)    NOT NULL,
    url                    VARCHAR(2048)   NOT NULL,
    http_method            ENUM('GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS') NOT NULL DEFAULT 'GET',
    check_interval_seconds INT UNSIGNED    NOT NULL DEFAULT 60,
    expected_status_code   SMALLINT UNSIGNED DEFAULT NULL,
    enabled                TINYINT(1)      NOT NULL DEFAULT 1,
    is_active              TINYINT(1)      NOT NULL DEFAULT 1,
    created_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_endpoints      PRIMARY KEY (id),
    CONSTRAINT fk_endpoints_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_interval      CHECK (check_interval_seconds >= 10),
    INDEX idx_endpoints_user_id  (user_id),
    INDEX idx_endpoints_active   (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE: monitoring_results
CREATE TABLE IF NOT EXISTS monitoring_results (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    endpoint_id      BIGINT UNSIGNED NOT NULL,
    status           VARCHAR(20)      NOT NULL DEFAULT 'UP',
    is_up            TINYINT(1)      NOT NULL DEFAULT 1,
    status_code      SMALLINT UNSIGNED DEFAULT NULL,
    http_status_code SMALLINT UNSIGNED DEFAULT NULL,
    response_time_ms INT UNSIGNED     DEFAULT NULL,
    error_message    VARCHAR(1000)    DEFAULT NULL,
    checked_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_results          PRIMARY KEY (id),
    CONSTRAINT fk_results_endpoint FOREIGN KEY (endpoint_id) REFERENCES monitored_endpoints(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_results_endpoint_checked (endpoint_id, checked_at DESC),
    INDEX idx_results_checked_at       (checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
