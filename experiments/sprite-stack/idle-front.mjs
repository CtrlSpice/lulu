// Breathing idle for the 48 px front view: A neutral, B head down 1 px (one torso row removed), C same with gill tips 1 px lower.
import fs from 'node:fs';
const [src, outPrefix] = process.argv.slice(2);
const l = fs.readFileSync(src, 'utf8').trimEnd().split('\n'), pal = l.filter(x => x.includes('=')), A = l.filter(x => !x.includes('='));
const blank = '.'.repeat(48);
const B = A.map((row, r) => r === 0 ? blank : r <= 32 ? A[r - 1] : row);
const C = B.map((row, r) => [...row].map((c, x) => (x <= 4 || x >= 43) && r <= 30 ? (r === 0 ? '.' : B[r - 1][x]) : c).join(''));
const save = (n, g) => fs.writeFileSync(`${outPrefix}-${n}.txt`, pal.join('\n') + '\n' + g.join('\n') + '\n');
save('A', A); save('B', B); save('C', C);
