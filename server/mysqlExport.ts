import { DatabaseState } from './db.js';

export function generateMySQLSchema(): string {
  return `-- ==============================================================
-- GateMaster 3D - Enterprise Gate Register & Material Logistics
-- Target Engine: MySQL 8.0+ / MariaDB 10.5+
-- Generated: ${new Date().toISOString()}
-- ==============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: system_settings
CREATE TABLE IF NOT EXISTS \`system_settings\` (
  \`setting_key\` VARCHAR(64) NOT NULL PRIMARY KEY,
  \`setting_value\` TEXT NOT NULL,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: users
CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(120) NOT NULL,
  \`login\` VARCHAR(60) NOT NULL UNIQUE,
  \`role\` ENUM('guard', 'supervisor', 'admin') NOT NULL DEFAULT 'guard',
  \`gate\` VARCHAR(100) DEFAULT 'Main Gate',
  \`salt\` VARCHAR(64) NOT NULL,
  \`password_hash\` VARCHAR(128) NOT NULL,
  \`active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`must_change\` TINYINT(1) NOT NULL DEFAULT 0,
  \`failed_attempts\` INT NOT NULL DEFAULT 0,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: gate_entries
CREATE TABLE IF NOT EXISTS \`gate_entries\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`code\` VARCHAR(32) NOT NULL UNIQUE,
  \`dir\` ENUM('IN', 'OUT') NOT NULL,
  \`inward_type\` VARCHAR(40) NOT NULL DEFAULT 'vehicle',
  \`purchaser_name\` VARCHAR(150) DEFAULT NULL,
  \`personal_purpose\` VARCHAR(255) DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL,
  \`gate\` VARCHAR(100) NOT NULL,
  \`guard_id\` VARCHAR(36) NOT NULL,
  \`guard_name\` VARCHAR(120) NOT NULL,
  \`purpose\` VARCHAR(100) NOT NULL,
  \`party\` VARCHAR(200) NOT NULL,
  \`vehicle_type\` VARCHAR(60) NOT NULL,
  \`vehicle_no\` VARCHAR(40) NOT NULL,
  \`driver\` VARCHAR(120) DEFAULT NULL,
  \`driver_id\` VARCHAR(60) DEFAULT NULL,
  \`doc_type\` VARCHAR(60) NOT NULL,
  \`doc_no\` VARCHAR(80) DEFAULT NULL,
  \`amount\` DECIMAL(15,2) DEFAULT NULL,
  \`po_no\` VARCHAR(80) DEFAULT NULL,
  \`authorised_by\` VARCHAR(120) DEFAULT NULL,
  \`dept\` VARCHAR(120) DEFAULT NULL,
  \`weight_kg\` DECIMAL(12,2) DEFAULT NULL,
  \`packages_count\` INT DEFAULT NULL,
  \`person\` VARCHAR(120) DEFAULT NULL,
  \`remarks\` TEXT DEFAULT NULL,
  \`returnable\` TINYINT(1) NOT NULL DEFAULT 0,
  \`expected_return\` DATE DEFAULT NULL,
  \`returned_at\` DATETIME DEFAULT NULL,
  \`return_code\` VARCHAR(32) DEFAULT NULL,
  \`against_code\` VARCHAR(32) DEFAULT NULL,
  \`vehicle_out_at\` DATETIME DEFAULT NULL,
  \`stage\` ENUM('at_gate', 'dock_weighbridge', 'inspection_unloading', 'cleared') NOT NULL DEFAULT 'at_gate',
  \`prints_count\` INT NOT NULL DEFAULT 0,
  \`is_cancelled\` TINYINT(1) NOT NULL DEFAULT 0,
  \`cancel_reason\` TEXT DEFAULT NULL,
  \`cancel_by\` VARCHAR(36) DEFAULT NULL,
  \`cancel_at\` DATETIME DEFAULT NULL,
  \`return_details\` JSON DEFAULT NULL,
  INDEX \`idx_code\` (\`code\`),
  INDEX \`idx_party\` (\`party\`),
  INDEX \`idx_vehicle\` (\`vehicle_no\`),
  INDEX \`idx_purchaser\` (\`purchaser_name\`),
  INDEX \`idx_created_at\` (\`created_at\`),
  INDEX \`idx_dir_stage\` (\`dir\`, \`stage\`),
  CONSTRAINT \`fk_gate_entries_guard\` FOREIGN KEY (\`guard_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: entry_items
CREATE TABLE IF NOT EXISTS \`entry_items\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`entry_id\` VARCHAR(36) NOT NULL,
  \`item_desc\` VARCHAR(255) NOT NULL,
  \`quantity\` DECIMAL(12,3) NOT NULL,
  \`unit\` VARCHAR(40) NOT NULL,
  INDEX \`idx_item_entry\` (\`entry_id\`),
  CONSTRAINT \`fk_entry_items_entry\` FOREIGN KEY (\`entry_id\`) REFERENCES \`gate_entries\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table: entry_corrections
CREATE TABLE IF NOT EXISTS \`entry_corrections\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`entry_id\` VARCHAR(36) NOT NULL,
  \`corrected_at\` DATETIME NOT NULL,
  \`by_user_id\` VARCHAR(36) NOT NULL,
  \`by_user_name\` VARCHAR(120) NOT NULL,
  \`field_name\` VARCHAR(60) NOT NULL,
  \`old_value\` TEXT DEFAULT NULL,
  \`new_value\` TEXT NOT NULL,
  \`reason\` TEXT NOT NULL,
  INDEX \`idx_corr_entry\` (\`entry_id\`),
  CONSTRAINT \`fk_entry_corrections_entry\` FOREIGN KEY (\`entry_id\`) REFERENCES \`gate_entries\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Table: entry_photos
CREATE TABLE IF NOT EXISTS \`entry_photos\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`entry_id\` VARCHAR(36) NOT NULL,
  \`note\` VARCHAR(200) NOT NULL,
  \`mime_type\` VARCHAR(60) NOT NULL,
  \`file_size\` INT NOT NULL,
  \`sha256_hash\` VARCHAR(64) NOT NULL,
  \`data_base64\` MEDIUMTEXT NOT NULL,
  \`captured_by\` VARCHAR(36) NOT NULL,
  \`captured_at\` DATETIME NOT NULL,
  INDEX \`idx_photo_entry\` (\`entry_id\`),
  CONSTRAINT \`fk_entry_photos_entry\` FOREIGN KEY (\`entry_id\`) REFERENCES \`gate_entries\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Table: audit_trail (Tamper-evident cryptographically chained)
CREATE TABLE IF NOT EXISTS \`audit_trail\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`ts\` DATETIME NOT NULL,
  \`user_id\` VARCHAR(36) NOT NULL,
  \`user_name\` VARCHAR(120) NOT NULL,
  \`action\` VARCHAR(80) NOT NULL,
  \`code\` VARCHAR(32) DEFAULT NULL,
  \`details\` JSON DEFAULT NULL,
  \`prev_hash\` VARCHAR(64) NOT NULL,
  \`hash\` VARCHAR(64) NOT NULL,
  INDEX \`idx_audit_ts\` (\`ts\`),
  INDEX \`idx_audit_code\` (\`code\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Table: user_sessions (Multi-device concurrent session management)
CREATE TABLE IF NOT EXISTS \`user_sessions\` (
  \`session_id\` VARCHAR(64) NOT NULL PRIMARY KEY,
  \`user_id\` VARCHAR(36) NOT NULL,
  \`login\` VARCHAR(60) NOT NULL,
  \`refresh_token\` VARCHAR(64) NOT NULL,
  \`device\` VARCHAR(120) DEFAULT 'Web Client',
  \`ip\` VARCHAR(45) DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL,
  \`last_active_at\` DATETIME NOT NULL,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  INDEX \`idx_session_user\` (\`user_id\`),
  CONSTRAINT \`fk_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
`;
}

