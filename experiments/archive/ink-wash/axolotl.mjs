import { W, H, makePaper, layer, line, dot, lift, save, useInk, fbm } from './ink.mjs';
import { hexToLab, anchored } from './match.mjs';
const out = process.argv[2] ?? 'sci.png';
makePaper();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// y at x along a polyline given as [x, y] points (any x order)
const edge = pts => { const p = [...pts].sort((a, b) => a[0] - b[0]); return x => { if (x <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const k = (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]); return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k; } return p[p.length - 1][1]; }; };
// Fill the band between a top and a bottom edge into a layer; ink(x, v) with v = 0 on the top edge, 1 on the bottom edge.
const band = (L, top, bot, x0, x1, ink) => {
  for (let x = Math.ceil(x0); x <= x1; x++) {
    const t = top(x), b = bot(x); if (b - t < 0.5) continue;
    for (let y = Math.floor(t); y <= Math.ceil(b); y++) {
      const soft = Math.min(1, Math.max(0, y + 0.5 - t), Math.max(0, b - y + 0.5));
      const i = y * W + x; L.D[i] = Math.max(L.D[i], ink(x, (y - t) / (b - t)) * soft);
    }
  }
};

// ---- Side view, facing right, walking. Proportions from the scientific references (Velasco 1879, Duméril 1854,
// Brehm, and side-view specimen photos): total length 820, head ~0.21 of it, tail ~0.42; eye a third back along the
// head, mid-height; mouth gape ends just behind and below the eye; three gill rami behind the head; forelimbs under
// the gills with four fingers, hindlimbs at the vent with five toes; dorsal fin from behind the head, ventral fin
// from the vent. ----
const SNOUT = 902, TIP = 80;
const top = edge([[SNOUT, 324], [900, 310], [894, 298], [884, 290], [870, 284], [840, 279], [800, 279], [760, 283], [730, 289], [712, 293], [660, 293], [600, 291], [540, 291], [480, 292], [430, 295], [380, 297], [320, 300], [260, 305], [200, 311], [150, 318], [110, 325], [TIP, 334]]);
const bot = edge([[SNOUT, 324], [900, 338], [894, 352], [884, 364], [870, 374], [850, 384], [820, 392], [780, 396], [745, 395], [720, 392], [680, 395], [620, 400], [560, 402], [500, 400], [450, 396], [420, 392], [380, 386], [320, 378], [260, 368], [200, 358], [150, 350], [110, 342], [TIP, 334]]);
const finTop = edge([[712, 293], [690, 289], [640, 285], [580, 281], [520, 277], [460, 272], [400, 268], [330, 266], [260, 270], [200, 280], [150, 294], [110, 312], [TIP, 334]]);
const finBot = edge([[430, 394], [400, 402], [340, 406], [280, 402], [220, 392], [160, 376], [120, 358], [TIP, 334]]);

useInk('body');
// 1. pale wash over the whole animal, a little stronger on the shaded belly side; fins paler still
const pale = layer();
band(pale, top, bot, TIP, SNOUT, (x, v) => 0.07 + 0.08 * sm(0.5, 1, v));
band(pale, finTop, top, TIP, 712, () => 0.09);
band(pale, bot, finBot, TIP, 430, () => 0.09);
pale.dry({ bleed: 14, cloud: 0.5, feather: 1 });

// 2. the dark back: one wet wash, darkest along the spine, running out to paper by mid-flank; lighter toward the tail tip
const back = layer();
band(back, top, bot, TIP, SNOUT - 4, (x, v) => (1.5 + 0.5 * sm(TIP, 700, x)) * (1 - sm(0.1, 0.65, v)) * (0.85 + 0.3 * fbm(x * 0.02, v * 3, 2)) * sm(SNOUT, SNOUT - 40, x) ** 0.5);
back.dry({ bleed: 18, cloud: 0.4, feather: 1, ring: 0.25 });

// 3. darker pools dropped into the wet back
const pools = layer();
for (const [x, y, rx, ry] of [[800, 292, 34, 10], [640, 302, 40, 12], [520, 302, 36, 11], [400, 306, 30, 10], [290, 314, 24, 8], [190, 324, 16, 6]]) pools.blob(x, y, rx, ry, 1.1);
pools.dry({ bleed: 12, cloud: 0.5, feather: 1 });

// 4. faint costal grooves down the flank between the limbs, and the gular fold under the throat
const grooves = layer();
for (let x = 690; x >= 470; x -= 22) grooves.stroke([[x, 318], [x - 2, 352], [x - 4, 388]], t => 2.2 * Math.sin(Math.PI * Math.min(1, 0.1 + t)), t => 0.22 * (1 - t * 0.6));
grooves.stroke([[764, 372], [748, 386], [742, 396]], () => 2, () => 0.3);
grooves.dry({ bleed: 4, cloud: 0.3, feather: 0.8, soften: 1 });

