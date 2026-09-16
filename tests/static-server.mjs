import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

export async function servePages() {
  const root = resolve('dist-pages'), base = '/khmer-calendar-manager/';
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!path.startsWith(base)) { res.writeHead(404).end(); return; }
      const file = resolve(root, path.slice(base.length) || 'index.html');
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}${base}`, close: () => new Promise(resolve => server.close(resolve)) };
}
