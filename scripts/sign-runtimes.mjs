import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, copyFile, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'darwin', 'Signing desktop runtimes requires macOS.');
const root = fileURLToPath(new URL('../', import.meta.url));
const identity = process.env.APPLE_SIGNING_IDENTITY?.trim() || '-';
const entitlements = path.join(root, 'src-tauri/Entitlements.plist');
await access(entitlements, constants.R_OK);

// Sign helpers before Tauri seals the containing app; Node needs allow-jit under the hardened runtime.
for (const name of ['node', 'whisper-cli']) {
  const binary = path.join(root, 'resources/bin', name);
  await access(binary, constants.X_OK);
  const pending = path.join(path.dirname(binary), `.${name}.signing-${randomUUID()}`);
  try {
    // A development app may still be executing the previous inode. Never change its signature in place.
    await copyFile(binary, pending, constants.COPYFILE_EXCL);
    const args = ['--force', '--sign', identity, '--identifier', `com.screenrecorder.runtime.${name}`, '--entitlements', entitlements];
    if (identity !== '-') args.push('--options', 'runtime', '--timestamp');
    execFileSync('/usr/bin/codesign', [...args, pending], { stdio: 'inherit' });
    execFileSync('/usr/bin/codesign', ['--verify', '--strict', pending], { stdio: 'inherit' });
    await access(pending, constants.X_OK);
    await rename(pending, binary);
  } finally {
    await rm(pending, { force: true });
  }
}
console.log(`Bundled runtimes signed with ${identity === '-' ? 'ad-hoc development signatures' : 'the configured identity and hardened runtime'}.`);
