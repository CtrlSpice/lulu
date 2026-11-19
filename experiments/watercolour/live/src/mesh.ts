// Turns the axolotl model into triangles for the renderer. Every vertex carries where it is on the animal, so the
// watercolour can be painted in the animal's own coordinates (and so stays put on her when she moves):
//   s    position along the body, 0 snout to 1 tail tip (for a leg: 0 root to 1 foot)
//   u    position across: -1 one flank, 0 the midline, +1 the other flank
//   v    position up/down: +1 the back, -1 the belly; on a fin 1 at its base to 2 at its free edge (-1 to -2 below)
//   part which kind of surface it is (PART)
//   lat  distance across from the midline in px
// An eye carries the body's coordinates at the spot it sits on, so the skin's paint continues under it.
// Gills use them differently. Frond: s = 0 at the body to 1 at the tip, u = -1 at the front edge to +1 at the rear
// edge, v = +1 facing up to -1 facing down, lat = which gill. Feathering: s the same, u = which filament (whole
// numbers are the gaps between filaments), v = 0 under the frond's middle to 1 at the filament tips, lat = a number
// for this row of filaments. The filaments of a row are one sheet; the paint draws each filament as a line on it.
import { type Axolotl, type Vec3, SECTION_EXPONENT, finBaseHalfWidth, finThinning } from './model.js';

export const PART = { body: 1, fin: 2, leg: 3, eye: 4, gill: 5, filament: 6 } as const;
/** Gill filaments under a frond: one every this many px along it, in two rows (towards the rear and towards the
 *  front). They lean this far towards the tip (0 = square to the frond) and hang this far below level. */
const FILAMENT_SPACING = 6.5, FILAMENT_LEAN = 0.6, FILAMENT_DROOP = 0.35;
/** Floats per vertex: x y z | s u v part | lat */
export const VERTEX_FLOATS = 8;
export interface Mesh { readonly vertices: Float32Array; readonly indices: Uint32Array; }

const AROUND = 28;       // vertices around a body cross-section
const STATION_STEP = 2;  // use every 2nd midline point (4 px)

