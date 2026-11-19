// Checks that the 3D model, seen straight from above in its rest pose, is the still picture axolotl-top-04:
// same midline, same half widths, same eyes, same shoulders and same back legs. Run with: npm test
// usage: node tools/check-model.ts <full geometry json> <guide geometry json> (both dumped by axolotl-top-04.mjs)
import { readFileSync } from 'node:fs';
import { buildAxolotl } from '../dist/model.js';

type Pt = [number, number];
const [fullFile, guideFile] = process.argv.slice(2);
const full = JSON.parse(readFileSync(fullFile, 'utf8')) as { L: number; spine: Pt[]; half: number[]; arc: number[] };
const guide = JSON.parse(readFileSync(guideFile, 'utf8')) as { eyes: Pt[]; legs: { name: string; root: Pt; joint: Pt; end: Pt; tips: Pt[] }[] };
const a = buildAxolotl();
const d2 = (p: readonly number[], q: readonly number[]): number => Math.hypot(p[0] - q[0], p[1] - q[1]);
let fails = 0;
const check = (name: string, value: number, limit: number): void => {
  const ok = value <= limit;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${value.toFixed(4)} px (limit ${limit})`);
};
check('number of midline points differs by', Math.abs(a.spine.length - full.spine.length), 0);
check('total length differs by', Math.abs(a.L - full.L), 0.001);
check('midline: largest distance from the still', Math.max(...a.spine.map((p, i) => d2(p, full.spine[i]))), 0.001);
check('half width: largest difference from the still', Math.max(...a.halfWidth.map((w, i) => Math.abs(w - full.half[i]))), 0.001);
check('eyes: largest distance from the still', Math.max(...a.eyes.map((e, i) => d2(e, guide.eyes[i]))), 0.001);
// The front legs keep the still's shoulders, but their pose was changed on 2026-11-18 so the hands come out behind
// the gill fronds (see FRONT_LEG in model.ts). So only their roots are compared; the back legs are compared in full.
for (const [i, leg] of a.legs.entries()) {
  const g = guide.legs[i];
  if (leg.name.startsWith('front')) { check(`${leg.name} leg: root, distance from the still`, d2(leg.root, g.root), 0.001); continue; }
  check(`${leg.name} leg: root, joint, end and digit tips, largest distance from the still`, Math.max(d2(leg.root, g.root), d2(leg.joint, g.joint), d2(leg.end, g.end), ...leg.tips.map((t, k) => d2(t, g.tips[k]))), 0.001);
}
// 3D sanity: the body is never thinner than 0 and the feet are below the belly
check('cross-sections with the back below the belly', a.top.filter((t, i) => t < a.bottom[i]).length, 0);
check('feet above the lowest point of the belly by', Math.max(0, ...a.legs.map(l => l.end[2] - Math.min(...a.bottom) - l.radius)), 0);
// gills: three fronds a side, mirrored, growing from the back corner of the head (between its widest point and the neck)
check('gill fronds missing (of 6)', 6 - a.gills.length, 0);
const mirrored = a.gills.slice(0, 3).map((g, i) => { const o = a.gills[i + 3]; return Math.max(Math.abs(g.root[0] - o.root[0]) * a.L, Math.abs(g.root[3] + o.root[3]), ...g.points.map((p, k) => Math.abs(p[2] - o.points[k][2]))); });
check('gill fronds: largest difference between the left and right of a pair', Math.max(...mirrored), 0.001);
check('gill fronds growing from somewhere other than the back corner of the head', a.gills.filter(g => g.root[0] < 0.15 || g.root[0] > 0.2).length, 0);
check('gill fronds whose skin does not start on the body surface', a.gills.filter(g => Math.abs(Math.abs(g.root[1]) ** 2.3 + g.root[2] ** 2.3 - 1) > 1e-6).length, 0);
console.log(fails ? `${fails} FAILED` : 'all passed: the model seen from above is the still picture');
process.exit(fails ? 1 : 0);
