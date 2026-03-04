const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcVal = crc32(Buffer.concat([typeBytes, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function makePNG(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter byte + RGB per pixel
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const base = y * (1 + size * 3);
    raw[base] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      // Draw a simple "M" shape or just solid color with rounded feel
      const off = base + 1 + x * 3;

      // Rounded rect mask: darken corners
      const cx = Math.abs(x - size / 2 + 0.5);
      const cy = Math.abs(y - size / 2 + 0.5);
      const corner = size * 0.18;
      const inRounded = !(cx > size / 2 - corner && cy > size / 2 - corner);

      if (inRounded) {
        raw[off]     = r;
        raw[off + 1] = g;
        raw[off + 2] = b;
      } else {
        raw[off]     = 255;
        raw[off + 1] = 255;
        raw[off + 2] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

// MeetFlow brand indigo: #4F46E5 = rgb(79, 70, 229)
const [r, g, b] = [79, 70, 229];

for (const size of [16, 32, 48, 128]) {
  const png = makePNG(size, r, g, b);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`✓ Created icons/icon${size}.png`);
}
