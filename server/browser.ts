// Development-only browser transport. Production clients use the private user socket.
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ApplicationService } from './service.js';
import { AppClient } from './rpc.js';
import { errorOf } from './validation.js';

const isolated = path.join(os.tmpdir(), `screen-recorder-browser-${process.getuid?.() ?? 'local'}`);
const service = new ApplicationService({ dataDir: process.env.SCREENREC_DATA_DIR || path.join(isolated, 'data'), projectsDir: process.env.SCREENREC_PROJECTS_DIR || path.join(isolated, 'projects') });
await service.initialize();
const client = new AppClient();
let desktop = await client.connect(false).then(() => true, () => false);
const server = createServer(async (request, response) => {
  const host = request.headers.host?.split(':')[0];
  const origin = request.headers.origin;
  if (host !== '127.0.0.1' && host !== 'localhost' || origin && !['http://127.0.0.1:1420','http://localhost:1420','http://127.0.0.1:4319'].includes(origin)) { response.writeHead(403); response.end('Forbidden origin'); return; }
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:4319');
    if (url.pathname === '/api/command' && request.method === 'POST') {
      if (!request.headers['content-type']?.startsWith('application/json')) { response.writeHead(415); response.end('JSON required'); return; }
      let body = '';
      for await (const chunk of request) { body += chunk; if (body.length > 2_000_000) { response.writeHead(413); response.end('Request too large'); return; } }
      const input = JSON.parse(body);
      const result = desktop ? await client.call(input.method, input.params) : await service.command(input.method, input.params);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify({ id: input.id, result })); return;
    }
    if (url.pathname === '/api/media' && request.method === 'GET' && !desktop) {
      const projectId = url.searchParams.get('projectId') ?? '', file = url.searchParams.get('path') ?? '';
      const project = await service.store.get(projectId);
      const allowed = [...project.assets.map(a => a.path), project.source?.screen, project.source?.camera].filter(Boolean);
      if (!allowed.includes(file)) { response.writeHead(403); response.end(); return; }
      const resolved = await service.store.resolveMedia(projectId, file);
      const extension = path.extname(resolved).toLowerCase();
      const mime: Record<string,string> = { '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime' };
      response.writeHead(200, { 'Content-Type': mime[extension] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(await fs.readFile(resolved)); return;
    }
    response.writeHead(404); response.end('Not found');
  } catch (error) { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: errorOf(error) })); }
});
server.listen(4319, '127.0.0.1', () => console.error(`Browser development service on 127.0.0.1:4319 (${desktop ? 'connected to desktop' : 'isolated projects; native media unavailable'})`));
process.on('SIGINT', () => { client.close(); server.close(); void service.flush().then(() => process.exit(0)); });
