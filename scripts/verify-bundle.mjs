import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, open, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

const systemPath = (value) => {
  const normalized = path.normalize(value);
  return normalized.startsWith("/System/Library/") || normalized.startsWith("/usr/lib/");
};
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const dependencies = (output) =>
  output.split("\n").flatMap((line) => {
    const match = line.match(/^\s+(.+?)\s+\(compatibility version/);
    return match ? [match[1]] : [];
  });
const runpaths = (output) =>
  [...output.matchAll(/cmd LC_RPATH\s+cmdsize \d+\s+path (.+?) \(offset \d+\)/g)].map(
    (match) => match[1],
  );
const portableReference = (value) =>
  systemPath(value) || /^@(rpath|loader_path|executable_path)(\/|$)/.test(value);

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8_000_000,
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${path.basename(executable)} ${args.join(" ")} failed: ${result.error?.message || result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`}`,
    );
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

async function binariesIn(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        assert(
          inside(root, await realpath(file)),
          `Bundle symlink points outside the app: ${file}`,
        );
        continue; // A framework's versioned target is inspected through its real directory.
      }
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        const handle = await open(file, "r"),
          header = Buffer.alloc(4);
        try {
          await handle.read(header, 0, 4, 0);
        } finally {
          await handle.close();
        }
        if (
          [
            "feedface",
            "cefaedfe",
            "feedfacf",
            "cffaedfe",
            "cafebabe",
            "bebafeca",
            "cafebabf",
            "bfbafeca",
          ].includes(header.toString("hex"))
        )
          files.push(file);
      }
    }
  }
  await walk(root);
  return files;
}

