import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

try { process.loadEnvFile('.env.local'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const env = { ...process.env };
if (env.APPLE_SIGNING_IDENTITY) env.APPLE_SIGNING_IDENTITY = env.APPLE_SIGNING_IDENTITY.trim();
try { await access(env.CARGO_HOME || path.join(homedir(), '.cargo'), constants.W_OK); }
catch {
  env.CARGO_HOME = path.resolve('.cache/cargo');
  await mkdir(env.CARGO_HOME, { recursive: true });
}
const args = process.argv.slice(2);
// Ad-hoc binaries have no team identity for hardened library validation. Certificate-signed builds enable it.
if (args[0] === 'build') args.push('--config', JSON.stringify({ bundle: { macOS: { hardenedRuntime: !!env.APPLE_SIGNING_IDENTITY && env.APPLE_SIGNING_IDENTITY !== '-' } } }));
const check = args[0] === 'check';
const executable = check ? 'cargo' : path.resolve('node_modules/.bin/tauri');
const child = spawn(executable, check ? ['check', '--manifest-path', 'src-tauri/Cargo.toml'] : args, { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
