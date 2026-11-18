import { readFileSync } from 'node:fs';
const c = JSON.parse(readFileSync('/Users/moya/Workspace/otel-desktop-viewer/desktopexporter/internal/frontend/public/licenses/madoromi/ink-curves.json', 'utf8'));
export const hexToLab = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); const [r, g, b] = v;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
export const nearest = hex => { const t = hexToLab(hex); let best = []; for (const [k, a] of Object.entries(c.inks)) for (let i = 0; i < 96; i++) { const d = Math.hypot(a[i * 3] - t[0], a[i * 3 + 1] - t[1], a[i * 3 + 2] - t[2]); best.push([d, k, i]); } best.sort((x, y) => x[0] - y[0]); const seen = new Set(); return best.filter(([, k]) => !seen.has(k) && seen.add(k)).slice(0, 3); };
if (import.meta.url === `file://${process.argv[1]}`) for (const h of process.argv.slice(2)) console.log(h, hexToLab(h).map(x => x.toFixed(3)).join(','), nearest(h).map(([d, k, i]) => `${k}@${i} d=${d.toFixed(3)}`).join('  '));

// A curve for one pixel Lulu colour family: follows a measured ink curve between anchor points,
// shifted so each anchor lands exactly on its Lulu colour. After the last anchor it either keeps
// following the ink (offset easing to zero) or goes straight to the paper.
export const anchored = (ink, anchors, tail = "ink", paperHex = "#faf4ed") => {
  const a = c.inks[ink], P = i => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
  const A = anchors.map(([hex, i]) => ({ i, off: hexToLab(hex).map((v, j) => v - P(i)[j]) }));
  const out = [];
  for (let i = A[0].i; i <= 95; i++) {
    let off;
    const k = A.findIndex((p, n) => n < A.length - 1 && i >= p.i && i <= A[n + 1].i);
    if (k >= 0) { const p = A[k], q = A[k + 1], f = (i - p.i) / (q.i - p.i); off = p.off.map((v, j) => v + (q.off[j] - v) * f); }
    else {
      const last = A[A.length - 1], f = (i - last.i) / (95 - last.i || 1);
      if (tail === "paper") { const from = P(last.i).map((v, j) => v + last.off[j]), to = hexToLab(paperHex); out.push(...from.map((v, j) => v + (to[j] - v) * f)); continue; }
      off = last.off.map(v => v * (1 - f));
    }
    out.push(...P(i).map((v, j) => v + off[j]));
  }
  return out;
};
