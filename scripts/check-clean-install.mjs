import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "darwin", "Clean-install checks require macOS.");
const root = fileURLToPath(new URL("../", import.meta.url));
const app = path.resolve(process.argv[2] || "/Applications/Recora Screen.app");
assert(
  app.startsWith(`/Applications${path.sep}`),
  "Install the DMG application in /Applications before running this check.",
);
const run = (command, args) => execFileSync(command, args, { stdio: "inherit" });
run(process.execPath, [path.join(root, "scripts/verify-bundle.mjs"), app]);
run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
run("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", app]);
run("/usr/bin/xcrun", ["stapler", "validate", app]);
console.log("Automated clean-install checks passed.");
