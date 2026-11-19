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

/** Half width (px) of the fin's crest, the pale ridge seen from above. The fin's fleshy base is wider: finBaseHalfWidth. */
export const finRidgeHalfWidth = (s: number): number => (1.4 + 2.6 * sm(0.52, 0.72, s)) * sm(0.20, 0.27, s) * (1 - 0.5 * sm(0.94, 1, s));

/** Half width (px) of the fin where it joins the body. The fin is thick and fleshy there and thins quickly to a membrane. */
export const finBaseHalfWidth = (s: number): number => 2.2 * finRidgeHalfWidth(s) + 2.5 * sm(0.20, 0.27, s);
/** How the fin thins with height: its half width at height h (0 = base, 1 = free edge), as a fraction of the base. */
export const finThinning = (h: number): number => (1 - h) ** 2.4;

// ---- legs: sprawling salamander stance. Angles are measured in the horizontal plane from OUT (straight away from the
// body) towards FWD (the head), so 0 = straight out, + = forward. Lengths are fractions of L as seen from above. ----
export interface LegSpec { readonly upper: number; readonly lower: number; readonly digitsAt: number; readonly digits: number; readonly spread: number; readonly len: readonly [number, number, number]; readonly radius: number; }
// The front leg is posed so that, seen from above, the forearm and hand come out behind the gill fronds instead of
// lying under them: the elbow points back, the forearm reaches straight out and the hand is planted out to the side.
// (Calculated: of the poses with at least a 60 degree bend at the elbow whose hand stays 6 px clear of the gills on
// both sides, this is the one closest to the still picture's pose, which was upper -30, lower 55, digits at 50, spread 86.)
export const FRONT_LEG: LegSpec = { upper: -60, lower: 0, digitsAt: 0, digits: 4, spread: 78, len: [0.05, 0.05, 0.045], radius: 11 };
export const BACK_LEG: LegSpec = { upper: 30, lower: -60, digitsAt: 20, digits: 5, spread: 103, len: [0.052, 0.052, 0.05], radius: 12.5 };
/** Radius of the eye beads (px). The still used 4.8 with ink bleeding around it; the live bead is crisp, so it is a little larger to read as beady. */
export const EYE_RADIUS = 6.4;
export const SHOULDER_AT = 0.24, HIP_AT = 0.52, STRIDE = 8;

// ---- gills: three fronds on each side, growing side by side out of the edge of the head at its back corner (from its
// widest point back to where the neck begins), so their flared bases join into one raised base. Each frond is a flat, tapering blade of her own skin (broad face up),
// sweeping out and back and curving towards the tail. The gill filaments hang under it as fine feathering that shows
// past both of its edges: longer behind, shorter in front. Size, spread and feathering follow the old illustration (fronds
// about 0.7 of the head's width long); the order (the lowest frond the most forward and outward, the highest the most
// swept back) follows photographs of living axolotls. ----
export interface GillSpec {
  readonly name: string;
  /** Where the frond leaves the body: position along the body (fraction of L), and how far up the flank in degrees
   *  (0 = the widest point of the side, 90 = the top of the back). */
  readonly at: number; readonly around: number;
  /** The frond's direction at its middle, in degrees: from straight back (0) towards straight out (90), and above level. */
  readonly out: number; readonly rise: number;
  /** Length (fraction of L) and half width of the blade (px). */
  readonly length: number; readonly width: number;
}
export const GILLS: readonly GillSpec[] = [
  { name: 'upper', at: 0.190, around: 16, out: 14, rise: 40, length: 0.105, width: 10.5 },
  { name: 'middle', at: 0.176, around: 12, out: 33, rise: 26, length: 0.122, width: 11 },
  { name: 'lower', at: 0.162, around: 8, out: 50, rise: 12, length: 0.118, width: 10.5 },
];
/** Degrees a frond turns towards the tail, and levels off, between its root and its tip. */
export const GILL_SWEEP = 30, GILL_LEVEL = 14;
/** How many straight pieces a frond is built from. */
export const GILL_PIECES = 20;
/** The blade's half width along the frond, as a multiple of its width: flared where it grows out of the body, then a
 *  long taper to a soft point. Its half thickness as a fraction of its half width: fleshy at the body, thin at the tip. */
