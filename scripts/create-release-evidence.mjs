import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const value = (name) => {
  const index = process.argv.indexOf(name);
  assert(index >= 0 && process.argv[index + 1], `Missing ${name}`);
  return path.resolve(process.argv[index + 1]);
};
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 60_000 });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  assert.equal(result.status, 0, `${path.basename(command)} failed: ${output}`);
  return output;
};
const hash = async (file) => {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
};

const app = value("--app");
const dmg = value("--dmg");
const notarizationPath = value("--notarization");
const output = value("--output");
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const template = JSON.parse(await readFile(path.join(root, "release", `${version}.json`), "utf8"));
assert.equal(path.basename(dmg), template.artifact.name, "DMG name does not match this release.");
const notarization = JSON.parse(await readFile(notarizationPath, "utf8"));
const signature = run("/usr/bin/codesign", ["--display", "--verbose=4", app]);
const identity = signature.match(/^Authority=(Developer ID Application:.+)$/m)?.[1];
assert(identity, "The app is not signed with a Developer ID Application identity.");
run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
run("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", app]);
run("/usr/bin/xcrun", ["stapler", "validate", app]);
run("/usr/bin/xcrun", ["stapler", "validate", dmg]);
assert.equal(notarization.status, "Accepted", "Apple did not accept the notarization submission.");
const commit = run("git", ["rev-parse", "HEAD"]);
assert.equal(run("git", ["status", "--porcelain=v1"]), "", "Build source must be clean.");
const info = await stat(dmg);
const evidence = {
  ...template,
  status: "release-candidate",
  sourceCommit: commit,
  artifact: { name: path.basename(dmg), bytes: info.size, sha256: await hash(dmg) },
  distribution: {
    developerId: true,
    notarized: true,
    gatekeeperAccepted: true,
    signingIdentity: identity,
    notarizationResult: `Accepted ${notarization.id || "submission"}`,
    evidence: path.basename(notarizationPath),
  },
  build: {
    runner: process.env.GITHUB_RUN_ID ? `GitHub Actions ${process.env.GITHUB_RUN_ID}` : "local",
    architecture: process.arch,
    macOS: run("/usr/bin/sw_vers", ["-productVersion"]),
    node: process.version,
    rustc: run("rustc", ["--version"]),
    xcode: run("/usr/bin/xcodebuild", ["-version"]).replaceAll("\n", "; "),
  },
};
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(`Release evidence: ${output}\nDMG SHA-256: ${evidence.artifact.sha256}`);
