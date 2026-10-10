// Breath-down frame where the shadow under the chin moves down with the head: row 21 (the body's new top row) becomes shadow, like row 20 is in the open frame.
import fs from 'node:fs';
const lines = fs.readFileSync('idle/front-breathe.txt', 'utf8').split('\n').filter(Boolean);
const pal = lines.filter(l => /^\S=#/.test(l));
const g = lines.filter(l => !/^\S=#/.test(l)).map(r => r.split(''));
for (let x = 10; x <= 21; x++) g[21][x] = 's';
fs.writeFileSync('idle/front-breathe-shadow.txt', pal.join('\n') + '\n' + g.map(r => r.join('')).join('\n') + '\n');
