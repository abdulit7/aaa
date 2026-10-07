import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';
import { DatabaseState, AppUser, GateEntry, SystemSettings, AuditLog, GatePhoto, UserSession, GateItem, GateCorrection } from './db.js';

let pool: mysql.Pool | null = null;
let isConnected = false;
let lastError: string | null = null;

export function getMySQLPool(): mysql.Pool | null {
  return pool;
}

export function isMySQLConnected(): boolean {
  return isConnected && pool !== null;
}

export function getMySQLLastError(): string | null {
  return lastError;
}

export function formatSqlDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }
  const s = String(val).trim();
  if (s.includes('T')) {
    return s.replace('T', ' ').slice(0, 19);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 19);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return s;
}

export function formatSqlDateOnly(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return s.slice(0, 10);
}

export function getMySQLConfig(override?: Partial<{ host: string; port: number; user: string; password: string; database: string }>) {
  let user = override?.user || process.env.MYSQL_USER || 'root';
  let password = override?.password !== undefined ? override.password : (process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : 'Pak@123');
  let host = override?.host || process.env.MYSQL_HOST || 'localhost';
  let port = override?.port || parseInt(process.env.MYSQL_PORT || '3306', 10);
  let database = override?.database || process.env.MYSQL_DATABASE || 'gateregister_db';

  if (!override && process.env.DATABASE_URL) {
    const raw = process.env.DATABASE_URL.trim();
    const match = raw.match(/^mysql:\/\/([^:]+):(.*)@([^:@\/]+)(?::(\d+))?\/([^?]+)/);
    if (match) {
      user = decodeURIComponent(match[1]);
      password = decodeURIComponent(match[2]);
      host = match[3];
      port = match[4] ? parseInt(match[4], 10) : 3306;
      database = match[5];
    }
  }

  return { host, port, user, password, database };
}

export async function reconnectMySQL(customConfig?: any): Promise<{ success: boolean; error?: string; config: any }> {
  const config = getMySQLConfig(customConfig);
  try {
    if (pool) {
      try { await pool.end(); } catch (_) {}
      pool = null;
    }
    isConnected = false;
    lastError = null;

    // 1. Try to create the database if not exists
    try {
      const initConn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        connectTimeout: 2500,
        dateStrings: true
      });
      await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await initConn.end();
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
        lastError = `Cannot connect to MySQL server at ${config.host}:${config.port} (${err.code}).`;
        return { success: false, error: lastError, config };
      }
    }

    const newPool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      connectTimeout: 2500,
      dateStrings: true
    });

    const conn = await newPool.getConnection();
    await conn.ping();
    conn.release();

    await ensureTables(newPool);

    pool = newPool;
    isConnected = true;
    lastError = null;
    console.log(`[MySQL] Connected successfully to ${config.user}@${config.host}:${config.port}/${config.database}`);
    return { success: true, config };
  } catch (err: any) {
    lastError = err.message || String(err);
    isConnected = false;
    pool = null;
    return { success: false, error: lastError || undefined, config };
  }
}

export async function initMySQL(state: DatabaseState): Promise<boolean> {
  const res = await reconnectMySQL();
  if (res.success && pool) {
    await syncFromMySQL(pool, state);
    return true;
  }
  return false;
}

