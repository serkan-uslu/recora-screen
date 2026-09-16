# Clean Mac release acceptance

Use a Mac that has never run this product and has no system Node.js installation. Record the app version, source commit, DMG SHA-256, Mac model and macOS version in the release evidence. Every checked row must refer to the exact notarized DMG being released.

## Installation and portability

- [ ] Download the DMG from the candidate artifact, verify its published SHA-256, mount it and copy **Recora Screen.app** to `/Applications`.
- [ ] Launch it from Finder without using Terminal or installing Node, npm, Rust, ffmpeg or Whisper separately.
- [ ] From a source checkout at the candidate commit, run `"/Applications/Recora Screen.app/Contents/Resources/bin/node" scripts/check-clean-install.mjs "/Applications/Recora Screen.app"`. This uses the app's bundled runtime; attach the terminal output.
- [ ] Confirm Gatekeeper opens the app without an unidentified-developer warning and the About/build version matches the evidence.
- [ ] Download the Base and Small Whisper models in the app, disconnect the network and transcribe one English and one Turkish recording.

## Projects, recording and recovery

- [ ] Create two projects, record screen/camera/microphone/system audio in one, edit the other while recording, then stop and export.
- [ ] Quit and reopen the app. Confirm both projects, edits, transcript, camera ranges and overlays remain separate.
- [ ] Exercise display, window and region capture; pause/resume; camera hide/show; camera hardware off/on; and input monitoring allowed/denied.
- [ ] Interrupt a disposable recording by terminating the app. Reopen it and confirm completed media fragments remain recoverable.
- [ ] Move a disposable project to Trash and confirm another project and an external export remain untouched.

## Editor and long recording

- [ ] Drag the playhead, sliders, camera and an overlay. Confirm live preview during the gesture and one undo step after release.
- [ ] Apply cuts, speed changes, automatic/manual zoom, silence cleanup, captions and audio levels. Compare preview and export at effect boundaries.
- [ ] Run the 30, 60 and 120 minute commands in `docs/editor-validation.md`. Attach metrics for memory, CPU, dropped frames, A/V spread, finalization and export.
- [ ] For the 60 minute 4K/30 screen/camera/microphone/system-audio run, measure start/end sync with a clap or timecode; drift must stay within 80 ms.

## Real MCP clients

Run the complete flow in `docs/mcp.md` independently in each client. An SDK connection or copied configuration is not a pass.

| Client         | Version | Capabilities/list | Create/open | Edit/undo | Preview image | Export/job | Evidence |
| -------------- | ------- | ----------------- | ----------- | --------- | ------------- | ---------- | -------- |
| Codex          |         | [ ]               | [ ]         | [ ]       | [ ]           | [ ]        |          |
| Claude Code    |         | [ ]               | [ ]         | [ ]       | [ ]           | [ ]        |          |
| Claude Desktop |         | [ ]               | [ ]         | [ ]       | [ ]           | [ ]        |          |

For every client, use `app_capabilities`, create and open **MCP connection check**, import or record a short take, apply a one-second title with the current revision, undo it, request a 500 ms preview frame, export a new 1080p MP4 outside project storage and poll the job to completion. Confirm the same changes in the desktop UI. Record the client version and attach its transcript or screen recording. Remember that a connected client may send returned transcript or preview content to its provider.

## Evidence result

- [ ] All rows passed against one source commit and one DMG hash.
- [ ] Failures and retries are attached; no synthetic or previous-build result is used as release evidence.
- [ ] `release-evidence.json` names the exact commit, artifact bytes/hash, Developer ID identity, Apple notarization result and build environment.
- [ ] `npm run check:launch -- --json` reports `ready: true` before publishing the beta website or release.