// 5. limbs: slender, two segments each, mostly paper with a shaded edge; far-side limbs paler.
// Walking pose with diagonal pairs: near fore and far hind reach forward, near hind and far fore push back.
const limbs = [
  { far: true, pts: [[690, 394], [678, 422], [656, 442]], toes: [[[656, 442], [640, 444]], [[656, 442], [642, 451]], [[656, 442], [650, 455]], [[656, 442], [660, 454]]] },
  { far: true, pts: [[476, 398], [496, 424], [516, 443]], toes: [[[516, 443], [533, 445]], [[516, 443], [532, 452]], [[516, 443], [526, 456]], [[516, 443], [516, 456]], [[516, 443], [507, 452]]] },
  { pts: [[708, 384], [716, 420], [744, 443]], toes: [[[744, 443], [762, 445]], [[744, 443], [760, 453]], [[744, 443], [752, 457]], [[744, 443], [741, 456]]] },
  { pts: [[448, 390], [440, 422], [414, 444]], toes: [[[414, 444], [396, 446]], [[414, 444], [397, 453]], [[414, 444], [403, 458]], [[414, 444], [413, 458]], [[414, 444], [423, 455]]] },
];
for (const l of limbs) {
  const L = layer(), k = l.far ? 0.6 : 1;
  L.stroke(l.pts, t => 15 * (1 - 0.38 * t), (t, v) => k * (0.12 + 0.4 * sm(0.1, 1, v) + 0.15 * sm(0.4, 1, -v)));
  for (const toe of l.toes) L.stroke(toe, t => 3.6 * (1 - 0.35 * t), () => k * 0.42);
  L.dry({ bleed: 7, cloud: 0.3, feather: 1 });
}

// 6. gills: three rami on the near side, rising up and back from behind the head, with combed filaments along
// their rear edge; two far-side rami show paler above the head.
useInk('gills');
const ramus = (pts, len, ink, far) => {
  const g = layer();
  g.stroke(pts, t => (far ? 3 : 4) * (1 - 0.45 * t), () => ink);
  // filaments along the rear/lower side: short strokes angled back from the stalk
  const [a, b, c] = pts;
  const rl = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]);
  for (let s = 0.15; s <= 1; s += (far ? 7 : 5) / rl) {
    const u = 1 - s, x = u * u * a[0] + 2 * u * s * b[0] + s * s * c[0], y = u * u * a[1] + 2 * u * s * b[1] + s * s * c[1];
    const tx = 2 * u * (b[0] - a[0]) + 2 * s * (c[0] - b[0]), ty = 2 * u * (b[1] - a[1]) + 2 * s * (c[1] - b[1]), tl = Math.hypot(tx, ty);
    let nx = -ty / tl, ny = tx / tl; if (nx > 0) { nx = -nx; ny = -ny; } // rear side (toward the tail)
    const fl = len * 1.3 * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, s * 1.1)));
    for (const side of far ? [1, -0.6] : [1, -0.8]) {
      const ex = x + (nx * 0.75 * side - (tx / tl) * 0.35 * Math.abs(side)) * fl, ey = y + (ny * 0.75 * side - (ty / tl) * 0.35 * Math.abs(side)) * fl;
      g.stroke([[x, y], [(x + ex) / 2 + 1, (y + ey) / 2 + 1], [ex, ey]], t => 1.7 * (1 - 0.55 * t), () => ink * 1.15);
    }
  }
  g.dry({ bleed: 4, cloud: 0.2, feather: 0.6, ring: 0.2, soften: 0.6 });
};
ramus([[744, 292], [740, 264], [728, 240]], 13, 0.45, true);
ramus([[750, 298], [732, 276], [712, 266]], 13, 0.45, true);
ramus([[732, 304], [720, 274], [700, 250]], 17, 1.05);
ramus([[730, 322], [706, 304], [678, 296]], 17, 1.05);
ramus([[728, 340], [704, 340], [678, 348]], 15, 0.95);

// 7. face: small dark lidless eye a third back along the head, at mid-height, with a highlight; the mouth gape
// runs back from the snout tip, nearly straight, turning up just behind and below the eye; a tiny nostril.
useInk('detail');
dot(848, 328, 5.5, 3); lift(846, 325.5, 1.8, 0.05);
line([[899, 347], [882, 350], [862, 350], [846, 347], [836, 341]], 1.2, 0.9);
dot(892, 306, 1.4, 0.6);
for (const l of limbs) for (const toe of l.toes) dot(toe[1][0], toe[1][1], 1.6, l.far ? 0.4 : 0.7);

save(out, {
  paper: hexToLab('#faf4ed'),
  curves: {
    body: { curve: anchored('edo-murasaki', [['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    gills: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    detail: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
  },
});
