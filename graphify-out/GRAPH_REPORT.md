# Graph Report - screen-recorder  (2026-09-14)

## Corpus Check
- 212 files · ~138,249 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1407 nodes · 3400 edges · 95 communities (60 shown, 23 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `76a070a0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- useStudioController.ts
- AppKit
- CaptureEngine
- timeline.ts
- validation.ts
- dependencies
- bundle
- README.md
- Timeline.tsx
- main.rs
- compilerOptions
- AppError
- devDependencies
- check-desktop.ts
- check-desktop-ai.ts
- permissions
- verify-bundle.mjs
- create-release-evidence.mjs
- prepare-runtime.mjs
- prepare-whisper.mjs
- desktop.mjs
- build.sh
- check.sh script
- native/README.md
- screen-recorder
- useRecordingController
- ApplicationService.ts
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
- App.tsx
- CaptureInputMonitor
- Clean Mac release acceptance
- download-stats.mjs
- check-launch.ts
- Architecture and contribution guide
- SettingsDialog.tsx
- entry
- edits.ts
- Screen Recorder
- command
- .runAssistant
- Launch readiness — 13 September 2026
- ai.ts
- MCP setup
- Privacy
- Validation and release
- ScreenCursor feature parity
- check-clean-install.mjs
- Product website
- check-capture-input.sh
- Editor interaction and capture validation
- useProjectThumbnailController.ts
- EditorScreen.tsx
- RenderInstruction
- shared/types.ts
- messageOf
- .prettierrc.json
- Development standards
- lint-staged
- development-standards.md
- ExportJob
- ProjectStore.ts
- usePreviewEditingController.ts

## God Nodes (most connected - your core abstractions)
1. `AppError` - 66 edges
2. `Project` - 53 edges
3. `CaptureEngine` - 42 edges
4. `scripts` - 38 edges
5. `NativeFailure` - 35 edges
6. `ProjectStore` - 35 edges
7. `NativeApp` - 31 edges
8. `command()` - 28 edges
9. `applyEdits()` - 27 edges
10. `ApplicationService` - 27 edges

## Surprising Connections (you probably didn't know these)
- `revealRange()` --calls--> `outputRanges()`  [EXTRACTED]
  src/features/editor/EditorScreen.tsx → shared/timeline.ts
- `checkedRange()` --calls--> `sourceRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `temporalPatch()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `applyEdits()` --calls--> `cameraLayoutSettings()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `sameCameraLayout()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts

## Import Cycles
- None detected.

## Communities (95 total, 23 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.21
Nodes (29): Codable, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings, Cursor (+21 more)

### Community 1 - "useStudioController.ts"
Cohesion: 0.15
Nodes (15): CaptureSettings, RecordingStatus, RunAction, createPreviewPlayback(), McpConfig, Modal, Model, Settings (+7 more)

### Community 2 - "AppKit"
Cohesion: 0.05
Nodes (39): AppKit, AVFoundation, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, CoreImage, CoreText, CameraBubbleView (+31 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.13
Nodes (23): AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CMClock, FileHandle, CaptureEngine (+15 more)

### Community 4 - "timeline.ts"
Cohesion: 0.26
Nodes (12): outputRanges(), segmentDuration(), sliceSegments(), sourceRanges(), sourceTime(), timelineTime(), Zoom, ZoomPanel() (+4 more)

### Community 5 - "validation.ts"
Cohesion: 0.05
Nodes (42): absolutePath, CommandMetadata, descriptions, examples, methodSchemas, model, none, permissionOverrides (+34 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 8 - "README.md"
Cohesion: 0.21
Nodes (3): Design system, Third-party notices, Website compatibility marks

### Community 9 - "Timeline.tsx"
Cohesion: 0.14
Nodes (22): defaultAutoZoom(), TimelineSegment, useStableCallback(), TrimHandle(), useTimelineDrag(), TimelineGap, TimelineInterval, useTimelineGeometry() (+14 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "AppError"
Cohesion: 0.12
Nodes (7): setup(), AppError, checkRevision(), ProjectStore, EditingService, RecordingService, Project

### Community 13 - "devDependencies"
Cohesion: 0.05
Nodes (43): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+35 more)

### Community 14 - "check-desktop.ts"
Cohesion: 0.06
Nodes (23): artifacts, client, finish(), native, pattern, app, created, dataDir (+15 more)

### Community 15 - "check-desktop-ai.ts"
Cohesion: 0.11
Nodes (14): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+6 more)

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "create-release-evidence.mjs"
Cohesion: 0.13
Nodes (11): app, commit, dmg, evidence, notarization, notarizationPath, output, root (+3 more)

### Community 19 - "prepare-runtime.mjs"
Cohesion: 0.29
Nodes (6): archive, bytes, cache, extracted, marker, root

### Community 20 - "prepare-whisper.mjs"
Cohesion: 0.40
Nodes (4): buildDir, checkout, current, output

### Community 21 - "desktop.mjs"
Cohesion: 0.50
Nodes (3): args, child, env

### Community 29 - "useRecordingController"
Cohesion: 0.52
Nodes (7): useRecordingController(), finishRecording(), runRecording(), startRecording(), toggleCameraDevice(), toggleCameraVisibility(), toggleRecordingPause()

### Community 30 - "ApplicationService.ts"
Cohesion: 0.17
Nodes (16): sourceSchema, time, cursorClicks(), eventSchema, AISettings, emptyRecording, ExportService, Jobs (+8 more)

### Community 31 - "bundle-notices.mjs"
Cohesion: 0.28
Nodes (10): json(), licenseFiles(), main(), missing, npmNotices(), root, rustNotices(), section() (+2 more)

### Community 32 - "scripts"
Cohesion: 0.05
Nodes (38): scripts, build, build:site, check, check:clean-install, check:launch, desktop:app, desktop:build (+30 more)

### Community 33 - "package-dmg.mjs"
Cohesion: 0.25
Nodes (7): app, bundleRoot, output, outputDirectory, pending, root, { version }

### Community 51 - "package.json"
Cohesion: 0.22
Nodes (8): description, engines, node, license, name, private, type, version

### Community 52 - "service.test.ts"
Cohesion: 0.12
Nodes (21): client, isolated, server, service, commandRegistry, isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema (+13 more)

### Community 53 - ".command"
Cohesion: 0.13
Nodes (23): AVPlayer, NativeApp, Any, AVPlayerItem, CheckedContinuation, CMTime, Never, Project (+15 more)

### Community 55 - "NativeFailure"
Cohesion: 0.14
Nodes (20): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), pcmData() (+12 more)

### Community 56 - ".main"
Cohesion: 0.16
Nodes (17): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, Project (+9 more)

### Community 57 - "App.tsx"
Cohesion: 0.19
Nodes (14): formatTime(), App(), IconButton(), StudioHeader(), StudioController, TimelineClip(), EditorScreen(), revealRange() (+6 more)

### Community 58 - "CaptureInputMonitor"
Cohesion: 0.09
Nodes (27): AVAssetWriter, AVAssetWriterInput, CFMachPort, CFRunLoop, CGEvent, CGEventType, CoreMedia, CaptureCheck (+19 more)

### Community 59 - "Clean Mac release acceptance"
Cohesion: 0.33
Nodes (6): Clean Mac release acceptance, Editor and long recording, Evidence result, Installation and portability, Projects, recording and recovery, Real MCP clients

### Community 62 - "check-launch.ts"
Cohesion: 0.09
Nodes (21): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+13 more)

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.40
Nodes (5): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants

### Community 64 - "SettingsDialog.tsx"
Cohesion: 0.13
Nodes (20): formatMcpConfig(), McpClient, McpPermissionCategory, Switch(), Field(), AboutDialog(), AuthorFooter(), Dialog() (+12 more)

### Community 65 - "entry"
Cohesion: 0.09
Nodes (23): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+15 more)

### Community 66 - "edits.ts"
Cohesion: 0.30
Nodes (12): applyEdits(), AudioWindow, checkedRange(), coalesceSegments(), found(), mergeRanges(), silenceCuts(), sourceSpan() (+4 more)

### Community 67 - "Screen Recorder"
Cohesion: 0.25
Nodes (8): Connect Claude or Codex, Contribute, Create, edit and keep your work, Develop, License, Local processing and current limits, Screen Recorder, Try the development preview

### Community 68 - "command"
Cohesion: 0.13
Nodes (19): useAssistantController(), exportTranscript(), saveKey(), saveSettings(), useJobsController(), cancelJob(), poll(), useProjectController() (+11 more)

### Community 70 - "Launch readiness — 13 September 2026"
Cohesion: 0.33
Nodes (6): Alignment delivered, Current development artifact, Launch readiness — 13 September 2026, Real MCP evidence, Still needed before public beta, What was actually checked

### Community 71 - "ai.ts"
Cohesion: 0.15
Nodes (10): ai, directory, object(), operationsSchema, CommandController, assistant(), defaultSettings, hashFile() (+2 more)

### Community 72 - "MCP setup"
Cohesion: 0.29
Nodes (7): Claude Code, Claude Desktop, Codex, Command contract, Development, MCP setup, Verify your connection

### Community 73 - "Privacy"
Cohesion: 0.40
Nodes (5): Local processing, MCP, Optional cloud assistant, Privacy, Removal

### Community 74 - "Validation and release"
Cohesion: 0.29
Nodes (7): Hardware acceptance before public release, Historical development validation, One record per release candidate, Reproduce checks, Signing and distribution, Validation and release, Website publication after the approved release

### Community 75 - "ScreenCursor feature parity"
Cohesion: 0.33
Nodes (5): Delivery boundary, Historical development verification, Implementation and acceptance, ScreenCursor feature parity, What the reference demonstrates

### Community 77 - "Product website"
Cohesion: 0.40
Nodes (4): Analytics, Content and metadata, Downloads and publication, Product website

### Community 79 - "Editor interaction and capture validation"
Cohesion: 0.50
Nodes (4): Desktop acceptance record, Editor interaction and capture validation, Environment and measured checks, Signed-app bounded capture reports

### Community 81 - "EditorScreen.tsx"
Cohesion: 0.23
Nodes (15): CameraLayoutSettings, defaultCanvas(), EditOperation, Range, PanelIntro(), RangeSummary(), Slider(), cameraEdit() (+7 more)

### Community 82 - "RenderInstruction"
Cohesion: 0.05
Nodes (63): AVAsynchronousVideoCompositionRequest, AVVideoCompositing, AVVideoCompositionInstructionProtocol, AVVideoCompositionRenderContext, CameraLayout, CameraRun, CameraSettings, CanvasSettings (+55 more)

### Community 83 - "shared/types.ts"
Cohesion: 0.15
Nodes (12): Asset, AutoZoomSettings, CameraLayout, CameraSettings, CanvasSettings, CaptureSource, defaultMcpPermissions, Device (+4 more)

### Community 84 - "messageOf"
Cohesion: 0.18
Nodes (12): RpcRequest, RpcResponse, useExportController(), exportVideo(), openExport(), importProject(), importImage(), desktop (+4 more)

### Community 85 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 86 - "Development standards"
Cohesion: 0.33
Nodes (5): Architecture and tests, Development standards, Repository knowledge graph, Required checks, TypeScript and lint

### Community 88 - "lint-staged"
Cohesion: 0.40
Nodes (5): lint-staged, *.{js,mjs,ts,tsx}, *.{json,css,html,md,yml,yaml}, eslint --fix --max-warnings 0 --no-warn-ignored, prettier --write

### Community 93 - "ExportJob"
Cohesion: 0.17
Nodes (12): AVAssetExportSession, CChar, screenrec_command(), ExportJob, .result, Any, Never, String (+4 more)

### Community 96 - "ProjectStore.ts"
Cohesion: 0.12
Nodes (12): parseProject(), projectSchema, appDataDir, archiveManifest(), atomicJSON(), Document, hasLegacyProject(), parseDocument() (+4 more)

### Community 98 - "usePreviewEditingController.ts"
Cohesion: 0.12
Nodes (22): cameraAt(), cameraLayoutSettings(), cameraOutputLayouts(), CameraRun, sameCameraLayout(), outputSize(), PlaybackState, PreviewGeometry (+14 more)

## Knowledge Gaps
- **385 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `tabWidth`, `printWidth` (+380 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 553 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _385 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AppKit` be split into smaller, more focused modules?**
  _Cohesion score 0.05376972530683811 - nodes in this community are weakly interconnected._
- **Should `CaptureEngine` be split into smaller, more focused modules?**
  _Cohesion score 0.1289198606271777 - nodes in this community are weakly interconnected._