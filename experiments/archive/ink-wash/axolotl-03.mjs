import { makePaper, layer, line, dot, lift, save, loadCurve, useInk } from './ink.mjs';
import { hexToLab, anchored } from './match.mjs';
const out = process.argv[2] ?? 'axo.png';
makePaper();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const prof = (pts, radii) => { const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const L = d[d.length - 1]; return t => { const s = t * L; let i = 1; while (i < d.length - 1 && d[i] < s) i++; const k = (s - d[i - 1]) / (d[i] - d[i - 1]); return radii[i - 1] + (radii[i] - radii[i - 1]) * Math.min(1, Math.max(0, k)); }; };

// ---- walking axolotl, side view, facing right. One big dark wet mass for the back,
// head and tail; belly and legs left as paper with only faint grey hints; small dry details last. ----
const spine = [[838, 352], [796, 330], [736, 322], [684, 336], [600, 346], [512, 350], [440, 344], [350, 330], [262, 318], [190, 318], [150, 326]];
const R = prof(spine, [26, 56, 64, 52, 58, 58, 50, 34, 20, 9, 1]);

useInk('body');
// 1. faint wash for the pale belly side and the tail fin
const pale = layer();
pale.stroke(spine, R, (t, v) => 0.1 * sm(-1, -0.4, v) + 0.06);
pale.stroke([[540, 340], [440, 336], [350, 322], [262, 310], [190, 312], [150, 324]], prof([0, 1], [10, 2]), () => 0);
pale.stroke([[520, 330], [440, 328], [350, 312], [262, 302], [190, 308], [150, 324]], t => 44 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.9)) ** 0.7, (t, v) => 0.12 * sm(0.1, 0.9, Math.abs(v)));
pale.dry({ bleed: 18, cloud: 0.5, feather: 1 });

// 2. the dark back: one wet stroke, darkest along the spine, running out to paper on the belly
const back = layer();
back.stroke(spine, t => R(t), (t, v) => (1.5 - 0.3 * t) * sm(-0.35, 0.5, v), { bristle: 0.25 });
back.dry({ bleed: 20, cloud: 0.4, feather: 1, ring: 0.25 });

// 3. darker pools dropped into the wet back
const pools = layer();
for (const [x, y, rx, ry] of [[740, 300, 34, 16], [610, 312, 42, 18], [480, 318, 38, 16], [370, 308, 28, 12], [270, 304, 20, 8]]) pools.blob(x, y, rx, ry, 0.9);
pools.dry({ bleed: 14, cloud: 0.5, feather: 1 });

useInk('gills');
// 4. gills: three plumes on the near side, swept back
const plume = (pts, w, ink, bleed) => { const g = layer(); g.stroke(pts, t => w * (1 - 0.55 * t) * Math.min(1, 0.4 + t * 4), () => ink); g.dry({ bleed, cloud: 0.3, feather: 1, ring: 0.2 }); };
plume([[704, 296], [688, 258], [660, 222]], 11, 1.1, 18);
plume([[698, 312], [664, 290], [624, 276]], 12, 1.2, 18);
plume([[696, 330], [660, 326], [620, 334]], 10, 1.0, 16);

useInk('body');
// 5. legs: short and stubby, mostly paper with a grey edge; toes as tiny dark marks
const legs = [
  { pts: [[714, 380], [724, 412], [744, 432]], toes: [[740, 438], [752, 440], [763, 436]] },
  { pts: [[478, 384], [466, 414], [442, 432]], toes: [[428, 436], [440, 440], [452, 439]] },
];
const legInk = layer();
legs.forEach(l => legInk.stroke(l.pts, t => 15 * (1 - 0.3 * t), (t, v) => 0.08 + 0.22 * sm(0.3, 1, Math.abs(v))));
legInk.dry({ bleed: 8, cloud: 0.3, feather: 1 });
useInk('detail');
legs.forEach(l => l.toes.forEach(([x, y]) => dot(x, y, 2.6, 0.9)));

// 6. face, placed like anatomical axolotl drawings: a small dark eye high on the side of the head,
// about a third back from the snout; a long shallow smile from the snout tip back to just behind the eye
dot(802, 318, 6, 3); lift(800, 315.5, 2, 0.05);
line([[856, 352], [838, 360], [816, 360], [798, 352], [790, 344]], 1.2, 0.9);
// Pixel Lulu palette. Each ink follows the measured curve of the Madoromi ink nearest to its colours,
// shifted so it passes exactly through Lulu's colours: body shade #c98a96 and blush #f2cfcb, outline wine
// #7e3a5c (all on Edo-murasaki); the gills use the same wine as the outline. Paper is Lulu's #faf4ed.
save(out, {
  paper: hexToLab('#faf4ed'),
  curves: {
    body: { curve: anchored('edo-murasaki', [['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    gills: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
    detail: { curve: anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper') },
  },
});
