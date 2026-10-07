import { Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class AuditController {
  public static getLogs(_req: AuthenticatedRequest, res: Response) {
    const logs = db.getAuditLogs();
    res.json(logs);
  }

  public static verify(req: AuthenticatedRequest, res: Response) {
    const result = db.verifyAuditIntegrity();
    if (req.user) {
      db.addAudit(req.user.id, req.user.name, 'TAMPER_AUDIT_VERIFIED', null, result);
    }
    res.json(result);
  }
}
