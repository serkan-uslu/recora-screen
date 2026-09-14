# Graph Report - screen-recorder  (2026-09-14)

## Corpus Check
- 209 files · ~134,654 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1370 nodes · 3351 edges · 90 communities (55 shown, 23 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51ead5e6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- useStudioController.ts
- makeComposition
- CaptureEngine
- RenderInstruction
- validation.ts
- dependencies
- bundle
- README.md
- shared/types.ts
- main.rs
- compilerOptions
- AppError
- devDependencies
- check-desktop.ts
- contracts/commands.ts
- permissions
- verify-bundle.mjs
- usePreviewEditingController.ts
- prepare-runtime.mjs
- prepare-whisper.mjs
- desktop.mjs
- build.sh
- check.sh script
- native/README.md
- screen-recorder
- CameraBubbleView
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
- ApplicationService
- .command
- prepare-site-download.mjs
- NativeFailure
- .main
- ProjectStore.ts
- EditorScreen.tsx
- check-desktop-ai.ts
- download-stats.mjs
- check-launch.ts
- Architecture and contribution guide
- App.tsx
- entry
- edits.ts
- Screen Recorder
- CompositionGeometry.swift
- .startExport
- Launch readiness — 13 September 2026
- ai.ts
- MCP setup
- Privacy
- Validation and release
- ScreenCursor feature parity
- Project
- Product website
- check-capture-input.sh
- Editor interaction and capture validation
- THIRD_PARTY_NOTICES.md
- screenrec_command
- desktop
- .prettierrc.json
- Development standards
- lint-staged
- development-standards.md

## God Nodes (most connected - your core abstractions)
1. `AppError` - 66 edges
2. `Project` - 52 edges
3. `CaptureEngine` - 42 edges
4. `NativeFailure` - 35 edges
5. `scripts` - 35 edges
6. `ProjectStore` - 33 edges
7. `NativeApp` - 31 edges
8. `command()` - 28 edges
9. `applyEdits()` - 27 edges
10. `ApplicationService` - 27 edges

## Surprising Connections (you probably didn't know these)
- `revealRange()` --calls--> `outputRanges()`  [EXTRACTED]
  src/features/editor/EditorScreen.tsx → shared/timeline.ts
- `checkedRange()` --calls--> `duration()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `temporalPatch()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `applyEdits()` --calls--> `duration()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `applyEdits()` --calls--> `defaultAutoZoom()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts

## Import Cycles
- None detected.

## Communities (90 total, 23 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.20
Nodes (30): Codable, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings, Cursor (+22 more)

### Community 1 - "useStudioController.ts"
Cohesion: 0.06
Nodes (51): formatMcpConfig(), McpClient, mcpPermissionCategories, McpPermissions, RecordingStatus, RunAction, McpConfig, Modal (+43 more)

### Community 2 - "makeComposition"
Cohesion: 0.14
Nodes (21): AppKit, AVFoundation, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, CoreImage, CoreText, BuiltComposition (+13 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.06
Nodes (51): AVAssetWriter, AVAssetWriterInput, AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CFMachPort (+43 more)

### Community 4 - "RenderInstruction"
Cohesion: 0.07
Nodes (45): AVAsynchronousVideoCompositionRequest, AVVideoCompositing, AVVideoCompositionInstructionProtocol, AVVideoCompositionRenderContext, CameraRun, CanvasSettings, CGAffineTransform, CMTimeRange (+37 more)

### Community 5 - "validation.ts"
Cohesion: 0.08
Nodes (24): audio, autoZoom, camera, cameraLayout, canvas, captions, color, cursor (+16 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 9 - "shared/types.ts"
Cohesion: 0.10
Nodes (36): Asset, AutoZoomSettings, CameraSettings, CanvasSettings, CaptureSource, defaultAutoZoom(), defaultEdits(), Device (+28 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "AppError"
Cohesion: 0.11
Nodes (7): setup(), AppError, checkRevision(), ProjectStore, AssistantService, TranscriptionService, ProjectSummary

### Community 13 - "devDependencies"
Cohesion: 0.05
Nodes (43): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+35 more)

### Community 14 - "check-desktop.ts"
Cohesion: 0.08
Nodes (16): artifacts, client, finish(), native, pattern, app, created, dataDir (+8 more)

### Community 15 - "contracts/commands.ts"
Cohesion: 0.09
Nodes (26): absolutePath, isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema, methodSchemas, model, none, permissionOverrides (+18 more)

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "usePreviewEditingController.ts"
Cohesion: 0.10
Nodes (21): outputSize(), CameraLayoutSettings, cameraEdit(), createPreviewPlayback(), PlaybackState, PreviewGeometry, PreviewItem, PreviewPlayback (+13 more)

### Community 19 - "prepare-runtime.mjs"
Cohesion: 0.29
Nodes (6): archive, bytes, cache, extracted, marker, root

### Community 20 - "prepare-whisper.mjs"
Cohesion: 0.40
Nodes (4): buildDir, checkout, current, output

### Community 21 - "desktop.mjs"
Cohesion: 0.50
Nodes (3): args, child, env

### Community 29 - "CameraBubbleView"
Cohesion: 0.10
Nodes (17): CameraBubbleView, .shape, CGPoint, NSCoder, NSRect, PreviewView, CGRect, CGSize (+9 more)

### Community 30 - "ApplicationService.ts"
Cohesion: 0.18
Nodes (14): cursorClicks(), eventSchema, AISettings, emptyRecording, EditingService, ExportService, Jobs, PreviewService (+6 more)

### Community 31 - "bundle-notices.mjs"
Cohesion: 0.28
Nodes (10): json(), licenseFiles(), main(), missing, npmNotices(), root, rustNotices(), section() (+2 more)

### Community 32 - "scripts"
Cohesion: 0.06
Nodes (35): scripts, build, build:site, check, check:launch, desktop:build, desktop:check, dev (+27 more)

### Community 33 - "package-dmg.mjs"
Cohesion: 0.25
Nodes (7): app, bundleRoot, output, outputDirectory, pending, root, { version }

### Community 51 - "package.json"
Cohesion: 0.22
Nodes (8): description, engines, node, license, name, private, type, version

### Community 52 - "ApplicationService"
Cohesion: 0.12
Nodes (16): client, isolated, server, service, errorOf(), socketPath, AppClient, readLines() (+8 more)

### Community 53 - ".command"
Cohesion: 0.14
Nodes (20): AVPlayer, NativeApp, Any, AVPlayerItem, CheckedContinuation, CMTime, Never, Project (+12 more)

### Community 55 - "NativeFailure"
Cohesion: 0.13
Nodes (22): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), pcmData() (+14 more)

### Community 56 - ".main"
Cohesion: 0.21
Nodes (11): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, Project (+3 more)

### Community 57 - "ProjectStore.ts"
Cohesion: 0.16
Nodes (13): object(), parseProject(), projectSchema, sourceSchema, subtitleText(), appDataDir, archiveManifest(), atomicJSON() (+5 more)

### Community 58 - "EditorScreen.tsx"
Cohesion: 0.21
Nodes (19): outputRanges(), EditOperation, Switch(), Field(), PanelIntro(), RangeSummary(), Slider(), DraftPreviewContext (+11 more)

### Community 59 - "check-desktop-ai.ts"
Cohesion: 0.08
Nodes (19): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+11 more)

### Community 62 - "check-launch.ts"
Cohesion: 0.09
Nodes (21): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+13 more)

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.40
Nodes (5): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants

