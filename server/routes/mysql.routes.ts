import { Router } from 'express';
import { MySQLController } from '../controllers/mysql.controller.js';

export const mysqlRouter = Router();

mysqlRouter.get('/status', MySQLController.getStatus);
mysqlRouter.post('/retry', MySQLController.retry);
mysqlRouter.post('/connect', MySQLController.connect);
mysqlRouter.get('/export-schema', MySQLController.exportSchema);
mysqlRouter.get('/export-dump', MySQLController.exportDump);
