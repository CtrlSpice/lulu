// 3D Lulu sculpted from the 48 px front and back drawings.
// Width at every height comes from the front drawing. Depth is sculpted here (round head, soft muzzle, round belly).
// The tail sticks straight out of the lower back. x: 0..47 as in the front drawing; y: back -24 .. front 23; r: row, 0 top.
import fs from 'node:fs';
const [dir, outTxt, nAngles = '8'] = process.argv.slice(2);
const load = n => { const l = fs.readFileSync(`${dir}/${n}.txt`, 'utf8').trimEnd().split('\n'); return { pal: l.filter(x => x.includes('=')), g: l.filter(x => !x.includes('=')) }; };
const FR = load('front'), BK = load('back');
const N = 48, GILL = 'gGpD', SKIN = 'bsmhdwe';
const at = (g, x, r) => (g[r] && g[r][x]) || '.';
const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const isSkin = (g, x, r) => { const c = at(g, x, r); return SKIN.includes(c) || (c === 'o' && n4.some(([a, b]) => SKIN.includes(at(g, x + a, r + b)))); };
const edge = (g, x, r) => at(g, x, r) === 'o' && n4.some(([a, b]) => at(g, x + a, r + b) === '.' || GILL.includes(at(g, x + a, r + b)));
const spans = test => { const out = []; let s = -1; for (let i = 0; i <= N; i++) { const on = i < N && test(i); if (on && s < 0) s = i; if (!on && s >= 0) { out.push([s, i - 1]); s = -1; } } return out; };
const vox = new Map(), key = (x, y, r) => (x * 64 + (y + 24)) * 64 + r;
const has = (x, y, r) => y >= -24 && y <= 23 && x >= 0 && x < N && vox.has(key(x, y, r));
// one rounded cross-section: x from x0..x1, depth from yb (back) to yf (front), widest at yc
const section = (r, x0, x1, yb, yc, yf, part, P = 2.3) => { const cx = (x0 + x1) / 2, rx = (x1 - x0 + 1) / 2;
  for (let x = x0; x <= x1; x++) for (let y = Math.floor(yb); y <= Math.ceil(yf); y++) { const ry = y >= yc ? yf - yc + 0.5 : yc - yb + 0.5;
    if (Math.abs((x - cx) / rx) ** P + Math.abs((y - yc) / ry) ** P <= 1) vox.set(key(x, y, r), { part }); } };
const bump = (r, mid, w) => Math.exp(-(((r - mid) / w) ** 2));
for (let r = 0; r < N; r++) { const fx = spans(x => isSkin(FR.g, x, r)); if (!fx.length) continue;
  if (r <= 28) { // head: near-round dome, a little deeper at the back, soft muzzle low on the front
    // side profile: the front is fullest low down (rounded snout at eye-to-mouth height), the chin tucks back a little, the back is a plain round
    const se = (d, span, p) => Math.max(0, 1 - Math.abs(d / span) ** p) ** (1 / p);
    const yf = 1 + 13 * (r <= 21 ? se(21 - r, 12.6, 2.2) : se(r - 21, 9, 2.4));
    const yb = 1 - 11.5 * (r <= 17 ? se(17 - r, 8.6, 2) : se(r - 17, 12.2, 2));
    section(r, fx[0][0], fx[fx.length - 1][1], yb, 2, yf, 'head', 2.2);
  } else if (r <= 42) { // trunk and arms
    const [a, b] = [fx[0][0], fx[fx.length - 1][1]], t = (r - 29) / 13, half = Math.min((b - a + 1) / 2, 10 + 3 * Math.sin(Math.PI * Math.min(1, t * 1.15) / 2));
    const d = 6 + 2.6 * Math.sin(Math.PI * Math.min(1, t + 0.15));
    section(r, Math.ceil(23.5 - half), Math.floor(23.5 + half), 0.5 - d, 0.5, 1 + d + 1.2 * bump(r, 38, 4), 'body');
    if (23.5 - half - a >= 2) { section(r, a, Math.ceil(23.5 - half) + 1, -1.5, 1, 3.5, 'arm'); section(r, Math.floor(23.5 + half) - 1, b, -1.5, 1, 3.5, 'arm'); }
  } else for (const [a, b] of fx) section(r, a, b, -5.5, 0.5, 6.5, 'leg');
}
// tail: straight out of the lower back, tapering, lifting slightly
for (let y = -6; y >= -21; y--) { const t = (-6 - y) / 15, cr = 39.5 - 2.5 * t, hw = 3.4 * (1 - t) + 1, hh = 4.2 * (1 - t) + 1.2;
  for (let x = 16; x <= 31; x++) for (let r = 28; r <= 46; r++) if (((x - 23.5) / hw) ** 2 + ((r - cr) / hh) ** 2 <= 1 && !vox.has(key(x, y, r))) vox.set(key(x, y, r), { part: 'tail' }); }
