/**
 * Helper to process, downscale and optimize images captured from mobile devices or webcams.
 * Mobile cameras frequently produce 10MB-25MB photos. This utility resizes them
 * to crisp full-HD resolution (max 1600px) and compresses to ~150-250KB JPEG in milliseconds,
 * making mobile uploads instantaneous and saving disk & network bandwidth.
 */
export async function optimizeMobileImage(
  file: File | Blob,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.82
): Promise<{ dataUrl: string; mime: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Maintain aspect ratio while bounding within maxWidth/maxHeight
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback if canvas context fails
          return resolve({
            dataUrl: e.target?.result as string,
            mime: (file as File).type || 'image/jpeg',
            size: (file as File).size || 0,
          });
        }

        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);

        const mime = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, quality);

        // Calculate approximate byte size from base64
        const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const size = Math.round((base64Len * 3) / 4);

        resolve({ dataUrl, mime, size });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an image (file, blob, or base64) directly to the server's public directory.
 * Returns the permanent public web URL (e.g. /uploads/photos/photo_123.jpg).
 */
export async function uploadImageToServer(
  dataUrlOrFile: string | File,
  folder: 'photos' | 'logo' = 'photos',
  prefix: string = 'img'
): Promise<string> {
  let dataUrl = '';

  if (typeof dataUrlOrFile === 'string') {
    if (dataUrlOrFile.startsWith('/uploads/') || dataUrlOrFile.startsWith('http')) {
      return dataUrlOrFile;
    }
    dataUrl = dataUrlOrFile;
  } else {
    const optimized = await optimizeMobileImage(dataUrlOrFile);
    dataUrl = optimized.dataUrl;
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, folder, prefix }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload image to server');
  }

  const data = await res.json();
  return data.url;
}
