// Apply Mila's new top-petal tuck (the left-half changes between the old and new up-in) to every tucked frame, mirrored.
// A frame's pixel is only changed where it still matches the old up-in, so later petal edits are kept.
// node idle/gills/apply-top.mjs old-up-in.txt new-up-in-painted.txt frame.txt ...
import fs from 'node:fs';
const [oldF, newF, ...frames] = process.argv.slice(2);
const load = f => { const l = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); return { pal: l.filter(x => /^\S=#/.test(x)), g: l.filter(x => !/^\S=#/.test(x)).map(r => r.split('')) }; };
const { g: old } = load(oldF), { g: neu } = load(newF);
const edits = [];
old.forEach((r, y) => r.forEach((c, x) => { if (x < 16 && c !== neu[y][x]) edits.push([x, y, c, neu[y][x]], [31 - x, y, old[y][31 - x], neu[y][x]]); }));
for (const f of frames) {
  const { pal, g } = load(f), skipped = [];
  for (const [x, y, was, now] of edits) { if (g[y][x] === was) g[y][x] = now; else skipped.push([x, y]); }
  fs.writeFileSync(f, pal.join('\n') + '\n' + g.map(r => r.join('')).join('\n') + '\n');
  console.log(f, 'skipped', JSON.stringify(skipped));
}
