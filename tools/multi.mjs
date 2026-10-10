// Several sprite grids side by side on one background.
// node multi.mjs out.png scale cols bg grid1.txt grid2.txt ...
import fs from 'node:fs';
import zlib from 'node:zlib';

const [, , out, scaleArg, colsArg, bg, ...srcs] = process.argv;
const scale = +scaleArg, cols = +colsArg;
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const load = src => {
  const lines = fs.readFileSync(src, 'utf8').split('\n').filter(l => l.length && !l.startsWith('#'));
  const palette = {}, rows = [];
  for (const l of lines) { const m = l.match(/^(\S)=(#[0-9a-fA-F]{6})$/); if (m) palette[m[1]] = m[2]; else rows.push(l); }
  return { palette, rows };
};
const grids = srcs.map(load);
const w = grids[0].rows[0].length, h = grids[0].rows.length;
const gap = 8, tileW = w * scale, tileH = h * scale;
const nRows = Math.ceil(grids.length / cols);
const W = cols * tileW + (cols + 1) * gap, H = nRows * tileH + (nRows + 1) * gap;
const px = Buffer.alloc(W * H * 4);
const set = (x, y, [r, g, b]) => { const o = (y * W + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, [128, 128, 128]);
grids.forEach(({ palette, rows }, t) => {
  const ox = gap + (t % cols) * (tileW + gap), oy = gap + Math.floor(t / cols) * (tileH + gap);
  for (let y = 0; y < tileH; y++) for (let x = 0; x < tileW; x++) {
    const ch = rows[Math.floor(y / scale)][Math.floor(x / scale)];
    set(ox + x, oy + y, ch === '.' ? hex(bg) : hex(palette[ch]));
  }
});
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${out}: ${grids.length} sprites`);