async function ensureTables(p: mysql.Pool) {
  // 1. system_settings
  await p.query(`
    CREATE TABLE IF NOT EXISTS \`system_settings\` (
      \`setting_key\` VARCHAR(64) NOT NULL PRIMARY KEY,
      \`setting_value\` LONGTEXT NOT NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Ensure setting_value is LONGTEXT if table was previously created with TEXT
  try { await p.query('ALTER TABLE `system_settings` MODIFY COLUMN `setting_value` LONGTEXT NOT NULL'); } catch (_) {}

  // 1b. locations table (persisted facility locations)
  await p.query(`
    CREATE TABLE IF NOT EXISTS \`locations\` (
      \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
      \`name\` VARCHAR(100) NOT NULL UNIQUE,
      \`code\` VARCHAR(50) DEFAULT NULL,
      \`address\` VARCHAR(255) DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Seed default locations if empty
  try {
    const [existingLocs] = await p.query('SELECT COUNT(*) as cnt FROM `locations`');
    if (Array.isArray(existingLocs) && Number((existingLocs as any[])[0]?.cnt || 0) === 0) {
      const defaultLocs = [
        { id: 'loc-1', name: 'Estate 1', code: 'EST-1', address: 'Main Manufacturing Complex, Gate 1' },
        { id: 'loc-2', name: 'Estate 2', code: 'EST-2', address: 'Industrial Extension & Workshop Unit' },
        { id: 'loc-3', name: 'Kamonki', code: 'KMK-1', address: 'Kamonki Logistics & Distribution Center' },
        { id: 'loc-4', name: 'Lahore', code: 'LHR-1', address: 'Lahore Regional Depot' },
        { id: 'loc-5', name: 'Gujranwala', code: 'GRW-1', address: 'Gujranwala Main Hub' },
        { id: 'loc-6', name: 'Head Office', code: 'HQ-1', address: 'Corporate Administration Headquarters' },
        { id: 'loc-7', name: 'Plant A', code: 'PLT-A', address: 'Primary Processing Plant Unit A' }
      ];
      for (const loc of defaultLocs) {
        await p.query(
          'INSERT IGNORE INTO `locations` (`id`, `name`, `code`, `address`, `active`) VALUES (?, ?, ?, ?, 1)',
          [loc.id, loc.name, loc.code, loc.address]
        );
      }
    }
  } catch (_) {}

  // 2. users
  await p.query(`
    CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
      \`name\` VARCHAR(120) NOT NULL,
      \`login\` VARCHAR(60) NOT NULL UNIQUE,
      \`role\` ENUM('guard', 'supervisor', 'admin') NOT NULL DEFAULT 'guard',
      \`gate\` VARCHAR(100) DEFAULT 'Main Gate',
      \`location\` VARCHAR(100) DEFAULT 'Estate 1',
      \`device_type\` ENUM('tablet', 'web') NOT NULL DEFAULT 'web',
      \`salt\` VARCHAR(64) NOT NULL,
      \`password_hash\` VARCHAR(128) NOT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`must_change\` TINYINT(1) NOT NULL DEFAULT 0,
      \`failed_attempts\` INT NOT NULL DEFAULT 0,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Auto migrations for users
  try { await p.query('ALTER TABLE `users` ADD COLUMN `location` VARCHAR(100) DEFAULT "Estate 1"'); } catch (_) {}
  try { await p.query('ALTER TABLE `users` ADD COLUMN `device_type` ENUM("tablet", "web") NOT NULL DEFAULT "web"'); } catch (_) {}

  // 3. gate_entries
  await p.query(`
    CREATE TABLE IF NOT EXISTS \`gate_entries\` (
      \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
      \`code\` VARCHAR(32) NOT NULL UNIQUE,
      \`dir\` ENUM('IN', 'OUT') NOT NULL,
      \`inward_type\` VARCHAR(40) NOT NULL DEFAULT 'vehicle',
      \`purchaser_name\` VARCHAR(150) DEFAULT NULL,
      \`personal_purpose\` VARCHAR(255) DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL,
      \`gate\` VARCHAR(100) NOT NULL,
      \`location\` VARCHAR(100) DEFAULT 'Estate 1',
      \`device_type\` VARCHAR(40) DEFAULT 'web',
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
      INDEX \`idx_gate\` (\`gate\`),
      INDEX \`idx_location\` (\`location\`),
      INDEX \`idx_created_at\` (\`created_at\`),
      INDEX \`idx_dir_stage\` (\`dir\`, \`stage\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Ensure missing columns exist in case table was pre-existing
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `inward_type` VARCHAR(40) NOT NULL DEFAULT "vehicle"'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `purchaser_name` VARCHAR(150) DEFAULT NULL'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `personal_purpose` VARCHAR(255) DEFAULT NULL'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `return_details` JSON DEFAULT NULL'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `location` VARCHAR(100) DEFAULT "Estate 1"'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `device_type` VARCHAR(40) DEFAULT "web"'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `movement_type` VARCHAR(60) DEFAULT "External / Supplier"'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `from_branch` VARCHAR(100) DEFAULT NULL'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `to_branch` VARCHAR(100) DEFAULT NULL'); } catch (_) {}
  try { await p.query('ALTER TABLE `gate_entries` ADD COLUMN `transfer_details` JSON DEFAULT NULL'); } catch (_) {}

  // 4. entry_items
  await p.query(`
    CREATE TABLE IF NOT EXISTS \`entry_items\` (
      \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
      \`entry_id\` VARCHAR(36) NOT NULL,
      \`item_desc\` VARCHAR(255) NOT NULL,
      \`quantity\` DECIMAL(12,3) NOT NULL,
      \`unit\` VARCHAR(40) NOT NULL,
      INDEX \`idx_item_entry\` (\`entry_id\`),
      CONSTRAINT \`fk_entry_items_entry\` FOREIGN KEY (\`entry_id\`) REFERENCES \`gate_entries\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. entry_corrections
  await p.query(`
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
  `);

  // 6. entry_photos
  await p.query(`
    CREATE TABLE IF NOT EXISTS \`entry_photos\` (
      \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
      \`entry_id\` VARCHAR(36) NOT NULL,
      \`note\` VARCHAR(200) NOT NULL,
      \`mime_type\` VARCHAR(60) NOT NULL,
      \`file_size\` INT NOT NULL,
      \`sha256_hash\` VARCHAR(64) NOT NULL,
      \`data_base64\` LONGTEXT NOT NULL,
      \`captured_by\` VARCHAR(36) NOT NULL,
      \`captured_at\` DATETIME NOT NULL,
      INDEX \`idx_photo_entry\` (\`entry_id\`),
      CONSTRAINT \`fk_entry_photos_entry\` FOREIGN KEY (\`entry_id\`) REFERENCES \`gate_entries\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try { await p.query('ALTER TABLE `entry_photos` MODIFY COLUMN `data_base64` LONGTEXT NOT NULL'); } catch (_) {}

  // 7. audit_trail
  await p.query(`
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
  `);

  // 8. user_sessions
  await p.query(`
    CREATE TABLE IF NOT EXISTS \`user_sessions\` (
      \`session_id\` VARCHAR(64) NOT NULL PRIMARY KEY,
      \`user_id\` VARCHAR(36) NOT NULL,
      \`login\` VARCHAR(60) NOT NULL,
      \`refresh_token\` VARCHAR(64) NOT NULL,
      \`device\` VARCHAR(120) DEFAULT 'Web Client',
      \`device_type\` VARCHAR(40) DEFAULT 'web',
      \`gate\` VARCHAR(100) DEFAULT 'Main Gate',
      \`location\` VARCHAR(100) DEFAULT 'Estate 1',
      \`ip\` VARCHAR(45) DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL,
      \`last_active_at\` DATETIME NOT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      INDEX \`idx_session_user\` (\`user_id\`),
      CONSTRAINT \`fk_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try { await p.query('ALTER TABLE `user_sessions` ADD COLUMN `device_type` VARCHAR(40) DEFAULT "web"'); } catch (_) {}
  try { await p.query('ALTER TABLE `user_sessions` ADD COLUMN `gate` VARCHAR(100) DEFAULT "Main Gate"'); } catch (_) {}
  try { await p.query('ALTER TABLE `user_sessions` ADD COLUMN `location` VARCHAR(100) DEFAULT "Estate 1"'); } catch (_) {}
}

async function syncFromMySQL(p: mysql.Pool, state: DatabaseState) {
  try {
    // 1. Settings
    const [settingsRows] = await p.query('SELECT setting_key, setting_value FROM `system_settings`');
    if (Array.isArray(settingsRows) && settingsRows.length > 0) {
      for (const r of settingsRows as any[]) {
        try {
          (state.settings as any)[r.setting_key] = JSON.parse(r.setting_value);
        } catch {
          (state.settings as any)[r.setting_key] = r.setting_value;
        }
      }
    } else {
      for (const [k, v] of Object.entries(state.settings)) {
        await p.query(
          'INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`)',
          [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]
        );
      }
    }

    // 2. Users
    const [usersRows] = await p.query('SELECT * FROM `users`');
    if (Array.isArray(usersRows) && usersRows.length > 0) {
      state.users = (usersRows as any[]).map(r => ({
        id: r.id,
        name: r.name,
        login: r.login,
        role: r.role,
        gate: r.gate || 'Main Gate',
        location: r.location || 'Estate 1',
        device_type: (r.device_type === 'tablet' ? 'tablet' : 'web'),
        salt: r.salt,
        password_hash: r.password_hash,
        active: Boolean(r.active),
        must_change: Boolean(r.must_change),
        failed: r.failed_attempts || 0
      }));
    } else if (state.users.length > 0) {
      for (const u of state.users) {
        await p.query(
          'INSERT INTO `users` (`id`, `name`, `login`, `role`, `gate`, `location`, `device_type`, `salt`, `password_hash`, `active`, `must_change`, `failed_attempts`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `location` = VALUES(`location`), `device_type` = VALUES(`device_type`)',
          [u.id, u.name, u.login, u.role, u.gate || 'Main Gate', u.location || 'Estate 1', u.device_type || 'web', u.salt, u.password_hash, u.active ? 1 : 0, u.must_change ? 1 : 0, u.failed]
        );
      }
    }

    // 3. Entries
    const entries = await mysqlGetEntries();
    state.entries = entries;

    // 4. Photos
    const [photosRows] = await p.query('SELECT * FROM `entry_photos` ORDER BY `captured_at` ASC');
    if (Array.isArray(photosRows)) {
      state.photos = (photosRows as any[]).map(ph => ({
        id: ph.id,
        entry_id: ph.entry_id,
        data_url: ph.data_base64,
        note: ph.note,
        mime: ph.mime_type,
        size: ph.file_size,
        sha256: ph.sha256_hash,
        captured_by: ph.captured_by,
        at: formatSqlDate(ph.captured_at)
      }));
    }

    // 5. Audit
    const [auditRows] = await p.query('SELECT * FROM `audit_trail` ORDER BY `id` ASC');
    if (Array.isArray(auditRows) && auditRows.length > 0) {
      state.audit = (auditRows as any[]).map(a => ({
        id: Number(a.id),
        ts: formatSqlDate(a.ts),
        user_id: a.user_id,
        user_name: a.user_name,
        action: a.action,
        code: a.code,
        details: typeof a.details === 'object' ? JSON.stringify(a.details) : String(a.details || ''),
        prev_hash: a.prev_hash,
        hash: a.hash
      }));
    }

    // 6. Active Sessions
    const [sessionsRows] = await p.query('SELECT * FROM `user_sessions` WHERE `is_active` = 1');
    if (Array.isArray(sessionsRows)) {
      state.sessions = (sessionsRows as any[]).map(s => ({
        sessionId: s.session_id,
        userId: s.user_id,
        login: s.login,
        refreshToken: s.refresh_token,
        device: s.device,
        device_type: (s.device_type === 'tablet' ? 'tablet' : 'web'),
        gate: s.gate || 'Main Gate',
        location: s.location || 'Estate 1',
        ip: s.ip,
        created_at: formatSqlDate(s.created_at),
        last_active_at: formatSqlDate(s.last_active_at),
        active: Boolean(s.is_active)
      }));
    }

    console.log(`[MySQL] Synced directly from database: ${state.users.length} users, ${state.entries.length} entries, ${state.audit.length} audit records.`);
  } catch (err: any) {
    console.warn('[MySQL] Note during record synchronization:', err.message);
  }
}

