// Render one sprite grid onto several backgrounds as a contact sheet.
// node sheet.mjs grid.txt out.png scale cols bg1 bg2 ...
// Tiles run left to right, then wrap after `cols` tiles.
import fs from 'node:fs';
import zlib from 'node:zlib';

const [, , src, out, scaleArg, colsArg, ...bgs] = process.argv;
const scale = +scaleArg, cols = +colsArg;
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

const gap = 8, tileW = w * scale, tileH = h * scale;
const nRows = Math.ceil(bgs.length / cols);
const W = cols * tileW + (cols + 1) * gap, H = nRows * tileH + (nRows + 1) * gap;
const px = Buffer.alloc(W * H * 4, 0);
const set = (x, y, [r, g, b]) => { const o = (y * W + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, [128, 128, 128]);
bgs.forEach((bg, t) => {
  const ox = gap + (t % cols) * (tileW + gap), oy = gap + Math.floor(t / cols) * (tileH + gap);
  const bgc = hex(bg);
  for (let y = 0; y < tileH; y++) for (let x = 0; x < tileW; x++) {
    const ch = rows[Math.floor(y / scale)][Math.floor(x / scale)];
    if (ch !== '.' && !palette[ch]) throw new Error(`unknown letter ${ch}`);
    set(ox + x, oy + y, ch === '.' ? bgc : hex(palette[ch]));
  }
});
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
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
ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log(`${out}: ${bgs.length} tiles`);
