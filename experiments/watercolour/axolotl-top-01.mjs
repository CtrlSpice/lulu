// Watercolour axolotl seen from above, after the left figure of the "Siredon Humboldtii / Fish-formed Siren" plate
// (Shaw, General Zoology, 1802), in Lulu's pink and wine.
//
// Built to be correct by construction: one smooth midline (the spine) from snout to tail tip, and the same half width
// on both sides of it, so the outline is mirror-symmetric about the midline everywhere. Eyes, shoulders and hips are
// mirrored pairs at the same station along the midline. All proportions are traced from the plate (plate pixels,
// mapped to the canvas by PLATE): total length L = 702 plate px.
import { W, H, N, makePaper, layer, line, save, useInk, fbm, blur } from './paint.mjs';
import { hexToLab, anchored } from './match.mjs';
import * as P from './paint.mjs';
import { writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'axolotl-top-01.png';
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
fine = fine.map((_, i) => { let x = 0, y = 0, c = 0; for (let j = Math.max(0, i - 38); j <= Math.min(fine.length - 1, i + 38); j++) { x += fine[j][0]; y += fine[j][1]; c++; } const k = Math.min(1, i / 38, (fine.length - 1 - i) / 38); return [fine[i][0] + k * (x / c - fine[i][0]), fine[i][1] + k * (y / c - fine[i][1])]; });
const SP = [fine[0]]; { let acc = 0; for (let i = 1; i < fine.length; i++) { const d = Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]); acc += d; if (acc >= 2) { SP.push(fine[i]); acc = 0; } } SP.push(fine[fine.length - 1]); }
const NS = SP.length, ARC = [0]; for (let i = 1; i < NS; i++) ARC.push(ARC[i - 1] + Math.hypot(SP[i][0] - SP[i - 1][0], SP[i][1] - SP[i - 1][1]));
const L = ARC[NS - 1];
const TAN = SP.map((_, i) => { const q = SP[Math.min(NS - 1, i + 1)], r = SP[Math.max(0, i - 1)], l = Math.hypot(q[0] - r[0], q[1] - r[1]); return [(q[0] - r[0]) / l, (q[1] - r[1]) / l]; }); // towards the tail
const NRM = TAN.map(([tx, ty]) => [-ty, tx]); // across the body; + is the animal's left... see SIDE below
const stationAt = frac => { let i = 0; while (i < NS - 1 && ARC[i] < frac * L) i++; return i; };

// ---- half width along the body, as fractions of the total length (position, half width), from the plate ----
// head: blunt snout, 0.060 at the eyes, widest 0.093 at the back of the head; a slight neck; trunk 0.096 wide just
// behind it narrowing to 0.068 at the hips (0.51); tail blade about 0.045, tapering to the tip.
const HALF = lerpTable([[0, 0], [0.006, 0.020], [0.012, 0.036], [0.026, 0.048], [0.047, 0.060], [0.088, 0.078], [0.117, 0.088], [0.150, 0.093], [0.171, 0.0925], [0.202, 0.088], [0.262, 0.096], [0.309, 0.088], [0.358, 0.078], [0.405, 0.073], [0.470, 0.070], [0.513, 0.068], [0.548, 0.064], [0.591, 0.051], [0.624, 0.045], [0.657, 0.048], [0.721, 0.050], [0.791, 0.045], [0.853, 0.039], [0.905, 0.026], [0.956, 0.010], [1, 0]]);
// smooth the profile so the outline has no corners (average over +-0.012 L), keeping the blunt snout and the tip exact
const halfAt = s => { const k = Math.min(1, s / 0.03, (1 - s) / 0.03) * 0.012; if (k <= 0) return HALF(s) * L; let t = 0; for (let j = -6; j <= 6; j++) t += HALF(Math.min(1, Math.max(0, s + k * j / 6))); return t / 13 * L; };
const HW = ARC.map(a => halfAt(a / L));

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