// --- Direct MySQL Query Implementations ---

export async function mysqlGetEntries(): Promise<GateEntry[]> {
  if (!pool || !isConnected) return [];
  try {
    const [rows] = await pool.query('SELECT * FROM `gate_entries` ORDER BY `created_at` DESC');
    if (!Array.isArray(rows)) return [];

    const entries: GateEntry[] = [];
    for (const r of rows as any[]) {
      const [itemsRows] = await pool.query('SELECT * FROM `entry_items` WHERE `entry_id` = ?', [r.id]);
      const [corrRows] = await pool.query('SELECT * FROM `entry_corrections` WHERE `entry_id` = ?', [r.id]);

      const items: GateItem[] = Array.isArray(itemsRows) ? (itemsRows as any[]).map(i => ({
        id: i.id,
        desc: i.item_desc,
        qty: Number(i.quantity),
        unit: i.unit
      })) : [];

      const corrections: GateCorrection[] = Array.isArray(corrRows) ? (corrRows as any[]).map(c => ({
        at: formatSqlDate(c.corrected_at),
        by: c.by_user_id,
        by_name: c.by_user_name,
        field: c.field_name,
        old: c.old_value,
        new: c.new_value,
        reason: c.reason
      })) : [];

      let parsedReturnDetails = null;
      if (r.return_details) {
        try {
          parsedReturnDetails = typeof r.return_details === 'string' ? JSON.parse(r.return_details) : r.return_details;
        } catch (_) {}
      }

      let parsedTransferDetails = null;
      if (r.transfer_details) {
        try {
          parsedTransferDetails = typeof r.transfer_details === 'string' ? JSON.parse(r.transfer_details) : r.transfer_details;
        } catch (_) {}
      }

      entries.push({
        id: r.id,
        code: r.code,
        dir: r.dir,
        movement_type: r.movement_type || undefined,
        from_branch: r.from_branch || undefined,
        to_branch: r.to_branch || undefined,
        inter_branch_details: parsedTransferDetails,
        inward_type: r.inward_type || 'vehicle',
        purchaser_name: r.purchaser_name || undefined,
        personal_purpose: r.personal_purpose || undefined,
        at: formatSqlDate(r.created_at),
        gate: r.gate || 'Main Gate',
        location: r.location || 'Estate 1',
        device_type: r.device_type || 'web',
        guard_id: r.guard_id,
        guard_name: r.guard_name,
        purpose: r.purpose,
        party: r.party,
        vehicle_type: r.vehicle_type,
        vehicle_no: r.vehicle_no,
        driver: r.driver || '',
        driver_id: r.driver_id || '',
        doc_type: r.doc_type,
        doc_no: r.doc_no || '',
        amount: r.amount !== null ? Number(r.amount) : null,
        po_no: r.po_no || '',
        authorised_by: r.authorised_by || '',
        dept: r.dept || '',
        items,
        weight: r.weight_kg !== null ? Number(r.weight_kg) : null,
        packages: r.packages_count !== null ? Number(r.packages_count) : null,
        person: r.person || '',
        remarks: r.remarks || '',
        returnable: Boolean(r.returnable),
        expected_return: formatSqlDateOnly(r.expected_return),
        returned_at: r.returned_at ? formatSqlDate(r.returned_at) : null,
        return_code: r.return_code || null,
        return_details: parsedReturnDetails,
        against: r.against_code || null,
        duplicate_of: [],
        vehicle_out_at: r.vehicle_out_at ? formatSqlDate(r.vehicle_out_at) : null,
        stage: r.stage,
        prints: r.prints_count || 0,
        corrections,
        cancelled: r.is_cancelled ? {
          at: formatSqlDate(r.cancel_at),
          by: r.cancel_by || '',
          by_name: 'Supervisor',
          reason: r.cancel_reason || ''
        } : null
      });
    }

    return entries;
  } catch (err: any) {
    console.warn('[MySQL Direct Query] Error fetching entries:', err.message);
    return [];
  }
}

