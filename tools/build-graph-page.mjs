// Build a self-contained copy of history/graph.html (all art embedded) for publishing as an Artifact.
// node tools/build-graph-page.mjs   -> history/lulu-warts-and-all.html
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dir = path.resolve('history');
const stepsSrc = fs.readFileSync(path.join(dir, 'steps.js'), 'utf8');
const ctx = {};
vm.runInNewContext(stepsSrc + '\nthis.ROWS = ROWS;', ctx);

const grids = {}, shots = {};
for (const [, , nodes] of ctx.ROWS) {
  if (!Array.isArray(nodes)) continue; // tool milestones carry text, not art
  for (const n of nodes) {
    if (n.img) {
      const ext = path.extname(n.img).slice(1).replace('jpg', 'jpeg');
      shots[n.img] = `data:image/${ext};base64,` + fs.readFileSync(path.join(dir, n.img)).toString('base64');
    } else {
      grids[n.f] = fs.readFileSync(path.join(dir, n.f), 'utf8');
    }
  }
}

const page = fs.readFileSync(path.join(dir, 'graph.html'), 'utf8');
const title = page.match(/<title>[\s\S]*?<\/title>/)[0];
const style = page.match(/<style>[\s\S]*?<\/style>/)[0]
  .replace(':root { --bg: #191724;', ':root { color-scheme: dark; --bg: #191724;')
  .replace(':root[data-bg="dawn"] {', ':root[data-bg="dawn"] { color-scheme: light;');
const body = page.slice(page.indexOf('<body>') + 6, page.lastIndexOf('</body>'))
  .replace('<script src="steps.js"></script>', `<script>${stepsSrc}</script>\n<script>window.EMBED = ${JSON.stringify({ grids, shots })};</script>`);
const out = path.join(dir, 'lulu-warts-and-all.html');
fs.writeFileSync(out, `${title}\n${style}\n${body}`);
console.log(out, Object.keys(grids).length, 'grids', Object.keys(shots).length, 'screenshots');
