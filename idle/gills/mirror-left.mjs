// Copy the left gill (columns 0-7) mirrored onto the right gill (columns 24-31); the face and body are left alone.
// node idle/gills/mirror-left.mjs painted.txt out.txt
import fs from 'node:fs';
const [src, out] = process.argv.slice(2);
const l = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean);
const pal = l.filter(x => /^\S=#/.test(x)), g = l.filter(x => !/^\S=#/.test(x)).map(r => r.split(''));
for (const r of g) for (let x = 0; x <= 7; x++) r[31 - x] = r[x];
fs.writeFileSync(out, pal.join('\n') + '\n' + g.map(r => r.join('')).join('\n') + '\n');