const gillTaper = smoothCurve([[0, 1.9], [0.07, 1.3], [0.16, 1.02], [0.45, 0.92], [0.75, 0.62], [0.93, 0.3], [1, 0.1]]);
const gillThickness = (t: number): number => 0.8 - 0.35 * sm(0.05, 0.7, t);
/** How far the gill shows past the blade's rear and front edge (px). It widens steadily along the frond and narrows
 *  again at the tip, like a feather. The fronds of a side fan apart at about 18 degrees, so the gap between two
 *  neighbours also widens along them (about 5 px at 0.3 of the length, 14 px at the middle, 36 px at 0.8). The gills
 *  are sized to fill that gap with only a few px to spare, so each frond's gill laps a little over its neighbour's
 *  instead of burying it. */
const gillFringe = (t: number, rear: boolean): number => (rear ? 20 : 16) * sm(0.05, 0.85, t) ** 1.2 * (1 - 0.45 * sm(0.8, 1, t));

export interface Gill {
  readonly name: string;
  readonly side: 1 | -1;
  /** Where on the body the frond grows from, in the skin's own coordinates: position along (0 to 1), across
   *  (-1 to 1), up (0 to 1), and px across from the midline. The frond's skin continues the body's from there. */
  readonly root: readonly [number, number, number, number];
  /** The frond's centre line from the body's surface to the tip. At each point: its direction, and the level
   *  direction across the blade towards its rear edge (both unit). */
  readonly points: readonly Vec3[];
  readonly along: readonly Vec3[];
  readonly across: readonly Vec3[];
  /** At each point: the blade's half width and half thickness, and the fringe length on the rear and front edges (px). */
  readonly halfWidth: readonly number[];
  readonly halfThick: readonly number[];
  readonly fringeRear: readonly number[];
  readonly fringeFront: readonly number[];
}

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
  /** Six gills: upper, middle and lower on each side. */
  readonly gills: readonly Gill[];
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

  // gills
  const unit3 = (p: Vec3): Vec3 => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
  const squared = (x: number): number => Math.sign(x) * Math.abs(x) ** (2 / SECTION_EXPONENT);
  const gills: Gill[] = [];
  for (const side of [1, -1] as const) for (const spec of GILLS) {
    const j = stationAt(arc, spec.at), out: Vec2 = [side * normal[j][0], side * normal[j][1]], back: Vec2 = tangent[j];
    const zc = (top[j] + bottom[j]) / 2, hh = (top[j] - bottom[j]) / 2, lat = HALF_PX[j] * squared(Math.cos(rad(spec.around)));
    const heading = (t: number): Vec3 => {
      const az = rad(spec.out + GILL_SWEEP * (0.5 - t)), el = rad(spec.rise + GILL_LEVEL * (0.5 - t)), c = Math.cos(el);
      return [(back[0] * Math.cos(az) + out[0] * Math.sin(az)) * c, (back[1] * Math.cos(az) + out[1] * Math.sin(az)) * c, Math.sin(el)];
    };
    const points: Vec3[] = [[spine[j][0] + out[0] * lat, spine[j][1] + out[1] * lat, zc + hh * squared(Math.sin(rad(spec.around)))]];
    const along: Vec3[] = [], across: Vec3[] = [], halfWidth: number[] = [], halfThick: number[] = [], fringeRear: number[] = [], fringeFront: number[] = [], piece = spec.length * L / GILL_PIECES;
    for (let k = 0; k <= GILL_PIECES; k++) {
      const t = k / GILL_PIECES, d = heading(t), level = unit3([-d[1], d[0], 0]), rear = level[0] * back[0] + level[1] * back[1] >= 0 ? 1 : -1;
      along.push(d); across.push([level[0] * rear, level[1] * rear, 0]);
      halfWidth.push(spec.width * gillTaper(t)); halfThick.push(spec.width * gillTaper(t) * gillThickness(t));
      fringeRear.push(gillFringe(t, true)); fringeFront.push(gillFringe(t, false));
      if (k < GILL_PIECES) { const m = heading((k + 0.5) / GILL_PIECES), p = points[k]; points.push([p[0] + m[0] * piece, p[1] + m[1] * piece, p[2] + m[2] * piece]); }
    }
    const root = [arc[j] / L, side * squared(Math.cos(rad(spec.around))), squared(Math.sin(rad(spec.around))), side * lat] as const;
    gills.push({ name: `${spec.name} ${side === 1 ? 'left' : 'right'}`, side, root, points, along, across, halfWidth, halfThick, fringeRear, fringeFront });
  }

  return { L, spine, arc, tangent, normal, halfWidth: HALF_PX, top, bottom, finTop, finBottom, eyes, eyeRadius: EYE_RADIUS, legs, gills, ground };
}
