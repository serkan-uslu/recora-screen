# Graph Report - screen-recorder  (2026-09-13)

## Corpus Check
- 90 files · ~69,122 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 861 nodes · 1789 edges · 63 communities (39 shown, 16 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 126 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `99ba049e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- App.tsx
- makeComposition
- CaptureEngine
- check-desktop-ai.ts
- validation.ts
- dependencies
- bundle
- Screen Recorder
- types.ts
- main.rs
- compilerOptions
- ProjectStore
- devDependencies
- ApplicationService
- AppError
- permissions
- verify-bundle.mjs
- service.ts
- prepare-runtime.mjs
- prepare-whisper.mjs
- desktop.mjs
- build.sh
- check.sh script
- native/README.md
- screen-recorder
- Bridge.swift
- edits.ts
- bundle-notices.mjs
- scripts
- package-dmg.mjs
- sign-runtimes.mjs
- License
- License
- License
- License
- License
- License
- License
- License
- License
- License
- License
- package.json
- service.test.ts
- .command
- App
- NativeFailure
- .main
- Timeline
- rpc.ts
- check-desktop.ts
- decode
- .init
- Slider

## God Nodes (most connected - your core abstractions)
1. `CaptureEngine` - 43 edges
2. `AppError` - 41 edges
3. `NativeFailure` - 32 edges
4. `ApplicationService` - 26 edges
5. `App()` - 25 edges
6. `makeComposition()` - 22 edges
7. `ProjectStore` - 22 edges
8. `duration()` - 21 edges
9. `ScreenrecCompositor` - 20 edges
10. `applyEdits()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `subtitleText()` --calls--> `outputRanges()`  [EXTRACTED]
  server/edits.ts → shared/timeline.ts
- `Timeline()` --calls--> `segmentDuration()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `App()` --calls--> `duration()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `ExportDialog()` --calls--> `duration()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `ZoomProperties()` --calls--> `duration()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts

## Import Cycles
- None detected.

## Communities (63 total, 16 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.21
Nodes (28): Codable, Audio, CameraSettings, CanvasSettings, Captions, CaptureSettings, Cursor, CursorEvent (+20 more)

### Community 1 - "App.tsx"
Cohesion: 0.09
Nodes (15): formatTime(), outputSize(), CameraPanel(), DraftPreviewContext, ErrorContext, ExportDialog(), idleRecording, McpConfig (+7 more)

### Community 2 - "makeComposition"
Cohesion: 0.07
Nodes (47): AppKit, AVAsynchronousVideoCompositionRequest, AVFoundation, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, AVVideoCompositing, AVVideoCompositionInstructionProtocol (+39 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.08
Nodes (37): AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CFMachPort, CFRunLoopSource, CGWindowID (+29 more)

### Community 4 - "check-desktop-ai.ts"
Cohesion: 0.07
Nodes (25): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+17 more)

### Community 5 - "validation.ts"
Cohesion: 0.10
Nodes (20): audio, autoZoom, camera, canvas, captions, color, cursor, editState (+12 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 8 - "Screen Recorder"
Cohesion: 0.06
Nodes (30): Claude Code, Claude Desktop, Codex, Command contract, Development, MCP setup, Local processing, MCP (+22 more)

### Community 9 - "types.ts"
Cohesion: 0.09
Nodes (20): artifacts, client, native, pattern, AppCapabilities, Asset, AutoZoomSettings, CameraSettings (+12 more)

### Community 10 - "main.rs"
Cohesion: 0.12
Nodes (23): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+15 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (24): DOM, DOM.Iterable, ES2023, node, scripts/*.ts, server, shared, src (+16 more)

### Community 12 - "ProjectStore"
Cohesion: 0.18
Nodes (4): ProjectStore, checkRevision(), Project, ProjectSummary

### Community 13 - "devDependencies"
Cohesion: 0.11
Nodes (19): esbuild, devDependencies, esbuild, @tauri-apps/cli, tsx, @types/node, @types/react, @types/react-dom (+11 more)

### Community 14 - "ApplicationService"
Cohesion: 0.24
Nodes (4): cursorClicks(), ready, ApplicationService, setup()

### Community 15 - "AppError"
Cohesion: 0.18
Nodes (4): Jobs, atomicJSON(), AppError, Job

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "service.ts"
Cohesion: 0.10
Nodes (23): eventSchema, subtitleText(), absolutePath, emptyRecording, model, none, projectId, provider (+15 more)

### Community 19 - "prepare-runtime.mjs"
Cohesion: 0.29
Nodes (6): archive, bytes, cache, extracted, marker, root

### Community 20 - "prepare-whisper.mjs"
Cohesion: 0.40
Nodes (4): buildDir, checkout, current, output

### Community 21 - "desktop.mjs"
Cohesion: 0.50
Nodes (3): args, child, env

### Community 29 - "Bridge.swift"
Cohesion: 0.12
Nodes (13): CChar, PreviewView, screenrec_attach_window(), screenrec_command(), NSCoder, NSRect, NativeCallback, NSView (+5 more)

### Community 30 - "edits.ts"
Cohesion: 0.22
Nodes (23): assistant(), applyEdits(), AudioWindow, checkedRange(), coalesceSegments(), found(), mergeRanges(), silenceCuts() (+15 more)

### Community 31 - "bundle-notices.mjs"
Cohesion: 0.28
Nodes (10): json(), licenseFiles(), main(), missing, npmNotices(), root, rustNotices(), section() (+2 more)

### Community 32 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, desktop:build, desktop:check, dev, dev:server, dev:web, mcp (+9 more)

### Community 33 - "package-dmg.mjs"
Cohesion: 0.25
Nodes (7): app, bundleRoot, output, outputDirectory, pending, root, { version }

### Community 51 - "package.json"
Cohesion: 0.22
Nodes (8): description, engines, node, license, name, private, type, version

### Community 52 - "service.test.ts"
Cohesion: 0.13
Nodes (12): finish(), server, callAppTool(), createMcpServer(), descriptions, toolMethods, AppClient, isReadOnly() (+4 more)

### Community 53 - ".command"
Cohesion: 0.19
Nodes (15): AVAssetExportSession, AVPlayer, AVPlayerItem, ExportJob, .result, NativeApp, Any, Bool (+7 more)

### Community 54 - "App"
Cohesion: 0.13
Nodes (20): RpcResponse, command(), desktop, messageOf(), pickPath(), retriable, App(), backToLibrary() (+12 more)

### Community 55 - "NativeFailure"
Cohesion: 0.14
Nodes (20): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), pcmData() (+12 more)

### Community 56 - ".main"
Cohesion: 0.21
Nodes (13): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, Project (+5 more)

### Community 57 - "Timeline"
Cohesion: 0.24
Nodes (18): apply(), draftPreview(), importImage(), CanvasPanel(), number(), OverlaysPanel(), RangeSummary(), seconds() (+10 more)

### Community 58 - "rpc.ts"
Cohesion: 0.27
Nodes (9): client, isolated, service, pending, send(), service, readLines(), serveSocket() (+1 more)

### Community 59 - "check-desktop.ts"
Cohesion: 0.25
Nodes (4): created, env, resources, video

### Community 60 - "decode"
Cohesion: 0.40
Nodes (6): decode(), jsonObject(), readCursor(), Any, Data, T

### Community 61 - ".init"
Cohesion: 0.40
Nodes (4): AVAssetWriter, AVAssetWriterInput, CGSize, URL

### Community 62 - "Slider"
Cohesion: 0.83
Nodes (4): Slider(), cancelGesture(), releasePointer(), resetValue()

## Knowledge Gaps
- **252 isolated node(s):** `Security`, `CoreMedia`, `CoreText`, `.sourcePixelBufferAttributes`, `.requiredPixelBufferAttributesForRenderContext` (+247 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 378 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CaptureEngine` connect `CaptureEngine` to `Models.swift`, `makeComposition`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `duration()` connect `edits.ts` to `App.tsx`, `check-desktop-ai.ts`, `ProjectStore`, `ApplicationService`, `service.ts`, `service.test.ts`, `App`, `Timeline`, `check-desktop.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `NativeFailure` connect `NativeFailure` to `Models.swift`, `makeComposition`, `CaptureEngine`, `Bridge.swift`, `.command`, `.main`, `.init`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 24 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Security`, `CoreMedia`, `CoreText` to the rest of the system?**
  _252 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08923076923076922 - nodes in this community are weakly interconnected._
- **Should `makeComposition` be split into smaller, more focused modules?**
  _Cohesion score 0.0742447516641065 - nodes in this community are weakly interconnected._