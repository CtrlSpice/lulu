// Watercolour axolotl, curled in a C, head lifted to the right. Silhouette traced from the reference
// (spine and widths in widths.json); washes, limbs, gills and face painted on top.
import { readFileSync } from 'node:fs';
import { W, H, N, makePaper, layer, line, dot, lift, save, useInk, fbm, blur } from './paint.mjs';
import { hexToLab, anchored } from './match.mjs';
import * as P from './paint.mjs';
const out = process.argv[2] ?? 'curl.png';
makePaper();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (c, w, x) => Math.exp(-(((x - c) / w) ** 2));
const K = 1.75, M = ([x, y]) => [500 + (x - 302) * K, 350 + (y - 318) * K];

// ---- body field from the traced spine ----
let rows = JSON.parse(readFileSync(new URL('./widths.json', import.meta.url), 'utf8'));
rows = rows.map((r, i) => i >= 13 && i <= 27 ? [r[0], r[1], Math.min(r[2], 36 + (i - 13) * -0.3), r[3]] : r); // far gills are not head
const smooth = (k) => rows.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 6); j <= Math.min(rows.length - 1, i + 6); j++) { s += rows[j][k]; n++; } return s / n; });
const wo = smooth(2).map(v => v * K), wi = smooth(3).map(v => v * K), sp = rows.map(r => M(r)), n = sp.length;
// round snout: a disc on the head end, as wide as the head is there
const [hx, hy] = sp[0], htl = Math.hypot(sp[1][0] - hx, sp[1][1] - hy), hnx = -(sp[1][1] - hy) / htl, hny = (sp[1][0] - hx) / htl;
const snout = { x: hx + hnx * (wo[0] - wi[0]) / 2, y: hy + hny * (wo[0] - wi[0]) / 2, r: (wo[0] + wi[0]) / 2 };
const T = new Float32Array(N).fill(-1), V = new Float32Array(N), A = new Float32Array(N), Dn = new Float32Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let best = 1e9, bi = 0, bu = 0;
  for (let i = 0; i < n - 1; i++) {
    const [ax, ay] = sp[i], [bx, by] = sp[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let u = ((x - ax) * dx + (y - ay) * dy) / L2; u = Math.max(0, Math.min(i === n - 2 ? 1.8 : 1, u));
    const d = Math.hypot(x - ax - dx * u, y - ay - dy * u); if (d < best) { best = d; bi = i; bu = u; }
  }
  const [ax, ay] = sp[bi], [bx, by] = sp[bi + 1], tl = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / tl, ty = (by - ay) / tl, nx = -ty, ny = tx;
  const o = (x - ax - (bx - ax) * bu) * nx + (y - ay - (by - ay) * bu) * ny;
  const uu = Math.max(0, Math.min(1, bu)), Wo = wo[bi] + (wo[bi + 1] - wo[bi]) * uu, Wi = wi[bi] + (wi[bi + 1] - wi[bi]) * uu;
  // ends: snout rounds off ahead of the first point, tail tapers to a point past the last
  const over = bu < 0 ? -bu * tl : bu > 1 ? (bu - 1) * tl : 0, shrink = bu < 0 ? Math.sqrt(Math.max(0, 1 - (over / 14) ** 2)) : bu > 1 ? Math.max(0, 1 - over / 26) : 1;
  const ahead = bi === 0 && ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) < 0;
  const d = ahead ? snout.r - Math.hypot(x - snout.x, y - snout.y) : (o > 0 ? Wo : Wi) * shrink - best, i = y * W + x;
  if (d > -2) { T[i] = (bi + bu) / (n - 1); V[i] = (Wo - o) / (Wo + Wi); A[i] = Math.min(1, Math.max(0, d / 1.6 + 0.4)); Dn[i] = d; }
}
// ---- tail end, traced from the annotated screenshot: top edge of the up-sweep, fin line, bottom edge ----
// y at x along a smooth curve through points with increasing x
const curveY = pts => { const c = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; for (let k = 0; k < 20; k++) { const t = k / 20, f = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3); c.push([f(0), f(1)]); } } c.push(pts[pts.length - 1]); return x => { if (x <= c[0][0]) return c[0][1]; for (let i = 1; i < c.length; i++) if (x <= c[i][0]) return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * (x - c[i - 1][0]) / (c[i][0] - c[i - 1][0] || 1); return c[c.length - 1][1]; }; };
const TIP = [525, 489];
const tailTop = curveY([[377, 573], [445, 576], [472, 549], [512, 509], TIP]);
const finLine = [[205, 543], [299, 596], [365, 613], [412, 603], [459, 576], [505, 529], TIP], finY = curveY(finLine);
const tailBot = curveY([[282, 639], [385, 646], [445, 629], [492, 589], TIP]);
const FIN = new Float32Array(N);
for (let y = 440; y < 680; y++) for (let x = 180; x <= TIP[0]; x++) {
  const i = y * W + x, top = tailTop(x), bot = tailBot(x);
  if (x >= 377) {
    // past x 377 the tail lies between the top edge and the bottom edge
    const d = Math.min(y - top, bot - y);
    if (d < -1.5) { if (y > top - 40) { A[i] = 0; T[i] = -1; } continue; }
    if (!A[i]) { T[i] = 0.97; V[i] = 0.5; }
    A[i] = Math.max(A[i], Math.min(1, Math.max(0, d / 1.6 + 0.4)));
  } else if (x >= 282 && y > finY(x) && y <= bot + 1.5 && !A[i]) { T[i] = 0.95; V[i] = 0.1; A[i] = Math.min(1, Math.max(0, (bot - y) / 1.6 + 0.4)); }
  // the fin: everything below the fin line, coming in gradually from where the line starts
  if (A[i] && y > finY(x)) FIN[i] = sm(205, 260, x) * Math.min(1, (y - finY(x)) / 2);
}
const inside = Float32Array.from(A), clip = blur(A, 1);

