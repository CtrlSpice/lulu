import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = process.argv[2]; const types = { '.html': 'text/html', '.png': 'image/png', '.json': 'application/json' };
http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(p, (e, d) => e ? res.writeHead(404).end() : res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(d));
}).listen(4789, '127.0.0.1');
