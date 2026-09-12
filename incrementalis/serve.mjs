import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
    const url = new URL(request.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') { response.writeHead(302, { Location: '/incrementalis/' }); response.end(); return; }
    if (path === '/incrementalis') { response.writeHead(302, { Location: '/incrementalis/' }); response.end(); return; }
    if (!path.startsWith('/incrementalis/')) { response.writeHead(404); response.end('Not found'); return; }
    path = path.slice('/incrementalis/'.length) || 'index.html';
    const file = resolve(root, path);
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) { response.writeHead(404); response.end('Not found'); return; }
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.info(`Incrementalis: http://127.0.0.1:${port}/incrementalis/`));
