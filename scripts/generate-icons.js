import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, isMaskable = false) {
  // RGBA buffer
  const scanlines = Buffer.alloc(height * (1 + width * 4));

  // Colors
  const bgGreen = [0x15, 0x80, 0x3d, 0xff]; // #15803d
  const bgDark = [0x14, 0x53, 0x2d, 0xff];  // #14532d
  const white = [0xff, 0xff, 0xff, 0xff];
  const red = [0xdc, 0x26, 0x26, 0xff];
  const darkGray = [0x1e, 0x29, 0x3b, 0xff];
  const blue = [0x1d, 0x4e, 0xd8, 0xff];
  const yellow = [0xfb, 0xbf, 0x24, 0xff];

  const cornerRadius = isMaskable ? 0 : width * 0.21; // Maskable should bleed to edges
  const safeMargin = isMaskable ? width * 0.12 : 0;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      let r = 0, g = 0, b = 0, a = 0;

      // Base gradient: top-left to bottom-right
      const t = (x + y) / (width + height);
      r = Math.round(bgGreen[0] * (1 - t) + bgDark[0] * t);
      g = Math.round(bgGreen[1] * (1 - t) + bgDark[1] * t);
      b = Math.round(bgGreen[2] * (1 - t) + bgDark[2] * t);
      a = 255;

      // Rounded corners for non-maskable icons
      if (!isMaskable) {
        let dx = 0, dy = 0;
        if (x < cornerRadius) dx = cornerRadius - x;
        else if (x > width - cornerRadius) dx = x - (width - cornerRadius);
        if (y < cornerRadius) dy = cornerRadius - y;
        else if (y > height - cornerRadius) dy = y - (height - cornerRadius);

        if (dx > 0 && dy > 0) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > cornerRadius) {
            a = 0; // Transparent outside rounded corner
          }
        }
      }

      if (a > 0) {
        // Draw Shield
        // Normalized coordinates in [0, 1] relative to safe box
        const nx = (x - safeMargin) / (width - 2 * safeMargin);
        const ny = (y - safeMargin) / (height - 2 * safeMargin);

        if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
          const cx = nx - 0.5;
          const cy = ny - 0.48;

          // Outer shield boundary check
          // Top: y from 0.18 to 0.76, x within width that tapers
          if (ny >= 0.18 && ny <= 0.78) {
            let halfW = 0.28;
            if (ny > 0.45) {
              // Taper to point at bottom (cx=0, ny=0.78)
              const taperProg = (ny - 0.45) / (0.78 - 0.45);
              halfW = 0.28 * Math.cos(taperProg * Math.PI * 0.5);
            }
            if (Math.abs(cx) <= halfW) {
              // Inside shield!
              r = white[0]; g = white[1]; b = white[2];

              // Check barrier arm & posts inside shield
              // Gate post left
              if (cx >= -0.16 && cx <= -0.11 && ny >= 0.42 && ny <= 0.65) {
                r = darkGray[0]; g = darkGray[1]; b = darkGray[2];
              }
              // Gate post right
              if (cx >= 0.11 && cx <= 0.16 && ny >= 0.42 && ny <= 0.65) {
                r = darkGray[0]; g = darkGray[1]; b = darkGray[2];
              }
              // Boom pivot
              const pdist = Math.hypot(cx - (-0.135), ny - 0.48);
              if (pdist <= 0.032) {
                if (pdist <= 0.015) {
                  r = yellow[0]; g = yellow[1]; b = yellow[2];
                } else {
                  r = darkGray[0]; g = darkGray[1]; b = darkGray[2];
                }
              }
              // Boom arm (angled slightly up)
              // line: ny - 0.48 = -0.2 * (cx - (-0.135))
              const armY = 0.48 - 0.2 * (cx + 0.135);
              if (cx >= -0.135 && cx <= 0.18 && Math.abs(ny - armY) <= 0.02) {
                // Red & White stripes
                const stripe = Math.floor((cx + ny) * 35) % 2 === 0;
                if (stripe) {
                  r = red[0]; g = red[1]; b = red[2];
                } else {
                  r = white[0]; g = white[1]; b = white[2];
                }
              }

              // Inward Arrow Badge (left green dot)
              if (Math.hypot(cx - (-0.06), ny - 0.32) <= 0.038) {
                r = bgGreen[0]; g = bgGreen[1]; b = bgGreen[2];
              }
              // Outward Arrow Badge (right blue dot)
              if (Math.hypot(cx - 0.06, ny - 0.32) <= 0.038) {
                r = blue[0]; g = blue[1]; b = blue[2];
              }
            }
          }
        }
      }

      scanlines[pxOffset] = r;
      scanlines[pxOffset + 1] = g;
      scanlines[pxOffset + 2] = b;
      scanlines[pxOffset + 3] = a;
    }
  }

  // PNG header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Non-interlaced

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', zlib.deflateSync(scanlines));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

console.log('Generating PWA icons...');
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createPng(180, 180, false));
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), createPng(48, 48, false));
console.log('PWA icons generated successfully in /public');
