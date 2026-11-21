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
const HEADIN = +(process.argv[8] || 2);   // the head is narrowed by this many px on each side; the mouth keeps its full width
const bump = (r, mid, w) => Math.exp(-(((r - mid) / w) ** 2));
const armRows = [];
for (let r = 0; r < N; r++) { const fx = spans(x => isSkin(FR.g, x, r)); if (!fx.length) continue;
  if (r <= 28) { // head: near-round dome, a little deeper at the back, soft muzzle low on the front
    // side profile: the front is fullest low down (rounded snout at eye-to-mouth height), the chin tucks back a little, the back is a plain round
    const se = (d, span, p) => Math.max(0, 1 - Math.abs(d / span) ** p) ** (1 / p);
    const yf = 1 + 13 * (r <= 21 ? se(21 - r, 12.6, 2.2) : se(r - 21, 9, 2.4));
    const yb = 1 - 11.5 * (r <= 17 ? se(17 - r, 8.6, 2) : se(r - 17, 12.2, 2));
    section(r, fx[0][0] + HEADIN, fx[fx.length - 1][1] - HEADIN, yb, 2, yf, 'head', 2.2);
  } else if (r <= 42) { // trunk: as deep as it is chonky right from where the head sits on it, so there is no neck
    const [a, b] = [fx[0][0], fx[fx.length - 1][1]], t = (r - 29) / 13, half = Math.min((b - a + 1) / 2, 8 + 5 * Math.min(1, (r - 29) / 9) ** 0.8);   // the torso alone: the arms are separate limbs
    // back: continues the back of the head and eases out, with no hump. front: a full belly, fullest at row 38
    const sm = Math.min(1, (r - 29) / 9), db = 6 + 3.2 * sm * sm * (3 - 2 * sm), df = 8.5 + 4.8 * bump(r, 38, 5.5);
    section(r, Math.ceil(23.5 - half), Math.floor(23.5 + half), 0.5 - db, 1, 1 + df, 'body');
    armRows.push([r, a, b]);
  } else for (const [a, b] of fx) section(r, a, b, -6, 1, 8, a < 23.5 ? 'legL' : 'legR');   // each leg is its own part so the split between them can be outlined
}
// snout: a broad rounded muzzle on the lower front of the head, carrying the mouth
// arms: short tapered limbs from the shoulder, where head meets body, out and down to the hand, held a little forward of the body's side
const hand = armRows.filter(([r]) => r >= 34 && r <= 37), tipX = Math.min(...hand.map(([, a]) => a)), tipR = (hand[0][0] + hand[hand.length - 1][0]) / 2;
for (const s of [-1, 1]) { const A = [23.5 + s * 7.5, 3, 31], B = [23.5 + s * (23.5 - tipX - 3), 6, tipR + 0.5];
  for (let x = 0; x < N; x++) for (let y = -6; y <= 12; y++) for (let r = 28; r <= 40; r++) { const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [x - A[0], y - A[1], r - A[2]];
    const k = Math.min(1, Math.max(0, (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2))), rad = 3.7 - 0.7 * k;
    if (Math.hypot(w[0] - k * d[0], w[1] - k * d[1], w[2] - k * d[2]) <= rad && !vox.has(key(x, y, r))) vox.set(key(x, y, r), { part: 'arm' }); } }
// two overlapping rounds: a bridge that carries the forehead slope forward, and the snout tip
const SNOUT = (process.argv[5] || '23.5,11,22.5,11,6.5,4.2').split(';').map(s => s.split(',').map(Number));
for (const SN of SNOUT) for (let x = 0; x < N; x++) for (let y = 0; y <= 23; y++) for (let r = 9; r <= 28; r++) if (((x - SN[0]) / SN[3]) ** 2 + ((y - SN[1]) / SN[4]) ** 2 + ((r - SN[2]) / SN[5]) ** 2 <= 1) vox.set(key(x, y, r), { part: 'head' });
// tail: the rounded tail the user chose, straight out of the lower back, with a round tip.
// The base is 1 px wider on each side than the tail was first drawn; the extra width is full where the tail leaves the body and fades out three quarters of the way along.
for (let y = -3; y >= -22; y--) { const t = (-3 - y) / 19, e = Math.sqrt(1 - Math.max(0, (t - 0.8) / 0.2) ** 2), cr = 38.4 - 1.2 * t, hw = (3.4 - 2 * t) * e + 0.3 + Math.min(1, Math.max(0, 1 - (t - 0.3) / 0.45)) ** 2, hh = (3.9 - 2.2 * t) * e + 0.3;
  for (let x = 16; x <= 31; x++) for (let r = 30; r <= 42; r++) if (((x - 23.5) / hw) ** 2 + ((r - cr) / hh) ** 2 <= 1 && !vox.has(key(x, y, r))) vox.set(key(x, y, r), { part: 'tail' }); }
