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
import { UsersController } from '../controllers/users.controller.js';
import { SettingsController } from '../controllers/settings.controller.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { isMySQLConnected } from '../mysqlClient.js';
import { errorHandler } from '../middleware/error.middleware.js';

export const apiRouter = Router();

// ---- PUBLIC (needed before login) ----
apiRouter.use('/auth', authRouter);                               // login / refresh (logout, me use requireAuth inside)
apiRouter.get('/users/locations', UsersController.getLocations);  // only if your login screen needs it
apiRouter.get('/settings', SettingsController.get);               // app name / logo on the login page

// ---- EVERYTHING BELOW NEEDS A VALID SESSION ----
apiRouter.use(requireAuth);

apiRouter.use('/entries', entriesRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/upload', uploadRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/settings', settingsRouter);                       // PUT/POST are admin-only inside
apiRouter.use('/audit', auditRouter);

// DB status: the header polls this for every user. Admins get details, everyone else only connected true/false.
apiRouter.get('/db-status', (req, res) => {
  if ((req as AuthenticatedRequest).user?.role === 'admin') return MySQLController.getDbStatus(req, res);
  res.json({ connected: isMySQLConnected() });
});

// ---- ADMIN ONLY ----
apiRouter.use('/mysql', requireRole(['admin']), mysqlRouter);
apiRouter.post('/db-reconnect', requireRole(['admin']), MySQLController.reconnectDb);

apiRouter.use(errorHandler);
