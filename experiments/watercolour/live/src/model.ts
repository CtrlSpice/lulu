// Lulu the axolotl as one 3D description. Everything else (top view, side view, posing, the live watercolour) is drawn
// from this.
//
// Units: canvas pixels of the 1000 x 700 picture, so the model seen straight from above is exactly the still
// "axolotl-top-04". x and y are the picture's axes; z points up, out of the paper, with z = 0 on the body's axis.
// Proportions are fractions of the total length L (snout to tail tip along the midline).
//
// The body is a midline (the spine) with, at every station along it, a half width (from the top view), a top and a
// bottom height (from side views), so each cross-section is a slightly squared ellipse. It is mirror-symmetric about
// the midline by construction. Fins, legs and eyes are placed on it by rule, as mirrored pairs.

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export const sm = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A smooth curve through points (cubic, the slope at each point taken from its two neighbours). */
function smoothCurve(points: readonly Vec2[], clampZero = true): (x: number) => number {
  const P = points, n = P.length;
  const m = P.map((_, k) =>
    k === 0 ? (P[1][1] - P[0][1]) / (P[1][0] - P[0][0])
    : k === n - 1 ? (P[k][1] - P[k - 1][1]) / (P[k][0] - P[k - 1][0])
    : ((P[k + 1][1] - P[k][1]) / (P[k + 1][0] - P[k][0]) + (P[k][1] - P[k - 1][1]) / (P[k][0] - P[k - 1][0])) / 2);
  return x => {
    if (x <= P[0][0]) return P[0][1];
    if (x >= P[n - 1][0]) return P[n - 1][1];
    let k = 0;
    while (k < n - 2 && x > P[k + 1][0]) k++;
    const h = P[k + 1][0] - P[k][0], t = (x - P[k][0]) / h, t2 = t * t, t3 = t2 * t;
    const v = (2 * t3 - 3 * t2 + 1) * P[k][1] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * P[k + 1][1] + (t3 - t2) * h * m[k + 1];
    return clampZero ? Math.max(0, v) : v;
  };
}

// ---- the midline, as traced from the old illustration (illustration pixels -> picture pixels) ----
const K = 1.6;
const fromIllustration = ([x, y]: Vec2): Vec2 => [500 + (605 - y) * K, 350 + (x - 372) * K];
const SPINE_TRACED: readonly Vec2[] = [[393, 328], [391, 361], [389, 395], [386, 440], [376, 478], [370, 510], [371.5, 560], [370, 610], [376, 640], [390, 670], [411.7, 700], [431, 750], [431, 775], [405, 813], [359, 834], [316, 846], [282, 860], [250, 874], [220, 882]];

function catmull(pts: readonly Vec2[], m: number): Vec2[] {
  const o: Vec2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < m; k++) {
      const t = k / m;
      const f = (j: 0 | 1) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3);
      o.push([f(0), f(1)]);
    }
  }
  o.push(pts[pts.length - 1]);
  return o;
}

/** The rest-pose midline: smoothed, then resampled at even 2 px steps (same construction as the still). */
function restSpine(): Vec2[] {
  let fine = catmull(SPINE_TRACED.map(fromIllustration), 40);
  fine = fine.map((_, i) => {
    let x = 0, y = 0, c = 0;
    for (let j = Math.max(0, i - 60); j <= Math.min(fine.length - 1, i + 60); j++) { x += fine[j][0]; y += fine[j][1]; c++; }
    const k = Math.min(1, i / 60, (fine.length - 1 - i) / 60);
    return [fine[i][0] + k * (x / c - fine[i][0]), fine[i][1] + k * (y / c - fine[i][1])] as Vec2;
  });
  const sp: Vec2[] = [fine[0]];
  let acc = 0;
  for (let i = 1; i < fine.length; i++) {
    acc += Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]);
    if (acc >= 2) { sp.push(fine[i]); acc = 0; }
  }
  sp.push(fine[fine.length - 1]);
  return sp;
}

// ---- proportions along the body, as fractions of L: [position, value] ----
/** Half width seen from above. Head: an axolotl shovel (84 % of full width at the eyes, blunt snout), full width at
 *  0.168; neck 0.0815 at 0.226; trunk 0.095 at 0.32; hips 0.066 at 0.52; tail tapering gently to a soft tip. */
