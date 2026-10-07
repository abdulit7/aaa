import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { entriesRouter } from './entries.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { usersRouter } from './users.routes.js';
import { settingsRouter } from './settings.routes.js';
import { auditRouter } from './audit.routes.js';
import { mysqlRouter } from './mysql.routes.js';
import { uploadRouter } from './upload.routes.js';
import { notificationsRouter } from './notifications.routes.js';
import { MySQLController } from '../controllers/mysql.controller.js';
import { errorHandler } from '../middleware/error.middleware.js';

export const apiRouter = Router();

// Modular REST Sub-Routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/entries', entriesRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/mysql', mysqlRouter);
apiRouter.use('/upload', uploadRouter);
apiRouter.use('/notifications', notificationsRouter);

// Database Health & Reconnect Direct Aliases for Client Compatibility
apiRouter.get('/db-status', MySQLController.getDbStatus);
apiRouter.post('/db-reconnect', MySQLController.reconnectDb);

// Global REST Error Handler
apiRouter.use(errorHandler);
