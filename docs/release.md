# Validation and release

Version 0.1.0 has been built as an Apple Silicon development app and DMG. This is a working, ad-hoc-signed development package; Developer ID signing, notarization, and the remaining hardware acceptance checks are still required for public distribution.

## Verified development build

- The release app at `src-tauri/target/release/bundle/macos/Screen Recorder.app` and DMG at `src-tauri/target/release/bundle/dmg/Screen-Recorder_0.1.0_macOS-arm64.dmg` were produced successfully. Bundle verification checked all four Mach-O binaries, their architectures, portable dynamic-library paths, and code signatures.
- The main executable ran with `--bundle-check`, exercising its actual native-library loader. Bundled Node and Whisper ran with a system-only `PATH` and without injected `NODE_*` or `DYLD_*` settings. The server and MCP JavaScript passed bundled Node syntax checks.
- The packaged MCP server exposed 42 tools. Integration checks covered independent projects, revision conflicts, retry IDs, reconnects, edits, native preview images, MP4 export, and moving test projects to Trash while preserving external exports.
- The signed release completed native audio extraction → bundled Whisper Base → three timed English transcript segments. A one-second cut preserved source timestamps while SRT/VTT exports shifted correctly. The native caption preview passed a visible-glyph pixel assertion and visual inspection.
- Desktop UI checks covered project creation/reopening, edits, cut/undo, draft saving, and dialogs. Synthetic native checks also exercised text and Turkish glyph rendering, camera composition, and preview/export behavior.

A short initial real-camera recording succeeded. The complete camera hardware off/on and gap-export check (`scripts/check-camera.ts`) remains pending screen/microphone permissions for the final bundle. No clean-Mac, 60-minute recording, Intel execution, or live cloud-provider result is implied by these checks.

## Reproduce checks

```sh
npm ci
npm run prepare:desktop
npm test
npm run build
npm run desktop:check
npm run test:native
npm run test:ai
npm run desktop:build
```

The default build has an ad-hoc development signature and includes a DMG. `npm run verify:bundle -- 'src-tauri/target/release/bundle/macos/Screen Recorder.app'` checks bundled executables, notices, architectures, dynamic library paths, and signatures, then runs the main app's `--bundle-check`, Node, and Whisper with a system-only `PATH`. This catches development-machine dependencies without claiming a clean-machine installation test. The DMG script verifies the app first, uses `hdiutil` without Finder automation, verifies the image, and prints its SHA-256 checksum.

For the actual desktop/MCP integration check, launch the app with `SCREENREC_DATA_DIR` and `SCREENREC_PROJECTS_DIR` set to isolated folders, then run `npm run test:desktop -- /absolute/path/to/synthetic.mp4` with the same environment. It creates temporary projects, edits through the official MCP client, fetches a native preview image, exports an MP4, reconnects the client, and moves only its own projects to Trash. The test verifies that external exports and unrelated projects remain.

`test:native` creates synthetic screen/camera/audio media and checks source-time cuts, deterministic seeks, camera masks/visibility, hardware-off camera gaps, timed overlays/captions/cursor/zoom, 1080p/4K exports, sampled preview/export pixel parity, local audio analysis, and WAV preparation. Its artifacts are written to a temporary folder printed by the command.

`bash native/check.sh --capture-check` records only a synthetic test window for about three seconds, including a pause/resume, with separate microphone and system audio. It requires existing screen and microphone permissions. It does not request camera permission or record the user's desktop.

`test:ai` downloads the checksum-verified multilingual base model, synthesizes a spoken English sentence locally, runs the bundled whisper.cpp executable, and checks that the resulting transcript contains the expected words and valid timestamps. It caches the test model under `.cache/local-ai-check/`. No cloud API calls are made.

For the full local-AI desktop check, first run `test:ai`, then launch the release app with isolated data/project directories under `.cache`. Run the following with the same `SCREENREC_DATA_DIR`, using the synthetic screen video printed by `test:native`:

