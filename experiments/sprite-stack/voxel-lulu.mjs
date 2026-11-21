// Voxel Lulu from round parts. x: left-right 0..47, y: back-front -24..23 (front positive), row: 0 top .. 47 bottom.
import fs from 'node:fs';
const [frontTxt, outTxt, nAngles = '8'] = process.argv.slice(2);
const fl = fs.readFileSync(frontTxt, 'utf8').trimEnd().split('\n');
const PAL = fl.filter(l => l.includes('='));
const F = fl.filter(l => !l.includes('='));
const N = 48, Y0 = -24;
// parts: ellipsoids [name, cx, cy, crow, rx, ry, rrow]
const parts = [
  ['head', 23.5, 2.5, 18, 15.2, 13.5, 9.8],
  ['body', 23.5, 0, 37, 11.5, 8, 9],
  ['arm', 10.5, 0.5, 35.5, 5, 3, 2.8], ['arm', 36.5, 0.5, 35.5, 5, 3, 2.8],
  ['leg', 16, 0.5, 43, 5, 4.5, 3], ['leg', 31, 0.5, 43, 5, 4.5, 3],
];
// tail: chain of flattened balls curling up behind the body
for (let t = 0; t <= 1.001; t += 0.05) { const a = t * 1.9; parts.push(['tail', 23.5, -7 - 9 * Math.sin(a * 0.9) - 2 * t, 41 - 9 * (1 - Math.cos(a)) * 0.75, 2.6 - 1.2 * t, 5 - 3.2 * t, 5 - 3.2 * t]); }
const vox = new Map(); const key = (x, y, r) => (x * 64 + (y - Y0)) * 64 + r;
for (let x = 0; x < N; x++) for (let y = Y0; y < 24; y++) for (let r = 0; r < N; r++) {
  let best = null, bf = 1;
  for (const p of parts) { const dx = (x - p[1]) / p[4], dy = (y - p[2]) / p[5], dr = (r - p[3]) / p[6], f = dx * dx + dy * dy + dr * dr; if (f < bf) { bf = f; best = p; } }
  if (!best) continue;
  const n = [(x - best[1]) / best[4] ** 2, (y - best[2]) / best[5] ** 2, -(r - best[3]) / best[6] ** 2], l = Math.hypot(...n) || 1;
  vox.set(key(x, y, r), { c: 'b', n: n.map(v => v / l), part: best[0] });
}
// gills: take the petals from the front drawing, as a 3-deep slab leaning backward as it goes outward
for (let r = 0; r < N; r++) for (let x = 0; x < N; x++) { const c = F[r][x]; if (!'gGpD'.includes(c)) continue;
  const out = Math.max(0, Math.abs(x - 23.5) - 13), yc = Math.round(-1 - 0.45 * out);
  for (let y = yc - 1; y <= yc + 1; y++) vox.set(key(x, y, r), { c: c === 'p' ? 'g' : c === 'D' ? 'G' : c, n: [Math.sign(x - 23.5) * 0.3, y - yc, 0.6], part: 'gill' }); }
// face: paint eyes, mouth, freckles and dimples from the front drawing onto the frontmost head voxels
for (let r = 9; r <= 27; r++) for (let x = 9; x <= 38; x++) { const c = F[r][x];
  const feature = 'ew'.includes(c) || (c === 'o' && r >= 22 && r <= 25 && x >= 13 && x <= 34) || (c === 's' && (r <= 14 || r === 22 || r === 23) && x > 11 && x < 36);
  if (!feature) continue;
  for (let y = 23; y >= Y0; y--) { const v = vox.get(key(x, y, r)); if (v && v.part === 'head') { v.c = c; for (const d of (r < 15 ? [] : [1, 2, 3])) { const v2 = vox.get(key(x, y - d, r)); if (v2 && v2.part === "head") v2.c = c; } break; } } }
// render one angle as a letter grid
const CW = 64, CH = 76, cx = 31.5, base = 58;
const Ls = (() => { const v = [-0.45, 0.45, 0.77], n = Math.hypot(...v); return v.map(q => q / n); })();
const frame = th => { const g = Array.from({ length: CH }, () => Array(CW).fill('.')); const cs = Math.cos(th), sn = Math.sin(th);
  for (let r = N - 1; r >= 0; r--) { const h = 45 - r;
    for (let sy = 0; sy < CH; sy++) for (let sx = 0; sx < CW; sx++) {
      const u = sx - cx, v = (sy - base + h) / 0.5, x = Math.round(23.5 + u * cs + v * sn), y = Math.round(-u * sn + v * cs);
      if (x < 0 || x >= N || y < Y0 || y > 23) continue; const q = vox.get(key(x, y, r)); if (!q) continue;
      let c = q.c;
      const nu = q.n[0] * cs - q.n[1] * sn, nv = q.n[0] * sn + q.n[1] * cs, i = nu * Ls[0] + nv * Ls[1] + q.n[2] * Ls[2];
      if (c === 'b') c = i > 0.9 ? 'h' : i > 0.45 ? 'b' : i > 0.05 ? 'm' : 's';
      else if (c === 'g') c = i > 0.75 ? 'p' : 'g'; else if (c === 'G') c = i < 0.2 ? 'D' : 'G';
      g[sy][sx] = c; } }
  const o = g.map(row => row.slice());
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (g[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + b] && g[y + b][x + a] && g[y + b][x + a] !== '.')) o[y][x] = 'o';
  return o.map(row => row.join('')); };
const n = +nAngles, frames = Array.from({ length: n }, (_, i) => frame(i * 2 * Math.PI / n));
const rows = Array.from({ length: CH }, (_, y) => frames.map(f => f[y]).join(''));
fs.writeFileSync(outTxt, PAL.join('\n') + '\n' + rows.join('\n') + '\n');
console.log('voxels', vox.size);