// ---- tail fins ----
// Seen from above, the dorsal fin is a thin upright membrane on the midline: a fine pale keel from behind the head to
// the tail. Behind the hips the tail turns onto its side (TWIST, 0 to a quarter turn), so the fins come into view as
// see-through margins: the dorsal fin on one edge (the keel slides over to it), the ventral fin, which starts at the
// vent, on the other. The muscle is the band between them; it thins out before the tip, which is all fin.
const SIDE = 1; // which edge the dorsal fin turns to: +1 = the outside of the tail's curl
const twist = s => sm(0.53, 0.72, s); // 0 = seen from above, 1 = seen from the side
const muscle = s => 1 - 0.44 * twist(s) - 0.56 * sm(0.90, 1, s); // half width of the muscle band as a fraction of the half width
const keel = s => SIDE * muscle(s) * twist(s) * 0.98; // where the dorsal fin's base line runs across the body (-1..1)
const FIN = new Float32Array(N);
for (let i = 0; i < N; i++) if (A[i] && S[i] > 0.5) { const m = muscle(S[i]), e = Math.abs(VX[i]) - m; FIN[i] = Math.min(1, Math.max(0, e * HW[stationAt(S[i])] / 2 + 0.5)) * sm(0.53, 0.60, S[i]); }

// ---- 1. base wash: Lulu pink over the whole animal, a little deeper towards the edges where it dried ----
useInk('body');
const base = layer();
for (let i = 0; i < N; i++) if (A[i]) base.D[i] = A[i] * (0.22 + 0.07 * Math.abs(VX[i]) ** 2 + 0.06 * bump(0.25, 0.2, S[i])) * (1 - 0.45 * FIN[i]);
base.dry({ bleed: 6, cloud: 0.45, feather: 0.6, ring: 0.6, soften: 2, grain: 0.15, clip });

// ---- 2. wine, middle wash: along the centre line, fading out towards both flanks; light on the snout ----
useInk('wine');
const backStrength = s => 0.2 + 0.8 * sm(0.03, 0.12, s) * (1 - 0.5 * sm(0.55, 0.85, s)) - 0.3 * sm(0.88, 1, s);
const centre = s => keel(s) * 0.5; // the markings follow the centre line, drifting with the muscle as the tail turns
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

// ---- 4. the keel (dorsal fin from above) and the fin edges: fine pale lines lifted out of the wash, soft wine edges ----
{
  const lift = new Float32Array(N), edge = new Float32Array(N);
  for (let i = 0; i < N; i++) if (A[i] > 0.9) {
    const s = S[i], hw = HW[stationAt(s)], dk = Math.abs(VX[i] - keel(s)) * hw; // px from the keel line
    lift[i] = Math.max(0, 1 - dk / 2.2) * sm(0.17, 0.24, s) * (1 - sm(0.93, 0.99, s));
    const dv = Math.abs(VX[i] + SIDE * muscle(s)) * hw; // px from the ventral fin's base line (the other edge of the muscle)
    edge[i] = Math.max(0, 1 - dv / 1.6) * sm(0.53, 0.62, s) * (1 - sm(0.93, 0.99, s));
  }
  const bl = blur(lift, 1), be = blur(edge, 1);
  for (const ink of ['body', 'wine']) { useInk(ink); for (let i = 0; i < N; i++) if (bl[i] > 0.01) P.S[i] *= 1 - (ink === 'wine' ? 0.6 : 0.2) * Math.min(1, bl[i]); }
  useInk('wine'); for (let i = 0; i < N; i++) if (be[i] > 0.01) P.S[i] += 0.16 * be[i] * (0.5 + fbm((i % W) / 25, ((i / W) | 0) / 25, 3));
}

