import { Request, Response } from 'express';
import { db } from '../db.js';
import {
  isMySQLConnected,
  getMySQLLastError,
  getMySQLConfig,
  reconnectMySQL,
  mysqlGetTableCounts
} from '../mysqlClient.js';
import { generateMySQLSchema, generateMySQLDump } from '../mysqlExport.js';

export class MySQLController {
  public static async getStatus(_req: Request, res: Response) {
    const settings = db.getSettings();
    const connected = isMySQLConnected();
    const counts = await mysqlGetTableCounts();
    const config = getMySQLConfig();

    res.json({
      status: connected ? 'Connected (Live MySQL)' : 'Disconnected (MySQL Offline)',
      connected,
      last_error: getMySQLLastError(),
      save_data_to_json: process.env.SAVE_DATA_TO_JSON === 'true',
      database_url_configured: Boolean(process.env.DATABASE_URL),
      configured_host: config.host,
      configured_port: config.port,
      configured_user: config.user,
      configured_database: config.database,
      tables: [
        { name: 'system_settings', rows: counts['system_settings'] ?? Object.keys(settings).length },
        { name: 'users', rows: counts['users'] ?? db.getUsers().length },
        { name: 'gate_entries', rows: counts['gate_entries'] ?? db.getCachedEntries().length },
        { name: 'entry_items', rows: counts['entry_items'] ?? 0 },
        { name: 'entry_photos', rows: counts['entry_photos'] ?? db.getRawState().photos.length },
        { name: 'audit_trail', rows: counts['audit_trail'] ?? db.getAuditLogs().length }
      ],
      features: [
        'Direct real-time MySQL database read & write operations',
        'JSON file bypassed (no data written to db.json)',
        'Offline caching & IndexedDB completely removed',
        'Instant live entry updates for mobile & desktop',
        'Full DDL schema export & SQL dump downloads'
      ]
    });
  }

  public static async retry(_req: Request, res: Response) {
    try {
      const result = await reconnectMySQL();
      if (result.success) {
        await db.getEntries();
        res.json({ success: true, connected: true, config: result.config });
      } else {
        res.status(503).json({ success: false, connected: false, error: result.error, config: result.config });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, connected: false, error: err.message });
    }
  }

  public static async connect(req: Request, res: Response) {
    const { host, port, user, password, database } = req.body;
    try {
      const result = await reconnectMySQL({ host, port: Number(port), user, password, database });
      if (result.success) {
        await db.updateSettings({
          mysql_host: host,
          mysql_port: Number(port),
          mysql_user: user,
          mysql_database: database
        });
        await db.getEntries();
        res.json({ success: true, connected: true, config: result.config });
      } else {
        res.status(503).json({ success: false, connected: false, error: result.error, config: result.config });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, connected: false, error: err.message });
    }
  }

  public static exportSchema(_req: Request, res: Response) {
    const sql = generateMySQLSchema();
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', 'attachment; filename="gateregister_schema.sql"');
    res.send(sql);
  }

  public static exportDump(_req: Request, res: Response) {
    const state = db.getRawState();
    const sql = generateMySQLDump(state);
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="gateregister_dump_${Date.now()}.sql"`);
    res.send(sql);
  }

  // Frontend Aliases for DB Status Check & Quick Reconnect
  public static async getDbStatus(_req: Request, res: Response) {
    const config = getMySQLConfig();
    res.json({
      connected: isMySQLConnected(),
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      error: getMySQLLastError() || undefined
    });
  }

  public static async reconnectDb(_req: Request, res: Response) {
    const result = await reconnectMySQL();
    const config = getMySQLConfig();
    if (result.success) {
      await db.getEntries();
    }
    res.json({
      connected: isMySQLConnected(),
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      error: result.error || undefined
    });
  }
}
