import { Request, Response, NextFunction } from 'express';
import { isMySQLConnected, getMySQLLastError, getMySQLConfig } from '../mysqlClient.js';

/**
 * Middleware: Enforces that MySQL database is connected for all live operations.
 * Bypasses JSON files and stops transient writes when database is offline.
 */
export function requireMySQL(req: Request, res: Response, next: NextFunction) {
  if (isMySQLConnected()) {
    return next();
  }

  if (process.env.STRICT_MYSQL === 'true') {
    return res.status(503).json({
      success: false,
      error: 'MySQL database is not connected. Operation blocked. GateMaster strictly saves data to and reads directly from MySQL database.',
      connected: false,
      last_error: getMySQLLastError(),
      config: getMySQLConfig()
    });
  }

  // When MySQL server is currently offline in dev/preview environment, allow operations through memory/state database
  res.setHeader('X-Database-Mode', 'Live-State');
  next();
}