const HALF_WIDTH: readonly Vec2[] = [[0, 0], [0.003, 0.030], [0.008, 0.045], [0.016, 0.056], [0.028, 0.066], [0.047, 0.078], [0.075, 0.084], [0.115, 0.089], [0.15, 0.0922], [0.168, 0.093], [0.19, 0.0905], [0.208, 0.0850], [0.226, 0.0815], [0.246, 0.0835], [0.27, 0.0885], [0.295, 0.0932], [0.32, 0.095], [0.35, 0.0925], [0.38, 0.0865], [0.43, 0.076], [0.48, 0.070], [0.52, 0.066], [0.56, 0.057], [0.62, 0.048], [0.70, 0.041], [0.80, 0.034], [0.90, 0.026], [0.955, 0.019], [0.985, 0.011], [0.996, 0.005], [1, 0]];
/** Height of the back above the body's axis, from side views (Dumeril plate, engraving): the head is flat and low
 *  (0.036 at the eyes), the back rises over the shoulders to 0.066, then falls along the tail. */
const TOP: readonly Vec2[] = [[0, 0.004], [0.012, 0.020], [0.047, 0.036], [0.10, 0.048], [0.175, 0.056], [0.226, 0.058], [0.32, 0.066], [0.42, 0.064], [0.52, 0.056], [0.62, 0.049], [0.75, 0.041], [0.90, 0.029], [0.97, 0.016], [1, 0.002]];
/** Depth of the belly below the axis: the throat is deeper than the head is high; the trunk is about as deep as high. */
const BOTTOM: readonly Vec2[] = [[0, 0.006], [0.012, 0.030], [0.047, 0.050], [0.10, 0.058], [0.175, 0.064], [0.226, 0.062], [0.32, 0.066], [0.42, 0.064], [0.52, 0.056], [0.62, 0.047], [0.75, 0.039], [0.90, 0.027], [0.97, 0.015], [1, 0.002]];
/** Dorsal fin height above the back: a low ridge from just behind the head, tallest over the tail. */
const FIN_TOP: readonly Vec2[] = [[0.20, 0], [0.26, 0.008], [0.40, 0.011], [0.52, 0.014], [0.62, 0.026], [0.74, 0.034], [0.88, 0.030], [0.96, 0.018], [1, 0.006]];
/** Ventral fin depth below the belly: from the vent to the tail tip. */
const FIN_BOTTOM: readonly Vec2[] = [[0.54, 0], [0.60, 0.012], [0.72, 0.026], [0.88, 0.024], [0.96, 0.014], [1, 0.005]];

const halfWidthCurve = smoothCurve(HALF_WIDTH), topCurve = smoothCurve(TOP), bottomCurve = smoothCurve(BOTTOM);
const finTopCurve = smoothCurve(FIN_TOP), finBottomCurve = smoothCurve(FIN_BOTTOM);
/** Exponent of the cross-section: 2 is an ellipse, larger is squarer. Axolotls are flat-backed, so a little squarer. */
export const SECTION_EXPONENT = 2.3;

/** Half width (px) of the fin's base, which is the pale ridge seen from above. */
export const finRidgeHalfWidth = (s: number): number => (1.4 + 2.6 * sm(0.52, 0.72, s)) * sm(0.20, 0.27, s) * (1 - 0.5 * sm(0.94, 1, s));

// ---- legs: sprawling salamander stance. Angles are measured in the horizontal plane from OUT (straight away from the
// body) towards FWD (the head), so 0 = straight out, + = forward. Lengths are fractions of L as seen from above. ----
export interface LegSpec { readonly upper: number; readonly lower: number; readonly digitsAt: number; readonly digits: number; readonly spread: number; readonly len: readonly [number, number, number]; readonly radius: number; }
export const FRONT_LEG: LegSpec = { upper: -30, lower: 55, digitsAt: 50, digits: 4, spread: 86, len: [0.05, 0.05, 0.045], radius: 11 };
export const BACK_LEG: LegSpec = { upper: 30, lower: -60, digitsAt: 20, digits: 5, spread: 103, len: [0.052, 0.052, 0.05], radius: 12.5 };
export const SHOULDER_AT = 0.24, HIP_AT = 0.52, STRIDE = 8;

