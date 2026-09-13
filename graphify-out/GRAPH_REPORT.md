# Graph Report - screen-recorder  (2026-09-13)

## Corpus Check
- 159 files · ~93,654 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1116 nodes · 2683 edges · 79 communities (50 shown, 20 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 210 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68f34067`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- useStudioController
- Composition.swift
- CaptureEngine
- check-desktop-ai.ts
- validation.ts
- dependencies
- bundle
- README.md
- types.ts
- main.rs
- compilerOptions
- AppError
- devDependencies
- Project
- edits.ts
- permissions
- verify-bundle.mjs
- ApplicationService.ts
- prepare-runtime.mjs
- prepare-whisper.mjs
- desktop.mjs
- build.sh
- check.sh script
- native/README.md
- screen-recorder
- Bridge.swift
- decode
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
- prepare-site-download.mjs
- NativeFailure
- .main
- Timeline
- usePreviewEditingController.ts
- check-desktop.ts
- download-stats.mjs
- analytics.ts
- Architecture and contribution guide
- camera-layout.test.ts
- ProjectsScreen.tsx
- PreviewView
- Screen Recorder
- api.ts
- render
- messageOf
- pickPath
- MCP setup
- Privacy
- Validation and release
- ScreenCursor feature parity
- useNativePreviewController.ts
- Product website
- check-capture-input.sh

## God Nodes (most connected - your core abstractions)
1. `AppError` - 44 edges
2. `CaptureEngine` - 43 edges
3. `useStudioController()` - 39 edges
4. `Project` - 36 edges
5. `NativeFailure` - 35 edges
6. `NativeApp` - 30 edges
7. `ApplicationService` - 29 edges
8. `ProjectStore` - 25 edges
9. `applyEdits()` - 23 edges
10. `duration()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `revealRange()` --calls--> `outputRanges()`  [EXTRACTED]
  src/features/editor/EditorScreen.tsx → shared/timeline.ts
- `applyEdits()` --calls--> `cameraLayoutSettings()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `sameCameraLayout()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `defaultAutoZoom()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts
- `applyEdits()` --calls--> `defaultCanvas()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts

## Import Cycles
- None detected.

## Communities (79 total, 20 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.20
Nodes (30): Codable, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings, Cursor (+22 more)

### Community 1 - "useStudioController"
Cohesion: 0.15
Nodes (27): StudioHeader(), useStudioController(), acceptCurrentProject(), apply(), backToLibrary(), cancelDraftPreview(), cancelJob(), commitRename() (+19 more)

### Community 2 - "Composition.swift"
Cohesion: 0.07
Nodes (62): AVAsynchronousVideoCompositionRequest, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, AVVideoCompositing, AVVideoCompositionInstructionProtocol, AVVideoCompositionRenderContext, CameraLayout (+54 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.06
Nodes (49): AVAssetWriter, AVAssetWriterInput, AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CFMachPort (+41 more)

### Community 4 - "check-desktop-ai.ts"
Cohesion: 0.07
Nodes (23): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+15 more)

### Community 5 - "validation.ts"
Cohesion: 0.05
Nodes (38): absolutePath, model, none, projectId, provider, readOnly, revision, settingsSchema (+30 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 9 - "types.ts"
Cohesion: 0.06
Nodes (68): formatTime(), AppCapabilities, Asset, AutoZoomSettings, CameraLayout, CameraLayoutSettings, CameraSettings, CanvasSettings (+60 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, ES2023, node, scripts/*.ts, server, shared, src (+18 more)

### Community 12 - "AppError"
Cohesion: 0.11
Nodes (13): setup(), AppError, checkRevision(), sourceSchema, appDataDir, archiveManifest(), Document, hasLegacyProject() (+5 more)

### Community 13 - "devDependencies"
Cohesion: 0.11
Nodes (19): esbuild, devDependencies, esbuild, @tauri-apps/cli, tsx, @types/node, @types/react, @types/react-dom (+11 more)

### Community 14 - "Project"
Cohesion: 0.26
Nodes (4): ready, setup(), ApplicationService, Project

### Community 15 - "edits.ts"
Cohesion: 0.20
Nodes (24): operationsSchema, applyEdits(), checkedRange(), coalesceSegments(), found(), mergeRanges(), silenceCuts(), sourceSpan() (+16 more)

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "ApplicationService.ts"
Cohesion: 0.15
Nodes (10): audioInspection(), inspect(), { values }, time, cursorClicks(), eventSchema, AudioWindow, emptyRecording (+2 more)

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
Cohesion: 0.18
Nodes (10): AppKit, AVFoundation, CChar, screenrec_attach_window(), screenrec_command(), NativeCallback, Security, Task (+2 more)

### Community 30 - "decode"
Cohesion: 0.40
Nodes (6): decode(), jsonObject(), readCursor(), Any, Data, T

### Community 31 - "bundle-notices.mjs"
Cohesion: 0.28
Nodes (10): json(), licenseFiles(), main(), missing, npmNotices(), root, rustNotices(), section() (+2 more)

### Community 32 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, build, build:site, desktop:build, desktop:check, dev, dev:server, dev:site (+14 more)

### Community 33 - "package-dmg.mjs"
Cohesion: 0.25
Nodes (7): app, bundleRoot, output, outputDirectory, pending, root, { version }

### Community 51 - "package.json"
Cohesion: 0.22
Nodes (8): description, engines, node, license, name, private, type, version

### Community 52 - "service.test.ts"
Cohesion: 0.09
Nodes (25): artifacts, client, finish(), native, pattern, client, isolated, server (+17 more)

### Community 53 - ".command"
Cohesion: 0.17
Nodes (18): AVAssetExportSession, AVPlayer, AVPlayerItem, ExportJob, .result, NativeApp, Any, Bool (+10 more)

### Community 55 - "NativeFailure"
Cohesion: 0.14
Nodes (20): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), pcmData() (+12 more)

### Community 56 - ".main"
Cohesion: 0.22
Nodes (12): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, Project (+4 more)

### Community 57 - "Timeline"
Cohesion: 0.32
Nodes (11): Timeline(), cancelDrag(), currentDrag(), finishDrag(), finishRange(), moveDrag(), moveRange(), releaseDragPointer() (+3 more)

### Community 58 - "usePreviewEditingController.ts"
Cohesion: 0.17
Nodes (15): PlaybackState, PreviewGeometry, PreviewItem, PreviewPlayback, Send, accent(), clamp(), Gesture (+7 more)

### Community 59 - "check-desktop.ts"
Cohesion: 0.12
Nodes (7): created, env, resources, video, atomicJSON(), Jobs, Job

### Community 62 - "analytics.ts"
Cohesion: 0.23
Nodes (8): author, AnalyticsEvent, AnalyticsSink, events, initializeAnalytics(), Plausible, track(), Window

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.18
Nodes (9): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants, Desktop acceptance record, Editor interaction and capture validation, Environment and measured checks (+1 more)

### Community 64 - "camera-layout.test.ts"
Cohesion: 0.29
Nodes (7): parseProject(), projectSchema, cameraAt(), cameraLayoutSettings(), cameraOutputLayouts(), CameraRun, sameCameraLayout()

### Community 65 - "ProjectsScreen.tsx"
Cohesion: 0.33
Nodes (5): useProjectThumbnailController(), deleteProject(), ProjectsScreen(), ProjectThumbnail(), date()

### Community 66 - "PreviewView"
Cohesion: 0.33
Nodes (5): PreviewView, CGRect, CGSize, NSCoder, NSRect

### Community 67 - "Screen Recorder"
Cohesion: 0.22
Nodes (9): AI and MCP, Build and check, Contributor navigation, Develop, Editing, License, Projects, Release status (+1 more)

### Community 68 - "api.ts"
Cohesion: 0.33
Nodes (5): RpcRequest, RpcResponse, desktop, sendCommand(), retriable

### Community 69 - "render"
Cohesion: 0.25
Nodes (6): NSColor, NSPoint, NSView, render(), Int, String

### Community 70 - "messageOf"
Cohesion: 0.39
Nodes (6): AboutDialog(), AuthorFooter(), useAuthorLinks(), open(), openExport(), messageOf()

### Community 71 - "pickPath"
Cohesion: 0.29
Nodes (7): StudioDialogs(), exportTranscript(), exportVideo(), importImage(), importProject(), startJob(), pickPath()

### Community 72 - "MCP setup"
Cohesion: 0.33
Nodes (6): Claude Code, Claude Desktop, Codex, Command contract, Development, MCP setup

### Community 73 - "Privacy"
Cohesion: 0.40
Nodes (5): Local processing, MCP, Optional cloud assistant, Privacy, Removal

### Community 74 - "Validation and release"
Cohesion: 0.40
Nodes (5): Hardware acceptance before public release, Reproduce checks, Signing and distribution, Validation and release, Verified development build

### Community 75 - "ScreenCursor feature parity"
Cohesion: 0.40
Nodes (5): Delivery boundary, Implementation and acceptance, ScreenCursor feature parity, Verified in the development package, What the reference demonstrates

### Community 76 - "useNativePreviewController.ts"
Cohesion: 0.60
Nodes (3): useNativePreviewController(), PreviewEditingProps, NativePreview()

### Community 77 - "Product website"
Cohesion: 0.50
Nodes (3): Analytics, Downloads and releases, Product website

## Knowledge Gaps
- **280 isolated node(s):** `Security`, `CoreText`, `.sourcePixelBufferAttributes`, `.requiredPixelBufferAttributesForRenderContext`, `.instruction` (+275 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 410 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Project` connect `Project` to `camera-layout.test.ts`, `check-desktop-ai.ts`, `validation.ts`, `types.ts`, `AppError`, `useNativePreviewController.ts`, `edits.ts`, `ApplicationService.ts`, `service.test.ts`, `usePreviewEditingController.ts`, `check-desktop.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `AppError` connect `AppError` to `camera-layout.test.ts`, `check-desktop-ai.ts`, `validation.ts`, `Project`, `edits.ts`, `ApplicationService.ts`, `service.test.ts`, `check-desktop.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `CaptureEngine` connect `CaptureEngine` to `Models.swift`, `Composition.swift`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `useStudioController()` (e.g. with `backToLibrary()` and `cancelJob()`) actually correct?**
  _`useStudioController()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Security`, `CoreText`, `.sourcePixelBufferAttributes` to the rest of the system?**
  _280 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Composition.swift` be split into smaller, more focused modules?**
  _Cohesion score 0.07067901234567901 - nodes in this community are weakly interconnected._