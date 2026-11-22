-- Flyway Migration V2: Manager-Developer Organizational Hierarchy & Approval Workflow
-- Establishes two-tier hierarchy (Manager -> Developer) with status approval gating and unique Developer IDs

ALTER TABLE users 
    MODIFY COLUMN role ENUM('MANAGER', 'DEVELOPER') NOT NULL DEFAULT 'DEVELOPER',
    ADD COLUMN status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER role,
    ADD COLUMN developer_code VARCHAR(50) NULL UNIQUE AFTER status,
    ADD COLUMN manager_id BIGINT UNSIGNED NULL AFTER developer_code,
    ADD CONSTRAINT fk_users_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_users_dev_code ON users(developer_code);
CREATE INDEX idx_users_status ON users(status);


