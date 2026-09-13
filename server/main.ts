import { randomUUID } from 'node:crypto';
import { ApplicationService } from './service.js';
import { AppError, errorOf } from './validation.js';
import { readLines, serveSocket } from './rpc.js';

const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + '\n');
const pending = new Map<string, { resolve: (value: any) => void; reject: (error: unknown) => void; timer: NodeJS.Timeout }>();
const service = new ApplicationService({ native: (method, params = {}) => new Promise((resolve, reject) => {
  const id = randomUUID();
  const timer = setTimeout(() => { pending.delete(id); reject(new AppError('NATIVE_TIMEOUT', `Native operation ${method} timed out. Check recording or job status before retrying.`)); }, 300000);
  pending.set(id, { resolve, reject, timer });
  send({ native: true, id, method, params });
}) });
service.on('project-changed', data => send({ event: 'project-changed', data }));

readLines(process.stdin, line => {
  let request: any;
  try { request = JSON.parse(line); } catch (error) { send({ error: errorOf(error) }); return; }
  if (typeof request.nativeResponse === 'string') {
    const waiting = pending.get(request.nativeResponse);
    if (waiting) {
      clearTimeout(waiting.timer); pending.delete(request.nativeResponse);
      request.error ? waiting.reject(new AppError(request.error.code ?? 'NATIVE_ERROR', request.error.message ?? String(request.error), request.error.details)) : waiting.resolve(request.result);
    }
    return;
  }
  if (typeof request.method !== 'string') { send({ id: request.id, error: { code: 'INVALID_REQUEST', message: 'RPC method is required' } }); return; }
  ready.then(() => service.command(request.method, request.params)).then(result => send({ id: request.id, result }), error => send({ id: request.id, error: errorOf(error) }));
}, error => { console.error(error.message); process.exitCode = 1; });

const ready = (async () => {
  await service.initialize();
  const socket = await serveSocket(service);
  process.stdin.on('end', () => {
    socket.close();
    for (const job of service.jobs.active()) service.jobs.cancel(job.id);
    service.flush().then(() => { process.exit(0); }, error => { console.error(error); process.exit(1); });
  });
  return socket;
})();
ready.catch(error => { console.error(errorOf(error).message); process.exit(1); });
