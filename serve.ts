// Local static server for playing Emberwild during development.
// Serves game/ at http://localhost:8080 — no build step, no dependencies.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'game');
const port = Number(process.env.PORT ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://localhost:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = join(root, normalize(pathname).replace(/^[/\\]+/, ''));
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Emberwild is served at http://localhost:${port}`);
});
