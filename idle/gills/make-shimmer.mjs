// Gill shimmer: the same gill silhouette, with the dark gill shadow moved 1 px along each petal.
// Option b also moves the middle petal's tip outline 1 px. Left gill edits; the right gill is its mirror.
import fs from 'node:fs';
const lines = fs.readFileSync('idle/front-open.txt', 'utf8').split('\n').filter(Boolean);
const pal = lines.filter(l => /^\S=#/.test(l));
const base = lines.filter(l => !/^\S=#/.test(l)).map(r => r.split(''));
const text = g => pal.join('\n') + '\n' + g.map(r => r.join('')).join('\n') + '\n';
const make = edits => {
  const g = base.map(r => [...r]);
  for (const [x, y, c] of edits) { g[y][x] = c; g[y][31 - x] = c; }
  return g;
};
const shadow = [
  [2, 6, 'g'], [2, 5, 'G'], [3, 8, 'g'], [3, 7, 'G'],   // top petal: shadow moves 1 px up, towards its tip
  [1, 11, 'g'], [4, 11, 'G'],                           // middle petal: shadow moves 1 px in, towards the head
  [2, 16, 'g'], [3, 16, 'g'], [2, 15, 'G'], [3, 15, 'G'], // bottom petal: shadow moves 1 px up
];
const tip = [[0, 11, '.'], [1, 11, 'o']];               // middle petal tip pulls in 1 px at the bottom corner
fs.writeFileSync('idle/gills/shimmer-a.txt', text(make(shadow)));
fs.writeFileSync('idle/gills/shimmer-b.txt', text(make([...shadow, ...tip])));
