import { Request, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class DashboardController {
  public static async getStats(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const q = req.query.location as string | undefined;
      // Non-admins always see their own branch; admins may pick one or see all.
      const location = user && user.role !== 'admin'
        ? user.location
        : (q && q !== 'ALL' ? q : undefined);
      const stats = await db.getStats(location);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to compute dashboard stats' });
    }
  }
}
