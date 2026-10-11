// The breath frame (head 1 px lower) with the gills of an upright frame moved down 1 px to match.
// node idle/gills/make-dip.mjs upright.txt out.txt
import fs from 'node:fs';
const [src, out] = process.argv.slice(2);
const load = f => { const l = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); return { pal: l.filter(x => /^\S=#/.test(x)), g: l.filter(x => !/^\S=#/.test(x)).map(r => r.split('')) }; };
const { pal, g: gills } = load(src), { g: breath } = load('idle/front-breathe-belly.txt');
const near = (g, x, y, set) => [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => set.includes(g[y + dy]?.[x + dx])));
const isGill = (g, x, y) => (x <= 7 || x >= 24) && y <= 20 && ('gG'.includes(g[y][x]) || (g[y][x] === 'o' && near(g, x, y, 'gG') && !near(g, x, y, 'bsew')));
const b = breath.map((r, y) => r.map((c, x) => isGill(breath, x, y) ? '.' : c));
gills.forEach((r, y) => r.forEach((c, x) => { if (isGill(gills, x, y) && b[y + 1] && b[y + 1][x] === '.') b[y + 1][x] = c; }));
fs.writeFileSync(out, pal.join('\n') + '\n' + b.map(r => r.join('')).join('\n') + '\n');