export async function mysqlGetEntryByCode(code: string): Promise<GateEntry | null> {
  if (!pool || !isConnected) return null;
  try {
    const [rows] = await pool.query('SELECT * FROM `gate_entries` WHERE `code` = ? LIMIT 1', [code.trim().toUpperCase()]);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const r = (rows as any[])[0];

    const [itemsRows] = await pool.query('SELECT * FROM `entry_items` WHERE `entry_id` = ?', [r.id]);
    const [corrRows] = await pool.query('SELECT * FROM `entry_corrections` WHERE `entry_id` = ?', [r.id]);

    const items: GateItem[] = Array.isArray(itemsRows) ? (itemsRows as any[]).map(i => ({
      id: i.id,
      desc: i.item_desc,
      qty: Number(i.quantity),
      unit: i.unit
    })) : [];

    const corrections: GateCorrection[] = Array.isArray(corrRows) ? (corrRows as any[]).map(c => ({
      at: formatSqlDate(c.corrected_at),
      by: c.by_user_id,
      by_name: c.by_user_name,
      field: c.field_name,
      old: c.old_value,
      new: c.new_value,
      reason: c.reason
    })) : [];

    let parsedReturnDetails = null;
    if (r.return_details) {
      try {
        parsedReturnDetails = typeof r.return_details === 'string' ? JSON.parse(r.return_details) : r.return_details;
      } catch (_) {}
    }

    let parsedTransferDetails = null;
    if (r.transfer_details) {
      try {
        parsedTransferDetails = typeof r.transfer_details === 'string' ? JSON.parse(r.transfer_details) : r.transfer_details;
      } catch (_) {}
    }

    return {
      id: r.id,
      code: r.code,
      dir: r.dir,
      movement_type: r.movement_type || undefined,
      from_branch: r.from_branch || undefined,
      to_branch: r.to_branch || undefined,
      inter_branch_details: parsedTransferDetails,
      inward_type: r.inward_type || 'vehicle',
      purchaser_name: r.purchaser_name || undefined,
      personal_purpose: r.personal_purpose || undefined,
      at: formatSqlDate(r.created_at),
      gate: r.gate || 'Main Gate',
      location: r.location || 'Estate 1',
      device_type: r.device_type || 'web',
      guard_id: r.guard_id,
      guard_name: r.guard_name,
      purpose: r.purpose,
      party: r.party,
      vehicle_type: r.vehicle_type,
      vehicle_no: r.vehicle_no,
      driver: r.driver || '',
      driver_id: r.driver_id || '',
      doc_type: r.doc_type,
      doc_no: r.doc_no || '',
      amount: r.amount !== null ? Number(r.amount) : null,
      po_no: r.po_no || '',
      authorised_by: r.authorised_by || '',
      dept: r.dept || '',
      items,
      weight: r.weight_kg !== null ? Number(r.weight_kg) : null,
      packages: r.packages_count !== null ? Number(r.packages_count) : null,
      person: r.person || '',
      remarks: r.remarks || '',
      returnable: Boolean(r.returnable),
      expected_return: formatSqlDateOnly(r.expected_return),
      returned_at: r.returned_at ? formatSqlDate(r.returned_at) : null,
      return_code: r.return_code || null,
      return_details: parsedReturnDetails,
      against: r.against_code || null,
      duplicate_of: [],
      vehicle_out_at: r.vehicle_out_at ? formatSqlDate(r.vehicle_out_at) : null,
      stage: r.stage,
      prints: r.prints_count || 0,
      corrections,
      cancelled: r.is_cancelled ? {
        at: formatSqlDate(r.cancel_at),
        by: r.cancel_by || '',
        by_name: 'Supervisor',
        reason: r.cancel_reason || ''
      } : null
    };
  } catch (err: any) {
    console.warn('[MySQL Direct Query] Error fetching entry by code:', err.message);
    return null;
  }
}

