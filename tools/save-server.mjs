// Tiny local receiver: POST /<name>.txt writes the body into the target folder. Only plain .txt names are accepted.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2];
http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', 'http://127.0.0.1:4789');
  if (req.method === 'OPTIONS') { res.setHeader('access-control-allow-methods', 'POST'); res.end(); return; }
  const name = decodeURIComponent(req.url.slice(1));
  if (req.method !== "POST" || !/^[a-z0-9-]+\.(txt|png)$/.test(name)) { res.writeHead(400).end(); return; }
  let body = ''; req.on('data', d => { body += d; if (body.length > 20000000) req.destroy(); });
  req.on('end', () => { fs.writeFileSync(path.join(dir, name), name.endsWith(".png") ? Buffer.from(body.replace(/^data:image\/png;base64,/, ""), "base64") : body); res.end("ok"); });
}).listen(4790, '127.0.0.1');
