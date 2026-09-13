# Screen Recorder

A local-first recording studio for people who teach, explain, and demo their screen. Built with React, TypeScript, Node.js, Tauri 2, and a native macOS media engine.

Create a project, record your screen and camera separately, edit the timeline, and export an MP4. Your original media stays intact. Claude and Codex can use the same editing commands through MCP.

## Develop

Requires macOS 15+, Xcode and its command line tools, Rust, Node.js 22.12+, Git, and CMake. The app bundles its Node runtime; these tools are only needed for development.

```sh
npm ci
npm run prepare:whisper
npm run dev
```

The initial preparation downloads a checksum-verified Node runtime and builds a pinned whisper.cpp release. Whisper models download separately from Settings. The default `small` model is multilingual; `base` is available for lower memory use. AI models are never included in Git.

For browser-only UI development, run these commands in separate terminals:

```sh
npm run dev:server
npm run dev:web
```

Browser development can manage real local projects. Screen capture and the native composition preview require the desktop app.

## Build and check

```sh
npm test
npm run build
npm run desktop:check
npm run desktop:build
```

Application bundles and DMGs are written under `src-tauri/target/release/bundle/`. A release must include `resources/bin/node` and `resources/bin/whisper-cli`. Build the Whisper runtime before packaging.

## Projects

Projects live in `~/Movies/Screen Recorder Projects/`. Each project is a folder containing `project.json`, a previous valid backup, original media, imported images, and recoverable working files. Edits are saved atomically. Exported movies are separate files and remain editable through their source project.

The Projects library supports creating, opening, renaming, searching, saving, importing a project folder, and moving a project to the macOS Trash. There is no subscription, account, project count limit, or imposed recording duration limit. Available disk and hardware determine capacity. One recording session can run at a time; a project with an active job cannot be deleted.

## Editing

- Independent screen, camera, microphone, and system audio.
- Circle or square webcam, including timed visibility changes.
- Nondestructive trim, split, cut, undo, and redo.
- Clip speed, draggable trim/zoom intervals, removed-range restoration, and adjacent clip merging.
- Cursor highlight, editable zooms, and automatic click/drag/typing-activity framing.
- Wallpaper, gradient, color, or custom-image backgrounds; blur, padding, rounded screen corners, shadows, and browser frames.
- Landscape, portrait, square, and 4:5 canvases with matching preview and export.
- Timed text/images and editable captions.
- Independent microphone and system audio levels.
- Shared native preview/export composition, 1080p and 4K H.264/AAC MP4.
- Local transcription, adjustable silence trimming, and optional AI editing.

Timed edits use **milliseconds on the current output timeline**. `clip.trim` explicitly names source endpoints; `source.restore` takes a removed source range. Persisted effects and transcript entries use source time. A shared mapping keeps every track synchronized after cuts and speed changes.

## AI and MCP

Local transcription uses whisper.cpp. Silence trimming uses adjustable audio energy thresholds and preserves audible system audio by default. Neither requires an API key. Whisper's timestamps can need correction; review close word boundaries before exporting.

The optional assistant supports OpenAI and Anthropic API keys stored in macOS Keychain. Only the supplied prompt, transcript, and edit context are sent to the chosen provider. The app has no analytics or hosted project service. See [privacy](docs/privacy.md) and [MCP setup](docs/mcp.md).

## Release status

See [validation and release checklist](docs/release.md) for the distinction between automated checks, hardware acceptance, and signed distribution. Product Hunt publication is a separate release step after an installable build passes the checklist.

The [ScreenCursor comparison](docs/screencursor-parity.md) records the public features and video interactions used as the macOS editing target, including the remaining platform boundary.

## License

MIT. Dependency and model license notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
