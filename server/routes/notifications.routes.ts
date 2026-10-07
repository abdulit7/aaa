import { Router } from 'express';
import { NotificationsController } from '../controllers/notifications.controller.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', NotificationsController.list);
notificationsRouter.get('/unread-count', NotificationsController.getUnreadCount);
notificationsRouter.post('/:id/read', NotificationsController.markRead);
notificationsRouter.post('/mark-all-read', NotificationsController.markAllRead);