// gills: petals from the front drawing, leaning back as they go outward
for (let r = 0; r < N; r++) for (let x = 0; x < N; x++) { const c = at(FR.g, x, r); if (!GILL.includes(c)) continue;
  const out = Math.max(0, Math.abs(x - 23.5) - 12), yc = Math.round(0 - 0.55 * out);
  for (let y = yc - 1; y <= yc + 1; y++) if (!vox.has(key(x, y, r))) vox.set(key(x, y, r), { part: 'gill', c: c === 'p' ? 'g' : c === 'D' ? 'G' : c }); }
// marks: eyes, mouth, freckles, dimples from the front drawing; freckles from the back drawing
const frontMark = (x, r) => { const c = at(FR.g, x, r); if (c === 'e' || c === 'w') return c; if (c === 'o' && r >= 21 && r <= 26 && !edge(FR.g, x, r)) return 'o';
  return null; };
const backMark = () => null;   // freckles and dimples are left off until the shape is right
for (const [k, v] of vox) { if (v.part === 'gill') continue; const r = k % 64, y = Math.floor(k / 64) % 64 - 24, x = Math.floor(k / 4096); v.c = 'b';
  if (v.part !== 'head') continue; const near = s => [1, 2, 3, 4, 5].some(d => !has(x, y + s * d, r));
  if (y > 1 && near(1)) v.c = frontMark(x, r) || 'b'; else if (y < 1 && near(-1)) v.c = backMark(47 - x, r) || 'b'; }
// normals from the shape, so the light stays put while she turns
for (const [k, v] of vox) { const r = k % 64, y = Math.floor(k / 64) % 64 - 24, x = Math.floor(k / 4096); const n = [0, 0, 0];
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) if (!has(x + a, y + b, r + c)) { n[0] += a; n[1] += b; n[2] -= c; }
  const l = Math.hypot(...n) || 1; v.n = n.map(q => q / l); }
const Ls = (() => { const v = [-0.45, 0.5, 0.74], n = Math.hypot(...v); return v.map(q => q / n); })();
const lit = (q, cs, sn) => { const nu = q.n[0] * cs - q.n[1] * sn, nv = q.n[0] * sn + q.n[1] * cs, i = nu * Ls[0] + nv * Ls[1] + q.n[2] * Ls[2];
  if (q.c === 'b') return i > 0.9 ? 'h' : i > 0.2 ? 'b' : 'm'; if (q.c === 'g') return i > 0.7 ? 'p' : 'g'; return q.c; };
// eye-level render with outlines around the figure and between parts
const CW = 64, CH = 56, cx = 31.5, base = 50;
const frame = th => { const g = Array.from({ length: CH }, () => Array(CW).fill('.')), D = Array.from({ length: CH }, () => Array(CW).fill(-99)), PT = Array.from({ length: CH }, () => Array(CW).fill(''));
  const cs = Math.cos(th), sn = Math.sin(th);
  for (let r = 0; r < N; r++) { const sy = base - (45 - r);
    for (let sx = 0; sx < CW; sx++) { const u = sx - cx;
      for (let v = 34; v >= -34; v -= 0.5) { const x = Math.round(23.5 + u * cs + v * sn), y = Math.round(-u * sn + v * cs); const q = (x >= 0 && x < N && y >= -24 && y <= 23) && vox.get(key(x, y, r)); if (!q) continue;
        g[sy][sx] = lit(q, cs, sn); D[sy][sx] = v; PT[sy][sx] = q.part; break; } } }
  const o = g.map(row => row.slice());
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { if (g[y][x] === '.') { if (n4.some(([a, b]) => g[y + b] && g[y + b][x + a] && g[y + b][x + a] !== '.')) o[y][x] = 'o'; }
    else if (n4.some(([a, b]) => PT[y + b] && PT[y + b][x + a] && PT[y + b][x + a] !== PT[y][x] && D[y + b][x + a] > D[y][x] + 1.5)) o[y][x] = 'o'; }
  return o.map(row => row.join('')); };
const n = +nAngles, frames = Array.from({ length: n }, (_, i) => frame(i * 2 * Math.PI / n));
fs.writeFileSync(outTxt, FR.pal.join('\n') + '\n' + Array.from({ length: CH }, (_, y) => frames.map(f => f[y]).join('')).join('\n') + '\n');
console.log('voxels', vox.size);
