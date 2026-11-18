// Orthographic camera for the head: screen = k * (r1 . P, r2 . P) + t, with r1, r2 orthonormal rows.
// Fixed by our two eyes (difference (101, -53)) and the neck direction (0.874, 0.486); one angle stays free (k).
import * as hd from './head3d.mjs';
const EYE = [101, -53], NECK = [0.874, 0.486], F = [848, 402.25];
export const cameras = () => {
  const out = [];
  for (let k = 115; k <= 320; k += 1) for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    const f = c => { const q1 = 1 - (NECK[0] * c) ** 2 - (EYE[0] / k) ** 2, q2 = 1 - (NECK[1] * c) ** 2 - (EYE[1] / k) ** 2; if (q1 < 0 || q2 < 0) return NaN; return NECK[0] * NECK[1] * c * c + EYE[0] * EYE[1] / k ** 2 + s1 * s2 * Math.sqrt(q1) * Math.sqrt(q2); };
    let prev = f(0.001);
    for (let c = 0.002; c < 1.5; c += 0.001) { const v = f(c); if (!isNaN(v) && !isNaN(prev) && Math.sign(v) !== Math.sign(prev)) {
      const r1 = [NECK[0] * c, EYE[0] / k, s1 * Math.sqrt(1 - (NECK[0] * c) ** 2 - (EYE[0] / k) ** 2)];
      const r2 = [NECK[1] * c, EYE[1] / k, s2 * Math.sqrt(1 - (NECK[1] * c) ** 2 - (EYE[1] / k) ** 2)];
      const r3 = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]]; // into the screen
      // we look from above (head top faces us: r3 . up < 0) and the near eye (a = -0.5) is the one closer to us (r3 . a > 0)
      if (r3[2] < 0 && r3[1] > 0) out.push({ k, c, r1, r2, r3 });
    } prev = v; }
  }
  return out;
};
export const projector = cam => { const e0 = [0, 0, hd.eyeZ], t = [F[0] - cam.k * (cam.r1[2] * e0[2]), F[1] - cam.k * (cam.r2[2] * e0[2])];
  return { p: P => [t[0] + cam.k * (cam.r1[0] * P[0] + cam.r1[1] * P[1] + cam.r1[2] * P[2]), t[1] + cam.k * (cam.r2[0] * P[0] + cam.r2[1] * P[1] + cam.r2[2] * P[2])], depth: P => cam.r3[0] * P[0] + cam.r3[1] * P[1] + cam.r3[2] * P[2] }; };
if (import.meta.url === `file://${process.argv[1]}`) {
  const cs = cameras();
  const pick = cs.filter((_, i) => i % Math.max(1, Math.floor(cs.length / 12)) === 0);
  for (const cam of pick) { const pr = projector(cam); const view = Math.acos(-cam.r3[2]) * 180 / Math.PI; console.log('k', cam.k, 'tilt from straight above (deg)', view.toFixed(0), 'tip ->', pr.p([hd.TIP, 0, hd.zTop(hd.TIP)]).map(Math.round), 'near eye ->', pr.p([0, -0.5, hd.eyeZ]).map(v => v.toFixed(1))); }
  console.log('count', cs.length);
}
