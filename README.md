# Screen Recorder

**The open-source screen recorder you can control with Claude and Codex.**

Record your screen, camera and audio. Create projects, edit timelines and export through MCP—or work directly in the editor. Built for tutorials, walkthroughs and product demos on Mac.

![The desktop editor with separate screen, camera, audio and effects tracks](website/public/media/editor.jpg)

_Actual desktop app with clean demonstration footage. Screen Recorder is the working name; final launch branding is pending._

## Try the development preview

The source is available under the MIT license. **There is no verified public beta download yet.** Version 0.1.0 targets Apple silicon and macOS 15+. The local development package bundles Node and Whisper; end users will not need to install Node.

- [Build and run from source](#develop).
- [Product documentation](https://serkan-uslu.github.io/screen-recorder/documentation/).
- [Release status and remaining checks](docs/release.md).
- Planned product site: [serkan-uslu.github.io/screen-recorder](https://serkan-uslu.github.io/screen-recorder/). Pages publication is pending. Locally, `npm run dev:site` serves `http://127.0.0.1:4174/`.

The current development-signed DMG is not a notarized public release. Public installation, final branding and release acceptance must pass before a beta is advertised as ready to download.

## Connect Claude or Codex

Open the desktop app, then go to **Settings & MCP → MCP & shortcuts**. Choose your client and copy its configuration. Paths come from the running installation, including the bundled Node runtime.

| Client         | Setup                                            |
| -------------- | ------------------------------------------------ |
| Codex          | [TOML configuration](docs/mcp.md#codex)          |
| Claude Code    | [CLI command](docs/mcp.md#claude-code)           |
| Claude Desktop | [JSON configuration](docs/mcp.md#claude-desktop) |

Try a request such as:

> Open my tutorial. Suggest silence cuts and let me review them. Hide my camera between 10 and 20 seconds, add a title for the first 3 seconds, and export a 1080p MP4.

MCP uses the same validated project, recording, editing, preview and export commands as the app. Edits support revision checks and grouped undo. Long analysis/export operations return jobs with progress and cancellation. Keep the desktop app running while connected. [Connection checks and command contract](docs/mcp.md#verify-your-connection).

The app and local tools are free. Your connected Claude/Codex client may require its own plan; the optional in-app OpenAI/Anthropic assistant uses your API key and provider billing. No app API key is needed for ordinary MCP project, edit or export operations.

## Create, edit and keep your work

- **Capture:** screen, window or region; separate camera, microphone and system audio; pause/resume and a background recording control.
- **Edit:** live timeline scrubbing, range selection, cut/split/trim, speed, clip merging, removed-range restoration and undo/redo. Each timeline row has its own context menu.
- **Direct attention:** automatic and manual zooms, cursor highlight, editable timing/depth/motion, and camera placement or visibility for a selected interval.
- **Compose:** circle or square camera; draggable text and images; backgrounds, blur, padding, rounded corners, shadows and browser frames. Landscape, portrait, square and 4:5 canvases are supported.
- **Audio and captions:** independent audio levels, local Whisper transcription, editable captions and microphone-based silence suggestions that protect audible system audio by default.
- **Export:** H.264/AAC MP4 up to 4K, using the same native composition engine as preview; captions can be burned in or saved as SRT/VTT.
- **Projects:** create, search, rename, reopen, save, import and move project folders to the macOS Trash. Exported movies remain separate; original media stays intact.

Projects live in `~/Movies/Screen Recorder Projects/`. Each portable folder contains its document, a previous valid backup, original media and imported assets. Saves are atomic. There are no artificial project-count or recording-duration limits; disk space and hardware determine capacity. One recording runs at a time, and its project is protected while other projects remain editable.

## Local processing and current limits

Recording, editing, silence analysis and Whisper transcription run on your Mac. Models download separately; multilingual `small` is the default and `base` uses fewer resources. After download, local AI works offline. Review transcription timing and silence suggestions before applying cuts. Silence cleanup requires a microphone track.

The optional in-app cloud assistant sends your prompt, necessary transcript and edit context to your chosen provider; API keys stay in macOS Keychain. External MCP clients can request transcripts and preview frames and may send those results to their model provider. The desktop app has no analytics; optional site analytics are separate. [Privacy details](docs/privacy.md).

Screen, camera and microphone permissions depend on what you capture. Pointer sampling works without Input Monitoring; typing activity and precise short-click detection require the optional event monitor. Typed text and key codes are not recorded.

Public readiness still requires Developer ID signing, notarization, clean-Mac installation, long-recording synchronization/memory checks and remaining device, failure-recovery and client acceptance scenarios. Historical synthetic checks do not establish these results. [Release evidence](docs/releases/0.1.0.json) and [historical validation](docs/editor-validation.md) distinguish measured results from pending work. Windows, Linux and Intel distribution are outside the current Apple silicon beta target. [ScreenCursor comparison](docs/screencursor-parity.md).

## Develop

Requires macOS 15+, Xcode and its command line tools, Rust, Node.js 22.12+, Git and CMake. React/TypeScript provides the UI; Node owns project operations and MCP; Tauri and the native macOS engine handle desktop/media integration.

```sh
npm ci
npm run prepare:whisper
npm run dev
```

Initial preparation downloads a checksum-verified Node runtime and builds a pinned whisper.cpp release. Models download separately from Settings and are not committed to Git.

For browser UI development, run these in separate terminals:

```sh
npm run dev:server
npm run dev:web
```

Browser development can manage real local projects. Capture and native composition preview require the desktop app.

```sh
npm test
npm run build
npm run desktop:check
npm run desktop:build
npm run test:launch
npm run check:launch -- --json
```

App bundles and DMGs are written under `src-tauri/target/release/bundle/`. `check:launch` is read-only and exits nonzero while release evidence is incomplete. [Signing, packaging and hardware checks](docs/release.md).

See the current [launch readiness report](docs/launch-readiness.md). Marketing and Product Hunt preparation materials are maintained locally and are not included in this repository.

## Contribute

Start with [architecture and layer boundaries](docs/architecture.md), [design-system tokens](docs/design-system.md), [MCP setup](docs/mcp.md) and [website/analytics setup](docs/website.md). The in-app **How to use** dialog covers the creator workflow. Open an issue or contact [Serkan Uslu](https://serkanuslu.com) at [info@serkanuslu.com](mailto:info@serkanuslu.com).

## License

MIT. Dependency and model notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Code quality commands and contributor rules: [Development standards](docs/development-standards.md).