// ---- 1. base wash: Lulu pink over the whole animal, wet, darker where it dried at the edge ----
useInk('body');
const base = layer();
for (let i = 0; i < N; i++) if (A[i]) { const t = T[i], v = V[i]; base.D[i] = A[i] * (0.22 + 0.12 * sm(0.4, 1, v) + 0.1 * bump(0.2, 0.25, t) - 0.12 * sm(0.75, 1, t) * sm(0.3, 0, v)); }
for (let i = 0; i < N; i++) if (FIN[i]) base.D[i] *= 1 - 0.45 * FIN[i];
base.dry({ bleed: 6, cloud: 0.45, feather: 0.6, ring: 0.6, soften: 2, grain: 0.15, clip });

// ---- 2. wine, middle wash: dropped into the wet base along the back and under the throat ----
useInk('wine');
const backStrength = t => 0.25 + 0.75 * sm(0.04, 0.16, t) * (1 - 0.55 * sm(0.45, 0.75, t)) - 0.35 * sm(0.78, 1, t);
const mid = layer();
for (let i = 0; i < N; i++) if (A[i]) {
  const t = T[i], v = V[i], x = i % W, y = (i / W) | 0;
  const back = backStrength(t) * (1 - sm(0.25, 0.75, v));
  const belly = sm(0.55, 0.9, v) * (bump(0.2, 0.09, t) * 0.9 + bump(0.07, 0.05, t) * 0.7);
  mid.D[i] = A[i] * Math.max(back, belly) * 0.55 * (0.7 + 0.6 * fbm(x / 45, y / 45, 3));
}
for (let i = 0; i < N; i++) if (FIN[i]) mid.D[i] *= 1 - 0.75 * FIN[i];
mid.dry({ bleed: 22, cloud: 0.6, feather: 0.5, ring: 0.35, soften: 6, grain: 0.5, clip, fine: true });

// ---- 3. wine, dark: a heavier charge along the spine that blooms and breaks up as it dries ----
const dark = layer();
for (let i = 0; i < N; i++) if (A[i]) {
  const t = T[i], v = V[i], x = i % W, y = (i / W) | 0;
  const along = sm(0.08, 0.18, t) * (1 - sm(0.5, 0.8, t));
  const across = bump(0.24 + 0.12 * sm(0.4, 0.75, t), 0.13, v);
  const blot = sm(0.42, 0.62, fbm(x / 26 + 5, y / 26, 4));
  const belly = sm(0.75, 0.95, v) * bump(0.21, 0.06, t) * 0.8;
  dark.D[i] = A[i] * Math.max(along * across * (0.4 + 1.1 * blot), belly * (0.5 + blot)) * 1.25;
}
for (let i = 0; i < N; i++) if (FIN[i]) dark.D[i] *= 1 - 0.9 * FIN[i];
dark.dry({ bleed: 8, cloud: 0.35, feather: 1, ring: 0.6, soften: 2, grain: 0.6, clip, hair: 0.6, fine: true });