// gills: petals from the front drawing, leaning back as they go outward
for (let r = 0; r < N; r++) for (let sx0 = 0; sx0 < N; sx0++) { const c = at(FR.g, sx0, r); if (!GILL.includes(c)) continue; const x = sx0 < 23.5 ? sx0 + HEADIN : sx0 - HEADIN;   // the gills move in with the head
  // each petal sweeps backward the further it gets from where the gills join the head, so from the side they fan up-back, back and down-back
  const dist = Math.hypot(Math.max(0, Math.abs(x - 23.5) - 13.5 + HEADIN), r - 17), yc = Math.round(-1 - 0.8 * dist);
  for (let y = yc - 1; y <= yc + 1; y++) if (!vox.has(key(x, y, r))) vox.set(key(x, y, r), { part: 'gill', c: c === 'p' ? 'g' : c === 'D' ? 'G' : c }); }
// marks: eyes, mouth, freckles, dimples from the front drawing; freckles from the back drawing
const EYEUP = +(process.argv[6] || 2);
const EYEOUT = +(process.argv[7] || 4);   // each eye is moved this many px outward from where the front drawing has it
const EO = EYEOUT - HEADIN;   // the eyes move in with the head, keeping their distance from its edge
const eyeAt = (x, r) => { const e = at(FR.g, x < 23.5 ? x + EO : x - EO, r + EYEUP); return (e === 'e' || e === 'w') && (x < 23.5) === ((x < 23.5 ? x + EO : x - EO) < 23.5) ? e : null; };
const frontMark = (x, r, depth) => { const c = at(FR.g, x, r); if (c === 'e' || c === 'w') return null; if (c === 'o' && r >= 21 && r <= 26 && !edge(FR.g, x, r)) return depth <= 2 ? 'o' : null;
  if (c === 's' && depth <= 2 && (r === 22 || r === 23) && (x < 16 || x > 31)) return 's';   // dimples. Freckles stay off until the rest is right
  return null; };
const backMark = () => null;   // freckles stay off until the rest is right
for (const [k, v] of vox) { if (v.part === 'gill') continue; const r = k % 64, y = Math.floor(k / 64) % 64 - 24, x = Math.floor(k / 4096); v.c = 'b';
  if (v.part !== 'head') continue; const near = s => [1, 2, 3, 4, 5].some(d => !has(x, y + s * d, r));
  const depth = [1, 2, 3, 4, 5].find(d => !has(x, y + d, r)); if (y > 1 && depth) v.c = frontMark(x, r, depth) || 'b';
  // eyes wrap round the corner of the head: any voxel within 2 of the surface, forward or sideways
  if (y < 1 && near(-1)) v.c = backMark(47 - x, r) || v.c; }
// normals from the shape, so the light stays put while she turns
for (const [k, v] of vox) { const r = k % 64, y = Math.floor(k / 64) % 64 - 24, x = Math.floor(k / 4096); const n = [0, 0, 0];
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) if (!has(x + a, y + b, r + c)) { n[0] += a; n[1] += b; n[2] -= c; }
  const l = Math.hypot(...n) || 1; v.n = n.map(q => q / l); }
