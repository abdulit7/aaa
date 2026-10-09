import { Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { effectiveLocation } from '../utils/scope.js';

// Only notifications targeted at the user's own location (admins may pick one, or see all).
function forUser(req: AuthenticatedRequest, unreadOnly: boolean) {
  const loc = effectiveLocation(req.user!, req.query.location as string);
  const all = db.getNotifications(undefined as any, unreadOnly);
  if (!loc) return all;
  const l = loc.toLowerCase().trim();
  return all.filter(n => {
    const t = (n.target_location || '').toLowerCase().trim();
    return t === l || t === 'all';
  });
}

export class NotificationsController {
  static list(req: AuthenticatedRequest, res: Response) {
    res.json(forUser(req, req.query.unread === 'true'));
  }

  static getUnreadCount(req: AuthenticatedRequest, res: Response) {
    res.json({ count: forUser(req, true).length });
  }

  static markRead(req: AuthenticatedRequest, res: Response) {
    const mine = forUser(req, false).some(n => n.id === req.params.id);
    if (!mine) return res.status(403).json({ success: false, error: 'Not your notification' });
    res.json({ success: db.markNotificationRead(req.params.id) });
  }

  static markAllRead(req: AuthenticatedRequest, res: Response) {
    const ids = forUser(req, true).map(n => n.id);
    ids.forEach(id => db.markNotificationRead(id));
    res.json({ success: true, count: ids.length });
  }
}
