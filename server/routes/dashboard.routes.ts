import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { requireMySQL } from '../middleware/mysql.middleware.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireMySQL, DashboardController.getStats);