async function verify(input) {
  const app = await realpath(path.resolve(input));
  assert(app.endsWith(".app") && (await stat(app)).isDirectory(), "Supply a macOS .app bundle.");
  const contents = path.join(app, "Contents");
  const info = JSON.parse(
    run("/usr/bin/plutil", ["-convert", "json", "-o", "-", path.join(contents, "Info.plist")]),
  );
  assert(
    typeof info.CFBundleExecutable === "string" &&
      path.basename(info.CFBundleExecutable) === info.CFBundleExecutable,
    "Invalid CFBundleExecutable.",
  );
  assert(info.CFBundleIdentifier === "com.screenrecorder.desktop", "Unexpected bundle identifier.");
  assert(
    Number.parseFloat(info.LSMinimumSystemVersion) >= 15,
    "The app must declare macOS 15 or later.",
  );
  const main = path.join(contents, "MacOS", info.CFBundleExecutable);
  const resources = path.join(contents, "Resources");
  const node = path.join(resources, "bin/node"),
    whisper = path.join(resources, "bin/whisper-cli");
  const native = path.join(contents, "Frameworks/libscreenrec.dylib");
  for (const relative of [
    "server.mjs",
    "mcp.mjs",
    "THIRD_PARTY_NOTICES.txt",
    "bin/NODE-LICENSE",
    "bin/WHISPER-LICENSE",
    "bin/node-version",
    "bin/whisper-version",
  ]) {
    const file = path.join(resources, relative);
    assert(
      (await stat(file)).isFile() && (await stat(file)).size > 0,
      `Missing or empty bundled resource: ${relative}`,
    );
  }
  for (const executable of [main, node, whisper]) await access(executable, constants.X_OK);
  assert((await stat(native)).isFile(), "Missing native capture/composition library.");
  const binaries = await binariesIn(app);
  for (const required of [main, node, whisper, native])
    assert(binaries.includes(required), `Expected a Mach-O binary: ${required}`);
  const metadata = new Map(
    binaries.map((file) => [
      file,
      {
        dependencies: dependencies(run("/usr/bin/otool", ["-L", file])),
        rpaths: runpaths(run("/usr/bin/otool", ["-l", file])),
        architectures: run("/usr/bin/lipo", ["-archs", file]).trim().split(/\s+/),
      },
    ]),
  );
  const issues = [];
  const expand = (reference, file) =>
    reference
      .replace(/^@loader_path(?=\/|$)/, path.dirname(file))
      .replace(/^@executable_path(?=\/|$)/, path.dirname(main));
  async function resolves(reference, file, rpaths) {
    if (systemPath(reference)) return true; // macOS system libraries can live only in the dyld shared cache.
    const candidates = reference.startsWith("@rpath/")
      ? rpaths.map((base) => path.join(expand(base, file), reference.slice("@rpath/".length)))
      : [expand(reference, file)];
    for (const candidate of candidates) {
      if (systemPath(candidate)) return true;
      if (!path.isAbsolute(candidate) || !inside(app, path.resolve(candidate))) continue;
      const resolved = await realpath(candidate).catch(() => null);
      if (resolved && inside(app, resolved)) return true;
    }
    return false;
  }
  for (const [file, data] of metadata) {
    const label = path.relative(app, file);
    for (const reference of [...data.dependencies, ...data.rpaths]) {
      if (!portableReference(reference))
        issues.push(`${label} contains a nonportable load path: ${reference}`);
    }
    const rpaths = [...data.rpaths, ...metadata.get(main).rpaths];
    for (const dependency of data.dependencies) {
      if (portableReference(dependency) && !(await resolves(dependency, file, rpaths)))
        issues.push(`${label} has an unresolved bundled dependency: ${dependency}`);
    }
    for (const architecture of metadata.get(main).architectures) {
      if (!data.architectures.includes(architecture))
        issues.push(`${label} lacks the main executable's ${architecture} architecture.`);
    }
    try {
      run("/usr/bin/codesign", ["--verify", "--strict", file]);
    } catch (error) {
      issues.push(error.message);
    }
  }
  try {
    run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
  } catch (error) {
    issues.push(error.message);
  }
  assert.equal(
    issues.length,
    0,
    `Bundle verification failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
  );

  // Run with a system-only PATH and without injected Node/dyld settings to catch accidental workstation dependencies.
  const cleanEnv = { ...process.env, PATH: "/usr/bin:/bin:/usr/sbin:/sbin" };
  for (const key of Object.keys(cleanEnv))
    if (key.startsWith("DYLD_") || key.startsWith("NODE_")) delete cleanEnv[key];
  assert(
    /native bundle ready/.test(run(main, ["--bundle-check"], { env: cleanEnv })),
    "The main app could not load its native library.",
  );
  const nodeVersion = run(node, ["--version"], { env: cleanEnv }).trim();
  assert(/^v22\./.test(nodeVersion), `Unexpected bundled Node runtime: ${nodeVersion}`);
  for (const script of ["server.mjs", "mcp.mjs"])
    run(node, ["--check", path.join(resources, script)], { env: cleanEnv });
  const help = run(whisper, ["--help"], { env: cleanEnv });
  assert(
    /usage:|--model/i.test(help),
    "The bundled Whisper executable did not return its help text.",
  );
  const signature = run("/usr/bin/codesign", ["--display", "--verbose=2", app]);
  const adHoc = /Signature=adhoc/.test(signature);
  console.log(
    `Verified ${app}\n  ${binaries.length} portable Mach-O binaries; ${metadata.get(main).architectures.join(", ")}\n  Bundled ${nodeVersion}, Whisper, server and MCP scripts run without a developer PATH\n  Code signature: ${adHoc ? "ad-hoc development signature" : "valid signature"}\n  Notarization and live recording permissions were not checked.`,
  );
}

if (process.argv.includes("--self-test")) {
  assert.deepEqual(
    dependencies(
      "app:\n\t@rpath/lib test.dylib (compatibility version 1.0.0, current version 1.0.0)\n",
    ),
    ["@rpath/lib test.dylib"],
  );
  assert.deepEqual(
    runpaths(
      "Load command 4\n          cmd LC_RPATH\n      cmdsize 48\n         path @executable_path/../Frameworks (offset 12)\n",
    ),
    ["@executable_path/../Frameworks"],
  );
  for (const reference of [
    "/opt/homebrew/lib/lib.dylib",
    "/usr/local/lib/lib.dylib",
    "/Users/dev/.cache/lib.dylib",
    "relative/lib.dylib",
    "/usr/lib/../../opt/homebrew/lib/lib.dylib",
  ])
    assert(!portableReference(reference));
  for (const reference of [
    "/usr/lib/libSystem.B.dylib",
    "/System/Library/Frameworks/AppKit.framework/AppKit",
    "@rpath/libscreenrec.dylib",
    "@loader_path/lib.dylib",
  ])
    assert(portableReference(reference));
  assert(!inside("/Applications/Test.app", "/Applications/Test.app-other/lib.dylib"));
  console.log("Bundle verifier self-check passed.");
} else if (process.argv.includes("--help")) {
  console.log(
    "Usage: node scripts/verify-bundle.mjs <path.app> [other.app ...]\n       node scripts/verify-bundle.mjs --self-test\nRequires macOS. Checks signatures and portability; does not sign, modify, or notarize the app.",
  );
} else {
  assert.equal(process.platform, "darwin", "Bundle verification requires macOS.");
  const inputs = process.argv.slice(2);
  assert(inputs.length > 0, "Usage: node scripts/verify-bundle.mjs <path.app>");
  for (const input of inputs) await verify(input);
}
