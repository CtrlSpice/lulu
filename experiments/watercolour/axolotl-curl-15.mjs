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
const T = new Float32Array(N).fill(-1), V = new Float32Array(N), A = new Float32Array(N), Dn = new Float32Array(N), DO = new Float32Array(N), DI = new Float32Array(N);
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
  if (d > -2) { T[i] = (bi + bu) / (n - 1); V[i] = (Wo - o) / (Wo + Wi); A[i] = Math.min(1, Math.max(0, d / 1.6 + 0.4)); Dn[i] = d; DO[i] = Wo * shrink - o; DI[i] = Wi * shrink + o; }
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
    DO[i] = bot - y; DI[i] = y - top;
  } else if (x >= 282 && y > finY(x) && y <= bot + 1.5 && !A[i]) { T[i] = 0.95; V[i] = 0.1; A[i] = Math.min(1, Math.max(0, (bot - y) / 1.6 + 0.4)); DO[i] = bot - y; DI[i] = 99; }
}
// ---- face front: the outline follows the line the user drew in the annotator, jaw to snout top (canvas px) ----
const faceLine = [[872, 470], [879, 468], [884, 464], [891, 462], [897, 457], [903, 454], [909, 449], [913, 443], [918, 438], [920, 434], [923, 431], [926, 426], [928, 420], [928, 414], [928, 410], [926, 405], [925, 400], [922, 395], [920, 390], [919, 387], [916, 380]]; // it meets the existing head outline at y 380
// x at y along the line, smoothed so the hand wobble goes
const fl = [...faceLine].sort((a, b) => a[1] - b[1]).map((p, k, a) => { let sx = 0, c = 0; for (let j = Math.max(0, k - 2); j <= Math.min(a.length - 1, k + 2); j++) { sx += a[j][0]; c++; } return [sx / c, p[1]]; });
const faceX = y => { for (let k = 1; k < fl.length; k++) if (y <= fl[k][1]) return fl[k - 1][0] + (fl[k][0] - fl[k - 1][0]) * (y - fl[k - 1][1]) / (fl[k][1] - fl[k - 1][1] || 1); return fl[fl.length - 1][0]; };
for (let y = 330; y < 500; y++) for (let x = 860, lt = 0, lv = 0; x < 980; x++) {
  const i = y * W + x;
  if (A[i] > 0.5) { lt = T[i]; lv = V[i]; }
  if (y < 345) continue; // above this the head outline stays as it was
  // between y 350 and 400 the old head edge (measured) eases into the drawn line, so they meet without a corner by the small eye
  const oldX = 887 + 0.85 * (y - 345), lineX = y < 380 ? 916 - 0.4 * (380 - y) : faceX(y);
  const edge = y > 470 ? 872 : y < 400 ? oldX + (lineX - oldX) * sm(350, 400, y) : faceX(y);
  const d = edge - x;
  if (d < -1.5) { A[i] = 0; T[i] = -1; continue; }
  if (y <= 470 && !A[i] && lt) { T[i] = lt; V[i] = lv; }
  if (T[i] >= 0) A[i] = Math.min(A[i] || 1, Math.max(0, d / 1.6 + 0.4));
}
// ---- chin: the jaw underside follows the red line the user drew (canvas px), blending into the face front ----
const chinY = curveY([[795, 469.5], [811, 471.5], [826, 475], [842, 477], [858, 476], [872, 473], [879, 468.5], [886, 463]]);
for (let x = 795; x <= 886; x++) for (let y = 440, lt = 0, lv = 0; y < 500; y++) {
  const i = y * W + x, d = chinY(x) - y;
  if (A[i] > 0.5) { lt = T[i]; lv = V[i]; }
  if (d < -1.5) { A[i] = 0; T[i] = -1; continue; }
  if (!A[i] && lt) { T[i] = lt; V[i] = lv; A[i] = 1; }
  if (T[i] >= 0) A[i] = Math.min(A[i], Math.max(0, d / 1.6 + 0.4));
}
// fins: a low dorsal ridge from just behind the gills along the back (outer edge of the curl), and a ventral fin
// from the vent behind the hind foot along the belly side (inner edge). Both hand over to the tail fin exactly as
// it was in version 04 (everything below the drawn fin line), which the user wants kept as it is.
// ---- lower edge under the neck: one smooth curve from the belly to the throat (canvas px), matching the old edge at both ends ----
const lowerY = curveY([[470, 277], [500, 306], [530, 330], [560, 350], [620, 379], [680, 410], [720, 432], [740, 445], [760, 457], [780, 465]]); // from x 680 on, the measured throat edge
for (let x = 470; x <= 780; x++) for (let y = 230, lt = 0, lv = 0; y < 490; y++) {
  const i = y * W + x, d = lowerY(x) - y;
  if (A[i] > 0.5) { lt = T[i]; lv = V[i]; }
  if (d < -1.5) { A[i] = 0; T[i] = -1; continue; }
  if (!A[i] && lt) { T[i] = lt; V[i] = lv; A[i] = 1; }
  if (T[i] >= 0) A[i] = Math.min(A[i], Math.max(0, d / 1.6 + 0.4));
}
// ---- head top: one smooth line from the back to the head under the far gills (it used to dip there) ----
const topY = curveY([[740, 196], [764, 225], [790, 252], [815, 276], [840, 297], [860, 314], [876, 334]]);
for (let x = 748; x <= 870; x++) for (let y = 480, lt = 0, lv = 0, lo = 0, li = 0; y >= 180; y--) {
  const i = y * W + x, d = y - topY(x);
  if (A[i] > 0.5) { lt = T[i]; lv = V[i]; lo = DO[i]; li = DI[i]; }
  if (d < -1.5 || A[i] || !lt) continue;
  T[i] = lt; V[i] = lv; DO[i] = lo; DI[i] = li; A[i] = Math.min(1, Math.max(0, d / 1.6 + 0.4));
}
// ---- smooth outline: blur the silhouette slightly and cut it again at the middle, so steps and kinks a few px
// across disappear all the way round; the tail tip point is left as it is ----
{
  const OLD = Float32Array.from(A), sb = blur(A, 2), keep = (x, y) => Math.hypot(x - TIP[0], y - TIP[1]) < 45;
  const hard = new Float32Array(N); for (let i = 0; i < N; i++) hard[i] = keep(i % W, (i / W) | 0) ? (OLD[i] > 0.5 ? 1 : 0) : (sb[i] > 0.5 ? 1 : 0);
  const soft = blur(hard, 1);
  // new pixels take their washes from the nearest old pixel
  for (let pass = 0; pass < 6; pass++) for (let i = W; i < N - W; i++) if (soft[i] > 0.02 && T[i] < 0) for (const j of [i - 1, i + 1, i - W, i + W]) if (T[j] >= 0) { T[i] = T[j]; V[i] = V[j]; DO[i] = DO[j]; DI[i] = DI[j]; break; }
  for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0; A[i] = keep(x, y) ? OLD[i] : soft[i]; if (A[i] < 0.02) { A[i] = 0; T[i] = -1; } }
}
const fracD = t => 0.06 * sm(0.19, 0.28, t);
const fracV = t => 0.24 * sm(0.5, 0.6, t) * (1 - sm(0.66, 0.76, t));
const tailFin = (x, y) => x >= 180 && x <= TIP[0] && y >= 440 && y < 680 && y > finY(x) ? sm(205, 260, x) * Math.min(1, (y - finY(x)) / 2) : 0;
const ZONE = new Float32Array(N); // 1 where the tail end looks exactly as in version 04
for (let i = 0; i < N; i++) if (A[i]) {
  const x = i % W, y = (i / W) | 0, t = T[i], depth = Math.max(1, DO[i] + DI[i]);
  ZONE[i] = sm(0.7, 0.78, t);
  const inD = fracD(t) * depth - DO[i], inV = fracV(t) * depth - DI[i];
  const body = t > 0.15 ? Math.min(1, Math.max(0, Math.max(inD, inV) / 2 + 0.5)) : 0;
  FIN[i] = Math.max(body * (1 - ZONE[i]), tailFin(x, y));
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
  const belly = sm(0.55, 0.9, v) * bump(0.07, 0.05, t) * 0.7;
  mid.D[i] = A[i] * Math.max(back, belly) * 0.55 * (0.7 + 0.6 * fbm(x / 45, y / 45, 3));
}
for (let i = 0; i < N; i++) if (FIN[i]) mid.D[i] *= 1 - (0.6 + 0.15 * ZONE[i]) * FIN[i];
mid.dry({ bleed: 22, cloud: 0.6, feather: 0.5, ring: 0.35, soften: 6, grain: 0.5, clip, fine: true });

