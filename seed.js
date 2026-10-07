import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

function getMySQLConfig() {
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : 'Pak@123';
  const host = process.env.MYSQL_HOST || 'localhost';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
  const database = process.env.MYSQL_DATABASE || 'gateregister_db';

  if (process.env.DATABASE_URL) {
    const raw = process.env.DATABASE_URL.trim();
    const match = raw.match(/^mysql:\/\/([^:]+):(.*)@([^:@\/]+)(?::(\d+))?\/([^?]+)/);
    if (match) {
      return {
        user: decodeURIComponent(match[1]),
        password: decodeURIComponent(match[2]),
        host: match[3],
        port: match[4] ? parseInt(match[4], 10) : 3306,
        database: match[5]
      };
    }
  }

  return { host, port, user, password, database };
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
}

async function seed() {
  const config = getMySQLConfig();
  console.log(`Connecting to MySQL database server at ${config.host}:${config.port} as user '${config.user}'...`);

  let connection;
  try {
    // 1. First ensure the database exists
    const rootConn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password
    });
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();

    // 2. Connect to the target database
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database
    });
    console.log(`Connected to database '${config.database}' successfully.`);
  } catch (err) {
    console.error(`Could not connect to MySQL server at ${config.host}:${config.port}: ${err.message}`);
    console.error('Please verify MySQL is running and root password is correct.');
    process.exit(1);
  }

  try {
    console.log('Creating database schema tables if not exist...');

    // 1. system_settings
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`system_settings\` (
        \`setting_key\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`setting_value\` TEXT NOT NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. users
    await connection.query(`
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
    `);

    // 3. gate_entries
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`gate_entries\` (
        \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
        \`code\` VARCHAR(32) NOT NULL UNIQUE,
        \`dir\` ENUM('IN', 'OUT') NOT NULL,
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
        INDEX \`idx_code\` (\`code\`),
        INDEX \`idx_party\` (\`party\`),
        INDEX \`idx_vehicle\` (\`vehicle_no\`),
        INDEX \`idx_created_at\` (\`created_at\`),
        INDEX \`idx_dir_stage\` (\`dir\`, \`stage\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. entry_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`entry_items\` (
        \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
        \`entry_id\` VARCHAR(36) NOT NULL,
        \`item_desc\` VARCHAR(255) NOT NULL,
        \`quantity\` DECIMAL(12,3) NOT NULL,
        \`unit\` VARCHAR(40) NOT NULL,
        CONSTRAINT \`fk_entry_items_entry\` FOREIGN KEY (\`entry_id\`) REFERENCES \`gate_entries\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. entry_corrections
    await connection.query(`
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
        CONSTRAINT \`fk_entry_corrections_entry\` FOREIGN KEY (\`entry_id\`) REFERENCES \`gate_entries\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. entry_photos
    await connection.query(`
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
    `);

    // 7. audit_trail
    await connection.query(`
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
    await connection.query(`
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
    `);

    // Seed Admin User
    const adminLogin = process.env.ADMIN_USER || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = 'Operations Manager';
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminHash = hashPassword(adminPassword, adminSalt);

    const [existingUsers] = await connection.query('SELECT id, login FROM `users` WHERE `login` = ?', [adminLogin]);

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      console.log(`Updating existing admin user '${adminLogin}' password in MySQL...`);
      await connection.query(
        'UPDATE `users` SET `salt` = ?, `password_hash` = ?, `active` = 1, `failed_attempts` = 0 WHERE `login` = ?',
        [adminSalt, adminHash, adminLogin]
      );
    } else {
      console.log(`Inserting new admin user '${adminLogin}' into MySQL...`);
      await connection.query(
        'INSERT INTO `users` (`id`, `name`, `login`, `role`, `gate`, `salt`, `password_hash`, `active`, `must_change`, `failed_attempts`) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0)',
        ['usr-admin-1', adminName, adminLogin, 'admin', 'Main Gate', adminSalt, adminHash]
      );
    }

    console.log(`✅ Admin user successfully seeded!`);
    console.log(`   Username: ${adminLogin}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role: admin`);
    console.log(`   Database: MySQL (${config.user}@${config.host}:${config.port}/${config.database})`);
  } catch (err) {
    console.error('Error during MySQL database seeding:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seed();
