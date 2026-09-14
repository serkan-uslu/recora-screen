# Validation and release

Version 0.1.0 is a **development preview**, not a verified public beta. Apple silicon and macOS 15+ are the planned release target. Existing local DMGs were rebuilt under the same filename, so a filename or an old checksum does not identify the current source or prove release readiness. Developer ID signing, notarization, final branding, and the remaining acceptance evidence are required before public distribution.

The latest preparation results and current artifact digest are recorded in [launch readiness](launch-readiness.md).

## One record per release candidate

`shared/brand.ts` supplies the public product version, platform and release state. [The 0.1.0 evidence template](releases/0.1.0.json) intentionally leaves unverified fields empty. [Historical editor validation](editor-validation.md) records earlier measurements; those results must not be presented as validation of a newly built candidate.

```sh
npm run test:launch
npm run --silent check:launch -- --json > .cache/launch-inspection.json
```

The second command is read-only and exits **1 until every gate passes**. Its JSON output includes the observed source commit and dirty files, versions from package/lock/Tauri/Cargo/shared branding, the command count derived from the shared UI/MCP registry, artifact bytes and DMG SHA-256, build environment, signature authority, Gatekeeper assessment and stapled-ticket validation. A valid Apple Development signature is explicitly insufficient. A locally installed certificate is reported separately from the artifact's actual signature. On non-macOS hosts, local signature validation remains pending.

For an approved candidate, copy the template to `artifacts/release-evidence.json`, fill it with the exact built source commit, actual DMG digest and links to measured reports, then run:

```sh
SCREENREC_RELEASE_EVIDENCE="$PWD/artifacts/release-evidence.json" npm run check:launch -- --json
```

Commit source changes before building the candidate. Keep the completed evidence outside tracked source and attach it beside the DMG on the release; this avoids a file claiming the hash of the commit that contains itself. Use immutable report URLs or include the reports as release attachments. Do not mark a manual check passed based on a synthetic test or another app build. Readiness also requires separate Codex, Claude Code and Claude Desktop client sessions, approved launch visuals, and verified analytics configuration.

The existing development DMG is inspectable, but its relationship to an exact clean source commit is unverified. This preparation does not create a commit, tag, GitHub Release, Pages deployment or Product Hunt submission.

## Historical development validation

- The release app at `src-tauri/target/release/bundle/macos/Screen Recorder.app` and DMG at `src-tauri/target/release/bundle/dmg/Screen-Recorder_0.1.0_macOS-arm64.dmg` were produced successfully. Bundle verification checked all four Mach-O binaries, their architectures, portable dynamic-library paths, and code signatures.
- The main executable ran with `--bundle-check`, exercising its actual native-library loader. Bundled Node and Whisper ran with a system-only `PATH` and without injected `NODE_*` or `DYLD_*` settings. The server and MCP JavaScript passed bundled Node syntax checks.
- Historical packaged MCP integration checks covered independent projects, revision conflicts, retry IDs, reconnects, edits, transient drafts without persistence, speed/cut mapping, editable zooms, transcript text timing, portrait native preview images and MP4 export, and moving test projects to Trash while preserving external exports. Current command totals are derived by `check:launch` from `server/contracts/commands.ts`; they are not maintained as a marketing claim here.
- The signed release completed native audio extraction → bundled Whisper Base → three timed English transcript segments. A one-second cut preserved source timestamps while SRT/VTT exports shifted correctly. The native caption preview passed a visible-glyph pixel assertion and visual inspection.
- Desktop UI checks covered project creation/reopening, edits, cut/undo, draft saving, and dialogs. The parity build additionally verified portrait native framing, wallpaper switching, a slider edit with one undo, zoom timing, visible 720p/1080p/4K aspect-aware presets, and hiding native preview behind dialogs. Synthetic native checks also exercised text and Turkish glyph rendering, camera composition, and preview/export behavior.
- Screen recording and Input Monitoring requests passed mocked permission-flow checks for existing grants, successful requests, stale/denied grants, and Settings-open failures without changing system permissions. Both buttons were verified to open their actual macOS privacy panes; the screen dialog now shows recovery guidance. The certificate-signed bundle passed binary/loader/runtime verification and retained the same certificate-based designated requirement across the rebuild. Live capture and typing checks still require valid user grants for that bundle.