export async function mysqlSaveEntry(entry: GateEntry): Promise<void> {
  if (!pool || !isConnected) {
    throw new Error('MySQL database is not connected. Operation blocked.');
  }

  const formattedAt = formatSqlDate(entry.at);
  const formattedOut = entry.vehicle_out_at ? formatSqlDate(entry.vehicle_out_at) : null;
  const formattedRet = entry.returned_at ? formatSqlDate(entry.returned_at) : null;
  const formattedExp = formatSqlDateOnly(entry.expected_return);
  const returnDetailsJson = entry.return_details ? JSON.stringify(entry.return_details) : null;
  const transferDetailsJson = entry.inter_branch_details ? JSON.stringify(entry.inter_branch_details) : null;

  await pool.query(
    `INSERT INTO \`gate_entries\` (
      \`id\`, \`code\`, \`dir\`, \`inward_type\`, \`purchaser_name\`, \`personal_purpose\`,
      \`created_at\`, \`gate\`, \`location\`, \`device_type\`, \`guard_id\`, \`guard_name\`, \`purpose\`,
      \`party\`, \`vehicle_type\`, \`vehicle_no\`, \`driver\`, \`driver_id\`, \`doc_type\`, \`doc_no\`,
      \`amount\`, \`po_no\`, \`authorised_by\`, \`dept\`, \`weight_kg\`, \`packages_count\`, \`person\`,
      \`remarks\`, \`returnable\`, \`expected_return\`, \`returned_at\`, \`return_code\`, \`against_code\`,
      \`vehicle_out_at\`, \`stage\`, \`prints_count\`, \`is_cancelled\`, \`cancel_reason\`, \`cancel_by\`, \`cancel_at\`,
      \`return_details\`, \`movement_type\`, \`from_branch\`, \`to_branch\`, \`transfer_details\`
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      \`stage\` = VALUES(\`stage\`),
      \`inward_type\` = VALUES(\`inward_type\`),
      \`purchaser_name\` = VALUES(\`purchaser_name\`),
      \`personal_purpose\` = VALUES(\`personal_purpose\`),
      \`gate\` = VALUES(\`gate\`),
      \`location\` = VALUES(\`location\`),
      \`device_type\` = VALUES(\`device_type\`),
      \`vehicle_out_at\` = VALUES(\`vehicle_out_at\`),
      \`returned_at\` = VALUES(\`returned_at\`),
      \`return_code\` = VALUES(\`return_code\`),
      \`prints_count\` = VALUES(\`prints_count\`),
      \`is_cancelled\` = VALUES(\`is_cancelled\`),
      \`cancel_reason\` = VALUES(\`cancel_reason\`),
      \`cancel_by\` = VALUES(\`cancel_by\`),
      \`cancel_at\` = VALUES(\`cancel_at\`),
      \`remarks\` = VALUES(\`remarks\`),
      \`party\` = VALUES(\`party\`),
      \`vehicle_no\` = VALUES(\`vehicle_no\`),
      \`doc_no\` = VALUES(\`doc_no\`),
      \`return_details\` = VALUES(\`return_details\`),
      \`movement_type\` = VALUES(\`movement_type\`),
      \`from_branch\` = VALUES(\`from_branch\`),
      \`to_branch\` = VALUES(\`to_branch\`),
      \`transfer_details\` = VALUES(\`transfer_details\`);`,
    [
      entry.id, entry.code, entry.dir, entry.inward_type || 'vehicle', entry.purchaser_name || null, entry.personal_purpose || null,
      formattedAt, entry.gate || 'Main Gate', entry.location || 'Estate 1', entry.device_type || 'web', entry.guard_id, entry.guard_name, entry.purpose,
      entry.party, entry.vehicle_type, entry.vehicle_no, entry.driver || null, entry.driver_id || null, entry.doc_type, entry.doc_no || null,
      entry.amount !== null ? entry.amount : null, entry.po_no || null, entry.authorised_by || null, entry.dept || null,
      entry.weight !== null ? entry.weight : null, entry.packages !== null ? entry.packages : null, entry.person || null,
      entry.remarks || null, entry.returnable ? 1 : 0, formattedExp, formattedRet, entry.return_code || null, entry.against || null,
      formattedOut, entry.stage, entry.prints || 0, entry.cancelled ? 1 : 0, entry.cancelled?.reason || null,
      entry.cancelled?.by || null, entry.cancelled?.at ? formatSqlDate(entry.cancelled.at) : null, returnDetailsJson,
      entry.movement_type || null, entry.from_branch || null, entry.to_branch || null, transferDetailsJson
    ]
  );

  // Save items
  if (entry.items && entry.items.length > 0) {
    for (const item of entry.items) {
      await pool.query(
        `INSERT INTO \`entry_items\` (\`id\`, \`entry_id\`, \`item_desc\`, \`quantity\`, \`unit\`)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`item_desc\` = VALUES(\`item_desc\`), \`quantity\` = VALUES(\`quantity\`), \`unit\` = VALUES(\`unit\`)`,
        [item.id, entry.id, item.desc, item.qty, item.unit]
      );
    }
  }

  // Save corrections
  if (entry.corrections && entry.corrections.length > 0) {
    for (const c of entry.corrections) {
      const formattedCorrAt = formatSqlDate(c.at);
      const [existing] = await pool.query(
        'SELECT id FROM `entry_corrections` WHERE `entry_id` = ? AND `corrected_at` = ? AND `field_name` = ?',
        [entry.id, formattedCorrAt, c.field]
      );
      if (!Array.isArray(existing) || existing.length === 0) {
        await pool.query(
          `INSERT INTO \`entry_corrections\` (\`entry_id\`, \`corrected_at\`, \`by_user_id\`, \`by_user_name\`, \`field_name\`, \`old_value\`, \`new_value\`, \`reason\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [entry.id, formattedCorrAt, c.by, c.by_name, c.field, c.old, c.new, c.reason]
        );
      }
    }
  }
}

export async function mysqlSaveUser(user: AppUser): Promise<void> {
  if (!pool || !isConnected) return;
  await pool.query(
    `INSERT INTO \`users\` (\`id\`, \`name\`, \`login\`, \`role\`, \`gate\`, \`location\`, \`device_type\`, \`salt\`, \`password_hash\`, \`active\`, \`must_change\`, \`failed_attempts\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       \`name\` = VALUES(\`name\`),
       \`role\` = VALUES(\`role\`),
       \`gate\` = VALUES(\`gate\`),
       \`location\` = VALUES(\`location\`),
       \`device_type\` = VALUES(\`device_type\`),
       \`salt\` = VALUES(\`salt\`),
       \`password_hash\` = VALUES(\`password_hash\`),
       \`active\` = VALUES(\`active\`),
       \`must_change\` = VALUES(\`must_change\`),
       \`failed_attempts\` = VALUES(\`failed_attempts\`);`,
    [user.id, user.name, user.login, user.role, user.gate || 'Main Gate', user.location || 'Estate 1', user.device_type || 'web', user.salt, user.password_hash, user.active ? 1 : 0, user.must_change ? 1 : 0, user.failed]
  );
}

export async function mysqlDeleteUser(userId: string): Promise<boolean> {
  if (!pool || !isConnected) return false;
  await pool.query('DELETE FROM `users` WHERE `id` = ?', [userId]);
  return true;
}

export async function mysqlGetUsers(): Promise<AppUser[]> {
  if (!pool || !isConnected) return [];
  const [rows] = await pool.query('SELECT * FROM `users`');
  if (!Array.isArray(rows)) return [];
  return (rows as any[]).map(r => ({
    id: r.id,
    name: r.name,
    login: r.login,
    role: r.role,
    gate: r.gate || 'Main Gate',
    location: r.location || 'Estate 1',
    device_type: (r.device_type === 'tablet' ? 'tablet' : 'web'),
    salt: r.salt,
    password_hash: r.password_hash,
    active: Boolean(r.active),
    must_change: Boolean(r.must_change),
    failed: r.failed_attempts || 0
  }));
}

export async function mysqlFindUserByLogin(login: string): Promise<AppUser | null> {
  if (!pool || !isConnected) return null;
  const [rows] = await pool.query('SELECT * FROM `users` WHERE LOWER(`login`) = LOWER(?) LIMIT 1', [login.trim()]);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = (rows as any[])[0];
  return {
    id: r.id,
    name: r.name,
    login: r.login,
    role: r.role,
    gate: r.gate || 'Main Gate',
    location: r.location || 'Estate 1',
    device_type: (r.device_type === 'tablet' ? 'tablet' : 'web'),
    salt: r.salt,
    password_hash: r.password_hash,
    active: Boolean(r.active),
    must_change: Boolean(r.must_change),
    failed: r.failed_attempts || 0
  };
}

export async function mysqlFindUserById(id: string): Promise<AppUser | null> {
  if (!pool || !isConnected) return null;
  const [rows] = await pool.query('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [id.trim()]);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = (rows as any[])[0];
  return {
    id: r.id,
    name: r.name,
    login: r.login,
    role: r.role,
    gate: r.gate || 'Main Gate',
    location: r.location || 'Estate 1',
    device_type: (r.device_type === 'tablet' ? 'tablet' : 'web'),
    salt: r.salt,
    password_hash: r.password_hash,
    active: Boolean(r.active),
    must_change: Boolean(r.must_change),
    failed: r.failed_attempts || 0
  };
}

export async function mysqlGetLocations(): Promise<{ id: string; name: string; code?: string; address?: string; active: boolean }[]> {
  if (!pool || !isConnected) return [];
  try {
    const [rows] = await pool.query('SELECT * FROM `locations` ORDER BY `name` ASC');
    if (!Array.isArray(rows)) return [];
    return (rows as any[]).map(r => ({
      id: r.id,
      name: r.name,
      code: r.code || undefined,
      address: r.address || undefined,
      active: Boolean(r.active)
    }));
  } catch (err: any) {
    console.warn('[MySQL Direct Query] Error fetching locations:', err.message);
    return [];
  }
}

export async function mysqlSaveLocation(loc: { id: string; name: string; code?: string; address?: string; active?: boolean }): Promise<void> {
  if (!pool || !isConnected) return;
  await pool.query(
    `INSERT INTO \`locations\` (\`id\`, \`name\`, \`code\`, \`address\`, \`active\`)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       \`name\` = VALUES(\`name\`),
       \`code\` = VALUES(\`code\`),
       \`address\` = VALUES(\`address\`),
       \`active\` = VALUES(\`active\`);`,
    [loc.id, loc.name.trim(), loc.code?.trim() || null, loc.address?.trim() || null, loc.active !== false ? 1 : 0]
  );
}

export async function mysqlDeleteLocation(name: string): Promise<boolean> {
  if (!pool || !isConnected) return false;
  try {
    await pool.query('DELETE FROM `locations` WHERE LOWER(`name`) = LOWER(?)', [name.trim()]);
    return true;
  } catch {
    return false;
  }
}

export async function mysqlSaveSettings(settings: SystemSettings): Promise<void> {
  if (!pool || !isConnected) return;
  for (const [k, v] of Object.entries(settings)) {
    await pool.query(
      'INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);',
      [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]
    );
  }
}

export async function mysqlGetSettings(): Promise<SystemSettings | null> {
  if (!pool || !isConnected) return null;
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM `system_settings`');
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const res: any = {};
  for (const r of rows as any[]) {
    try {
      res[r.setting_key] = JSON.parse(r.setting_value);
    } catch {
      res[r.setting_key] = r.setting_value;
    }
  }
  return res as SystemSettings;
}

export async function mysqlSaveAudit(audit: AuditLog): Promise<void> {
  if (!pool || !isConnected) return;
  const formattedTs = formatSqlDate(audit.ts);
  await pool.query(
    `INSERT INTO \`audit_trail\` (\`id\`, \`ts\`, \`user_id\`, \`user_name\`, \`action\`, \`code\`, \`details\`, \`prev_hash\`, \`hash\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE \`hash\` = VALUES(\`hash\`);`,
    [audit.id, formattedTs, audit.user_id, audit.user_name, audit.action, audit.code || null, audit.details, audit.prev_hash, audit.hash]
  );
}

export async function mysqlGetAuditTrail(): Promise<AuditLog[]> {
  if (!pool || !isConnected) return [];
  const [rows] = await pool.query('SELECT * FROM `audit_trail` ORDER BY `id` DESC LIMIT 500');
  if (!Array.isArray(rows)) return [];
  return (rows as any[]).map(a => ({
    id: Number(a.id),
    ts: formatSqlDate(a.ts),
    user_id: a.user_id,
    user_name: a.user_name,
    action: a.action,
    code: a.code,
    details: typeof a.details === 'object' ? JSON.stringify(a.details) : String(a.details || ''),
    prev_hash: a.prev_hash,
    hash: a.hash
  }));
}

export async function mysqlSavePhoto(photo: GatePhoto): Promise<void> {
  if (!pool || !isConnected) return;
  const formattedAt = formatSqlDate(photo.at);
  await pool.query(
    `INSERT INTO \`entry_photos\` (\`id\`, \`entry_id\`, \`note\`, \`mime_type\`, \`file_size\`, \`sha256_hash\`, \`data_base64\`, \`captured_by\`, \`captured_at\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE \`note\` = VALUES(\`note\`);`,
    [photo.id, photo.entry_id, photo.note, photo.mime, photo.size, photo.sha256, photo.data_url, photo.captured_by, formattedAt]
  );
}

export async function mysqlGetPhotosForEntry(entryId: string): Promise<GatePhoto[]> {
  if (!pool || !isConnected) return [];
  const [rows] = await pool.query('SELECT * FROM `entry_photos` WHERE `entry_id` = ? ORDER BY `captured_at` ASC', [entryId]);
  if (!Array.isArray(rows)) return [];
  return (rows as any[]).map(ph => ({
    id: ph.id,
    entry_id: ph.entry_id,
    data_url: ph.data_base64,
    note: ph.note,
    mime: ph.mime_type,
    size: ph.file_size,
    sha256: ph.sha256_hash,
    captured_by: ph.captured_by,
    at: formatSqlDate(ph.captured_at)
  }));
}

export async function mysqlSaveSession(session: UserSession): Promise<void> {
  if (!pool || !isConnected) return;
  const formattedCreated = formatSqlDate(session.created_at);
  const formattedActive = formatSqlDate(session.last_active_at);
  await pool.query(
    `INSERT INTO \`user_sessions\` (\`session_id\`, \`user_id\`, \`login\`, \`refresh_token\`, \`device\`, \`device_type\`, \`gate\`, \`location\`, \`ip\`, \`created_at\`, \`last_active_at\`, \`is_active\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       \`refresh_token\` = VALUES(\`refresh_token\`),
       \`device\` = VALUES(\`device\`),
       \`device_type\` = VALUES(\`device_type\`),
       \`gate\` = VALUES(\`gate\`),
       \`location\` = VALUES(\`location\`),
       \`last_active_at\` = VALUES(\`last_active_at\`),
       \`is_active\` = VALUES(\`is_active\`);`,
    [
      session.sessionId, session.userId, session.login, session.refreshToken,
      session.device || 'Web Client', session.device_type || 'web', session.gate || 'Main Gate', session.location || 'Estate 1',
      session.ip || null, formattedCreated, formattedActive, session.active ? 1 : 0
    ]
  );
}

export async function mysqlValidateSession(sessionId: string): Promise<UserSession | null> {
  if (!pool || !isConnected) return null;
  const [rows] = await pool.query('SELECT * FROM `user_sessions` WHERE `session_id` = ? AND `is_active` = 1 LIMIT 1', [sessionId]);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = (rows as any[])[0];
  return {
    sessionId: r.session_id,
    userId: r.user_id,
    login: r.login,
    refreshToken: r.refresh_token,
    device: r.device,
    device_type: (r.device_type === 'tablet' ? 'tablet' : 'web'),
    gate: r.gate || 'Main Gate',
    location: r.location || 'Estate 1',
    ip: r.ip,
    created_at: formatSqlDate(r.created_at),
    last_active_at: formatSqlDate(r.last_active_at),
    active: Boolean(r.is_active)
  };
}

export async function mysqlGetTableCounts(): Promise<Record<string, number>> {
  if (!pool || !isConnected) return {};
  try {
    const counts: Record<string, number> = {};
    const tables = ['system_settings', 'users', 'locations', 'gate_entries', 'entry_items', 'entry_photos', 'audit_trail', 'user_sessions'];
    for (const t of tables) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
        counts[t] = Number((rows as any[])[0]?.cnt || 0);
      } catch {
        counts[t] = 0;
      }
    }
    return counts;
  } catch {
    return {};
  }
}
