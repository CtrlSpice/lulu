// Watercolour axolotl seen from above, after the left figure of the "Siredon Humboldtii / Fish-formed Siren" plate
// (Shaw, General Zoology, 1802), in Lulu's pink and wine.
//
// Anatomy from above: the tail is flattened side to side, so it is narrow and tapers evenly to a point; the dorsal fin
// stands upright on the midline from just behind the head to the tail tip, so it shows as a thin ridge on top; the
// ventral fin is underneath and hidden. (The plate twists its tail to show the fins; that is not what a top view shows.)
//
// Built to be correct by construction: one smooth midline (the spine) from snout to tail tip, and the same half width
// on both sides of it, so the outline is mirror-symmetric about the midline everywhere. Eyes, shoulders and hips are
// mirrored pairs at the same station along the midline. All proportions are traced from the plate (plate pixels,
// mapped to the canvas by PLATE): total length L = 702 plate px.
import { W, H, N, makePaper, layer, line, save, useInk, fbm, blur } from './paint.mjs';
import { hexToLab, anchored } from './match.mjs';
import * as P from './paint.mjs';
import { writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'axolotl-top-04.png';
makePaper();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (c, w, x) => Math.exp(-(((x - c) / w) ** 2));
const lerpTable = tbl => x => { if (x <= tbl[0][0]) return tbl[0][1]; for (let k = 1; k < tbl.length; k++) if (x <= tbl[k][0]) { const [x0, y0] = tbl[k - 1], [x1, y1] = tbl[k]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return tbl[tbl.length - 1][1]; };

// plate pixel -> canvas pixel: the figure is turned a quarter so the head points right; K = canvas px per plate px
const K = 1.6, PLATE = ([x, y]) => [500 + (605 - y) * K, 350 + (x - 372) * K];

// ---- midline (spine), traced as the middle between the plate's two edges, snout to tail tip ----
const SPINE_PLATE = [[393, 328], [391, 361], [389, 395], [386, 440], [376, 478], [370, 510], [371.5, 560], [370, 610], [376, 640], [390, 670], [411.7, 700], [431, 750], [431, 775], [405, 813], [359, 834], [316, 846], [282, 860], [250, 874], [220, 882]];
const catmull = (pts, m) => { const o = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; for (let k = 0; k < m; k++) { const t = k / m, f = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3); o.push([f(0), f(1)]); } } o.push(pts[pts.length - 1]); return o; };
// smooth the traced points (a spline, then a moving average), then resample at even 2 px steps along the curve
let fine = catmull(SPINE_PLATE.map(PLATE), 40);
fine = fine.map((_, i) => { let x = 0, y = 0, c = 0; for (let j = Math.max(0, i - 60); j <= Math.min(fine.length - 1, i + 60); j++) { x += fine[j][0]; y += fine[j][1]; c++; } const k = Math.min(1, i / 60, (fine.length - 1 - i) / 60); return [fine[i][0] + k * (x / c - fine[i][0]), fine[i][1] + k * (y / c - fine[i][1])]; });
const SP = [fine[0]]; { let acc = 0; for (let i = 1; i < fine.length; i++) { const d = Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]); acc += d; if (acc >= 2) { SP.push(fine[i]); acc = 0; } } SP.push(fine[fine.length - 1]); }
const NS = SP.length, ARC = [0]; for (let i = 1; i < NS; i++) ARC.push(ARC[i - 1] + Math.hypot(SP[i][0] - SP[i - 1][0], SP[i][1] - SP[i - 1][1]));
const L = ARC[NS - 1];
const TAN = SP.map((_, i) => { const q = SP[Math.min(NS - 1, i + 1)], r = SP[Math.max(0, i - 1)], l = Math.hypot(q[0] - r[0], q[1] - r[1]); return [(q[0] - r[0]) / l, (q[1] - r[1]) / l]; }); // towards the tail
const NRM = TAN.map(([tx, ty]) => [-ty, tx]); // across the body; + is the animal's left... see SIDE below
const stationAt = frac => { let i = 0; while (i < NS - 1 && ARC[i] < frac * L) i++; return i; };

