import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "darwin", "DMG packaging requires macOS.");
assert.equal(process.argv.length, 2, "Usage: node scripts/package-dmg.mjs");
const root = fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
assert(
  typeof version === "string" && /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version),
  "package.json must contain a safe semantic version.",
);
assert(["arm64", "x64"].includes(process.arch), "Only native arm64 and x64 bundles are supported.");
const bundleRoot = path.join(root, "src-tauri/target/release/bundle");
const app = path.join(bundleRoot, "macos/Recora Screen.app");
execFileSync(process.execPath, [path.join(root, "scripts/verify-bundle.mjs"), app], {
  stdio: "inherit",
});

const outputDirectory = path.join(bundleRoot, "dmg");
await mkdir(outputDirectory, { recursive: true });
const output = path.join(outputDirectory, `Recora-Screen_${version}_macOS-${process.arch}.dmg`);
const pending = path.join(outputDirectory, `.recora-screen-${randomUUID()}.dmg`);
const staging = await mkdtemp(path.join(tmpdir(), "recora-screen-dmg-"));
try {
  execFileSync("/usr/bin/ditto", [app, path.join(staging, "Recora Screen.app")], {
    stdio: "inherit",
  });
  await symlink("/Applications", path.join(staging, "Applications"));
  execFileSync(
    "/usr/bin/hdiutil",
    ["create", "-volname", "Recora Screen", "-srcfolder", staging, "-format", "UDZO", pending],
    { stdio: "inherit" },
  );
  execFileSync("/usr/bin/hdiutil", ["verify", pending], { stdio: "inherit" });
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(pending)) hash.update(chunk);
  // Both paths share the build directory, so a failed image creation never replaces the previous artifact.
  await rename(pending, output);
  console.log(`DMG: ${output}\nSHA256: ${hash.digest("hex")}`);
} finally {
  await rm(pending, { force: true });
  await rm(staging, { recursive: true, force: true });
}
