import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Pinned LTS runtime. Users don't need Node, npm, or a development environment.
const version = "22.22.3";
const arch = process.env.SCREENREC_ARCH || process.arch;
if (process.platform !== "darwin" || !["arm64", "x64"].includes(arch))
  throw new Error("Desktop bundles currently require macOS arm64 or x64.");
const root = path.resolve("resources/bin");
const cache = path.resolve(".cache/node");
const filename = `node-v${version}-darwin-${arch}.tar.gz`;
await mkdir(root, { recursive: true });
await mkdir(cache, { recursive: true });
const marker = path.join(root, "node-version");
if (
  (await readFile(marker, "utf8").catch(() => "")) === `${version}-${arch}` &&
  (await access(path.join(root, "node"), constants.X_OK).then(
    () => true,
    () => false,
  ))
)
  process.exit(0);
const base = `https://nodejs.org/dist/v${version}`;
const checksums = await fetch(`${base}/SHASUMS256.txt`).then((r) => {
  if (!r.ok) throw new Error(`Node checksums: ${r.status}`);
  return r.text();
});
const expected = checksums
  .split("\n")
  .find((line) => line.endsWith(`  ${filename}`))
  ?.split(/\s+/)[0];
if (!expected) throw new Error("Official Node archive checksum is missing.");
const response = await fetch(`${base}/${filename}`);
if (!response.ok) throw new Error(`Node archive: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash("sha256").update(bytes).digest("hex") !== expected)
  throw new Error("Node archive checksum mismatch.");
const archive = path.join(cache, filename);
await writeFile(archive, bytes);
execFileSync("/usr/bin/tar", ["-xzf", archive, "-C", cache]);
const extracted = path.join(cache, `node-v${version}-darwin-${arch}`);
await copyFile(path.join(extracted, "bin/node"), path.join(root, "node"));
await copyFile(path.join(extracted, "LICENSE"), path.join(root, "NODE-LICENSE"));
await chmod(path.join(root, "node"), 0o755);
await writeFile(marker, `${version}-${arch}`);
await rm(extracted, { recursive: true });
console.log(`Bundled verified Node ${version} (${arch}).`);