// ---- half width along the body, as fractions of the total length (position, half width) ----
// Head: an axolotl's head from above is a broad rounded shovel, not a wedge: the sides are nearly parallel and the
// snout is wide and blunt. Its outline is taken from a top-down photo of a real axolotl as a share of the head's full
// width at each distance behind the snout tip: 56 % at 0.012 L, 71 % at 0.028 L, 84 % at the eyes (0.047 L), 96 % at
// 0.115 L, full width 0.093 at the back of the head (0.168 L). (The 1802 plate draws the head more triangular: only
// 66 % at the eyes, which reads as a lizard or newt.) Neck: the body narrows to 0.0815 behind the head (0.226 L), in one long easy curve, which separates head from body; the gills attach there. Trunk: widens again to
// 0.095 (0.30 L), then narrows to 0.066 at the hips (0.52 L). Tail, seen from above: flattened side to side, so it
// narrows to about two thirds of the hip width and tapers gently to a soft rounded tip (not a spike).
const HALF_PTS = [[0, 0], [0.003, 0.030], [0.008, 0.045], [0.016, 0.056], [0.028, 0.066], [0.047, 0.078], [0.075, 0.084], [0.115, 0.089], [0.15, 0.0922], [0.168, 0.093], [0.19, 0.0905], [0.208, 0.0850], [0.226, 0.0815], [0.246, 0.0835], [0.27, 0.0885], [0.295, 0.0932], [0.32, 0.095], [0.35, 0.0925], [0.38, 0.0865], [0.43, 0.076], [0.48, 0.070], [0.52, 0.066], [0.56, 0.057], [0.62, 0.048], [0.70, 0.041], [0.80, 0.034], [0.90, 0.026], [0.955, 0.019], [0.985, 0.011], [0.996, 0.005], [1, 0]];
// a smooth curve through those points (cubic, with the slope at each point taken from its two neighbours), so the
// outline has no corners or bumps: every change of width is one continuous curve
const HALF = (() => {
  const P = HALF_PTS, n = P.length, m = P.map((_, k) => k === 0 ? (P[1][1] - P[0][1]) / (P[1][0] - P[0][0]) : k === n - 1 ? (P[k][1] - P[k - 1][1]) / (P[k][0] - P[k - 1][0]) : ((P[k + 1][1] - P[k][1]) / (P[k + 1][0] - P[k][0]) + (P[k][1] - P[k - 1][1]) / (P[k][0] - P[k - 1][0])) / 2);
  return x => { if (x <= 0) return 0; if (x >= 1) return 0; let k = 0; while (k < n - 2 && x > P[k + 1][0]) k++; const h = P[k + 1][0] - P[k][0], t = (x - P[k][0]) / h, t2 = t * t, t3 = t2 * t; return Math.max(0, (2 * t3 - 3 * t2 + 1) * P[k][1] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * P[k + 1][1] + (t3 - t2) * h * m[k + 1]); };
})();
const halfAt = s => HALF(s) * L;
// a light smoothing of the half widths along the body (weighted average over about +-0.012 L), fading out towards the
// snout and the tail tip so their shapes stay exact; it removes any abrupt change of bend the curve still has
const HW = (() => {
  const raw = ARC.map(a => halfAt(a / L)), R = Math.round(0.012 * L / 2);
  return raw.map((v, i) => { const sI = ARC[i] / L, k = Math.min(1, Math.max(0, (sI - 0.05) / 0.04), Math.max(0, (0.93 - sI) / 0.04)); if (k <= 0) return v; let t = 0, wsum = 0; for (let j = -R; j <= R; j++) { const q = Math.min(raw.length - 1, Math.max(0, i + j)), w = Math.exp(-((j / (R / 2)) ** 2)); t += raw[q] * w; wsum += w; } return v + k * (t / wsum - v); });
})();

