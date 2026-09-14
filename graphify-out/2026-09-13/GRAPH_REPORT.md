# Graph Report - screen-recorder  (2026-09-13)

## Corpus Check
- 159 files · ~94,453 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1121 nodes · 2690 edges · 73 communities (43 shown, 21 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 210 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `63998206`
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
- useStudioController.ts
- main.rs
- compilerOptions
- AppError
- devDependencies
- Project
- types.ts
- permissions
- verify-bundle.mjs
- check-interactions.ts
- prepare-runtime.mjs
- prepare-whisper.mjs
- desktop.mjs
- build.sh
- check.sh script
- native/README.md
- screen-recorder
- Bridge.swift
- check-local-ai.ts
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
- website/vite.config.ts
- Jobs
- download-stats.mjs
- analytics.ts
- Architecture and contribution guide
- ApplicationService.ts
- PreviewView
- Screen Recorder
- MCP setup
- Privacy
- Validation and release
- ScreenCursor feature parity
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
- `temporalPatch()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `silenceCuts()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `subtitleText()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `ApplicationService` --references--> `RecordingStatus`  [EXTRACTED]
  server/services/ApplicationService.ts → shared/types.ts
- `assistant()` --calls--> `duration()`  [EXTRACTED]
  server/services/ai.ts → shared/timeline.ts

## Import Cycles
- None detected.

## Communities (73 total, 21 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.20
Nodes (30): Codable, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings, Cursor (+22 more)

### Community 1 - "useStudioController"
Cohesion: 0.05
Nodes (60): RpcRequest, RpcResponse, StudioDialogs(), StudioHeader(), createPreviewPlayback(), PlaybackState, PreviewGeometry, PreviewItem (+52 more)

### Community 2 - "Composition.swift"
Cohesion: 0.07
Nodes (61): AVAsynchronousVideoCompositionRequest, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, AVVideoCompositing, AVVideoCompositionInstructionProtocol, AVVideoCompositionRenderContext, CameraLayout (+53 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.05
Nodes (55): AppKit, AVAssetWriter, AVAssetWriterInput, AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings (+47 more)

### Community 4 - "check-desktop-ai.ts"
Cohesion: 0.09
Nodes (21): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+13 more)

### Community 5 - "validation.ts"
Cohesion: 0.05
Nodes (41): absolutePath, model, none, projectId, provider, readOnly, revision, settingsSchema (+33 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 9 - "useStudioController.ts"
Cohesion: 0.07
Nodes (64): formatTime(), outputRanges(), AppCapabilities, CameraLayoutSettings, CanvasSettings, CaptureSettings, EditOperation, Overlay (+56 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, ES2023, node, scripts/*.ts, server, shared, src (+18 more)

### Community 12 - "AppError"
Cohesion: 0.17
Nodes (4): setup(), AppError, checkRevision(), ProjectStore

### Community 13 - "devDependencies"
Cohesion: 0.11
Nodes (19): esbuild, devDependencies, esbuild, @tauri-apps/cli, tsx, @types/node, @types/react, @types/react-dom (+11 more)

### Community 14 - "Project"
Cohesion: 0.25
Nodes (4): cursorClicks(), setup(), ApplicationService, Project

### Community 15 - "types.ts"
Cohesion: 0.11
Nodes (35): applyEdits(), checkedRange(), coalesceSegments(), found(), mergeRanges(), silenceCuts(), sourceSpan(), temporalPatch() (+27 more)

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "check-interactions.ts"
Cohesion: 0.12
Nodes (9): created, env, resources, video, audioInspection(), inspect(), { values }, ProjectSummary (+1 more)

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
Cohesion: 0.20
Nodes (8): AVFoundation, CChar, CoreImage, screenrec_command(), NativeCallback, ScreenCaptureKit, Security, UnsafePointer

### Community 30 - "check-local-ai.ts"
Cohesion: 0.33
Nodes (5): ai, audio, directory, original, text

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
Cohesion: 0.11
Nodes (21): client, isolated, server, service, isReadOnly(), methodSchemas, errorOf(), AppClient (+13 more)

### Community 53 - ".command"
Cohesion: 0.17
Nodes (19): AVAssetExportSession, AVPlayer, AVPlayerItem, ExportJob, .result, NativeApp, Any, Bool (+11 more)

### Community 55 - "NativeFailure"
Cohesion: 0.13
Nodes (22): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), pcmData() (+14 more)

### Community 56 - ".main"
Cohesion: 0.16
Nodes (18): CGImage, screenrec_attach_window(), NativeCheck, Bool, CGRect, Data, Double, Int (+10 more)

### Community 57 - "Timeline"
Cohesion: 0.23
Nodes (14): Timeline(), cancelDrag(), currentDrag(), finishDrag(), finishRange(), menuPosition(), moveDrag(), moveRange() (+6 more)

### Community 59 - "Jobs"
Cohesion: 0.12
Nodes (7): artifacts, client, finish(), native, pattern, Jobs, Job

### Community 62 - "analytics.ts"
Cohesion: 0.23
Nodes (8): author, AnalyticsEvent, AnalyticsSink, events, initializeAnalytics(), Plausible, track(), Window

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.18
Nodes (9): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants, Desktop acceptance record, Editor interaction and capture validation, Environment and measured checks (+1 more)

### Community 64 - "ApplicationService.ts"
Cohesion: 0.16
Nodes (15): parseProject(), projectSchema, sourceSchema, AudioWindow, subtitleText(), appDataDir, archiveManifest(), atomicJSON() (+7 more)

### Community 66 - "PreviewView"
Cohesion: 0.31
Nodes (5): PreviewView, CGRect, CGSize, NSCoder, NSRect

### Community 67 - "Screen Recorder"
Cohesion: 0.22
Nodes (9): AI and MCP, Build and check, Contributor navigation, Develop, Editing, License, Projects, Release status (+1 more)

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

### Community 77 - "Product website"
Cohesion: 0.50
Nodes (3): Analytics, Downloads and releases, Product website

## Knowledge Gaps
- **281 isolated node(s):** `Security`, `CoreText`, `.sourcePixelBufferAttributes`, `.requiredPixelBufferAttributesForRenderContext`, `.instruction` (+276 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 412 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Project` connect `Project` to `ApplicationService.ts`, `useStudioController`, `check-desktop-ai.ts`, `validation.ts`, `useStudioController.ts`, `AppError`, `types.ts`, `check-interactions.ts`, `service.test.ts`, `Jobs`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `AppError` connect `AppError` to `ApplicationService.ts`, `check-desktop-ai.ts`, `validation.ts`, `Project`, `types.ts`, `service.test.ts`, `Jobs`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `CaptureEngine` connect `CaptureEngine` to `Models.swift`, `Composition.swift`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `useStudioController()` (e.g. with `backToLibrary()` and `cancelJob()`) actually correct?**
  _`useStudioController()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Security`, `CoreText`, `.sourcePixelBufferAttributes` to the rest of the system?**
  _281 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useStudioController` be split into smaller, more focused modules?**
  _Cohesion score 0.054945054945054944 - nodes in this community are weakly interconnected._