A short initial real-camera recording succeeded. The complete camera hardware off/on and gap-export check (`scripts/check-camera.ts`) requires a dedicated run with the final bundle and capture permissions. No clean-Mac, 60-minute recording, Intel execution, or live cloud-provider result is implied by these checks.

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

Without a configured certificate, the default build has an ad-hoc development signature and includes a DMG. `npm run verify:bundle -- 'src-tauri/target/release/bundle/macos/Screen Recorder.app'` checks bundled executables, notices, architectures, dynamic library paths, and signatures, then runs the main app's `--bundle-check`, Node, and Whisper with a system-only `PATH`. This catches development-machine dependencies without claiming a clean-machine installation test. The DMG script verifies the app first, uses `hdiutil` without Finder automation, verifies the image, and prints its SHA-256 checksum.

For the actual desktop/MCP integration check, launch the app with `SCREENREC_DATA_DIR` and `SCREENREC_PROJECTS_DIR` set to isolated folders, then run `npm run test:desktop -- /absolute/path/to/synthetic.mp4` with the same environment. It records the display, stops and reopens the recording, edits the timeline, fetches a native preview, exports an MP4, verifies a cold service reopen, then runs the broader MCP edit suite. The script temporarily enables protected MCP categories through the desktop command channel and restores the previous policy when it finishes. It moves only its own projects to Trash and verifies that external exports and unrelated projects remain.

`test:native` creates synthetic screen/camera/audio media and checks source-time cuts, deterministic seeks, camera masks/visibility, hardware-off camera gaps, timed overlays/captions/cursor/zoom, 1080p/4K exports, sampled preview/export pixel parity, local audio analysis, and WAV preparation. Canvas checks cover portrait 4K, original wallpapers, custom images, blur, browser frames, alpha colors, legacy 4:3 thumbnails, and narrow output dimensions. Repeated mixed-speed exports decode audio and check its pitch and coverage through the final segment, including reuse of one speed after gaps. Its artifacts are written to a temporary folder printed by the command.

`bash native/check.sh --capture-check` records only a synthetic test window for about three seconds, including a pause/resume, with separate microphone and system audio. It requires existing screen and microphone permissions. It does not request camera permission or record the user's desktop.

`test:ai` downloads the checksum-verified multilingual base model, synthesizes English and Turkish speech locally, runs the bundled whisper.cpp executable, and checks both transcripts for expected words and valid timestamps. It caches the test model under `.cache/local-ai-check/`. No cloud API calls are made.

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
- Verify countdown cancellation and automatic framing from real clicks, drags, and typing with input permission allowed and denied. Confirm typing metadata contains activity times and pointer positions only, with no typed text or key codes.
- Test interrupted capture recovery and low/full-disk failure using a disposable volume. Keep the prior valid project and finalized recording fragments recoverable.
- Intel support is outside this Apple silicon beta. Add it only after building and executing on an Intel Mac with its own acceptance record.
- Apply cuts, silence cleanup, zoom, image/text layers, captions, and audio levels. Compare preview frames and exported video at effect boundaries and after every cut.
- Download both Whisper models and test Turkish and English speech offline. Review silence suggestions with audible system sound. Check OpenAI and Anthropic with your own keys, including cancellation and a batch undo.
- Confirm UI edits appear through MCP and MCP edits update the UI, including a stale-revision conflict and a disconnected client during recording.

These hardware, failure-injection, real-provider, and clean-machine checks must be recorded for each release candidate. The short and synthetic checks do not prove the 60-minute drift/memory criterion.

## Signing and distribution

Without signing configuration, the local build uses ad-hoc signatures and `hardenedRuntime: false`: ad-hoc binaries have no Team ID for hardened library validation of the bundled native library. The build wrapper enables the hardened runtime when a real `APPLE_SIGNING_IDENTITY` is supplied. Runtime helpers then receive hardened-runtime options and timestamps as well.