// ---- body field: for every pixel, where it is along the midline (S, 0..1) and across the body (VX, -1..1) ----
const S = new Float32Array(N).fill(-1), VX = new Float32Array(N), A = new Float32Array(N), OFF = new Float32Array(N);
{
  const reach = Math.max(...HW) + 4;
  for (let j = 0; j < NS; j++) { // each spine sample claims the pixels nearest to it
    const [px, py] = SP[j];
    for (let y = Math.max(0, Math.floor(py - reach)); y <= Math.min(H - 1, Math.ceil(py + reach)); y++) for (let x = Math.max(0, Math.floor(px - reach)); x <= Math.min(W - 1, Math.ceil(px + reach)); x++) {
      const i = y * W + x, d2 = (x - px) ** 2 + (y - py) ** 2; if (S[i] >= 0 && d2 >= OFF[i]) continue; if (d2 > reach * reach) continue;
      OFF[i] = d2; S[i] = j; // provisional: nearest sample index and squared distance
    }
  }
  for (let i = 0; i < N; i++) if (S[i] >= 0) {
    const j = S[i], x = i % W, y = (i / W) | 0, o = (x - SP[j][0]) * NRM[j][0] + (y - SP[j][1]) * NRM[j][1], along = (x - SP[j][0]) * TAN[j][0] + (y - SP[j][1]) * TAN[j][1];
    const d = HW[j] - Math.hypot(o, (j === 0 || j === NS - 1) ? along : 0);
    if (d > -2) { A[i] = Math.min(1, Math.max(0, d / 1.6 + 0.4)); S[i] = ARC[j] / L; VX[i] = Math.max(-1, Math.min(1, o / Math.max(1, HW[j]))); OFF[i] = o; } else { S[i] = -1; }
  }
}
const clip = blur(A, 1);

// ---- dorsal fin, seen from above ----
// The fin is an upright membrane on the midline, from just behind the head (0.20 L) to the tail tip, tallest over the
// tail. From above it shows as a thin ridge on top: a fine line on the trunk, a slightly wider soft band over the tail
// (where the tall fin leans a little). FINW is its half width in px; RIDGE is 1 on the ridge.
const FINW = s => (1.4 + 2.6 * sm(0.52, 0.72, s)) * sm(0.20, 0.27, s) * (1 - 0.5 * sm(0.94, 1, s));
const RIDGE = new Float32Array(N);
for (let i = 0; i < N; i++) if (A[i] && S[i] > 0.19) RIDGE[i] = Math.min(1, Math.max(0, (FINW(S[i]) - Math.abs(OFF[i])) / 1.2 + 0.5)) * sm(0.20, 0.24, S[i]);
const FIN = new Float32Array(N); // no fin margins from above

// ---- 1. base wash: Lulu pink over the whole animal, a little deeper towards the edges where it dried ----
useInk('body');
const base = layer();
for (let i = 0; i < N; i++) if (A[i]) base.D[i] = A[i] * (0.22 + 0.07 * Math.abs(VX[i]) ** 2 + 0.06 * bump(0.25, 0.2, S[i])) * (1 - 0.45 * FIN[i]);
base.dry({ bleed: 6, cloud: 0.45, feather: 0.6, ring: 0.6, soften: 2, grain: 0.15, clip });

// ---- 2. wine, middle wash: along the centre line, fading out towards both flanks; light on the snout ----
useInk('wine');
const backStrength = s => 0.2 + 0.8 * sm(0.03, 0.12, s) * (1 - 0.5 * sm(0.55, 0.85, s)) - 0.3 * sm(0.88, 1, s);
const centre = () => 0; // the markings run along the centre line
const mid = layer();
for (let i = 0; i < N; i++) if (A[i]) {
  const x = i % W, y = (i / W) | 0, u = VX[i] - centre(S[i]);
  mid.D[i] = A[i] * backStrength(S[i]) * (1 - sm(0.15, 0.85, Math.abs(u))) * 0.5 * (0.75 + 0.5 * fbm(x / 45, y / 45, 3)) * (1 - 0.7 * FIN[i]);
}
mid.dry({ bleed: 20, cloud: 0.6, feather: 0.5, ring: 0.35, soften: 6, grain: 0.5, clip, fine: true });

// ---- 3. wine, dark: blotches along the centre line, from behind the eyes to the tail ----
const dark = layer();
for (let i = 0; i < N; i++) if (A[i]) {
  const x = i % W, y = (i / W) | 0, s = S[i], u = VX[i] - centre(s);
  const along = sm(0.06, 0.13, s) * (1 - sm(0.80, 0.95, s)), across = bump(0, 0.36, u), blot = sm(0.42, 0.62, fbm(x / 26 + 5, y / 26, 4));
  dark.D[i] = A[i] * along * across * (0.4 + 1.1 * blot) * 1.25 * (1 - 0.9 * FIN[i]);
}
dark.dry({ bleed: 8, cloud: 0.35, feather: 1, ring: 0.6, soften: 2, grain: 0.6, clip, hair: 0.6, fine: true });

