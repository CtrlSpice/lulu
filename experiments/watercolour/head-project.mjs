// Projects the 3D head (head3d.mjs) into the drawing with the camera that fits our eyes and neck (camera.mjs).
// Scale: head length 0.21 of the total body length (1517 px), from the scientific references.
import * as hd from './head3d.mjs';
import { cameras, projector } from './camera.mjs';
export const W = 1000, H = 700;
export const K = Math.round(0.21 * 1517 / (hd.TIP - hd.BACK));
export const cam = cameras().find(c => c.k === K);
export const pr = projector(cam);
// depth buffer of the head surface, with the head coordinates (x forward, z up) of the visible point at each pixel
export const render = () => {
  const Z = new Float32Array(W * H).fill(Infinity), X = new Float32Array(W * H), Zh = new Float32Array(W * H);
  const NX = 300, NT = 240, grid = [];
  for (let i = 0; i <= NX; i++) { const x = hd.TIP + (hd.BACK - hd.TIP) * i / NX, row = []; for (let j = 0; j <= NT; j++) { const P = hd.surf(x, 2 * Math.PI * j / NT); row.push({ P, s: pr.p(P), d: pr.depth(P) }); } grid.push(row); }
  const tri = (a, b, c) => {
    const minx = Math.max(0, Math.floor(Math.min(a.s[0], b.s[0], c.s[0]))), maxx = Math.min(W - 1, Math.ceil(Math.max(a.s[0], b.s[0], c.s[0]))), miny = Math.max(0, Math.floor(Math.min(a.s[1], b.s[1], c.s[1]))), maxy = Math.min(H - 1, Math.ceil(Math.max(a.s[1], b.s[1], c.s[1])));
    const den = (b.s[1] - c.s[1]) * (a.s[0] - c.s[0]) + (c.s[0] - b.s[0]) * (a.s[1] - c.s[1]); if (Math.abs(den) < 1e-9) return;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5, py = y + 0.5, l1 = ((b.s[1] - c.s[1]) * (px - c.s[0]) + (c.s[0] - b.s[0]) * (py - c.s[1])) / den, l2 = ((c.s[1] - a.s[1]) * (px - c.s[0]) + (a.s[0] - c.s[0]) * (py - c.s[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const d = l1 * a.d + l2 * b.d + l3 * c.d, i = y * W + x;
      if (d < Z[i]) { Z[i] = d; X[i] = l1 * a.P[0] + l2 * b.P[0] + l3 * c.P[0]; Zh[i] = l1 * a.P[2] + l2 * b.P[2] + l3 * c.P[2]; }
    }
  };
  for (let i = 0; i < NX; i++) for (let j = 0; j < NT; j++) { const a = grid[i][j], b = grid[i + 1][j], c = grid[i][j + 1], d = grid[i + 1][j + 1]; tri(a, b, c); tri(b, d, c); }
  return { Z, X, Zh };
};
// the mouth on the head surface at lip height, near corner -> round the tip -> far corner; keeps only what we can see
export const mouth = Z => {
  const at = (x, side) => { const w = hd.halfW(x), zc = (hd.zTop(x) + hd.zBot(x)) / 2, h = (hd.zTop(x) - hd.zBot(x)) / 2, s = Math.max(-1, Math.min(1, (hd.mouthZ - zc) / h)); return [x, side * w * Math.max(0, 1 - Math.abs(s) ** 2.5) ** (1 / 2.5), hd.mouthZ]; };
  const pts = []; for (let x = hd.mouthBack; x <= hd.TIP; x += 0.004) pts.push(at(x, -1)); for (let x = hd.TIP; x >= hd.mouthBack; x -= 0.004) pts.push(at(x, 1));
  // the near side faces us, so all of it shows; the far side shows only until it turns away behind the snout
  const near = [], far = [];
  for (const P of pts) { const s = pr.p(P); if (P[1] <= 0) near.push(s); else { const i = Math.round(s[1]) * W + Math.round(s[0]); if (pr.depth(P) <= Z[i] + 0.04) far.push(s); else break; } }
  return [near]; // the far side turns away right at the tip, so only the near side is drawn
};
const _unused = () => {
  return runs.filter(r => r.length > 3);
};
export const gillBases = () => [-1, 1].map(side => pr.p([hd.BACK, side * hd.halfW(hd.BACK), 0.15]));
