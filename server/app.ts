import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { ConflictError, Store } from './store.ts';

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage): Promise<any> {
  let bytes = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8 * 1024 * 1024) throw new Error('Request exceeds the 8 MB limit');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function createApp(options: { dataDirectory: string; root: string; dev?: boolean }) {
  const store = new Store(options.dataDirectory); await store.initialize();
  let vite: Awaited<ReturnType<typeof import('vite')['createServer']>> | undefined;
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) { json(res, 403, { error: 'This manager accepts local requests only' }); return; }
      const pathname = new URL(req.url ?? '/', `http://${host}`).pathname;
      if (pathname.startsWith('/api/')) {
        if (req.method === 'GET' && pathname === '/api/workspace') { json(res, 200, await store.read()); return; }
        const origin = req.headers.origin;
        if (req.method !== 'POST' || req.headers['x-manager-request'] !== '1' || !req.headers['content-type']?.startsWith('application/json') || (origin && origin !== `http://${host}`)) {
          json(res, 403, { error: 'Use the local manager to submit changes' }); return;
        }
        const input = await body(req);
        if (typeof input.expected !== 'string') throw new Error('Missing workspace revision');
        if (pathname === '/api/save') { json(res, 200, await store.save(input.data, input.expected, input.note)); return; }
        if (pathname === '/api/export') { json(res, 200, await store.export(input.expected)); return; }
        json(res, 404, { error: 'Unknown action' }); return;
      }
      if (vite) { vite.middlewares(req, res, () => { res.writeHead(404); res.end('Not found'); }); return; }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      const dist = resolve(options.root, 'dist');
      const target = resolve(dist, `.${decodeURIComponent(pathname === '/' ? '/index.html' : pathname)}`);
      if (!target.startsWith(dist + sep)) { res.writeHead(403); res.end(); return; }
      const bytes = await readFile(target);
      const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
      res.writeHead(200, { 'content-type': types[extname(target)] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error: any) {
      json(res, error instanceof ConflictError ? 409 : error.code === 'ENOENT' ? 404 : 422, { error: error.message ?? String(error) });
    }
  });
  if (options.dev) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({ root: options.root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  }
  return { server, store, close: async () => { await vite?.close(); await new Promise<void>((ok, reject) => server.close(error => error ? reject(error) : ok())); } };
}