### Community 64 - "App.tsx"
Cohesion: 0.11
Nodes (25): formatTime(), CaptureSettings, App(), IconButton(), AboutDialog(), AuthorFooter(), Dialog(), StudioDialogs() (+17 more)

### Community 65 - "entry"
Cohesion: 0.09
Nodes (23): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+15 more)

### Community 66 - "edits.ts"
Cohesion: 0.17
Nodes (23): applyEdits(), AudioWindow, checkedRange(), coalesceSegments(), found(), mergeRanges(), silenceCuts(), sourceSpan() (+15 more)

### Community 67 - "Screen Recorder"
Cohesion: 0.25
Nodes (8): Connect Claude or Codex, Contribute, Create, edit and keep your work, Develop, License, Local processing and current limits, Screen Recorder, Try the development preview

### Community 68 - "CompositionGeometry.swift"
Cohesion: 0.18
Nodes (17): CameraLayout, CameraSettings, Equatable, cameraOutputRuns(), cameraRect(), CameraRun, cameraVisible(), CameraVisual (+9 more)

### Community 69 - ".startExport"
Cohesion: 0.18
Nodes (13): AVAssetExportSession, decode(), jsonObject(), requiredString(), Any, ExportJob, .result, Any (+5 more)

### Community 70 - "Launch readiness — 13 September 2026"
Cohesion: 0.33
Nodes (6): Alignment delivered, Current development artifact, Launch readiness — 13 September 2026, Real MCP evidence, Still needed before public beta, What was actually checked

### Community 71 - "ai.ts"
Cohesion: 0.22
Nodes (8): operationsSchema, assistant(), defaultSettings, hashFile(), LocalAI, { $schema: _editSchemaDialect, ...editSchema }, duration(), defaultMcpPermissions

### Community 72 - "MCP setup"
Cohesion: 0.29
Nodes (7): Claude Code, Claude Desktop, Codex, Command contract, Development, MCP setup, Verify your connection

### Community 73 - "Privacy"
Cohesion: 0.29
Nodes (5): Local processing, MCP, Optional cloud assistant, Privacy, Removal

### Community 74 - "Validation and release"
Cohesion: 0.29
Nodes (7): Hardware acceptance before public release, Historical development validation, One record per release candidate, Reproduce checks, Signing and distribution, Validation and release, Website publication after the approved release

### Community 75 - "ScreenCursor feature parity"
Cohesion: 0.40
Nodes (5): Delivery boundary, Historical development verification, Implementation and acceptance, ScreenCursor feature parity, What the reference demonstrates

### Community 77 - "Product website"
Cohesion: 0.50
Nodes (4): Analytics, Content and metadata, Downloads and publication, Product website

### Community 79 - "Editor interaction and capture validation"
Cohesion: 0.50
Nodes (4): Desktop acceptance record, Editor interaction and capture validation, Environment and measured checks, Signed-app bounded capture reports

### Community 81 - "screenrec_command"
Cohesion: 0.29
Nodes (6): CChar, screenrec_attach_window(), screenrec_command(), NativeCallback, UnsafeMutableRawPointer, UnsafePointer

### Community 84 - "desktop"
Cohesion: 0.23
Nodes (7): RpcRequest, RpcResponse, useProjectThumbnailController(), ProjectThumbnail(), desktop, sendCommand(), retriable

### Community 85 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 86 - "Development standards"
Cohesion: 0.33
Nodes (5): Architecture and tests, Development standards, Repository knowledge graph, Required checks, TypeScript and lint

### Community 88 - "lint-staged"
Cohesion: 0.40
Nodes (5): lint-staged, *.{js,mjs,ts,tsx}, *.{json,css,html,md,yml,yaml}, eslint --fix --max-warnings 0 --no-warn-ignored, prettier --write

## Knowledge Gaps
- **363 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `tabWidth`, `printWidth` (+358 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 526 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _363 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useStudioController.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06398390342052314 - nodes in this community are weakly interconnected._
- **Should `makeComposition` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._