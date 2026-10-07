import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

export const settingsRouter = Router();

settingsRouter.get('/', SettingsController.get);
settingsRouter.put('/', requireAuth, requireRole(['admin']), SettingsController.update);
settingsRouter.post('/', requireAuth, requireRole(['admin']), SettingsController.update);
