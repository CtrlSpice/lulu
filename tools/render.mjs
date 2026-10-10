// Render a letter-grid sprite to PNG: node render.mjs grid.txt out.png scale [bg]
// grid.txt: lines "key=#rrggbb" for palette, then the pixel rows. '.' is transparent.
import fs from 'node:fs';
import zlib from 'node:zlib';

const [, , src, out, scaleArg = '16', bgArg = '#26233a'] = process.argv;
const scale = +scaleArg;
const lines = fs.readFileSync(src, 'utf8').split('\n').filter(l => l.length && !l.startsWith('#'));
const palette = {};
const rows = [];
for (const l of lines) {
  const m = l.match(/^(\S)=(#[0-9a-fA-F]{6})$/);
  if (m) palette[m[1]] = m[2]; else rows.push(l);
}
const w = rows[0].length, h = rows.length;
rows.forEach((r, i) => { if (r.length !== w) throw new Error(`row ${i} has ${r.length} columns, expected ${w}`); });
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const bg = bgArg === 'none' ? null : hex(bgArg);

const W = w * scale, H = h * scale;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const ch = rows[Math.floor(y / scale)][Math.floor(x / scale)];
    const o = y * (W * 4 + 1) + 1 + x * 4;
    if (ch === '.') {
      if (bg) { raw[o] = bg[0]; raw[o + 1] = bg[1]; raw[o + 2] = bg[2]; raw[o + 3] = 255; }
      continue;
    }
    if (!palette[ch]) throw new Error(`unknown letter ${ch}`);
    const [r, g, b] = hex(palette[ch]);
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
fs.writeFileSync(out, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log(`${out}: ${w}x${h} at ${scale}x`);
