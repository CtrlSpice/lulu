// Ink wash renderer: each wash layer is painted as soft brush strokes, then bled outward into the paper
// along fibres (a feathered fringe), then dried onto the sheet. Darker layers go on top. Renders a PNG.
import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

export const W = 1000, H = 700, N = W * H;

let seed = 7;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x, y, oct = 4) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return v / (1 - 0.5 ** oct); };

// Blur: three box passes approximate a gaussian.
const boxH = (src, dst, r) => { const n = 2 * r + 1; for (let y = 0; y < H; y++) { let acc = 0; const o = y * W; for (let x = -r; x <= r; x++) acc += src[o + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { dst[o + x] = acc / n; acc += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } } };
const boxV = (src, dst, r) => { const n = 2 * r + 1; for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += src[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { dst[y * W + x] = acc / n; acc += src[Math.min(H - 1, y + r + 1) * W + x] - src[Math.max(0, y - r) * W + x]; } } };
export const blur = (a, r) => { if (r < 1) return Float32Array.from(a); const t = new Float32Array(N), o = Float32Array.from(a); for (let k = 0; k < 3; k++) { boxH(o, t, r); boxV(t, o, r); } return o; };

// Paper fibres: thin random strands; ink creeps along them at the wet edge.
export const F = new Float32Array(N);
export const makePaper = () => {
  for (let k = 0; k < 90000; k++) {
    const x0 = rnd() * W, y0 = rnd() * H, a = rnd() * Math.PI * 2, len = 3 + rnd() * 14, s = 0.5 + rnd() * 0.5;
    for (let t = 0; t < len; t++) { const x = Math.round(x0 + Math.cos(a) * t), y = Math.round(y0 + Math.sin(a) * t); if (x >= 0 && y >= 0 && x < W && y < H) F[y * W + x] = Math.max(F[y * W + x], s); }
  }
  const b = blur(F, 1); for (let i = 0; i < N; i++) F[i] = Math.min(1, b[i] * 2.2);
};

// Dried ink on the sheet, one density buffer per ink; drawing goes into the current ink.
const buffers = {};
export let S;
export const useInk = name => { S = buffers[name] ??= new Float32Array(N); };

const catmull = (pts, n = 500) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)], m = Math.ceil(n / (pts.length - 1));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

// A wash layer collects strokes, then is bled and dried in one go.
export const layer = () => {
  const D = new Float32Array(N);
  return {
    D,
    // stroke(points, radius(t), ink(t, v)); v = +1 on the upper edge of the stroke, -1 on the lower edge.
    stroke(pts, radius, ink = () => 0.6, { bristle = 0 } = {}) {
      const path = catmull(pts), len = [0];
      for (let i = 1; i < path.length; i++) len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      const L = len[len.length - 1]; let j = 0;
      for (let s = 0; s <= L; s += 0.8) {
        while (j < len.length - 2 && len[j + 1] < s) j++;
        const k = (s - len[j]) / (len[j + 1] - len[j] || 1), x = path[j][0] + (path[j + 1][0] - path[j][0]) * k, y = path[j][1] + (path[j + 1][1] - path[j][1]) * k;
        let tx = path[j + 1][0] - path[j][0], ty = path[j + 1][1] - path[j][1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let nx = -ty, ny = tx; if (ny > 0) { nx = -nx; ny = -ny; }
        const t = L ? s / L : 0, r = radius(t); if (r <= 0.3) continue;
        const R = Math.ceil(r) + 1;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const d = Math.hypot(dx, dy); if (d > r) continue;
          const px = Math.round(x + dx), py = Math.round(y + dy); if (px < 0 || py < 0 || px >= W || py >= H) continue;
          let v = ink(t, (dx * nx + dy * ny) / r);
          if (bristle) v *= 1 - bristle * Math.max(0, fbm((px * nx + py * ny) * 0.5, (px * tx + py * ty) * 0.015, 2) - 0.3) * 1.6;
          const soft = Math.min(1, (r - d) / 1.5 + 0.15), idx = py * W + px;
          D[idx] = Math.max(D[idx], v * soft);
        }
      }
    },
    blob(x, y, rx, ry, ink) { for (let py = Math.floor(y - ry - 2); py <= y + ry + 2; py++) for (let px = Math.floor(x - rx - 2); px <= x + rx + 2; px++) { const d = Math.hypot((px - x) / rx, (py - y) / ry); if (d > 1) continue; const idx = py * W + px; D[idx] = Math.max(D[idx], ink * Math.min(1, (1 - d) * 4 + 0.2)); } },
    // bleed: how far (px) the wet ink spreads into the paper; feather: how much the fibres break up the fringe;
    // cloud: blotchy variation inside the wash; ring: darker edge where the wash dried.
    dry({ bleed = 10, feather = 0.8, cloud = 0.35, ring = 0.25, soften = 1.2, opacity = 1, hair = 1 } = {}) {
      const core = blur(D, Math.max(1, Math.round(soften)));
      const wide = blur(D, Math.max(1, Math.round(bleed / 2)));
      for (let i = 0; i < N; i++) {
        const c = core[i], w = wide[i]; if (c < 0.002 && w < 0.002) continue;
        const x = i % W, y = (i / W) | 0;
        // direction the ink is spreading (down the slope of the blurred wash)
        const gx = wide[Math.min(N - 1, i + 1)] - wide[Math.max(0, i - 1)], gy = wide[Math.min(N - 1, i + W)] - wide[Math.max(0, i - W)];
        const gl = Math.hypot(gx, gy) || 1e-6, nx = gx / gl, ny = gy / gl;
        // hairs: streaks that run outwards (fine across, long along the spread), plus loose paper fibres
        const across = (x * -ny + y * nx), along = (x * nx + y * ny);
        const streak = fbm(across * 0.35 + 50, along * 0.04, 3);
        const fib = 1 - feather + feather * (0.35 + 1.1 * (hair * streak + (1 - hair) * 0.5) + 0.5 * F[i]);
        const fr = w * fib * 1.05;
        const outside = Math.max(0, 1 - c / (w + 1e-4)); let v = c + Math.max(0, Math.min(w * 1.4, fr) - c) * outside;
        v *= 1 - cloud + cloud * 2 * (0.6 * fbm(x / 60 + 13, y / 60, 4) + 0.4 * fbm(x / 14, y / 14, 3));
        v += ring * Math.max(0, c - w) * 2.5;
        S[i] += v * opacity;
      }
    },
  };
};