export interface Leg { readonly name: string; readonly root: Vec3; readonly joint: Vec3; readonly end: Vec3; readonly tips: readonly Vec3[]; readonly radius: number; }

/** How the body is bent away from its rest pose. */
export interface Pose {
  /** Sideways wave travelling down the body: size in px at the tail tip, and its phase (radians). */
  readonly wave: number;
  readonly phase: number;
}
export const REST: Pose = { wave: 0, phase: 0 };

export interface Axolotl {
  /** Total length in px. */
  readonly L: number;
  /** Midline points, 2 px apart, snout first. */
  readonly spine: readonly Vec2[];
  /** Distance along the midline at each point (px). */
  readonly arc: readonly number[];
  /** Unit direction towards the tail, and unit direction across the body, at each point. */
  readonly tangent: readonly Vec2[];
  readonly normal: readonly Vec2[];
  /** At each point: half width, height of the back and depth of the belly (px, z up), fin heights (px). */
  readonly halfWidth: readonly number[];
  readonly top: readonly number[];
  readonly bottom: readonly number[];
  readonly finTop: readonly number[];
  readonly finBottom: readonly number[];
  readonly eyes: readonly [Vec3, Vec3];
  readonly eyeRadius: number;
  readonly legs: readonly Leg[];
  /** Height of the ground the feet rest on (px, negative). */
  readonly ground: number;
}

const REST_SPINE = restSpine();
const REST_ARC = (() => { const a = [0]; for (let i = 1; i < REST_SPINE.length; i++) a.push(a[i - 1] + Math.hypot(REST_SPINE[i][0] - REST_SPINE[i - 1][0], REST_SPINE[i][1] - REST_SPINE[i - 1][1])); return a; })();
export const LENGTH = REST_ARC[REST_ARC.length - 1];

/** Half widths in px at every midline point: the curve, lightly smoothed along the body away from snout and tail tip. */
const HALF_PX: readonly number[] = (() => {
  const raw = REST_ARC.map(a => halfWidthCurve(a / LENGTH) * LENGTH), R = Math.round(0.012 * LENGTH / 2);
  return raw.map((v, i) => {
    const s = REST_ARC[i] / LENGTH, k = Math.min(1, Math.max(0, (s - 0.05) / 0.04), Math.max(0, (0.93 - s) / 0.04));
    if (k <= 0) return v;
    let t = 0, wsum = 0;
    for (let j = -R; j <= R; j++) { const q = Math.min(raw.length - 1, Math.max(0, i + j)), w = Math.exp(-((j / (R / 2)) ** 2)); t += raw[q] * w; wsum += w; }
    return v + k * (t / wsum - v);
  });
})();

/** Station (index into the midline) at a fraction of the total length. */
export function stationAt(arc: readonly number[], frac: number): number {
  const target = frac * arc[arc.length - 1];
  let i = 0;
  while (i < arc.length - 1 && arc[i] < target) i++;
  return i;
}

const rad = (d: number): number => d * Math.PI / 180;