```sh
SCREENREC_RESOURCES="$PWD/src-tauri/target/release/bundle/macos/Screen Recorder.app/Contents/Resources" \
  npx tsx scripts/check-desktop-ai.ts /absolute/path/to/synthetic-screen.mov
```

This check uses installed `ffmpeg`/`ffprobe` only to prepare and inspect test fixtures; they are not application dependencies. It retains a `Local AI acceptance fixture` project and prints its artifact directory, including SRT, VTT, and the checked caption image.

## Hardware acceptance before public release

- On a clean Mac without Node installed, open the app, create multiple projects, record, edit, save, quit, and reopen. Verify project separation and Trash recovery. Delete a project and verify external exports remain.
- Record 60 minutes at 4K/30 with screen, camera, microphone, and system sound. Use a visible clap or timecode at the beginning and end. Measure synchronization drift; it must remain within 80 ms. Sample process memory over the full session and check that it stabilizes.
- Exercise camera hide/show separately from hardware off/on, camera unplugging, microphone unplugging, display/window/region selection, pause/resume, and permission denial.
- Test interrupted capture recovery and low/full-disk failure using a disposable volume. Keep the prior valid project and finalized recording fragments recoverable.
- Build and execute on an Intel Mac; the verified development artifact is arm64 only.
- Apply cuts, silence cleanup, zoom, image/text layers, captions, and audio levels. Compare preview frames and exported video at effect boundaries and after every cut.
- Download both Whisper models and test Turkish and English speech offline. Review silence suggestions with audible system sound. Check OpenAI and Anthropic with your own keys, including cancellation and a batch undo.
- Confirm UI edits appear through MCP and MCP edits update the UI, including a stale-revision conflict and a disconnected client during recording.

These hardware, failure-injection, real-provider, and clean-machine checks must be recorded for each release candidate. The short and synthetic checks do not prove the 60-minute drift/memory criterion.

## Signing and distribution

The default local build is for development. It uses ad-hoc signatures and `hardenedRuntime: false`: ad-hoc binaries have no Team ID for hardened library validation of the bundled native library. The build wrapper enables the hardened runtime when a real `APPLE_SIGNING_IDENTITY` is supplied. Runtime helpers then receive hardened-runtime options and timestamps as well.

Public distribution requires a **Developer ID Application** identity, an Apple Developer account with notarization access, and appropriate signing for both bundled executable runtimes and the native library. Apple Development identities alone are insufficient. The preparation script signs temporary Node and Whisper copies with stable identifiers and JIT entitlements, verifies them, and atomically replaces the prepared runtimes before Tauri seals the app. An existing development process can continue using its prior executable.

1. Set `APPLE_SIGNING_IDENTITY` to your Developer ID Application identity. Follow [Tauri's macOS signing guide](https://v2.tauri.app/distribute/sign/macos/) to configure notarization credentials securely in the environment or CI secret store. Do not put credentials in source files.
2. Run `npm run desktop:build`. Build separately on each supported host architecture; the current scripts produce a native architecture bundle, not a universal binary.
3. Verify the app with `codesign --verify --deep --strict --verbose=2`, inspect Gatekeeper with `spctl --assess --type execute --verbose=2`, and validate the stapled ticket with `xcrun stapler validate`. Check both bundled `Contents/Resources/bin/node` and `whisper-cli` signatures explicitly before submitting.
4. Install the DMG on a clean Mac and complete the hardware checklist. Publish the DMG, SHA-256 checksum, source tag, changelog, and notices on GitHub Releases.
5. Record a real product demo showing project creation, capture, transcript cleanup, a camera visibility interval, an MCP edit, and export. Use this tested download for the Product Hunt launch.

The manual `release.yml` workflow reuses the same build and verification scripts, forces development signing, and uploads app ZIP/DMG artifacts and checksums. It does not publish a GitHub Release or Product Hunt listing. No signing keys or notarization credentials are supplied by this repository.