export function generateMySQLDump(state: DatabaseState): string {
  const schema = generateMySQLSchema();
  const escapeSql = (str: any) => {
    if (str === null || str === undefined) return 'NULL';
    return `'${String(str).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
  };

  const lines: string[] = [
    schema,
    '\n-- ==============================================================',
    '-- DATA DUMP FOR ALL CURRENT RECORDS',
    '-- ==============================================================\n',
    'START TRANSACTION;\n'
  ];

  // Insert settings
  lines.push('-- System Settings');
  for (const [k, v] of Object.entries(state.settings)) {
    lines.push(`INSERT INTO \`system_settings\` (\`setting_key\`, \`setting_value\`) VALUES (${escapeSql(k)}, ${escapeSql(v)}) ON DUPLICATE KEY UPDATE \`setting_value\` = VALUES(\`setting_value\`);`);
  }

  // Insert users
  lines.push('\n-- Users');
  for (const u of state.users) {
    lines.push(`INSERT INTO \`users\` (\`id\`, \`name\`, \`login\`, \`role\`, \`gate\`, \`salt\`, \`password_hash\`, \`active\`, \`must_change\`, \`failed_attempts\`) VALUES (${escapeSql(u.id)}, ${escapeSql(u.name)}, ${escapeSql(u.login)}, ${escapeSql(u.role)}, ${escapeSql(u.gate)}, ${escapeSql(u.salt)}, ${escapeSql(u.password_hash)}, ${u.active ? 1 : 0}, ${u.must_change ? 1 : 0}, ${u.failed}) ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`role\` = VALUES(\`role\`), \`active\` = VALUES(\`active\`);`);
  }

  // Insert entries & items
  lines.push('\n-- Gate Entries');
  for (const e of state.entries) {
    const returnDetailsStr = e.return_details ? JSON.stringify(e.return_details) : null;
    lines.push(`INSERT INTO \`gate_entries\` (
      \`id\`, \`code\`, \`dir\`, \`inward_type\`, \`purchaser_name\`, \`personal_purpose\`,
      \`created_at\`, \`gate\`, \`guard_id\`, \`guard_name\`, \`purpose\`,
      \`party\`, \`vehicle_type\`, \`vehicle_no\`, \`driver\`, \`driver_id\`, \`doc_type\`, \`doc_no\`,
      \`amount\`, \`po_no\`, \`authorised_by\`, \`dept\`, \`weight_kg\`, \`packages_count\`, \`person\`,
      \`remarks\`, \`returnable\`, \`expected_return\`, \`returned_at\`, \`return_code\`, \`against_code\`,
      \`vehicle_out_at\`, \`stage\`, \`prints_count\`, \`is_cancelled\`, \`cancel_reason\`, \`cancel_by\`, \`cancel_at\`,
      \`return_details\`
    ) VALUES (
      ${escapeSql(e.id)}, ${escapeSql(e.code)}, ${escapeSql(e.dir)}, ${escapeSql(e.inward_type || 'vehicle')}, ${escapeSql(e.purchaser_name)}, ${escapeSql(e.personal_purpose)},
      ${escapeSql(e.at)}, ${escapeSql(e.gate)},
      ${escapeSql(e.guard_id)}, ${escapeSql(e.guard_name)}, ${escapeSql(e.purpose)}, ${escapeSql(e.party)},
      ${escapeSql(e.vehicle_type)}, ${escapeSql(e.vehicle_no)}, ${escapeSql(e.driver)}, ${escapeSql(e.driver_id)},
      ${escapeSql(e.doc_type)}, ${escapeSql(e.doc_no)}, ${e.amount !== null ? e.amount : 'NULL'}, ${escapeSql(e.po_no)},
      ${escapeSql(e.authorised_by)}, ${escapeSql(e.dept)}, ${e.weight !== null ? e.weight : 'NULL'},
      ${e.packages !== null ? e.packages : 'NULL'}, ${escapeSql(e.person)}, ${escapeSql(e.remarks)},
      ${e.returnable ? 1 : 0}, ${escapeSql(e.expected_return)}, ${escapeSql(e.returned_at)},
      ${escapeSql(e.return_code)}, ${escapeSql(e.against)}, ${escapeSql(e.vehicle_out_at)}, ${escapeSql(e.stage)},
      ${e.prints}, ${e.cancelled ? 1 : 0}, ${escapeSql(e.cancelled?.reason)}, ${escapeSql(e.cancelled?.by)}, ${escapeSql(e.cancelled?.at)},
      ${escapeSql(returnDetailsStr)}
    ) ON DUPLICATE KEY UPDATE \`stage\` = VALUES(\`stage\`), \`prints_count\` = VALUES(\`prints_count\`), \`purchaser_name\` = VALUES(\`purchaser_name\`);`);

    // Insert items
    for (const item of e.items) {
      lines.push(`INSERT INTO \`entry_items\` (\`id\`, \`entry_id\`, \`item_desc\`, \`quantity\`, \`unit\`) VALUES (${escapeSql(item.id)}, ${escapeSql(e.id)}, ${escapeSql(item.desc)}, ${item.qty}, ${escapeSql(item.unit)});`);
    }

    // Insert corrections
    for (const corr of e.corrections) {
      lines.push(`INSERT INTO \`entry_corrections\` (\`entry_id\`, \`corrected_at\`, \`by_user_id\`, \`by_user_name\`, \`field_name\`, \`old_value\`, \`new_value\`, \`reason\`) VALUES (${escapeSql(e.id)}, ${escapeSql(corr.at)}, ${escapeSql(corr.by)}, ${escapeSql(corr.by_name)}, ${escapeSql(corr.field)}, ${escapeSql(corr.old)}, ${escapeSql(corr.new)}, ${escapeSql(corr.reason)});`);
    }
  }

  // Insert audit trail
  lines.push('\n-- Cryptographic Audit Trail');
  for (const a of state.audit) {
    lines.push(`INSERT INTO \`audit_trail\` (\`id\`, \`ts\`, \`user_id\`, \`user_name\`, \`action\`, \`code\`, \`details\`, \`prev_hash\`, \`hash\`) VALUES (${a.id}, ${escapeSql(a.ts)}, ${escapeSql(a.user_id)}, ${escapeSql(a.user_name)}, ${escapeSql(a.action)}, ${escapeSql(a.code)}, ${escapeSql(a.details)}, ${escapeSql(a.prev_hash)}, ${escapeSql(a.hash)});`);
  }

  // Insert user sessions
  if (state.sessions && state.sessions.length > 0) {
    lines.push('\n-- Active User Client Sessions');
    for (const s of state.sessions) {
      lines.push(`INSERT INTO \`user_sessions\` (\`session_id\`, \`user_id\`, \`login\`, \`refresh_token\`, \`device\`, \`ip\`, \`created_at\`, \`last_active_at\`, \`is_active\`) VALUES (${escapeSql(s.sessionId)}, ${escapeSql(s.userId)}, ${escapeSql(s.login)}, ${escapeSql(s.refreshToken)}, ${escapeSql(s.device)}, ${escapeSql(s.ip)}, ${escapeSql(s.created_at)}, ${escapeSql(s.last_active_at)}, ${s.active ? 1 : 0});`);
    }
  }

  lines.push('\nCOMMIT;\n');
  return lines.join('\n');
}
