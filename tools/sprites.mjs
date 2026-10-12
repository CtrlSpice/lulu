// Sprite sheets from letter grids: one PNG strip per animation (each distinct frame once, 1x, transparent background)
// plus a JSON frame list with the order and time of each frame. Animations are defined in sprites/animations.json.
// node tools/sprites.mjs [animations.json] [out folder]   (defaults: sprites/animations.json, sprites/)
// -> <out folder>/<name>.png and <out folder>/<name>.json
import fs from 'node:fs';
import zlib from 'node:zlib';

const parse = f => {
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
  return { pal: Object.fromEntries(lines.filter(l => /^\S=#/.test(l)).map(l => [l[0], l.slice(2)])), rows: lines.filter(l => !/^\S=#/.test(l)) };
};

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};
// indexed-colour PNG: palette entry 0 is fully transparent, the rest are the grid colours
const png = (grids, colours) => {
  const fw = grids[0].rows[0].length, fh = grids[0].rows.length, W = fw * grids.length;
  const raw = Buffer.alloc((W + 1) * fh);
  for (let y = 0; y < fh; y++) {
    raw[y * (W + 1)] = 0;
    grids.forEach((g, i) => [...g.rows[y]].forEach((ch, x) => { raw[y * (W + 1) + 1 + i * fw + x] = ch === '.' ? 0 : colours.indexOf(g.pal[ch]) + 1; }));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(fh, 4); ihdr[8] = 8; ihdr[9] = 3;
  const plte = Buffer.from([0, 0, 0, ...colours.flatMap(c => [1, 3, 5].map(o => parseInt(c.slice(o, o + 2), 16)))]);
  const trns = Buffer.from([0]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

const [config = 'sprites/animations.json', outDir = 'sprites'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const animations = JSON.parse(fs.readFileSync(config, 'utf8'));
for (const [name, steps] of Object.entries(animations)) {
  const files = [...new Set(steps.map(([f]) => f))];
  const grids = files.map(parse);
  const colours = [...new Set(grids.flatMap(g => g.rows.flatMap(r => [...r].filter(c => c !== '.').map(c => g.pal[c]))))];
  fs.writeFileSync(`${outDir}/${name}.png`, png(grids, colours));
  const sheet = {
    image: `${name}.png`,
    frameWidth: grids[0].rows[0].length,
    frameHeight: grids[0].rows.length,
    frameCount: files.length,
    frames: steps.map(([f, ms]) => ({ frame: files.indexOf(f), ms })),
  };
  fs.writeFileSync(`${outDir}/${name}.json`, JSON.stringify(sheet, null, 2) + '\n');
  console.log(`${outDir}/${name}.png`, `${files.length} frames`, fs.statSync(`${outDir}/${name}.png`).size, 'bytes');
}