For repeated local builds, put `APPLE_SIGNING_IDENTITY="Apple Development: Your Name (IDENTIFIER)"` in the git-ignored `.env.local`, using an identity listed by `security find-identity -v -p codesigning`. Both the build wrapper and runtime signer load this file; an explicitly exported environment value takes precedence. This avoids a new ad-hoc code identity invalidating macOS grants after every edit. Switching from an ad-hoc build still needs a one-time permission renewal, and a stale enabled entry may need removal and re-adding in System Settings. See [Apple's explanation of code identity and permission tracking](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements). The app never resets or grants these permissions itself.

Launch the exact release bundle when checking permissions. An older `target/debug/bundle/macos/Screen Recorder.app` can have the same display name and bundle identifier with a different signature; opening by name alone may launch that copy instead. Verify the running executable path before troubleshooting an enabled Settings entry that the app reports as ungranted.

Public distribution requires a **Developer ID Application** identity, an Apple Developer account with notarization access, and appropriate signing for both bundled executable runtimes and the native library. Apple Development identities alone are insufficient. The preparation script signs temporary Node and Whisper copies with stable identifiers and JIT entitlements, verifies them, and atomically replaces the prepared runtimes before Tauri seals the app. An existing development process can continue using its prior executable.

1. Set `APPLE_SIGNING_IDENTITY` to your Developer ID Application identity. Follow [Tauri's macOS signing guide](https://v2.tauri.app/distribute/sign/macos/) to configure notarization credentials securely in the environment or CI secret store. Do not put credentials in source files.
2. Run `npm run desktop:build`. Build separately on each supported host architecture; the current scripts produce a native architecture bundle, not a universal binary.
3. Verify the app with `codesign --verify --deep --strict --verbose=2`, inspect Gatekeeper with `spctl --assess --type execute --verbose=2`, and validate the stapled ticket with `xcrun stapler validate`. Check both bundled `Contents/Resources/bin/node` and `whisper-cli` signatures explicitly before submitting.
4. Install the DMG on a clean Mac and complete the hardware checklist. Publish the DMG, SHA-256 checksum, source tag, changelog, and notices on GitHub Releases.
5. Record a real product demo showing project creation, capture, transcript cleanup, a camera visibility interval, an MCP edit, and export. Use this tested download for the Product Hunt launch.

The manual `release.yml` workflow requires a base64 PKCS#12 Developer ID certificate plus Apple notarization credentials in GitHub Actions secrets. It fails before building when any credential is absent or the identity is not `Developer ID Application`. The workflow signs the app and bundled runtimes with hardened runtime, notarizes and staples the app, packages and notarizes the DMG, verifies Gatekeeper, then uploads the DMG, Apple results, checksum and generated `release-evidence.json` as a source-commit-named candidate artifact. It does not publish a GitHub Release or Product Hunt listing. The generated evidence retains pending manual acceptance rows; complete [the clean Mac checklist](clean-mac-acceptance.md) against that exact candidate before publication.

## Website publication after the approved release

The manual `pages.yml` workflow is prepared but does not run on pushes. Enable GitHub Pages with **GitHub Actions** as its source only when the beta is approved. Publish a GitHub prerelease with tag `v0.1.0` pointing at the tested commit, the exact DMG, checksum, `release-evidence.json`, reports and release notes. Set the repository variable `PLAUSIBLE_SCRIPT_URL` to the verified HTTPS `pa-*.js` script from the project's Plausible settings.

Dispatch **Publish verified beta website** on the same commit and provide the exact `https://github.com/serkan-uslu/screen-recorder/releases/download/v0.1.0/Screen-Recorder_0.1.0_macOS-arm64.dmg` URL. The gate downloads companion evidence, confirms the tag/source match, requires passed acceptance and distribution evidence, and hashes the actual public asset before building the site. It rejects `latest` links, a missing release, absent analytics configuration, dirty source, or a different artifact. The output is `website/dist`, deployed to `https://serkan-uslu.github.io/screen-recorder/`.

Site analytics count visits and explicit button events. A Download Click is not a completed transfer or installation. `npm run stats:downloads` reports GitHub asset transfers separately. No install count is collected. Verify production events in Plausible before recording `analyticsVerified` as passed; keep privacy signals and failed/blocked analytics from interrupting downloads.
