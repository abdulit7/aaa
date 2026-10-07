import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

/**
 * Ensures that the target upload folder exists inside public/uploads.
 */
export function ensureUploadDir(subfolder: string = ''): string {
  const targetDir = subfolder ? path.join(UPLOADS_DIR, subfolder) : UPLOADS_DIR;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

/**
 * Saves a base64 data URL or raw base64 string as a physical image file inside public/uploads/{subfolder}.
 * Returns the public web URL path (e.g. /uploads/photos/photo_123456.jpg).
 * If the input is already a relative URL (starts with '/uploads/') or external HTTP URL, returns it unchanged.
 */
export function saveBase64Image(dataUrlOrBase64: string, subfolder: string = 'photos', prefix: string = 'img'): string {
  if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') {
    return '';
  }

  const trimmed = dataUrlOrBase64.trim();

  // If already saved or external URL, return directly
  if (trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  try {
    let mimeType = 'image/jpeg';
    let base64Data = trimmed;

    // Check for data URL scheme: data:image/png;base64,...
    const match = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      mimeType = `image/${match[1]}`;
      base64Data = match[2];
    } else if (trimmed.includes(',')) {
      // General data URL pattern
      const parts = trimmed.split(',');
      base64Data = parts[1] || '';
      const headerMatch = parts[0].match(/:(.*?);/);
      if (headerMatch) mimeType = headerMatch[1];
    }

    // Determine clean file extension
    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('svg')) ext = 'svg';
    else if (mimeType.includes('gif')) ext = 'gif';

    const buffer = Buffer.from(base64Data, 'base64');
    if (!buffer || buffer.length === 0) {
      return '';
    }

    const targetDir = ensureUploadDir(subfolder);
    const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, buffer);

    // Return public URL path reachable via browser/mobile
    const publicUrl = subfolder ? `/uploads/${subfolder}/${filename}` : `/uploads/${filename}`;
    return publicUrl;
  } catch (err) {
    console.error('Failed to save base64 image to public directory:', err);
    return dataUrlOrBase64; // fallback to original if disk write fails
  }
}