// ---- 4. limbs: forelimb tucked under the chest, hind foot peeking from the inner curve ----
const limbs = layer();
const fore = [[412, 318], [384, 333], [352, 334]].map(M);
limbs.stroke(fore, t => 11 * (1 - 0.35 * t), (t, v) => 0.9 + 0.4 * sm(0, -1, v));
for (const p of [[338, 326], [336, 333], [340, 340], [347, 343]].map(M)) limbs.stroke([fore[2], p], t => 3.6 * (1 - 0.5 * t), () => 1.2);
const hind = [[196, 258], [186, 268], [176, 276]].map(M);
limbs.stroke(hind, t => 9 * (1 - 0.3 * t), () => 0.9);
for (const p of [[160, 271], [161, 280], [167, 287], [176, 289], [184, 286]].map(M)) limbs.stroke([hind[2], p], t => 3 * (1 - 0.5 * t), () => 1.1);
limbs.dry({ bleed: 5, cloud: 0.3, feather: 0.8, ring: 0.5, soften: 1.2, grain: 0.4, fine: true });

// ---- 5. tail fin: a faint line where the see-through fin meets the tail ----
useInk('wine');
line(finLine.slice(1), 1.1, 0.3);

// ---- 6. gills: pale feathery fronds; lift the wet wash out underneath first ----
const rami = [
  { base: [470, 284], tips: [[458, 240], [482, 236], [504, 254]], far: true },
  { base: [434, 300], tips: [[388, 266], [376, 304], [392, 340]] },
].flatMap(g => g.tips.map(tip => ({ base: M(g.base), tip: M(tip), far: g.far })));
const frond = layer();
for (const r of rami) {
  const mx = (r.base[0] + r.tip[0]) / 2, my = (r.base[1] + r.tip[1]) / 2, dx = r.tip[0] - r.base[0], dy = r.tip[1] - r.base[1], len = Math.hypot(dx, dy);
  const bend = [mx - dy * 0.08, my + dx * 0.08];
  frond.stroke([r.base, bend, r.tip], t => (r.far ? 16 : 21) * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.7, () => 1);
  r.mid = bend; r.len = len;
}
const fm = blur(frond.D, 3);
for (const ink of ['body', 'wine']) { useInk(ink); for (let i = 0; i < N; i++) if (fm[i] > 0.01) P.S[i] *= 1 - 0.92 * Math.min(1, fm[i] * 1.3); }
useInk('body');
const gl = layer();
for (let i = 0; i < N; i++) gl.D[i] = 0.12 * Math.min(1, fm[i] * 1.2);
gl.dry({ bleed: 3, cloud: 0.6, ring: 2.2, soften: 1, grain: 0.1 });
// filaments: fine wine hairs combed along each frond, both edges
useInk('wine');
for (const r of rami) {
  const q = (s) => { const u = 1 - s; return [u * u * r.base[0] + 2 * u * s * r.mid[0] + s * s * r.tip[0], u * u * r.base[1] + 2 * u * s * r.mid[1] + s * s * r.tip[1]]; };
  line([r.base, r.mid, r.tip], 1.1, r.far ? 0.22 : 0.3);
  for (let s = 0.15; s < 0.97; s += 6 / r.len) {
    const [x, y] = q(s), [x2, y2] = q(Math.min(1, s + 0.01)); let tx = x2 - x, ty = y2 - y; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    const fl = (r.far ? 14 : 19) * Math.sin(Math.PI * Math.min(1, s * 1.05)) ** 0.6;
    for (const side of [1, -1]) line([[x, y], [x + (-ty * side * 0.8 + tx * 0.6) * fl, y + (tx * side * 0.8 + ty * 0.6) * fl]], 0.9, (r.far ? 0.3 : 0.4) * (0.7 + 0.6 * fbm(x * 0.2, y * 0.2, 2)));
  }
}

// ---- 7. face: small dark eyes (near one under the gills, far one on the snout's edge), mouth along the jaw ----
const eye = M([472, 363]); dot(eye[0], eye[1], 6.5, 4); lift(eye[0] - 2, eye[1] - 2.5, 2, 0.1);
const eye2 = M([532, 331]); dot(eye2[0], eye2[1], 3.6, 3);
line([[533, 364], [520, 374], [503, 382], [487, 386]].map(M), 1.4, 0.5);

save(out, {
  paper: hexToLab('#faf4ed'),
  curves: {
    body: { curve: anchored('edo-murasaki', [['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    wine: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
  },
});