// Fine dry marks straight onto the sheet: whiskers, toes, a mouth line.
export const line = (pts, width, amount, { taper = true } = {}) => {
  const L = layer(); L.stroke(pts, t => width * (taper ? Math.sin(Math.PI * Math.min(1, 0.08 + t)) ** 0.4 : 1), () => amount);
  const b = blur(L.D, 1); for (let i = 0; i < N; i++) S[i] += b[i] * (0.75 + 0.5 * F[i]);
};
export const lift = (x, y, r, keep = 0.1) => { for (let py = Math.floor(y - r - 1); py <= y + r + 1; py++) for (let px = Math.floor(x - r - 1); px <= x + r + 1; px++) { const d = Math.hypot(px - x, py - y) / r; if (d > 1) continue; const i = py * W + px, k = keep + (1 - keep) * Math.min(1, Math.max(0, (d - 0.6) / 0.4)); S[i] *= k; } };
export const dot = (x, y, r, amount) => { const L = layer(); L.blob(x, y, r, r, amount); const b = blur(L.D, 1); for (let i = 0; i < N; i++) S[i] += b[i]; };

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
// Colour comes from a measured ink curve (OKLab, densest first, most diluted last): ink density picks
// the point on the curve, and the thinnest wash fades into the paper.
const oklabToSrgb8 = (L, A, B) => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map(c => { c = Math.min(1, Math.max(0, c)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); });
};
const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = c => { c = Math.min(1, Math.max(0, c)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); };
// Each ink: density picks a point on its own measured curve (densest first); the thinnest wash fades to paper.
// Inks layer like glazes: each one filters the light the paper reflects.
export const save = (file, { curves, paper = [0.965, 0.002, 0.009], k = 1.6, fade = 0.06 } = {}) => {
  const paperLin = oklabToSrgb8(...paper).map(v => toLin(v / 255));
  const luts = Object.entries(curves).map(([ink, spec]) => {
    const full = spec.curve ?? spec, kk = spec.k ?? k, curve = full.slice((spec.from ?? 0) * 3);
    const n = curve.length / 3, lut = [];
    for (let q = 0; q <= 1024; q++) {
      const a = q / 1024; let lab;
      if (a < fade) { const u = a / fade, e = (n - 1) * 3; lab = paper.map((p, j) => p + (curve[e + j] - p) * u); }
      else { const pos = (1 - (a - fade) / (1 - fade)) * (n - 1), i = Math.min(n - 2, Math.floor(pos)), f = pos - i; lab = [0, 1, 2].map(j => curve[i * 3 + j] + (curve[(i + 1) * 3 + j] - curve[i * 3 + j]) * f); }
      lut.push(oklabToSrgb8(...lab).map((v, j) => toLin(v / 255) / paperLin[j]));
    }
    return [buffers[ink] ?? new Float32Array(N), lut, kk];
  });
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const o = y * (W * 3 + 1); raw[o] = 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, grain = 0.992 + 0.016 * hash(x * 3, y * 7), t = [...paperLin];
      for (const [buf, lut, kk] of luts) { if (!buf[i]) continue; const c = lut[Math.round((1 - Math.exp(-kk * buf[i])) * 1024)]; t[0] *= c[0]; t[1] *= c[1]; t[2] *= c[2]; }
      for (let j = 0; j < 3; j++) raw[o + 1 + x * 3 + j] = Math.min(255, Math.round(fromLin(t[j]) * grain));
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
};
export const loadCurve = name => JSON.parse(readFileSync("/Users/moya/Workspace/otel-desktop-viewer/desktopexporter/internal/frontend/public/licenses/madoromi/ink-curves.json", "utf8")).inks[name];
