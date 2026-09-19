#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [executable, ...args] = process.argv.slice(2);

if (!executable) {
  console.error("The signed development runner needs an executable path.");
  process.exit(1);
}
const resolvedExecutable = path.resolve(process.cwd(), executable);
let launchedExecutable = resolvedExecutable;
let signedDevelopmentBundle = false;

const identity = (
  process.env.RECORA_DEV_SIGNING_IDENTITY || process.env.APPLE_SIGNING_IDENTITY
)?.trim();
if (process.platform === "darwin" && identity && identity !== "-") {
  const sign = (target, identifier, entitlements) => {
    const command = [
      "--force",
      "--sign",
      identity,
      "--identifier",
      identifier,
      "--options",
      "runtime",
      "--timestamp=none",
    ];
    if (entitlements) command.push("--entitlements", entitlements);
    command.push(target);
    const signed = spawnSync("codesign", command, { cwd: root, encoding: "utf8" });
    if (signed.status !== 0) {
      process.stderr.write(signed.stderr || `Could not sign ${target}.\n`);
      process.exit(signed.status ?? 1);
    }
  };
  const bundle = path.join(root, "src-tauri/target/debug/Recora Screen.app");
  const contents = path.join(bundle, "Contents");
  const macOS = path.join(contents, "MacOS");
  const frameworks = path.join(contents, "Frameworks");
  const resources = path.join(contents, "Resources");
  mkdirSync(macOS, { recursive: true });
  mkdirSync(frameworks, { recursive: true });
  mkdirSync(resources, { recursive: true });

  launchedExecutable = path.join(macOS, "recora-screen");
  const bundledLibrary = path.join(frameworks, "libscreenrec.dylib");
  copyFileSync(resolvedExecutable, launchedExecutable);
  chmodSync(launchedExecutable, 0o755);
  copyFileSync(path.join(root, "native/build/libscreenrec.dylib"), bundledLibrary);
  copyFileSync(path.join(root, "src-tauri/icons/icon.icns"), path.join(resources, "icon.icns"));

  const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
  writeFileSync(
    path.join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDevelopmentRegion</key><string>English</string>
  <key>CFBundleDisplayName</key><string>Recora Screen</string>
  <key>CFBundleExecutable</key><string>recora-screen</string>
  <key>CFBundleIconFile</key><string>icon.icns</string>
  <key>CFBundleIdentifier</key><string>com.screenrecorder.desktop</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>Recora Screen</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.video</string>
  <key>LSMinimumSystemVersion</key><string>15.0</string>
  <key>NSAudioCaptureUsageDescription</key><string>Record system audio alongside your screen.</string>
  <key>NSCameraUsageDescription</key><string>Record your camera as a separate, editable video track.</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>Record your narration as a separate audio track.</string>
  <key>NSScreenCaptureUsageDescription</key><string>Record the screen or window you select.</string>
</dict></plist>\n`,
  );

  sign(bundledLibrary, "com.screenrecorder.desktop.native");
  sign(
    launchedExecutable,
    "com.screenrecorder.desktop",
    path.join(root, "src-tauri/Entitlements.plist"),
  );
  sign(bundle, "com.screenrecorder.desktop", path.join(root, "src-tauri/Entitlements.plist"));
  console.log(`Signed the development app as ${identity}.`);
  signedDevelopmentBundle = true;
}

if (process.platform === "darwin" && signedDevelopmentBundle) {
  // TCC attributes privacy requests to the process that launched an app. Starting
  // through the terminal (or an IDE) makes that parent responsible for Screen
  // Recording and Input Monitoring. A per-user launchd job makes the signed app
  // responsible for its own requests and keeps that identity stable across builds.
  const label = "com.recora.screen.dev";
  const domain = `gui/${process.getuid()}/${label}`;
  const removeJob = () => spawnSync("launchctl", ["remove", label], { stdio: "ignore" });
  removeJob();
  // launchd stops the previous process asynchronously. Give AppKit and the
  // single-instance guard time to release before submitting its replacement.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 750);
  const submitted = spawnSync(
    "launchctl",
    [
      "submit",
      "-l",
      label,
      "--",
      "/bin/zsh",
      "-c",
      'cd "$1" && shift && exec "$@"',
      "recora-dev",
      root,
      launchedExecutable,
      ...args,
    ],
    {
      env: process.env,
      encoding: "utf8",
    },
  );
  if (submitted.status !== 0) {
    process.stderr.write(submitted.stderr || "Could not launch the signed development app.\n");
    process.exit(submitted.status ?? 1);
  }
  console.log("Launched the development app with its own macOS privacy identity.");
  let finished = false;
  const finish = (code = 0) => {
    if (finished) return;
    finished = true;
    clearInterval(watch);
    removeJob();
    process.exit(code);
  };
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => finish(0));
  let startupChecks = 0;
  const watch = setInterval(() => {
    const job = spawnSync("launchctl", ["print", domain], { encoding: "utf8" });
    if (job.status === 0 && /^\s*state = running$/m.test(job.stdout)) {
      startupChecks = 20;
      return;
    }
    startupChecks += 1;
    if (startupChecks >= 20) finish(0);
  }, 500);
} else {
  const child = spawnSync(launchedExecutable, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (child.error) {
    console.error(child.error.message);
    process.exit(1);
  }
  process.exit(child.status ?? 1);
}