export function buildMesh(a: Axolotl): Mesh {
  const v: number[] = [], idx: number[] = [];
  const count = (): number => v.length / VERTEX_FLOATS;
  const push = (p: Vec3, s: number, u: number, vz: number, part: number, lat: number): number => { v.push(p[0], p[1], p[2], s, u, vz, part, lat); return count() - 1; };
  const quad = (p: number, q: number, r: number, t: number): void => { idx.push(p, q, r, p, r, t); };
  const pw = (x: number): number => Math.sign(x) * Math.abs(x) ** (2 / SECTION_EXPONENT);
  const n = a.spine.length, stations: number[] = [];
  for (let i = 0; i < n; i += STATION_STEP) stations.push(i);
  if (stations[stations.length - 1] !== n - 1) stations.push(n - 1);
  const sOf = (i: number): number => a.arc[i] / a.L;

  // body: rings of a squared ellipse around the midline
  let prev = -1;
  for (const i of stations) {
    const first = count(), zc = (a.top[i] + a.bottom[i]) / 2, hh = (a.top[i] - a.bottom[i]) / 2, hw = a.halfWidth[i];
    for (let j = 0; j <= AROUND; j++) {
      const th = 2 * Math.PI * j / AROUND, pu = pw(Math.cos(th)), pv = pw(Math.sin(th)), lat = hw * pu;
      push([a.spine[i][0] + a.normal[i][0] * lat, a.spine[i][1] + a.normal[i][1] * lat, zc + hh * pv], sOf(i), pu, pv, PART.body, lat);
    }
    if (prev >= 0) for (let j = 0; j < AROUND; j++) quad(prev + j, prev + j + 1, first + j + 1, first + j);
    prev = first;
  }

  // fins: standing on the midline, thick where they join the body and thinning quickly to a fine free edge
  const FIN_ROWS = [0, 0.12, 0.3, 0.55]; // heights (0 = base, 1 = free edge) of the rows of vertices up each face
  const fin = (sign: 1 | -1, from: number, height: readonly number[], surface: readonly number[]): void => {
    let last = -1;
    const per = FIN_ROWS.length * 2 + 1;
    for (const i of stations) {
      const s = sOf(i); if (s < from) continue;
      const base = Math.min(finBaseHalfWidth(s), a.halfWidth[i] * 0.9), z0 = surface[i] - sign * 1.5, tall = Math.max(height[i], 1.5 * Math.min(1, (s - from) / 0.04)) + 1.5;
      const p = a.spine[i], nn = a.normal[i], first = count();
      const at = (side: number, h: number): void => { const w = side * base * finThinning(h); push([p[0] + nn[0] * w, p[1] + nn[1] * w, z0 + sign * tall * h], s, w / Math.max(1, a.halfWidth[i]), sign * (1 + h), PART.fin, w); };
      for (const h of FIN_ROWS) at(-1, h);
      at(0, 1);
      for (const h of [...FIN_ROWS].reverse()) at(1, h);
      if (last >= 0) for (let j = 0; j < per - 1; j++) quad(last + j, last + j + 1, first + j + 1, first + j);
      last = first;
    }
  };
  fin(1, 0.20, a.finTop, a.top);
  fin(-1, 0.54, a.finBottom, a.bottom);

  // legs and eyes: tapered tubes and small balls
  const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const cross = (p: Vec3, q: Vec3): Vec3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const unit = (p: Vec3): Vec3 => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
  const tube = (p0: Vec3, p1: Vec3, r0: number, r1: number, s0: number, s1: number): void => {
    const d = unit(sub(p1, p0)), e1 = unit(Math.abs(d[2]) > 0.95 ? cross(d, [1, 0, 0]) : cross(d, [0, 0, 1])), e2 = cross(d, e1), SIDES = 10, first = count();
    for (const [p, r, s] of [[p0, r0, s0], [p1, r1, s1]] as const) for (let j = 0; j <= SIDES; j++) {
      const th = 2 * Math.PI * j / SIDES, c = Math.cos(th), q = Math.sin(th), off: Vec3 = [e1[0] * c + e2[0] * q, e1[1] * c + e2[1] * q, e1[2] * c + e2[2] * q];
      push([p[0] + off[0] * r, p[1] + off[1] * r, p[2] + off[2] * r], s, c, off[2], PART.leg, 0);
    }
    for (let j = 0; j < SIDES; j++) quad(first + j, first + j + 1, first + SIDES + 1 + j + 1, first + SIDES + 1 + j);
  };
  const ball = (c: Vec3, r: number, part: number, s: number): void => {
    const RINGS = 6, SEG = 10, first = count();
    for (let i = 0; i <= RINGS; i++) for (let j = 0; j <= SEG; j++) {
      const ph = Math.PI * i / RINGS, th = 2 * Math.PI * j / SEG, x = Math.sin(ph) * Math.cos(th), y = Math.sin(ph) * Math.sin(th), z = Math.cos(ph);
      push([c[0] + x * r, c[1] + y * r, c[2] + z * r], s, x, z, part, 0);
    }
    for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) { const p = first + i * (SEG + 1) + j; quad(p, p + 1, p + SEG + 2, p + SEG + 1); }
  };
  for (const leg of a.legs) {
    const r = leg.radius, dir = unit(sub(leg.joint, leg.root)), inside: Vec3 = [leg.root[0] - dir[0] * 16, leg.root[1] - dir[1] * 16, leg.root[2] - dir[2] * 16];
    tube(inside, leg.joint, r, r * 0.84, 0, 0.35);       // upper segment, from inside the body to the elbow or knee
    ball(leg.joint, r * 0.84, PART.leg, 0.35);            // the joint
    tube(leg.joint, leg.end, r * 0.84, r * 0.62, 0.35, 0.7); // lower segment, to the wrist or ankle
    ball(leg.end, r * 0.62, PART.leg, 0.7);
    for (const tip of leg.tips) { tube(leg.end, tip, 4.3, 2.2, 0.7, 1); ball(tip, 2.2, PART.leg, 1); }
  }
  // eyes: beads sitting on the head, carrying the skin's coordinates at that spot
  for (const eye of a.eyes) {
    let i = 0, best = Infinity;
    for (let k = 0; k < n; k++) { const d = Math.hypot(eye[0] - a.spine[k][0], eye[1] - a.spine[k][1]); if (d < best) { best = d; i = k; } }
    const lat = (eye[0] - a.spine[i][0]) * a.normal[i][0] + (eye[1] - a.spine[i][1]) * a.normal[i][1], u = lat / a.halfWidth[i], first = count();
    ball(eye, a.eyeRadius, PART.eye, 0);
    for (let k = first; k < count(); k++) { const o = k * VERTEX_FLOATS; v[o + 3] = sOf(i); v[o + 4] = u; v[o + 5] = Math.max(0, 1 - Math.abs(u) ** SECTION_EXPONENT) ** (1 / SECTION_EXPONENT); v[o + 7] = lat; }
  }

  // gills: flat fronds growing out of the flank, with a fringe of filaments along both edges
  for (const [g, gill] of a.gills.entries()) {
    const m = gill.points.length - 1, SIDES = 12, d0 = gill.along[0], p0 = gill.points[0], INSIDE = 16;
    // each frond starts inside the body, wider still, so it rises out of the flank with no gap or step
    const ring = (centre: Vec3, k: number, scale: number, t: number): number => {
      const e1 = gill.across[k], d = gill.along[k], e2 = cross(e1, d), up = e2[2] >= 0 ? 1 : -1, first = count();
      for (let j = 0; j <= SIDES; j++) {
        const th = 2 * Math.PI * j / SIDES, c = Math.cos(th), q = Math.sin(th) * up, w = gill.halfWidth[k] * scale * c, h = gill.halfThick[k] * scale * q;
        push([centre[0] + e1[0] * w + e2[0] * h, centre[1] + e1[1] * w + e2[1] * h, centre[2] + e1[2] * w + e2[2] * h], t, c, Math.sin(th), PART.gill, g);
      }
      return first;
    };
    let last = ring([p0[0] - d0[0] * INSIDE, p0[1] - d0[1] * INSIDE, p0[2] - d0[2] * INSIDE], 0, 1.25, 0);
    for (let k = 0; k <= m; k++) {
      const first = ring(gill.points[k], k, 1, k / m);
      for (let j = 0; j < SIDES; j++) quad(last + j, last + j + 1, first + j + 1, first + j);
      last = first;
    }
    const tip = gill.points[m], dm = gill.along[m], end = ring([tip[0] + dm[0] * 2, tip[1] + dm[1] * 2, tip[2] + dm[2] * 2], m, 0.05, 1);
    for (let j = 0; j < SIDES; j++) quad(last + j, last + j + 1, end + j + 1, end + j);
    const length = Math.hypot(tip[0] - p0[0], tip[1] - p0[1], tip[2] - p0[2]) || 1, filaments = Math.max(4, Math.round(length / FILAMENT_SPACING));
    for (const [row, edge] of [1, -1].entries()) {
      let before = -1;
      for (let k = 0; k <= m; k++) {
        const t = k / m, p = gill.points[k], e = gill.across[k], d = gill.along[k], show = (edge === 1 ? gill.fringeRear : gill.fringeFront)[k];
        const lean = FILAMENT_LEAN + 0.9 * t * t, dir = unit([e[0] * edge + d[0] * lean, e[1] * edge + d[1] * lean, e[2] * edge + d[2] * lean - FILAMENT_DROOP]);
        // the row starts under the middle of the blade and reaches "show" px past its edge
        const under = gill.halfThick[k] * 0.5, start: Vec3 = [p[0], p[1], p[2] - under], reach = show > 0.5 ? gill.halfWidth[k] * 1.1 + show : 0, first = count();
        push(start, t, t * filaments, 0, PART.filament, g * 2 + row);
        push([start[0] + dir[0] * reach, start[1] + dir[1] * reach, start[2] + dir[2] * reach], t, t * filaments, 1, PART.filament, g * 2 + row);
        if (before >= 0) quad(before, before + 1, first + 1, first);
        before = first;
      }
    }
  }

  return { vertices: new Float32Array(v), indices: new Uint32Array(idx) };
}
