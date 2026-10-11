// up-in: Mila's left top-petal edit mirrored onto the right gill.
// down-in / down-out: the breath frame (head 1 px lower) with the up-in / original gills moved down 1 px to match.
import fs from 'node:fs';
const load = f => { const l = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); return { pal: l.filter(x => /^\S=#/.test(x)), g: l.filter(x => !/^\S=#/.test(x)).map(r => r.split('')) }; };
const text = (pal, g) => pal.join('\n') + '\n' + g.map(r => r.join('')).join('\n') + '\n';
const { pal, g: painted } = load(process.argv[2]);
const { g: open } = load('idle/front-open.txt'), { g: breath } = load('idle/front-breathe-belly.txt');

const upIn = painted.map(r => [...r]);
painted.forEach((r, y) => r.forEach((c, x) => { if (x < 16 && c !== open[y][x]) upIn[y][31 - x] = c; }));

const near = (g, x, y, set) => [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => set.includes(g[y + dy]?.[x + dx])));
const isGill = (g, x, y) => (x <= 7 || x >= 24) && y <= 20 && ('gG'.includes(g[y][x]) || (g[y][x] === 'o' && near(g, x, y, 'gG') && !near(g, x, y, 'bsew')));
const withGills = gills => {
  const b = breath.map((r, y) => r.map((c, x) => isGill(breath, x, y) ? '.' : c));
  gills.forEach((r, y) => r.forEach((c, x) => { if (isGill(gills, x, y) && b[y + 1] && b[y + 1][x] === '.') b[y + 1][x] = c; }));
  return b;
};
fs.writeFileSync('idle/gills/up-in.txt', text(pal, upIn));
fs.writeFileSync('idle/gills/down-in.txt', text(pal, withGills(upIn)));
fs.writeFileSync('idle/gills/down-out.txt', text(pal, withGills(open)));