/** Build the axolotl in a pose. With REST it is exactly the still picture's geometry. */
export function buildAxolotl(pose: Pose = REST): Axolotl {
  const n = REST_SPINE.length, L = LENGTH, arc = REST_ARC;
  // pose: a sideways wave that grows towards the tail (the head stays still)
  const restNormal = (i: number): Vec2 => { const q = REST_SPINE[Math.min(n - 1, i + 1)], r = REST_SPINE[Math.max(0, i - 1)], l = Math.hypot(q[0] - r[0], q[1] - r[1]); return [-(q[1] - r[1]) / l, (q[0] - r[0]) / l]; };
  const spine: Vec2[] = REST_SPINE.map((p, i) => {
    if (!pose.wave) return p;
    const s = arc[i] / L, d = pose.wave * sm(0.15, 1, s) * s * Math.sin(2 * Math.PI * 1.1 * s - pose.phase), nn = restNormal(i);
    return [p[0] + nn[0] * d, p[1] + nn[1] * d];
  });
  const tangent: Vec2[] = spine.map((_, i) => { const q = spine[Math.min(n - 1, i + 1)], r = spine[Math.max(0, i - 1)], l = Math.hypot(q[0] - r[0], q[1] - r[1]); return [(q[0] - r[0]) / l, (q[1] - r[1]) / l]; });
  const normal: Vec2[] = tangent.map(([tx, ty]) => [-ty, tx]);
  const frac = arc.map(a => a / L);
  const top = frac.map(s => topCurve(s) * L), bottom = frac.map(s => -bottomCurve(s) * L);
  const finTop = frac.map(s => finTopCurve(s) * L), finBottom = frac.map(s => finBottomCurve(s) * L);
  const ground = Math.min(...bottom) - 2;

  // eyes: where the head reaches 85 % of its full width, 53 % of the head's half width either side, on the surface
  const headFull = Math.max(...HALF_WIDTH.filter(p => p[0] < 0.2).map(p => p[1]));
  let eyeS = 0.047;
  for (let q = 0.01; q < 0.15; q += 0.0005) if (halfWidthCurve(q) >= 0.85 * headFull) { eyeS = q; break; }
  const je = stationAt(arc, eyeS), eyeOff = 0.53 * halfWidthCurve(eyeS) * L;
  const eyeZ = (() => { const zc = (top[je] + bottom[je]) / 2, hh = (top[je] - bottom[je]) / 2, u = eyeOff / HALF_PX[je]; return zc + hh * Math.max(0, 1 - u ** SECTION_EXPONENT) ** (1 / SECTION_EXPONENT); })();
  const eyes = [-1, 1].map(side => [spine[je][0] + side * normal[je][0] * eyeOff, spine[je][1] + side * normal[je][1] * eyeOff, eyeZ] as Vec3) as [Vec3, Vec3];

  // legs
  const legs: Leg[] = [];
  const leg = (name: string, at: number, side: 1 | -1, stride: number, spec: LegSpec): void => {
    const j = stationAt(arc, at), out: Vec2 = [side * normal[j][0], side * normal[j][1]], fwd: Vec2 = [-tangent[j][0], -tangent[j][1]];
    const dir = (a: number): Vec2 => { const c = Math.cos(rad(a)), q = Math.sin(rad(a)); return [out[0] * c + fwd[0] * q, out[1] * c + fwd[1] * q]; };
    const step = (p: Vec2, d: Vec2, len: number): Vec2 => [p[0] + d[0] * len, p[1] + d[1] * len];
    const zc = (top[j] + bottom[j]) / 2, hh = (top[j] - bottom[j]) / 2;
    const root2: Vec2 = [spine[j][0] + out[0] * (HALF_PX[j] - 7), spine[j][1] + out[1] * (HALF_PX[j] - 7)];
    const joint2 = step(root2, dir(spec.upper + stride), spec.len[0] * L), end2 = step(joint2, dir(spec.lower + stride * 0.5), spec.len[1] * L);
    const zRoot = zc - 0.35 * hh, zFoot = ground + spec.radius * 0.5; // the leg leaves the flank low down; the foot rests on the ground
    const centre = Math.atan2(dir(spec.digitsAt)[1], dir(spec.digitsAt)[0]);
    const tips: Vec3[] = Array.from({ length: spec.digits }, (_, k) => {
      const a = centre + rad(spec.spread) * (k / (spec.digits - 1) - 0.5), len = spec.len[2] * L * (0.85 + 0.15 * Math.sin(Math.PI * k / (spec.digits - 1)));
      return [end2[0] + Math.cos(a) * len, end2[1] + Math.sin(a) * len, ground + 2] as Vec3;
    });
    legs.push({ name, root: [root2[0], root2[1], zRoot], joint: [joint2[0], joint2[1], zRoot - 0.15 * hh], end: [end2[0], end2[1], zFoot], tips, radius: spec.radius });
  };
  leg('front left', SHOULDER_AT, 1, STRIDE, FRONT_LEG);
  leg('front right', SHOULDER_AT, -1, -STRIDE, FRONT_LEG);
  leg('back left', HIP_AT, 1, -STRIDE, BACK_LEG);
  leg('back right', HIP_AT, -1, STRIDE, BACK_LEG);

  return { L, spine, arc, tangent, normal, halfWidth: HALF_PX, top, bottom, finTop, finBottom, eyes, eyeRadius: 4.8, legs, ground };
}
