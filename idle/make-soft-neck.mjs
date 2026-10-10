// Softer neck on the breath-down frame: the middle of the chin outline (row 20) becomes skin shadow.
import fs from 'node:fs';
const lines = fs.readFileSync('idle/front-breathe.txt', 'utf8').split('\n').filter(Boolean);
const pal = lines.filter(l => /^\S=#/.test(l));
const base = lines.filter(l => !/^\S=#/.test(l));
const soften = (from, to) => base.map((r, y) => y === 20 ? [...r].map((c, x) => x >= from && x <= to ? 's' : c).join('') : r);
const write = (f, g) => fs.writeFileSync(f, pal.join('\n') + '\n' + g.join('\n') + '\n');
write('idle/front-breathe-soft-wide.txt', soften(11, 20));  // outline kept only at the 2 px ends
write('idle/front-breathe-soft-narrow.txt', soften(13, 18)); // outline kept 4 px at each end
