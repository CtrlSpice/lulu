// Writes ink-luts.json: the two inks' colour tables for the live page, computed exactly as the still renderer
// (../paint.mjs save()) does. For each ink: 1025 steps of "how much paint" (0 = none, 1024 = full strength), each the
// fraction of the paper's light the paint lets through, per colour channel (linear light). Run with: npm run luts
import { writeFileSync } from 'node:fs';
import { hexToLab, anchored } from '../../match.mjs';

type Lab = [number, number, number];
const oklabToSrgb8 = (L: number, A: number, B: number): number[] => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map(c => { c = Math.min(1, Math.max(0, c)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); });
};
const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const paper = hexToLab('#faf4ed') as Lab, FADE = 0.06;
const paperLin = oklabToSrgb8(...paper).map(v => toLin(v / 255));
const table = (curve: number[]): number[] => {
  const n = curve.length / 3, out: number[] = [];
  for (let q = 0; q <= 1024; q++) {
    const a = q / 1024;
    let lab: Lab;
    if (a < FADE) { const u = a / FADE, e = (n - 1) * 3; lab = paper.map((p, j) => p + (curve[e + j] - p) * u) as Lab; }
    else { const pos = (1 - (a - FADE) / (1 - FADE)) * (n - 1), i = Math.min(n - 2, Math.floor(pos)), f = pos - i; lab = [0, 1, 2].map(j => curve[i * 3 + j] + (curve[(i + 1) * 3 + j] - curve[i * 3 + j]) * f) as Lab; }
    out.push(...oklabToSrgb8(...lab).map((v, j) => +(toLin(v / 255) / paperLin[j]).toFixed(5)));
  }
  return out;
};
const luts = {
  note: 'Colour tables for the live watercolour page, from tools/make-luts.ts. paperLin: the paper in linear light. body / wine: 1025 rgb triples, the fraction of the paper light each ink lets through at each strength. strength = 1 - exp(-1.6 * paint).',
  paperLin: paperLin.map(v => +v.toFixed(5)),
  body: table(anchored('edo-murasaki', [['#c98a96', 45], ['#f2cfcb', 77]], 'paper')),
  wine: table(anchored('edo-murasaki', [['#7e3a5c', 19], ['#c98a96', 45], ['#f2cfcb', 77]], 'paper')),
};
writeFileSync(new URL('../ink-luts.json', import.meta.url), JSON.stringify(luts));
console.log('ink-luts.json written:', luts.body.length / 3, 'steps per ink; paper', luts.paperLin.join(', '));
