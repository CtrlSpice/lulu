// Breath-down frame with a fuller belly: row 27 (below the arms) grows 1 px on each side.
import fs from 'node:fs';
const lines = fs.readFileSync('idle/front-breathe-shadow.txt', 'utf8').split('\n').filter(Boolean);
const pal = lines.filter(l => /^\S=#/.test(l));
const g = lines.filter(l => !/^\S=#/.test(l)).map(r => r.split(''));
g[27][6] = 'o'; g[27][7] = 'b'; g[27][24] = 'b'; g[27][25] = 'o';
fs.writeFileSync('idle/front-breathe-belly.txt', pal.join('\n') + '\n' + g.map(r => r.join('')).join('\n') + '\n');
