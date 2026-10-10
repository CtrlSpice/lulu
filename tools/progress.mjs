// Progress sheet: every step on one background, mixed 64 px and 32 px art scaled to the same tile size.
// node progress.mjs out.png bg cols grid1 grid2 ...
import fs from 'node:fs'; import zlib from 'node:zlib';
const [, , out, bgArg, colsArg, ...srcs] = process.argv;
const cols = +colsArg, T = 192, gap = 12;
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const bg = hex(bgArg);
const load = f => { const p = {}, rows = []; for (const l of fs.readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^(\S)=(#[0-9a-fA-F]{6})$/); if (m) p[m[1]] = m[2]; else if (l.length) rows.push(l); } return { p, rows }; };
const grids = srcs.map(load);
const nRows = Math.ceil(grids.length / cols);
const W = cols * T + (cols + 1) * gap, H = nRows * T + (nRows + 1) * gap;
const px = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { px[i * 4] = bg[0]; px[i * 4 + 1] = bg[1]; px[i * 4 + 2] = bg[2]; px[i * 4 + 3] = 255; }
grids.forEach(({ p, rows }, t) => {
  const n = rows[0].length, s = T / n;
  const ox = gap + (t % cols) * (T + gap), oy = gap + Math.floor(t / cols) * (T + gap);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const ch = rows[Math.floor(y / s)]?.[Math.floor(x / s)] ?? '.';
    if (ch === '.') continue;
    const [r, g, b] = hex(p[ch]); const o = ((oy + y) * W + ox + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b;
  }
});
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const tb = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const v of b) c = tb[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(out, W + 'x' + H, grids.length + ' steps');
