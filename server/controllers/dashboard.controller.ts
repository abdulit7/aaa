import { Request, Response } from 'express';
import { db } from '../db.js';

export class DashboardController {
  public static async getStats(_req: Request, res: Response) {
    try {
      const stats = await db.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to compute dashboard stats' });
    }
  }
}
