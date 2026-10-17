// Serves this checkout at /design-system/ for local end-to-end runs. Everything else (/assets/ fonts, the
// Explore menu, analytics, the profile photo) comes from the live site, so the pages run as on sbmadhav.com
// but with this branch's files. Run python3 build.py first so the generated files are current.
//   node e2e/local-server.mjs [port]          (default 8123)
//   BASE_URL=http://127.0.0.1:8123 npx playwright test
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv[2] || process.env.PORT || 8123);
const LIVE = 'https://sbmadhav.com';
const PREFIX = '/design-system/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.py': 'text/x-python', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
// Repo-only paths that GitHub Pages does not publish (see _config.yml exclude)
const BLOCKED = /^\/(e2e|docs|tests|node_modules|__pycache__|\.git|\.github|\.githooks)(\/|$)|^\/(CLAUDE|README|CONTRIBUTING|SECURITY|LICENSE-CONTENT)\.md$|^\/(LICENSE|build\.py|_config\.yml|\.gitignore)$/;

async function proxy(req, res) {
  const r = await fetch(LIVE + req.url, { redirect: 'manual' });
  const headers = {};
  r.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) headers[k] = v; });
  if (headers.location) headers.location = headers.location.replace(LIVE, '');
  res.writeHead(r.status, headers);
  res.end(Buffer.from(await r.arrayBuffer()));
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/design-system') { res.writeHead(301, { location: PREFIX + url.search }); return res.end(); }
    if (!pathname.startsWith(PREFIX)) return await proxy(req, res);
    const rel = '/' + pathname.slice(PREFIX.length);
    if (BLOCKED.test(rel)) { res.writeHead(404); return res.end('Not found'); }
    // Resolve, then require the result to be the checkout or inside it (root + separator), so "..",
    // encoded slashes and sibling folders that share a name prefix (design-system-old) are all refused
    let p = path.resolve(root, '.' + rel);
    if (p !== root && !p.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const s = await stat(p).catch(() => null);
    if (s && s.isDirectory()) p = path.join(p, 'index.html');
    const body = await readFile(p).catch(() => null);
    if (!body) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(port, '127.0.0.1', () => console.log(`Design system (this checkout) on http://127.0.0.1:${port}/design-system/ (localhost only)`));