// ---- 4. the dorsal fin ridge: lifted paler out of the wet wash along the midline, with a fine wine edge each side ----
{
  const ridge = blur(RIDGE, 1), edge = new Float32Array(N);
  for (let i = 0; i < N; i++) if (A[i] > 0.9 && S[i] > 0.2) edge[i] = Math.max(0, 1 - Math.abs(Math.abs(OFF[i]) - FINW(S[i])) / 1.1) * sm(0.22, 0.30, S[i]);
  const be = blur(edge, 1);
  for (const ink of ['body', 'wine']) { useInk(ink); for (let i = 0; i < N; i++) if (ridge[i] > 0.01) P.S[i] *= 1 - (ink === 'wine' ? 0.72 : 0.18) * Math.min(1, ridge[i]); }
  useInk('wine'); for (let i = 0; i < N; i++) if (be[i] > 0.01) P.S[i] += 0.13 * be[i] * (0.5 + fbm((i % W) / 25, ((i / W) | 0) / 25, 3));
}

// ---- 5. legs: Lulu's dark stick legs with splayed toes, posed and sized as on the plate ----
// Each pair attaches at the same station on both sides: shoulders at 0.24 L, hips at 0.52 L, on the outline. Joints are
// traced from the plate (plate px); four fingers in front, five toes behind.
useInk('wine');
const limbs = layer();
const toward = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];
const fan = (from, dir, len, n, spread) => Array.from({ length: n }, (_, k) => { const a = Math.atan2(dir[1], dir[0]) + spread * (k / (n - 1) - 0.5); return toward(from, [Math.cos(a), Math.sin(a)], len * (0.85 + 0.15 * Math.sin(Math.PI * k / (n - 1)))); });
// Joints are calculated, not traced. At each attachment the leg has its own directions: OUT, straight away from the
// body, and FWD, towards the head. An angle is measured from OUT towards FWD (so 0 = straight out, + = forward).
// Front leg (sprawling stance from above): upper arm out and back to the elbow (-30 deg), forearm forward and out to
// the wrist (+55 deg), four fingers fanned around +50 deg. Back leg: thigh out and forward to the knee (+30 deg),
// shin back and out to the ankle (-60 deg), five toes fanned around +20 deg. Segment lengths are fractions of the
// total length L (Dumeril: each leg about 0.15 L): front 0.05 + 0.05 + 0.045, back 0.052 + 0.052 + 0.05.
// The two legs of a pair are mirror images except for a small stride (STRIDE deg), opposite on the two sides and
// opposite between front and back, as in a walking salamander.
const LEGS = [];
const STRIDE = 8, rad = d => d * Math.PI / 180;
const leg = (name, frac, side, stride, spec) => {
  const j = stationAt(frac), out = [side * NRM[j][0], side * NRM[j][1]], fwd = [-TAN[j][0], -TAN[j][1]];
  const at = a => { const c = Math.cos(rad(a)), q = Math.sin(rad(a)); return [out[0] * c + fwd[0] * q, out[1] * c + fwd[1] * q]; };
  const root = [SP[j][0] + out[0] * (HW[j] - 7), SP[j][1] + out[1] * (HW[j] - 7)];
  const joint = toward(root, at(spec.upper + stride), spec.len[0] * L), end = toward(joint, at(spec.lower + stride * 0.5), spec.len[1] * L);
  const tips = fan(end, at(spec.digitsAt), spec.len[2] * L, spec.digits, rad(spec.spread));
  // straight segments meeting at a joint, like bones: the upper segment from inside the body to the elbow/knee, the
  // lower segment from there to the wrist/ankle; each a straight stroke that tapers a little
  const inside = toward(root, at(spec.upper + stride), -16), ink = (t, v) => 0.9 + 0.4 * sm(0, -1, v);
  limbs.stroke([inside, joint], t => spec.r * (1 - 0.16 * t), (t, v) => sm(0, 0.2, t) * ink(t, v));
  limbs.stroke([joint, end], t => spec.r * (0.84 - 0.22 * t), ink);
  for (const p of tips) limbs.stroke([end, p], t => 4.3 * (1 - 0.5 * t), () => 1.15);
  LEGS.push({ name, root, joint, end, tips, bend: Math.round(180 - Math.abs(spec.lower + stride * 0.5 - spec.upper - stride)), length: +((spec.len[0] + spec.len[1] + spec.len[2])).toFixed(3) });
};
const FRONT = { upper: -30, lower: 55, digitsAt: 50, digits: 4, spread: 86, len: [0.05, 0.05, 0.045], r: 11 };
const BACK = { upper: 30, lower: -60, digitsAt: 20, digits: 5, spread: 103, len: [0.052, 0.052, 0.05], r: 12.5 };
const SHOULDER = 0.24, HIP = 0.52; // front legs just behind the head (the pectoral girdle sits right behind the gill arches: Dumeril, photos); back legs at the vent
leg('front left', SHOULDER, 1, STRIDE, FRONT);
leg('front right', SHOULDER, -1, -STRIDE, FRONT);
leg('back left', HIP, 1, -STRIDE, BACK);
leg('back right', HIP, -1, STRIDE, BACK);
{ const behind = blur(A.map(a => 1 - 0.93 * a), 1); limbs.dry({ bleed: 5, cloud: 0.3, feather: 0.8, ring: 0.5, soften: 1.2, grain: 0.4, fine: true, clip: behind }); } // the body lies over the leg roots

