import { Request, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class NotificationsController {
  public static list(req: Request, res: Response) {
    try {
      const location = req.query.location as string;
      const unreadOnly = req.query.unread === 'true';
      const list = db.getNotifications(location, unreadOnly);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list notifications' });
    }
  }

  public static markRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = db.markNotificationRead(id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to mark notification read' });
    }
  }

  public static markAllRead(req: Request, res: Response) {
    try {
      const location = req.query.location as string || req.body.location;
      const success = db.markAllNotificationsRead(location);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to mark all notifications read' });
    }
  }

  public static getUnreadCount(req: Request, res: Response) {
    try {
      const location = req.query.location as string;
      const list = db.getNotifications(location, true);
      res.json({ count: list.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
