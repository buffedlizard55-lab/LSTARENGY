import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
};
http
  .createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    try {
      let route = decodeURIComponent(new URL(req.url, 'http://preview.invalid').pathname);
      // Simulates the GitHub project prefix as well as ordinary preview /docs/.
      if (route === '/LSTARENGY') route = '/LSTARENGY/';
      if (route.startsWith('/LSTARENGY/')) route = route.slice('/LSTARENGY'.length);
      if (
        route.split('/').some((part) => part.startsWith('.')) ||
        route.includes('\\') ||
        route.includes('\0')
      )
        throw new Error('Forbidden');
      if (route === '/') route = '/index.html';
      if (route === '/docs' || route === '/docs/') route = '/docs/index.html';
      if (!(route === '/index.html' || route.startsWith('/docs/'))) throw new Error('Not found');
      const filename = path.resolve(root, `.${route}`);
      if (!filename.startsWith(`${root}${path.sep}`) || !(await stat(filename)).isFile())
        throw new Error('Not found');
      const body = await readFile(filename);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  })
  .listen(port, '0.0.0.0', () =>
    console.log(
      `Research website listening on 0.0.0.0:${port}. No host/origin restriction; read-only static assets.`,
    ),
  );
