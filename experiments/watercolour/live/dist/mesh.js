// Turns the axolotl model into triangles for the renderer. Every vertex carries where it is on the animal, so the
// watercolour can be painted in the animal's own coordinates (and so stays put on her when she moves):
//   s    position along the body, 0 snout to 1 tail tip (for a leg: 0 root to 1 foot)
//   u    position across: -1 one flank, 0 the midline, +1 the other flank
//   v    position up/down: +1 the back, -1 the belly; on a fin 1 at its base to 2 at its free edge (-1 to -2 below)
//   part which kind of surface it is (PART)
//   lat  distance across from the midline in px
import { SECTION_EXPONENT, finRidgeHalfWidth } from './model.js';
export const PART = { body: 1, fin: 2, leg: 3, eye: 4 };
/** Floats per vertex: x y z | s u v part | lat */
export const VERTEX_FLOATS = 8;
const AROUND = 28; // vertices around a body cross-section
const STATION_STEP = 2; // use every 2nd midline point (4 px)
export function buildMesh(a) {
    const v = [], idx = [];
    const count = () => v.length / VERTEX_FLOATS;
    const push = (p, s, u, vz, part, lat) => { v.push(p[0], p[1], p[2], s, u, vz, part, lat); return count() - 1; };
    const quad = (p, q, r, t) => { idx.push(p, q, r, p, r, t); };
    const pw = (x) => Math.sign(x) * Math.abs(x) ** (2 / SECTION_EXPONENT);
    const n = a.spine.length, stations = [];
    for (let i = 0; i < n; i += STATION_STEP)
        stations.push(i);
    if (stations[stations.length - 1] !== n - 1)
        stations.push(n - 1);
    const sOf = (i) => a.arc[i] / a.L;
    // body: rings of a squared ellipse around the midline
    let prev = -1;
    for (const i of stations) {
        const first = count(), zc = (a.top[i] + a.bottom[i]) / 2, hh = (a.top[i] - a.bottom[i]) / 2, hw = a.halfWidth[i];
        for (let j = 0; j <= AROUND; j++) {
            const th = 2 * Math.PI * j / AROUND, pu = pw(Math.cos(th)), pv = pw(Math.sin(th)), lat = hw * pu;
            push([a.spine[i][0] + a.normal[i][0] * lat, a.spine[i][1] + a.normal[i][1] * lat, zc + hh * pv], sOf(i), pu, pv, PART.body, lat);
        }
        if (prev >= 0)
            for (let j = 0; j < AROUND; j++)
                quad(prev + j, prev + j + 1, first + j + 1, first + j);
        prev = first;
    }
    // fins: thin wedges standing on the midline. The dorsal fin's base is the pale ridge seen from above.
    const wedge = (sign, from, baseHalf, height, surface) => {
        let last = -1;
        for (const i of stations) {
            const s = sOf(i);
            if (s < from)
                continue;
            const b = Math.min(baseHalf(s), a.halfWidth[i] * 0.9), z0 = surface[i] - sign * 1, z1 = surface[i] + sign * Math.max(height[i], 1.5 * Math.min(1, (s - from) / 0.04));
            const p = [a.spine[i][0], a.spine[i][1], 0], nn = a.normal[i], first = count();
            push([p[0] - nn[0] * b, p[1] - nn[1] * b, z0], s, -b / Math.max(1, a.halfWidth[i]), sign, PART.fin, -b);
            push([p[0], p[1], z1], s, 0, sign * 2, PART.fin, 0);
            push([p[0] + nn[0] * b, p[1] + nn[1] * b, z0], s, b / Math.max(1, a.halfWidth[i]), sign, PART.fin, b);
            if (last >= 0) {
                quad(last, last + 1, first + 1, first);
                quad(last + 1, last + 2, first + 2, first + 1);
            }
            last = first;
        }
    };
    wedge(1, 0.20, finRidgeHalfWidth, a.finTop, a.top);
    wedge(-1, 0.54, () => 2.5, a.finBottom, a.bottom);
    // legs and eyes: tapered tubes and small balls
    const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const unit = (p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
    const tube = (p0, p1, r0, r1, s0, s1) => {
        const d = unit(sub(p1, p0)), e1 = unit(Math.abs(d[2]) > 0.95 ? cross(d, [1, 0, 0]) : cross(d, [0, 0, 1])), e2 = cross(d, e1), SIDES = 10, first = count();
        for (const [p, r, s] of [[p0, r0, s0], [p1, r1, s1]])
            for (let j = 0; j <= SIDES; j++) {
                const th = 2 * Math.PI * j / SIDES, c = Math.cos(th), q = Math.sin(th), off = [e1[0] * c + e2[0] * q, e1[1] * c + e2[1] * q, e1[2] * c + e2[2] * q];
                push([p[0] + off[0] * r, p[1] + off[1] * r, p[2] + off[2] * r], s, c, off[2], PART.leg, 0);
            }
        for (let j = 0; j < SIDES; j++)
            quad(first + j, first + j + 1, first + SIDES + 1 + j + 1, first + SIDES + 1 + j);
    };
    const ball = (c, r, part, s) => {
        const RINGS = 6, SEG = 10, first = count();
        for (let i = 0; i <= RINGS; i++)
            for (let j = 0; j <= SEG; j++) {
                const ph = Math.PI * i / RINGS, th = 2 * Math.PI * j / SEG, x = Math.sin(ph) * Math.cos(th), y = Math.sin(ph) * Math.sin(th), z = Math.cos(ph);
                push([c[0] + x * r, c[1] + y * r, c[2] + z * r], s, x, z, part, 0);
            }
        for (let i = 0; i < RINGS; i++)
            for (let j = 0; j < SEG; j++) {
                const p = first + i * (SEG + 1) + j;
                quad(p, p + 1, p + SEG + 2, p + SEG + 1);
            }
    };
    for (const leg of a.legs) {
        const r = leg.radius, dir = unit(sub(leg.joint, leg.root)), inside = [leg.root[0] - dir[0] * 16, leg.root[1] - dir[1] * 16, leg.root[2] - dir[2] * 16];
        tube(inside, leg.joint, r, r * 0.84, 0, 0.35); // upper segment, from inside the body to the elbow or knee
        ball(leg.joint, r * 0.84, PART.leg, 0.35); // the joint
        tube(leg.joint, leg.end, r * 0.84, r * 0.62, 0.35, 0.7); // lower segment, to the wrist or ankle
        ball(leg.end, r * 0.62, PART.leg, 0.7);
        for (const tip of leg.tips) {
            tube(leg.end, tip, 4.3, 2.2, 0.7, 1);
            ball(tip, 2.2, PART.leg, 1);
        }
    }
    for (const eye of a.eyes)
        ball(eye, a.eyeRadius, PART.eye, 0);
    return { vertices: new Float32Array(v), indices: new Uint32Array(idx) };
}
