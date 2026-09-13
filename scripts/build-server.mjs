import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('resources', { recursive: true });
await build({
  entryPoints: { server: 'server/main.ts', mcp: 'server/mcp.ts' },
  outdir: 'resources', outExtension: { '.js': '.mjs' }, bundle: true,
  platform: 'node', target: 'node22', format: 'esm', sourcemap: true,
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});
