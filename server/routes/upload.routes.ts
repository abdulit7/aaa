import { Router, Request, Response } from 'express';
import { saveBase64Image } from '../utils/fileStorage.js';

export const uploadRouter = Router();

uploadRouter.post('/', (req: Request, res: Response) => {
  try {
    const { dataUrl, image, folder = 'photos', prefix = 'photo' } = req.body;
    const payload = dataUrl || image;
    if (!payload || typeof payload !== 'string') {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    const publicUrl = saveBase64Image(payload, folder, prefix);
    if (!publicUrl) {
      return res.status(500).json({ success: false, error: 'Failed to save image file' });
    }

    return res.json({ success: true, url: publicUrl });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Upload failed' });
  }
});