const Ls = (() => { const v = [-0.45, 0.5, 0.74], n = Math.hypot(...v); return v.map(q => q / n); })();
const lit = (q, cs, sn) => { const nu = q.n[0] * cs - q.n[1] * sn, nv = q.n[0] * sn + q.n[1] * cs, i = nu * Ls[0] + nv * Ls[1] + q.n[2] * Ls[2];
  if (q.c === 'b') return i > 0.9 ? 'h' : i > 0.2 ? 'b' : 'm'; if (q.c === 'g') return i > 0.7 ? 'p' : 'g'; return q.c; };
// eye-level render with outlines around the figure and between parts
const CW = 64, CH = 56, cx = 31.5, base = 50;
// how much nearer a neighbouring part must be before a line is drawn on the farther one. A leg shares no line with the body or the tail; the two legs share one with each other.
const isLeg = p => p === 'legL' || p === 'legR';
const gapFor = (far, near) => (isLeg(far) && isLeg(near)) ? 1.5 : (isLeg(far) || isLeg(near)) ? 99 : (far === 'body' && near === 'head') ? 2.5 : 1.5;
const EYE = { dx: +(process.argv[11] || 5.5), y: +(process.argv[12] || 7), top: 14, hide: 0.05 };
const frame = th => { const g = Array.from({ length: CH }, () => Array(CW).fill('.')), D = Array.from({ length: CH }, () => Array(CW).fill(-99)), PT = Array.from({ length: CH }, () => Array(CW).fill(''));
  const cs = Math.cos(th), sn = Math.sin(th);
  for (let r = 0; r < N; r++) { const sy = base - (45 - r);
    for (let sx = 0; sx < CW; sx++) { const u = sx - cx;
      for (let v = 34; v >= -34; v -= 0.5) { const x = Math.round(23.5 + u * cs + v * sn), y = Math.round(-u * sn + v * cs); const q = (x >= 0 && x < N && y >= -24 && y <= 23) && vox.get(key(x, y, r)); if (!q) continue;
        g[sy][sx] = lit(q, cs, sn); D[sy][sx] = v; PT[sy][sx] = q.part; break; } } }
  // eyes: placed per angle. Each eye has one anchor point; from the front it lands where the front drawing has the eye,
  // from the side it lands on the side of the head. The eye is 3 px wide facing the camera, 2 px wide when turned away, hidden from behind.
  for (const s of [-1, 1]) { const dx = s * EYE.dx, u = dx * cs - EYE.y * sn, v = dx * sn + EYE.y * cs, f = v / Math.hypot(EYE.dx, EYE.y);
    if (f <= EYE.hide || cs < -0.2) continue; const w = f > 0.5 ? 3 : 2, c0 = Math.round(cx + u), cols = w === 3 ? [c0 - 1, c0, c0 + 1] : (u < 0 ? [c0, c0 + 1] : [c0 - 1, c0]);
    const cells = []; for (let i = 0; i < 5; i++) for (const x of cols) cells.push([x, EYE.top + 5 + i]);
    if (cells.filter(([x, y]) => PT[y] && PT[y][x] === 'head').length < cells.length * 0.8) continue;
    for (const [x, y] of cells) if (PT[y][x] === 'head') g[y][x] = 'e';
    if (PT[EYE.top + 5][cols[0]] === 'head') g[EYE.top + 5][cols[0]] = 'w'; }
  const o = g.map(row => row.slice());
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { if (g[y][x] === '.') { if (n4.some(([a, b]) => g[y + b] && g[y + b][x + a] && g[y + b][x + a] !== '.')) o[y][x] = 'o'; }
    else if (n4.some(([a, b]) => PT[y + b] && PT[y + b][x + a] && PT[y + b][x + a] !== PT[y][x] && D[y + b][x + a] > D[y][x] + gapFor(PT[y][x], PT[y + b][x + a]))) o[y][x] = 'o'; }
  return o.map(row => row.join('')); };
const n = +nAngles, frames = Array.from({ length: n }, (_, i) => frame(i * 2 * Math.PI / n));
fs.writeFileSync(outTxt, FR.pal.join('\n') + '\n' + Array.from({ length: CH }, (_, y) => frames.map(f => f[y]).join('')).join('\n') + '\n');
console.log('voxels', vox.size);