// ---- 6. eyes: a mirrored pair of small dark beads ----
useInk('wine');
const EYE_R = 4.8, eyeAt = (x, y) => {
  const Lr = layer(); Lr.blob(x, y, EYE_R, EYE_R, 4); const b = blur(Lr.D, 1); for (let i = 0; i < N; i++) P.S[i] += b[i];
  for (let py = Math.floor(y - EYE_R); py <= y + EYE_R; py++) for (let px = Math.floor(x - EYE_R); px <= x + EYE_R; px++) { const u = (px - x) / EYE_R, v = (py - y) / EYE_R, d = Math.hypot(u, v); if (d > 0.9 || v < 0.1) continue; P.S[py * W + px] *= 1 - 0.62 * sm(0.1, 0.55, v) * sm(0.9, 0.55, d); } // reflected light, low in the bead
  for (let py = Math.floor(y - 4); py <= y; py++) for (let px = Math.floor(x - 4); px <= x; px++) { const d = Math.hypot(px - (x - 1.6), py - (y - 1.9)) / 1.5; if (d <= 1) P.S[py * W + px] *= 0.05 + 0.95 * Math.min(1, Math.max(0, (d - 0.6) / 0.4)); } // shine
};
// position: where the head reaches 85 % of its full width (as on a real axolotl); spacing: 53 % of the head's width
// there (top-down photo), so each eye sits well inside the outline, nearer the side than the midline
const HEAD_FULL = Math.max(...HALF_PTS.filter(p => p[0] < 0.2).map(p => p[1]));
const EYE_S = (() => { for (let q = 0.01; q < 0.15; q += 0.0005) if (HALF(q) >= 0.85 * HEAD_FULL) return q; return 0.047; })();
const EYES = [-1, 1].map(side => { const j = stationAt(EYE_S), e = 0.53 * HALF(EYE_S) * L; return [SP[j][0] + side * NRM[j][0] * e, SP[j][1] + side * NRM[j][1] * e]; });
for (const [x, y] of EYES) eyeAt(x, y);

save(out, {
  paper: hexToLab('#faf4ed'),
  curves: {
    body: { curve: anchored('edo-murasaki', [['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    wine: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
  },
});
// for checks: the geometry this picture was built from
if (process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify({ L, K, spine: SP.filter((_, i) => i % 5 === 0), half: HW.filter((_, i) => i % 5 === 0), arc: ARC.filter((_, i) => i % 5 === 0), eyes: EYES, legs: LEGS, fin: { onMidline: true, from: 0.20, margins: FIN.reduce((t, v) => t + v, 0) }, shoulder: [LEGS[0].root, LEGS[1].root], hip: [LEGS[2].root, LEGS[3].root] }));
if (process.env.DUMPFULL) writeFileSync(process.env.DUMPFULL, JSON.stringify({ L, spine: SP, half: HW, arc: ARC }));
