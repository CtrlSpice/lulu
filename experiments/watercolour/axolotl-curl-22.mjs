// Watercolour axolotl, curled in a C, head lifted to the right. Silhouette traced from the reference
// (spine and widths in widths.json); washes, limbs, gills and face painted on top.
import { readFileSync } from 'node:fs';
import { W, H, N, makePaper, layer, line, dot, lift, save, useInk, fbm, blur } from './paint.mjs';
import { hexToLab, anchored } from './match.mjs';
import * as P from './paint.mjs';
import * as hd from './head3d.mjs';
import { render as renderHead, mouth as headMouth, pr as headPr } from './head-project.mjs';
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
// ---- head: a 3D axolotl head (head3d.mjs: outline from a top-down photo, profiles from the Dumeril side view,
// length 0.21 of the body) seen through the camera that fits our two eyes and the neck (head-project.mjs). It
// replaces the old head; the body behind it stays. Washes on the head follow the 3D surface: V runs from the top of
// the head (0) to the throat (1). ----
const HEAD = renderHead(), T_NECK = 0.19;
{
  const inHead = i => HEAD.Z[i] < Infinity;
  for (let i = 0; i < N; i++) {
    if (inHead(i)) {
      const x = HEAD.X[i], top = hd.zTop(x), bot = hd.zBot(x), v = Math.min(1, Math.max(0, (top - HEAD.Zh[i]) / Math.max(0.05, top - bot)));
      A[i] = 1; T[i] = T_NECK * (hd.TIP - x) / (hd.TIP - hd.BACK); V[i] = Math.min(1, 0.15 + 2.2 * v); DO[i] = v * 100; DI[i] = (1 - v) * 100;
    } else if (T[i] >= 0 && T[i] < T_NECK) { A[i] = 0; T[i] = -1; } // old head outside the new one
  }
}
// ---- neck: the head dips down towards us, so the neck bends down into it. Both edges run in smooth curves from the
// body at station 52 to the back of the 3D head: the back edge into the head's top, the belly edge into the head's
// lower back corner. The old neck outside this bend is removed. Shading values run along the neck (T) and from the
// back edge (V = 0) to the belly edge (V = 1). ----
{
  const ST = 52, p = sp[ST], q = sp[ST + 1], r = sp[ST - 1], tl = Math.hypot(q[0] - r[0], q[1] - r[1]), tx = (q[0] - r[0]) / tl, ty = (q[1] - r[1]) / tl;
  const march = (dx, dy) => { let d = 0; while (d < 400 && T[Math.round(p[1] + dy * d) * W + Math.round(p[0] + dx * d)] >= 0) d++; return [p[0] + dx * (d - 1), p[1] + dy * (d - 1)]; };
  const backEdge = march(-ty, tx), bellyEdge = march(ty, -tx), toHead = [-tx, -ty];
  // back of the head: the extreme points of its last cross-section across the neck direction
  const across = [-toHead[1], toHead[0]]; let hb = null, hn = null;
  for (let j = 0; j < 360; j++) { const sPt = headPr.p(hd.surf(hd.BACK, j * Math.PI / 180)), dd = sPt[0] * across[0] + sPt[1] * across[1]; if (!hb || dd < hb.d) hb = { s: sPt, d: dd }; if (!hn || dd > hn.d) hn = { s: sPt, d: dd }; }
  const headDir = [0.874, 0.486];
  const herm = (P0, m0, P1, m1) => { const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), out = []; for (let k = 0; k <= 120; k++) { const u = k / 120, h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2; out.push([h00 * P0[0] + h10 * L * m0[0] + h01 * P1[0] + h11 * L * m1[0], h00 * P0[1] + h10 * L * m0[1] + h01 * P1[1] + h11 * L * m1[1]]); } return out; };
  const top = herm(backEdge, toHead, hb.s, headDir), bot = herm(bellyEdge, toHead, hn.s, headDir);
  const tStart = T[Math.round(p[1]) * W + Math.round(p[0])];
  // remove the old neck between station 52 and the head, then fill the bend
  for (let i = 0; i < N; i++) if (T[i] >= T_NECK && T[i] < tStart && HEAD.Z[i] === Infinity) { A[i] = 0; T[i] = -1; }
  const tri = (a, b, c) => { // a, b, c: [x, y, u, v]
    const minx = Math.floor(Math.min(a[0], b[0], c[0])), maxx = Math.ceil(Math.max(a[0], b[0], c[0])), miny = Math.floor(Math.min(a[1], b[1], c[1])), maxy = Math.ceil(Math.max(a[1], b[1], c[1]));
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-9) return;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) { const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den, l3 = 1 - l1 - l2; if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue; const i = y * W + x; if (HEAD.Z[i] < Infinity) continue; const u = l1 * a[2] + l2 * b[2] + l3 * c[2], v = l1 * a[3] + l2 * b[3] + l3 * c[3]; A[i] = 1; T[i] = tStart + (T_NECK - tStart) * u; V[i] = v; DO[i] = v * 100; DI[i] = (1 - v) * 100; } };
  for (let k = 0; k < top.length - 1; k++) { const u0 = k / (top.length - 1), u1 = (k + 1) / (top.length - 1); const A0 = [...top[k], u0, 0], A1 = [...top[k + 1], u1, 0], B0 = [...bot[k], u0, 1], B1 = [...bot[k + 1], u1, 1]; tri(A0, A1, B0); tri(A1, B1, B0); }
  // the head's own back face, between its two back points, is filled by the head; close any sliver between bend and head
  tri([...hb.s, 1, 0], [...hn.s, 1, 1], [...top[top.length - 1], 1, 0]);
}
// ---- neck: where the body meets the 3D head the corners are rounded with a closing (grow by R, shrink back by R),
// only inside two windows around the junction (far side behind the far gills, belly side behind the near cheek), and
// only adding pixels, so the outline elsewhere is untouched ----
{
  const R = 30, inWin = (x, y) => (x >= 690 && x <= 870 && y >= 140 && y <= 310) || (x >= 520 && x <= 680 && y >= 320 && y <= 480);
  const dist = inside => { // chamfer distance (px) to the nearest pixel where inside() is true
    const D = new Float32Array(N).fill(1e9); for (let i = 0; i < N; i++) if (inside(i)) D[i] = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (x > 0) D[i] = Math.min(D[i], D[i - 1] + 1); if (y > 0) { D[i] = Math.min(D[i], D[i - W] + 1); if (x > 0) D[i] = Math.min(D[i], D[i - W - 1] + 1.414); if (x < W - 1) D[i] = Math.min(D[i], D[i - W + 1] + 1.414); } }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (x < W - 1) D[i] = Math.min(D[i], D[i + 1] + 1); if (y < H - 1) { D[i] = Math.min(D[i], D[i + W] + 1); if (x < W - 1) D[i] = Math.min(D[i], D[i + W + 1] + 1.414); if (x > 0) D[i] = Math.min(D[i], D[i + W - 1] + 1.414); } }
    return D;
  };
  const toBody = dist(i => A[i] > 0.5), grown = i => toBody[i] <= R, toOutside = dist(i => !grown(i));
  for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0; if (A[i] < 0.5 && inWin(x, y) && toOutside[i] > R) { A[i] = Math.min(1, (toOutside[i] - R) / 1.6 + 0.4); T[i] = -1; } }
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
// ---- blend the head and body shading values across the neck, so no wash edge marks where the 3D head meets the
// traced body: average T and V over nearby body pixels (radius ~12 px), only in the head and neck area ----
{
  const inArea = i => { const x = i % W, y = (i / W) | 0; return x >= 500 && y >= 100 && y <= 580; };
  const wA = new Float32Array(N), wT = new Float32Array(N), wV = new Float32Array(N);
  for (let i = 0; i < N; i++) if (A[i] > 0.5 && T[i] >= 0) { wA[i] = 1; wT[i] = T[i]; wV[i] = V[i]; }
  const bA = blur(wA, 6), bT = blur(wT, 6), bV = blur(wV, 6);
  for (let i = 0; i < N; i++) if (A[i] > 0 && T[i] >= 0 && inArea(i) && bA[i] > 0.05) { const x = i % W, k = Math.min(1, Math.max(0, (x - 500) / 40)); T[i] += (bT[i] / bA[i] - T[i]) * k; V[i] += (bV[i] / bA[i] - V[i]) * k; }
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
// shoulder points on the final outline: from the spine at a station, out to the belly edge and to the far flank, 6 px inside
const shoulderAt = st => { const p = sp[st], q = sp[st + 1], r = sp[st - 1], tl = Math.hypot(q[0] - r[0], q[1] - r[1]), tx = (q[0] - r[0]) / tl, ty = (q[1] - r[1]) / tl, nx = -ty, ny = tx;
  const edge = (dx, dy) => { let d = 0; while (A[Math.round(p[1] + dy * d) * W + Math.round(p[0] + dx * d)] > 0.5 && d < 400) d++; return [p[0] + dx * (d - 6), p[1] + dy * (d - 6)]; };
  return { near: edge(-nx, -ny), far: edge(nx, ny), tail: [tx, ty], outNear: [-nx, -ny], outFar: [nx, ny] }; };
const mix = (a, ka, b, kb) => unit(a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb);
const foreLeg = (L, sh, tail, out, k, size, ink) => {
  const fwd = [-tail[0], -tail[1]];
  const elbow = toward(sh, mix(out, 0.75, tail, 0.6), 70 * size);
  const handDir = mix(fwd, 0.9, out, 0.3), wrist = toward(elbow, handDir, 60 * size);
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
const SH = shoulderAt(38);
foreLeg(limbs, SH.near, SH.tail, SH.outNear, 1, 1, 1);
hindLeg(limbs, [262, 300], unit(-0.64, 0.77), unit(0.77, 0.64), 1, 1, 1);
// far pair: we look down on her from above and to the side, so the outer edge of the curl is her far flank; the far
// legs come out from under it at the same stations, a little shorter and paler, with the body hiding their roots
const farLimbs = layer(), FAR = 0.6, FS = 0.88;
foreLeg(farLimbs, SH.far, SH.tail, SH.outFar, 0.92, FS, FAR); // same station, across from the near shoulder
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
// mouth: the gape of the 3D head at lip height, as much of it as we can see from this angle (small gaps joined)
{
  const runs = headMouth(HEAD.Z), joined = [];
  for (const r of runs) { const last = joined[joined.length - 1]; if (last && Math.hypot(r[0][0] - last[last.length - 1][0], r[0][1] - last[last.length - 1][1]) < 25) last.push(...r); else joined.push([...r]); }
  for (const r of joined) {
    // smooth small wobbles from the surface mesh (moving average over 9 points), every 4th point
    const sm9 = r.map((_, k) => { let x = 0, y = 0, c = 0; for (let j = Math.max(0, k - 10); j <= Math.min(r.length - 1, k + 10); j++) { x += r[j][0]; y += r[j][1]; c++; } return [x / c, y / c]; });
    const pts = sm9.filter((_, k) => k % 4 === 0 || k === sm9.length - 1);
    const lip = layer(); lip.stroke(pts.map(([x, y]) => [x, y + 5]), t => 4.5 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)), () => 0.2); lip.dry({ bleed: 3, cloud: 0.3, feather: 0.5, ring: 0.2, soften: 2 });
    line(pts, 1.4, 0.85);
  }
}

save(out, {
  paper: hexToLab('#faf4ed'),
  curves: {
    body: { curve: anchored('edo-murasaki', [['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    wine: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
  },
});
