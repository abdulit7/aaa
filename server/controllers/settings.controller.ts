import { Request, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { saveBase64Image } from '../utils/fileStorage.js';

export class SettingsController {
  public static get(_req: Request, res: Response) {
    res.json(db.getSettings());
  }

  public static async update(req: AuthenticatedRequest, res: Response) {
    const payload = { ...req.body };

    // If logo is uploaded as base64, save to public/uploads/logo/ and store only the web path
    if (payload.logo_url && typeof payload.logo_url === 'string' && payload.logo_url.startsWith('data:image/')) {
      const publicUrl = saveBase64Image(payload.logo_url, 'logo', 'logo');
      if (publicUrl) {
        payload.logo_url = publicUrl;
      }
    }

    const updated = await db.updateSettings(payload);
    if (req.user) {
      db.addAudit(req.user.id, req.user.name, 'SETTINGS_UPDATED', null, payload);
    }
    res.json(updated);
  }
}
