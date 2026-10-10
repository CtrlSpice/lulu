// Lulu views on several backgrounds, each row once plain and once with a pixel grid.
// node sheet-grid.mjs out.png scale bg1,bg2,... view1.txt view2.txt ...
import fs from 'node:fs';
import zlib from 'node:zlib';
const [, , out, scaleArg, bgList, ...srcs] = process.argv;
const scale = +scaleArg, bgs = bgList.split(',');
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const load = f => { const p = {}, rows = []; for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) { const m = l.match(/^(\S)=(#[0-9a-fA-F]{6})$/); if (m) p[m[1]] = m[2]; else rows.push(l); } return { p, rows }; };
const views = srcs.map(load);
const N = 32, gap = 8, tile = N * scale;
const tiles = [];
for (const bg of bgs) for (const grid of [false, true]) tiles.push({ bg, grid });
const W = views.length * tile + (views.length + 1) * gap, H = tiles.length * tile + (tiles.length + 1) * gap;
const px = Buffer.alloc(W * H * 4);
const set = (x, y, [r, g, b]) => { const o = (y * W + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255; };
const mix = ([r, g, b], [r2, g2, b2], a) => [r + (r2 - r) * a, g + (g2 - g) * a, b + (b2 - b) * a].map(Math.round);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, [128, 128, 128]);
tiles.forEach(({ bg, grid }, row) => views.forEach(({ p, rows }, col) => {
  const ox = gap + col * (tile + gap), oy = gap + row * (tile + gap);
  const back = hex(bg), light = (back[0] + back[1] + back[2]) / 3 > 128;
  for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
    const ch = rows[Math.floor(y / scale)][Math.floor(x / scale)];
    let c = ch === '.' ? back : hex(p[ch]);
    if (grid && (x % scale === 0 || y % scale === 0)) c = mix(c, light ? [0, 0, 0] : [255, 255, 255], (x % (4 * scale) === 0 || y % (4 * scale) === 0) ? 0.3 : 0.12);
    set(ox + x, oy + y, c);
  }
}));
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const v of b) c = t[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(out, W + 'x' + H);
