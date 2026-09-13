import { copyFile, mkdir, rm } from 'node:fs/promises';
import { loadEnv } from 'vite';
const env = { ...loadEnv('production', 'website'), ...process.env };
if (env.VITE_DOWNLOAD_URL) {
  const url = new URL(env.VITE_DOWNLOAD_URL);
  if (url.protocol !== 'https:') throw new Error('VITE_DOWNLOAD_URL must use HTTPS');
  await rm('website/public/downloads/Screen-Recorder_0.1.0_macOS-arm64.dmg', { force: true });
} else {
  const file = 'Screen-Recorder_0.1.0_macOS-arm64.dmg';
  await mkdir('website/public/downloads', { recursive: true });
  try { await copyFile(`src-tauri/target/release/bundle/dmg/${file}`, `website/public/downloads/${file}`); }
  catch (error) { throw new Error('Build the desktop DMG first with npm run desktop:build, or configure VITE_DOWNLOAD_URL in website/.env.local.', { cause: error }); }
}
