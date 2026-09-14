import { execFileSync } from "node:child_process";
import { mkdir, copyFile, chmod, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const revision = "927cfce34f31707e17f2bff35c349632fb9e2c3a"; // whisper.cpp v1.9.4
const checkout = path.resolve(".cache/whisper.cpp");
const output = path.resolve("resources/bin");
await mkdir(output, { recursive: true });
if (
  (await readFile(path.join(output, "whisper-version"), "utf8").catch(() => "")) === revision &&
  (await access(path.join(output, "whisper-cli"), constants.X_OK).then(
    () => true,
    () => false,
  ))
)
  process.exit(0);
try {
  execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { stdio: "pipe" });
} catch {
  await mkdir(path.dirname(checkout), { recursive: true });
  execFileSync(
    "git",
    [
      "clone",
      "--depth",
      "1",
      "--branch",
      "v1.9.4",
      "https://github.com/ggml-org/whisper.cpp.git",
      checkout,
    ],
    { stdio: "inherit" },
  );
}
const current = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (current !== revision)
  throw new Error("Whisper source revision mismatch. Remove .cache/whisper.cpp and retry.");
const buildDir = path.join(checkout, "build-screenrec");
execFileSync(
  "cmake",
  [
    "-S",
    checkout,
    "-B",
    buildDir,
    "-DCMAKE_BUILD_TYPE=Release",
    "-DCMAKE_OSX_DEPLOYMENT_TARGET=15.0",
    "-DBUILD_SHARED_LIBS=OFF",
    "-DWHISPER_BUILD_TESTS=OFF",
    "-DGGML_METAL=ON",
    "-DGGML_METAL_EMBED_LIBRARY=ON",
    "-DGGML_NATIVE=OFF",
  ],
  { stdio: "inherit" },
);
execFileSync(
  "cmake",
  ["--build", buildDir, "--config", "Release", "--target", "whisper-cli", "-j", "4"],
  { stdio: "inherit" },
);
await copyFile(path.join(buildDir, "bin/whisper-cli"), path.join(output, "whisper-cli"));
await copyFile(path.join(checkout, "LICENSE"), path.join(output, "WHISPER-LICENSE"));
await chmod(path.join(output, "whisper-cli"), 0o755);
await writeFile(path.join(output, "whisper-version"), revision);
console.log("Bundled whisper.cpp with embedded Metal support. Models download separately.");