// ---- 3. wine, dark: a heavier charge along the spine that blooms and breaks up as it dries ----
const dark = layer();
for (let i = 0; i < N; i++) if (A[i]) {
  const t = T[i], v = V[i], x = i % W, y = (i / W) | 0;
  const along = sm(0.08, 0.18, t) * (1 - sm(0.5, 0.8, t));
  const across = bump(0.24 + 0.12 * sm(0.4, 0.75, t), 0.13, v);
  const blot = sm(0.42, 0.62, fbm(x / 26 + 5, y / 26, 4));
  const belly = 0;
  dark.D[i] = A[i] * Math.max(along * across * (0.4 + 1.1 * blot), belly * (0.5 + blot)) * 1.25;
}
for (let i = 0; i < N; i++) if (FIN[i]) dark.D[i] *= 1 - (0.65 + 0.25 * ZONE[i]) * FIN[i];
dark.dry({ bleed: 8, cloud: 0.35, feather: 1, ring: 0.6, soften: 2, grain: 0.6, clip, hair: 0.6, fine: true });

// ---- 4. limbs: forelimb tucked under the chest, hind foot peeking from the inner curve ----
const limbs = layer();
const toward = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];
const unit = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
const fan = (from, dir, len, n, spread) => Array.from({ length: n }, (_, k) => { const a = Math.atan2(dir[1], dir[0]) + spread * (k / (n - 1) - 0.5); return toward(from, [Math.cos(a), Math.sin(a)], len * (0.85 + 0.15 * Math.sin(Math.PI * k / (n - 1)))); });
// Legs bend the salamander way (Dumeril side view): the elbow points back towards the tail and the forearm comes
// forward, so the hand points forward; the knee points forward towards the head and the shin goes back, so the foot
// points back and out. tail/out are unit directions at the attachment: towards the tail along the body, and away
// from the body on that side.
const mix = (a, ka, b, kb) => unit(a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb);
const foreLeg = (L, sh, tail, out, k, size, ink) => {
  const fwd = [-tail[0], -tail[1]];
  const elbow = toward(sh, mix(out, 0.75, tail, 0.6), 70 * size);
  const handDir = mix(fwd, 0.75, out, 0.55), wrist = toward(elbow, handDir, 60 * size);
  L.stroke([toward(sh, out, -20), sh, elbow, wrist], t => 13 * k * (1 - 0.45 * t), (t, v) => sm(0, 0.14, t) * ink * (0.9 + 0.4 * sm(0, -1, v)));
  for (const p of fan(wrist, handDir, 38 * size, 4, 1.6)) L.stroke([wrist, p], t => 4.6 * k * (1 - 0.5 * t), () => ink * 1.2);
};
const hindLeg = (L, hip, tail, out, k, size, ink) => {
  const fwd = [-tail[0], -tail[1]];
  const knee = toward(hip, mix(out, 0.8, fwd, 0.45), 72 * size);
  const ankle = toward(knee, mix(tail, 0.8, out, 0.4), 65 * size), footDir = mix(tail, 0.6, out, 0.6);
  L.stroke([toward(hip, out, -20), hip, knee, ankle], t => 14 * k * (1 - 0.45 * t), t => sm(0, 0.14, t) * ink * 0.9);
  for (const p of fan(ankle, footDir, 40 * size, 5, 1.9)) L.stroke([ankle, p], t => 4.4 * k * (1 - 0.5 * t), () => ink * 1.1);
};
// near pair: shoulder on the belly edge under the gill base (station 24), hip on the belly edge at the vent (station 92)
foreLeg(limbs, [686, 405], unit(-0.875, -0.48), unit(-0.48, 0.875), 1, 1, 1);
hindLeg(limbs, [262, 300], unit(-0.64, 0.77), unit(0.77, 0.64), 1, 1, 1);
// far pair: we look down on her from above and to the side, so the outer edge of the curl is her far flank; the far
// legs come out from under it at the same stations, a little shorter and paler, with the body hiding their roots
const farLimbs = layer(), FAR = 0.6, FS = 0.88;
foreLeg(farLimbs, [800, 269], unit(-0.78, -0.62), unit(0.62, -0.78), 0.92, FS, FAR);
hindLeg(farLimbs, [135, 201], unit(-0.64, 0.77), unit(-0.77, -0.64), 0.92, FS, FAR);
{ const behind = blur(A.map(a => 1 - a), 1); farLimbs.dry({ bleed: 5, cloud: 0.3, feather: 0.8, ring: 0.5, soften: 1.2, grain: 0.4, fine: true, clip: behind }); }
limbs.dry({ bleed: 5, cloud: 0.3, feather: 0.8, ring: 0.5, soften: 1.2, grain: 0.4, fine: true });

