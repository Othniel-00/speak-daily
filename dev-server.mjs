// Local preview: node dev-server.mjs  (serves the app and /api/* like Vercel does)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const mod = await import(path.join(root, url.pathname + '.js') + '?t=' + Date.now()).catch(() => null);
    if (!mod) { res.writeHead(404).end(); return; }
    let body = ''; for await (const c of req) body += c;
    req.query = Object.fromEntries(url.searchParams); try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    res.send = (s) => res.end(s);
    return mod.default(req, res);
  }
  let p = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  try { const data = await fs.readFile(p); res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }).end(data); }
  catch { res.writeHead(404).end('Not found'); }
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
