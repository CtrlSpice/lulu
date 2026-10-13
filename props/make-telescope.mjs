// First draft of Lulu's telescope, after the original painting: a navy tube widening to the front with brass bands,
// pointing up and to the right, on a dark mount and a black tripod. 32 x 32, standing on the same ground row as Lulu (30).
import fs from 'node:fs';
const N = 32, g = Array.from({ length: N }, () => Array(N).fill('.'));
const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };

// tube: three nested sections, like a telescoping spyglass, each a step wider than the one behind it,
// from the eyepiece (x 5) up and to the right to the mouth (x 27); a brass band sits at the front of each section
const LIFT = 3;   // raised so the eyepiece is at Lulu's eye level (rows 11-13)
// a little flatter than the first draft, so the raised front stays inside the grid
const SECTIONS = [{ to: 10, half: 1.4 }, { to: 18, half: 2.0 }, { to: 27, half: 2.6 }];
const cy = x => 15 - LIFT - (x - 5) * 7 / 22, half = x => SECTIONS.find(s => x <= s.to).half;
const inTube = (x, y) => x >= 5 && x <= 27 && Math.abs(y + 0.5 - cy(x)) <= half(x);
const band = x => (x >= 9 && x <= 10) || (x >= 17 && x <= 18) || x >= 25;          // brass: the end of each section and the front rim
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inTube(x, y)) {
  const lower = y + 0.5 > cy(x);                                                    // lower half of the tube is in shadow
  put(x, y, band(x) ? (lower ? 'Y' : 'y') : (lower ? 'N' : 'n'));
}
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)                              // outline around the tube
  if (!inTube(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inTube(x + dx, y + dy))) put(x, y, 'o');
for (let y = 0; y < N; y++) if (inTube(27, y)) put(27, y, 'k');                      // the lens at the front, dark

// mount: a small dark box under the middle of the tube, with a brass bolt
for (let y = 13 - LIFT; y <= 17 - LIFT; y++) for (let x = 12; x <= 16; x++) if (g[y][x] === '.') put(x, y, x === 12 || x === 16 || y === 17 - LIFT ? 'o' : 'm');
put(14, 15 - LIFT, 'y');

// tripod: three 1 px legs from under the mount to the ground (row 30), with a cross brace
const leg = (x0, x1) => { for (let y = 18 - LIFT; y <= 30; y++) put(Math.round(x0 + (x1 - x0) * (y - 18 + LIFT) / (12 + LIFT)), y, 'o'); };
leg(13, 9); leg(14, 14); leg(15, 20);
for (let x = 11; x <= 18; x++) if (g[24][x] === '.') put(x, 24, 'o');

const pal = ['o=#7e3a5c', 'n=#31748f', 'N=#26476b', 'y=#f6c177', 'Y=#ea9d34', 'k=#191724', 'm=#393552'];
fs.writeFileSync('props/telescope.txt', pal.join('\n') + '\n' + g.map(r => r.join('')).join('\n') + '\n');