// ---- 5. tail fin: a faint line where the see-through fin meets the tail ----
useInk('wine');
{ const fb = blur(FIN.map((f, i) => ZONE[i] < 0.5 ? f : 0), 1), core = blur(A, 3); for (let i = 0; i < N; i++) if (fb[i] > 0.05 && fb[i] < 0.95 && core[i] > 0.97 && ZONE[i] < 0.5 && DO[i] < DI[i]) P.S[i] += 0.24 * (0.45 + 0.55 * fbm(i % W / 25 + 4, (i / W | 0) / 25, 3)) * 4 * fb[i] * (1 - fb[i]); }
line(finLine.slice(1), 1.1, 0.3);

// ---- 6. gills: pale feathery fronds; lift the wet wash out underneath first ----
const rami = [
  { base: [470, 284], tips: [[458, 240], [482, 236], [504, 254]], far: true },
  { base: [434, 300], tips: [[388, 266], [376, 304], [392, 340]] },
].flatMap(g => g.tips.map(tip => ({ base: M(g.base), tip: M(tip), far: g.far })));
const frond = layer(), farFrond = layer();
for (const r of rami) {
  const mx = (r.base[0] + r.tip[0]) / 2, my = (r.base[1] + r.tip[1]) / 2, dx = r.tip[0] - r.base[0], dy = r.tip[1] - r.base[1], len = Math.hypot(dx, dy);
  const bend = [mx - dy * 0.08, my + dx * 0.08];
  frond.stroke([r.base, bend, r.tip], t => (r.far ? 16 : 21) * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.7, () => 1);
  if (r.far) farFrond.stroke([r.base, bend, r.tip], t => 16 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.7, () => 1);
  r.mid = bend; r.len = len;
}
const fm = blur(frond.D, 3), ff = blur(farFrond.D, 3);
// under the far gills the pale pink body stays, so the head outline reads as one line; only the dark wash lifts
for (const ink of ['body', 'wine']) { useInk(ink); for (let i = 0; i < N; i++) if (fm[i] > 0.01) P.S[i] *= 1 - Math.max(0, 0.92 * Math.min(1, fm[i] * 1.3) - (ink === 'body' ? 0.7 * Math.min(1, ff[i] * 1.3) : 0)); }
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
// both eyes: small dark beads of the same height, same highlight from the upper left. The head is turned towards
// the viewer, so the near eye faces us and shows round; the far eye is on the other side of the head and shows
// foreshortened (narrower, same height).
const EYE_R = 4.8, eyeAt = (x, y, squash = 1) => {
  const L = layer(); L.blob(x, y, EYE_R * squash, EYE_R, 4); const b = blur(L.D, 1); for (let i = 0; i < N; i++) P.S[i] += b[i];
  // reflected light: the lower part of the bead is a little paler, fading in from the middle
  for (let py = Math.floor(y - EYE_R); py <= y + EYE_R; py++) for (let px = Math.floor(x - EYE_R); px <= x + EYE_R; px++) {
    const u = (px - x) / (EYE_R * squash), v = (py - y) / EYE_R, d = Math.hypot(u, v); if (d > 0.88 || v < 0.15) continue;
    P.S[py * W + px] *= 1 - 0.62 * sm(0.1, 0.55, v) * sm(0.9, 0.55, d);
  }
  lift(x - 1.6 * squash, y - 1.9, 1.5, 0.05); // shine
};
const eye = M([472, 363]); eyeAt(eye[0], eye[1]);
const eye2 = M([532, 331]); eyeAt(eye2[0] - 4, eye2[1] + 3, 0.72); // inside the snout edge with skin all round it
line([[533, 364], [520, 374], [503, 382], [487, 386]].map(M), 1.4, 0.5);

save(out, {
  paper: hexToLab('#faf4ed'),
  curves: {
    body: { curve: anchored('edo-murasaki', [['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    wine: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
  },
});
