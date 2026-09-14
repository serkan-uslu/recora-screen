import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { product, release } from "@/shared/brand.js";
import { methodSchemas } from "@/server/contracts/commands.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const requiredAcceptance = [
  "brandApproved",
  "cleanMacInstall",
  "longRecordingSyncAndMemory",
  "failureRecovery",
  "capturePermissionsAndDevices",
  "englishAndTurkishOfflineWhisper",
  "previewExportParity",
  "regressionChecks",
  "bundledRuntimePortability",
  "openaiProvider",
  "anthropicProvider",
  "codexClient",
  "claudeCodeClient",
  "claudeDesktopClient",
  "analyticsVerified",
  "launchMediaReviewed",
] as const;
const evidenceSchema = z.object({
  version: z.string(),
  sourceCommit: z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .nullable(),
  artifact: z.object({
    name: z.string(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  }),
  distribution: z.object({
    developerId: z.boolean(),
    notarized: z.boolean(),
    gatekeeperAccepted: z.boolean(),
    evidence: z.string().nullable(),
  }),
  acceptance: z.record(
    z.string(),
    z.object({ status: z.enum(["pending", "passed", "failed"]), evidence: z.string().nullable() }),
  ),
});
type Evidence = z.infer<typeof evidenceSchema>;
type Check = { id: string; passed: boolean; detail: string };
const checks: Check[] = [];
function check(id: string, passed: boolean, detail: string) {
  checks.push({ id, passed, detail });
}
function run(executable: string, args: string[]) {
  const result = spawnSync(executable, args, { cwd: root, encoding: "utf8", timeout: 30_000 });
  return {
    passed: !result.error && result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`.trim(),
  };
}
async function sha256(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
function releaseUrl(value: string, repository: string, version: string, assetName: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.href === `${repository}/releases/download/v${version}/${assetName}`
    );
  } catch {
    return false;
  }
}
function acceptanceComplete(evidence: Evidence) {
  return requiredAcceptance.every(
    (key) =>
      evidence.acceptance[key]?.status === "passed" &&
      Boolean(evidence.acceptance[key]?.evidence?.trim()),
  );
}

if (process.argv.includes("--self-check")) {
  const url =
    "https://github.com/serkan-uslu/screen-recorder/releases/download/v0.1.0/Screen-Recorder_0.1.0_macOS-arm64.dmg";
  assert(releaseUrl(url, product.repository, "0.1.0", "Screen-Recorder_0.1.0_macOS-arm64.dmg"));
  for (const candidate of [
    url.replace("https:", "http:"),
    `${url}?download=1`,
    url.replace("v0.1.0/", "latest/"),
    url.replace("github.com", "github.com.evil.example"),
  ]) {
    assert(
      !releaseUrl(candidate, product.repository, "0.1.0", "Screen-Recorder_0.1.0_macOS-arm64.dmg"),
    );
  }
  const evidence = {
    acceptance: Object.fromEntries(
      requiredAcceptance.map((key) => [
        key,
        { status: "passed", evidence: "release-bound report" },
      ]),
    ),
  } as Evidence;
  assert(acceptanceComplete(evidence));
  evidence.acceptance.cleanMacInstall = { status: "pending", evidence: null };
  assert(!acceptanceComplete(evidence));
  evidence.acceptance.cleanMacInstall = { status: "passed", evidence: "" };
  assert(!acceptanceComplete(evidence));
  assert(!evidenceSchema.safeParse({ ...evidence, distribution: {} }).success);
  console.log(
    "Launch checker self-check passed: exact release URLs and missing evidence fail closed.",
  );
} else {
  const siteOnly = process.argv.includes("--site");
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  const tauri = JSON.parse(await readFile(path.join(root, "src-tauri/tauri.conf.json"), "utf8"));
  const cargo = (await readFile(path.join(root, "src-tauri/Cargo.toml"), "utf8")).match(
    /^version\s*=\s*"([^"]+)"/m,
  )?.[1];
  const download = process.env.VITE_DOWNLOAD_URL || release.downloadUrl;
  const exactUrl = releaseUrl(download, product.repository, packageJson.version, release.assetName);
  const evidencePath =
    siteOnly && exactUrl
      ? new URL("release-evidence.json", download).href
      : process.env.SCREENREC_RELEASE_EVIDENCE || `docs/releases/${packageJson.version}.json`;
  const evidence = evidenceSchema.parse(
    evidencePath.startsWith("https:")
      ? await fetch(evidencePath, { signal: AbortSignal.timeout(30_000) }).then(
          async (response) => {
            assert(response.ok, `Release evidence unavailable: HTTP ${response.status}`);
            return response.json();
          },
        )
      : JSON.parse(await readFile(path.resolve(root, evidencePath), "utf8")),
  );
  const versions = {
    product: product.version,
    package: packageJson.version,
    lock: packageLock.version,
    lockRoot: packageLock.packages?.[""].version,
    tauri: tauri.version,
    cargo,
    evidence: evidence.version,
  };
  check(
    "versions",
    Object.values(versions).every((value) => value === packageJson.version),
    JSON.stringify(versions),
  );
  check(
    "product-name",
    product.name === tauri.productName,
    `${product.name} / ${tauri.productName}`,
  );
  check(
    "platform",
    Number.parseFloat(tauri.bundle.macOS.minimumSystemVersion) ===
      Number.parseFloat(product.minimumMacOS),
    `${product.platform}; macOS ${product.minimumMacOS}+`,
  );
  const commandNames = Object.keys(methodSchemas).sort();
  check(
    "command-registry",
    commandNames.length > 0,
    `${commandNames.length} commands derived from the shared UI/MCP registry`,
  );
  const commit = run("git", ["rev-parse", "HEAD"]);
  const workingTree = run("git", ["status", "--porcelain=v1", "--untracked-files=normal"]);
  check(
    "source-provenance",
    commit.passed && evidence.sourceCommit === commit.output,
    `Observed ${commit.output}; artifact source ${evidence.sourceCommit ?? "unverified"}`,
  );
  check(
    "working-tree",
    workingTree.passed && workingTree.output === "",
    workingTree.output || "Clean",
  );
  check(
    "artifact-identity",
    evidence.artifact.name === release.assetName &&
      /^[a-f0-9]{64}$/.test(evidence.artifact.sha256 ?? ""),
    `${evidence.artifact.name}: ${evidence.artifact.sha256 ?? "not recorded"}`,
  );
  check("release-status", String(release.status) === "public-beta", String(release.status));
  for (const key of requiredAcceptance) {
    const value = evidence.acceptance[key];
    check(
      key,
      value?.status === "passed" && Boolean(value?.evidence?.trim()),
      value?.evidence || "Pending release-bound evidence",
    );
  }
  check("release-download", exactUrl, download || "No public release download configured");
  let artifact: { path: string; sha256: string | null; bytes: number | null } | null = null;
  let signing: Record<string, unknown> | null = null;
  if (siteOnly) {
    check(
      "distribution-evidence",
      Object.values(evidence.distribution).every(Boolean),
      evidence.distribution.evidence ||
        "Developer ID, notarization and Gatekeeper evidence required",
    );
    const releaseTag = run("git", ["rev-parse", `v${packageJson.version}^{commit}`]);
    check(
      "release-tag",
      releaseTag.passed && releaseTag.output === commit.output,
      releaseTag.output,
    );
    check(
      "analytics-configured",
      /^https:\/\//.test(process.env.VITE_PLAUSIBLE_SCRIPT_URL || ""),
      "The Plausible HTTPS pa-*.js script must be configured",
    );
    if (exactUrl) {
      try {
        const response = await fetch(download, { signal: AbortSignal.timeout(120_000) });
        assert(response.ok && response.body, `HTTP ${response.status}`);
        assert(response.url.startsWith("https://"), "Release asset redirected to an insecure URL");
        const hash = createHash("sha256");
        let bytes = 0;
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            hash.update(value);
          }
        } finally {
          reader.releaseLock();
        }
        const digest = hash.digest("hex");
        artifact = { path: download, sha256: digest, bytes };
        check(
          "published-asset",
          digest === evidence.artifact.sha256 && bytes > 0,
          `${bytes} bytes; SHA-256 ${digest}`,
        );
      } catch (error) {
        check("published-asset", false, String(error));
      }
    }
  } else {
    const app = path.join(root, `src-tauri/target/release/bundle/macos/${tauri.productName}.app`);
    const dmg = path.join(root, "src-tauri/target/release/bundle/dmg", release.assetName);
    const info = await stat(dmg).catch(() => null);
    const digest = info?.isFile() ? await sha256(dmg) : null;
    artifact = { path: path.relative(root, dmg), sha256: digest, bytes: info?.size ?? null };
    check(
      "local-artifact",
      Boolean(digest) && digest === evidence.artifact.sha256,
      digest || "DMG not built",
    );
    if (process.platform === "darwin") {
      const signature = run("/usr/bin/codesign", ["--display", "--verbose=4", app]);
      const verification = run("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]);
      const gatekeeper = run("/usr/sbin/spctl", [
        "--assess",
        "--type",
        "execute",
        "--verbose=2",
        app,
      ]);
      const notarization = run("/usr/bin/xcrun", ["stapler", "validate", app]);
      const identities = run("/usr/bin/security", ["find-identity", "-v", "-p", "codesigning"]);
      signing = {
        authority: signature.output
          .split("\n")
          .filter((line) => /^(Authority|TeamIdentifier|Signature)=/.test(line)),
        verification,
        gatekeeper,
        notarization,
        developerIdAvailable:
          identities.passed && identities.output.includes('"Developer ID Application:'),
      };
      check(
        "developer-id",
        verification.passed && /^Authority=Developer ID Application:/m.test(signature.output),
        JSON.stringify(signing.authority),
      );
      check("gatekeeper", gatekeeper.passed, gatekeeper.output);
      check("notarization", notarization.passed, notarization.output);
    } else
      check(
        "macos-distribution",
        false,
        "Run local signature, Gatekeeper and ticket checks on macOS",
      );
  }
  const report = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    mode: siteOnly ? "pages" : "local",
    ready: checks.every((value) => value.passed),
    sourceCommit: commit.output,
    versions,
    commandCount: commandNames.length,
    commandNames,
    artifact,
    signing,
    evidencePath,
    checks,
  };
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(
      `${report.ready ? "READY" : "NOT READY"}: ${product.name} ${product.version}; ${commandNames.length} shared commands`,
    );
    for (const value of checks)
      console.log(`${value.passed ? "PASS" : "PENDING"} ${value.id}: ${value.detail}`);
  }
  process.exitCode = report.ready ? 0 : 1;
}