// ---- 5. legs: Lulu's dark stick legs with splayed toes, posed and sized as on the plate ----
// Each pair attaches at the same station on both sides: shoulders at 0.31 L, hips at 0.51 L, on the outline. Joints are
// traced from the plate (plate px); four fingers in front, five toes behind.
useInk('wine');
const limbs = layer();
const toward = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];
const fan = (from, dir, len, n, spread) => Array.from({ length: n }, (_, k) => { const a = Math.atan2(dir[1], dir[0]) + spread * (k / (n - 1) - 0.5); return toward(from, [Math.cos(a), Math.sin(a)], len * (0.85 + 0.15 * Math.sin(Math.PI * k / (n - 1)))); });
const attach = (frac, side) => { const j = stationAt(frac), e = HW[j] - 7; return { root: [SP[j][0] + side * NRM[j][0] * e, SP[j][1] + side * NRM[j][1] * e], inward: [-side * NRM[j][0], -side * NRM[j][1]] }; };
const leg = (frac, side, joints, digits, digitLen, r0) => {
  const at = attach(frac, side), pts = joints.map(PLATE), first = PLATE(joints[0]), shift = [at.root[0] - first[0], at.root[1] - first[1]];
  const path = pts.map((p, k) => { const f = 1 - k / (pts.length - 1); return [p[0] + shift[0] * f, p[1] + shift[1] * f]; }); // root snapped to the mirrored attachment, foot where the plate has it
  const end = path[path.length - 1], prev = path[path.length - 2], dl = Math.hypot(end[0] - prev[0], end[1] - prev[1]), dir = [(end[0] - prev[0]) / dl, (end[1] - prev[1]) / dl];
  limbs.stroke([toward(path[0], at.inward, 16), ...path], t => r0 * (1 - 0.42 * t), (t, v) => sm(0, 0.16, t) * (0.9 + 0.4 * sm(0, -1, v)));
  for (const p of fan(end, dir, digitLen, digits, digits === 4 ? 1.5 : 1.8)) limbs.stroke([end, p], t => 4.3 * (1 - 0.5 * t), () => 1.15);
};
const SHOULDER = 0.31, HIP = 0.51; // plate: shoulders 217 px and hips 360 px along the 702 px midline
// the plate's left side is the top of the canvas; which sign of NRM that is depends on the midline's direction
const top = (() => { const j = stationAt(SHOULDER); return NRM[j][1] < 0 ? 1 : -1; })(), bottom = -top;
leg(SHOULDER, top, [[303, 530], [286, 547], [268, 558], [252, 574]], 4, 40, 11);      // left front: back and out
leg(SHOULDER, bottom, [[433, 543], [455, 560], [474, 574], [489, 590]], 4, 40, 11);   // right front
leg(HIP, top, [[347, 680], [340, 706], [335, 742], [327, 762]], 5, 52, 12.5);        // left back: trailing along the tail
leg(HIP, bottom, [[447, 667], [468, 690], [478, 728], [494, 745]], 5, 52, 12.5);     // right back: out to the side
{ const behind = blur(A.map(a => 1 - 0.93 * a), 1); limbs.dry({ bleed: 5, cloud: 0.3, feather: 0.8, ring: 0.5, soften: 1.2, grain: 0.4, fine: true, clip: behind }); } // the body lies over the leg roots

// ---- 6. eyes: a mirrored pair of small dark beads, 0.047 L behind the snout, 0.033 L either side of the midline ----
useInk('wine');
const EYE_R = 4.8, eyeAt = (x, y) => {
  const Lr = layer(); Lr.blob(x, y, EYE_R, EYE_R, 4); const b = blur(Lr.D, 1); for (let i = 0; i < N; i++) P.S[i] += b[i];
  for (let py = Math.floor(y - EYE_R); py <= y + EYE_R; py++) for (let px = Math.floor(x - EYE_R); px <= x + EYE_R; px++) { const u = (px - x) / EYE_R, v = (py - y) / EYE_R, d = Math.hypot(u, v); if (d > 0.9 || v < 0.1) continue; P.S[py * W + px] *= 1 - 0.62 * sm(0.1, 0.55, v) * sm(0.9, 0.55, d); } // reflected light, low in the bead
  for (let py = Math.floor(y - 4); py <= y; py++) for (let px = Math.floor(x - 4); px <= x; px++) { const d = Math.hypot(px - (x - 1.6), py - (y - 1.9)) / 1.5; if (d <= 1) P.S[py * W + px] *= 0.05 + 0.95 * Math.min(1, Math.max(0, (d - 0.6) / 0.4)); } // shine
};
const EYES = [-1, 1].map(side => { const j = stationAt(0.047), e = 0.0335 * L; return [SP[j][0] + side * NRM[j][0] * e, SP[j][1] + side * NRM[j][1] * e]; });
for (const [x, y] of EYES) eyeAt(x, y);

save(out, {
  paper: hexToLab('#faf4ed'),
  curves: {
    body: { curve: anchored('edo-murasaki', [['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    wine: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
  },
});
// for checks: the geometry this picture was built from
if (process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify({ L, K, spine: SP.filter((_, i) => i % 5 === 0), half: HW.filter((_, i) => i % 5 === 0), arc: ARC.filter((_, i) => i % 5 === 0), eyes: EYES, shoulder: [attach(SHOULDER, 1).root, attach(SHOULDER, -1).root], hip: [attach(HIP, 1).root, attach(HIP, -1).root] }));
