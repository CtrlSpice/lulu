// Inhale: head, gills and chin outline (rows 1-19) rise 1 px; the body's top shadow row repeats once below the chin, as a neck.
import fs from 'node:fs';
const lines = fs.readFileSync('idle/front-open.txt', 'utf8').split('\n').filter(Boolean);
const pal = lines.filter(l => /^\S=#/.test(l));
const base = lines.filter(l => !/^\S=#/.test(l)).map(r => r.split(''));
const g = base.map(r => [...r]);
for (let y = 0; y <= 18; y++) g[y] = [...base[y + 1]];
g[19] = [...base[20]];
fs.writeFileSync('idle/front-inhale.txt', pal.join('\n') + '\n' + g.map(r => r.join('')).join('\n') + '\n');
