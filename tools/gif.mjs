// Animated GIF from sprite grids, no dependencies.
// node tools/gif.mjs out.gif scale delayMs bg grid1.txt grid2.txt ...
// A grid written as file.txt@ms shows for ms instead of delayMs.
import fs from 'node:fs';

const [out, scaleArg, delayArg, bg, ...files] = process.argv.slice(2);
const scale = +scaleArg, delay = Math.round(+delayArg / 10);

const parse = f => {
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
  const pal = Object.fromEntries(lines.filter(l => /^\S=#/.test(l)).map(l => [l[0], l.slice(2)]));
  return { pal, rows: lines.filter(l => !/^\S=#/.test(l)) };
};
const frames = files.map(f => { const [file, ms] = f.split('@'); return { file, cs: ms ? Math.round(+ms / 10) : delay }; });
const grids = frames.map(f => parse(f.file));
const W = grids[0].rows[0].length * scale, H = grids[0].rows.length * scale;

// One global colour table: background first, then every grid colour.
const colours = [bg, ...new Set(grids.flatMap(g => Object.values(g.pal)))];
const bits = Math.max(2, Math.ceil(Math.log2(colours.length)));
const tableSize = 1 << bits;
const table = Buffer.alloc(tableSize * 3);
colours.forEach((c, i) => table.set([1, 3, 5].map(o => parseInt(c.slice(o, o + 2), 16)), i * 3));

const indices = g => {
  const px = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = g.rows[Math.floor(y / scale)][Math.floor(x / scale)];
    px[y * W + x] = c === '.' ? 0 : colours.indexOf(g.pal[c]);
  }
  return px;
};

// LZW with variable code size, packed LSB first into 255-byte sub-blocks.
const lzw = (px, minSize) => {
  const clear = 1 << minSize, end = clear + 1;
  const bytes = [];
  let acc = 0, accBits = 0, size = minSize + 1, next = end + 1;
  let dict = new Map();
  const emit = code => {
    acc |= code << accBits; accBits += size;
    while (accBits >= 8) { bytes.push(acc & 255); acc >>>= 8; accBits -= 8; }
  };
  emit(clear);
  let prefix = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = prefix * 4096 + k;
    if (dict.has(key)) { prefix = dict.get(key); continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << size) && size < 12) size++;
    } else {
      emit(clear); dict = new Map(); size = minSize + 1; next = end + 1;
    }
    prefix = k;
  }
  emit(prefix); emit(end);
  if (accBits > 0) bytes.push(acc & 255);
  const blocks = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  return Buffer.from([minSize, ...blocks, 0]);
};

const u16 = n => [n & 255, n >> 8];
const parts = [
  Buffer.from('GIF89a'),
  Buffer.from([...u16(W), ...u16(H), 0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0]),
  table,
  Buffer.from([0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0]), // loop forever
];
grids.forEach((g, i) => {
  parts.push(Buffer.from([0x21, 0xf9, 4, 0, ...u16(frames[i].cs), 0, 0]));
  parts.push(Buffer.from([0x2c, 0, 0, 0, 0, ...u16(W), ...u16(H), 0]));
  parts.push(lzw(indices(g), bits));
});
parts.push(Buffer.from([0x3b]));
fs.writeFileSync(out, Buffer.concat(parts));
console.log(out, `${W}x${H}`, grids.length, 'frames', colours.length, 'colours');
