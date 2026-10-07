import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { requireMySQL } from '../middleware/mysql.middleware.js';

export const auditRouter = Router();

auditRouter.get('/', requireMySQL, requireAuth, requireRole(['supervisor', 'admin']), AuditController.getLogs);
auditRouter.post('/verify', requireMySQL, requireAuth, requireRole(['supervisor', 'admin']), AuditController.verify);
