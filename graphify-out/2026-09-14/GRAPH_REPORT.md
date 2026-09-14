# Graph Report - screen-recorder  (2026-09-14)

## Corpus Check
- 209 files · ~135,981 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1377 nodes · 3365 edges · 102 communities (67 shown, 23 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16d0461e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- .main
- useStudioController.ts
- CameraBubbleView
- CaptureEngine
- CompositionGeometry.swift
- validation.ts
- dependencies
- bundle
- README.md
- Project
- main.rs
- compilerOptions
- ProjectStore
- devDependencies
- check-interactions.ts
- CaptureInputMonitor
- permissions
- verify-bundle.mjs
- previewPlayback.ts
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
- AppError
- .command
- prepare-site-download.mjs
- prepareAudio
- .canvasAndSpeedChecks
- App.tsx
- NativeFailure
- check-local-ai.ts
- download-stats.mjs
- check-launch.ts
- Architecture and contribution guide
- SettingsDialog.tsx
- entry
- edits.ts
- Screen Recorder
- command
- decode
- Launch readiness — 13 September 2026
- ai.ts
- MCP setup
- Privacy
- Validation and release
- ScreenCursor feature parity
- contracts/commands.ts
- Product website
- check-capture-input.sh
- Editor interaction and capture validation
- THIRD_PARTY_NOTICES.md
- EditorScreen.tsx
- .frame
- shared/types.ts
- services/commands.ts
- .prettierrc.json
- Development standards
- makeComposition
- lint-staged
- development-standards.md
- AppKit
- .runAssistant
- RenderInstruction
- ProjectStore.ts
- useJobsController.ts
- useNativePreviewController.ts
- useStableCallback
- PreviewRenderMetrics
- .init

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
- `temporalPatch()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `applyEdits()` --calls--> `defaultAutoZoom()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts
- `silenceCuts()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `subtitleText()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts

## Import Cycles
- None detected.

## Communities (102 total, 23 thin omitted)

### Community 0 - ".main"
Cohesion: 0.18
Nodes (33): Codable, Project, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings (+25 more)

### Community 1 - "useStudioController.ts"
Cohesion: 0.23
Nodes (12): AppCapabilities, CaptureSettings, RecordingStatus, McpConfig, Modal, Tab, useExportController(), exportVideo() (+4 more)

### Community 2 - "CameraBubbleView"
Cohesion: 0.09
Nodes (17): CameraBubbleView, .shape, CGPoint, NSCoder, NSRect, PreviewView, CGRect, CGSize (+9 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.13
Nodes (23): AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CMClock, FileHandle, CaptureEngine (+15 more)

### Community 4 - "CompositionGeometry.swift"
Cohesion: 0.15
Nodes (26): CTFramesetter, Equatable, cameraOutputRuns(), cameraRect(), CameraRun, cameraVisible(), CameraVisual, CanvasLayout (+18 more)

### Community 5 - "validation.ts"
Cohesion: 0.08
Nodes (24): audio, autoZoom, camera, cameraLayout, canvas, captions, color, cursor (+16 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 9 - "Project"
Cohesion: 0.17
Nodes (21): outputRanges(), defaultAutoZoom(), Project, Range, TimelineClip(), TrimHandle(), TimelineGap, TimelineInterval (+13 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "ProjectStore"
Cohesion: 0.14
Nodes (6): setup(), checkRevision(), errorOf(), ProjectStore, RecordingService, CommandParams

### Community 13 - "devDependencies"
Cohesion: 0.05
Nodes (43): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+35 more)

### Community 14 - "check-interactions.ts"
Cohesion: 0.12
Nodes (12): artifacts, client, finish(), native, pattern, audioInspection(), inspect(), parseProcessSample() (+4 more)

### Community 15 - "CaptureInputMonitor"
Cohesion: 0.13
Nodes (19): CFMachPort, CFRunLoop, CGEvent, CGEventType, CaptureCheck, CaptureInputMonitor, cursorPosition(), Sample (+11 more)

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "previewPlayback.ts"
Cohesion: 0.18
Nodes (7): createPreviewPlayback(), PlaybackState, PreviewGeometry, PreviewItem, PreviewPlayback, Send, reconcileProjectRefresh()

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
Cohesion: 0.16
Nodes (17): finite, projectSchema, sourceSchema, time, cursorClicks(), eventSchema, AISettings, emptyRecording (+9 more)

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

### Community 52 - "AppError"
Cohesion: 0.12
Nodes (15): client, isolated, server, service, AppError, AppClient, readLines(), serveSocket() (+7 more)

### Community 53 - ".command"
Cohesion: 0.09
Nodes (32): AVAssetExportSession, AVPlayer, NativeApp, Any, AVPlayerItem, CheckedContinuation, CMTime, Never (+24 more)

### Community 55 - "prepareAudio"
Cohesion: 0.18
Nodes (16): AVAssetReader, AVAssetReaderTrackOutput, Foundation, analyzeAudio(), audioReader(), pcmData(), prepareAudio(), Any (+8 more)

### Community 56 - ".canvasAndSpeedChecks"
Cohesion: 0.25
Nodes (9): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, String (+1 more)

### Community 57 - "App.tsx"
Cohesion: 0.17
Nodes (15): formatTime(), App(), IconButton(), StudioHeader(), ErrorContext, useProjectThumbnailController(), StudioController, EditorScreen() (+7 more)

### Community 58 - "NativeFailure"
Cohesion: 0.13
Nodes (16): AVAssetWriter, AVAssetWriterInput, CChar, Error, LocalizedError, Bool, CGSize, CMSampleBuffer (+8 more)

### Community 59 - "check-local-ai.ts"
Cohesion: 0.33
Nodes (5): ai, audio, directory, original, text

### Community 62 - "check-launch.ts"
Cohesion: 0.09
Nodes (21): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+13 more)

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.40
Nodes (5): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants

### Community 64 - "SettingsDialog.tsx"
Cohesion: 0.15
Nodes (18): formatMcpConfig(), McpClient, outputSize(), mcpPermissionCategories, AboutDialog(), AuthorFooter(), Dialog(), StudioDialogs() (+10 more)

### Community 65 - "entry"
Cohesion: 0.09
Nodes (23): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+15 more)

### Community 66 - "edits.ts"
Cohesion: 0.06
Nodes (46): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+38 more)

### Community 67 - "Screen Recorder"
Cohesion: 0.25
Nodes (8): Connect Claude or Codex, Contribute, Create, edit and keep your work, Develop, License, Local processing and current limits, Screen Recorder, Try the development preview

### Community 68 - "command"
Cohesion: 0.12
Nodes (21): useAssistantController(), exportTranscript(), saveKey(), saveSettings(), useJobsController(), cancelJob(), poll(), useProjectController() (+13 more)

### Community 69 - "decode"
Cohesion: 0.67
Nodes (4): decode(), jsonObject(), Any, T

### Community 70 - "Launch readiness — 13 September 2026"
Cohesion: 0.33
Nodes (6): Alignment delivered, Current development artifact, Launch readiness — 13 September 2026, Real MCP evidence, Still needed before public beta, What was actually checked

### Community 71 - "ai.ts"
Cohesion: 0.22
Nodes (8): operationsSchema, assistant(), defaultSettings, hashFile(), LocalAI, { $schema: _editSchemaDialect, ...editSchema }, defaultMcpPermissions, TranscriptSegment

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

### Community 76 - "contracts/commands.ts"
Cohesion: 0.09
Nodes (28): absolutePath, CommandMetadata, commandRegistry, descriptions, examples, isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema (+20 more)

### Community 77 - "Product website"
Cohesion: 0.50
Nodes (4): Analytics, Content and metadata, Downloads and publication, Product website

### Community 79 - "Editor interaction and capture validation"
Cohesion: 0.50
Nodes (4): Desktop acceptance record, Editor interaction and capture validation, Environment and measured checks, Signed-app bounded capture reports

### Community 81 - "EditorScreen.tsx"
Cohesion: 0.24
Nodes (13): EditOperation, Switch(), Field(), PanelIntro(), RangeSummary(), Slider(), DraftPreviewContext, SilenceControls() (+5 more)

### Community 82 - ".frame"
Cohesion: 0.18
Nodes (16): AVAsynchronousVideoCompositionRequest, AVVideoCompositing, AVVideoCompositionRenderContext, CanvasSettings, CGAffineTransform, ScreenrecCompositor, .requiredPixelBufferAttributesForRenderContext, .sourcePixelBufferAttributes (+8 more)

### Community 83 - "shared/types.ts"
Cohesion: 0.12
Nodes (16): Asset, AutoZoomSettings, CameraLayout, CameraLayoutSettings, CameraSettings, CanvasSettings, CaptureSource, Device (+8 more)

### Community 84 - "services/commands.ts"
Cohesion: 0.40
Nodes (4): RpcRequest, RpcResponse, sendCommand(), retriable

### Community 85 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 86 - "Development standards"
Cohesion: 0.33
Nodes (5): Architecture and tests, Development standards, Repository knowledge graph, Required checks, TypeScript and lint

### Community 87 - "makeComposition"
Cohesion: 0.23
Nodes (17): AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, BuiltComposition, .instruction, makeComposition(), mediaStructure(), CMPersistentTrackID (+9 more)

### Community 88 - "lint-staged"
Cohesion: 0.40
Nodes (5): lint-staged, *.{js,mjs,ts,tsx}, *.{json,css,html,md,yml,yaml}, eslint --fix --max-warnings 0 --no-warn-ignored, prettier --write

### Community 93 - "AppKit"
Cohesion: 0.23
Nodes (7): AppKit, AVFoundation, CoreImage, CoreMedia, CoreText, ScreenCaptureKit, Security

### Community 94 - ".runAssistant"
Cohesion: 0.23
Nodes (3): subtitleText(), AssistantService, TranscriptionService

### Community 95 - "RenderInstruction"
Cohesion: 0.24
Nodes (11): AVVideoCompositionInstructionProtocol, CameraRun, CMTimeRange, RenderInstruction, CIImage, CMPersistentTrackID, CMTime, CursorEvent (+3 more)

### Community 96 - "ProjectStore.ts"
Cohesion: 0.27
Nodes (9): object(), parseProject(), appDataDir, archiveManifest(), atomicJSON(), Document, hasLegacyProject(), parseDocument() (+1 more)

### Community 97 - "useJobsController.ts"
Cohesion: 0.20
Nodes (8): RunAction, Model, Settings, Chat, Chat, SilenceReview, AssistantPanel(), idleRecording

### Community 98 - "useNativePreviewController.ts"
Cohesion: 0.24
Nodes (9): useNativePreviewController(), accent(), clamp(), PreviewEditingProps, previewTransform(), replayPreviewGesture(), usePreviewEditingController(), move() (+1 more)

### Community 99 - "useStableCallback"
Cohesion: 0.27
Nodes (9): useStableCallback(), useTimelineDrag(), useTimelineGeometry(), RangeDrag, useTimelineSelection(), Timeline(), menuPosition(), openClipMenu() (+1 more)

### Community 100 - "PreviewRenderMetrics"
Cohesion: 0.47
Nodes (5): PreviewRenderMetrics, Any, Bool, Double, String

## Knowledge Gaps
- **366 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `tabWidth`, `printWidth` (+361 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 529 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `Project` connect `Project` to `ProjectStore.ts`, `useJobsController.ts`, `edits.ts`, `useStudioController.ts`, `useNativePreviewController.ts`, `validation.ts`, `useStableCallback`, `ai.ts`, `SettingsDialog.tsx`, `ProjectStore`, `contracts/commands.ts`, `check-interactions.ts`, `EditorScreen.tsx`, `previewPlayback.ts`, `shared/types.ts`, `.runAssistant`, `ApplicationService.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _366 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CameraBubbleView` be split into smaller, more focused modules?**
  _Cohesion score 0.09113300492610837 - nodes in this community are weakly interconnected._
- **Should `CaptureEngine` be split into smaller, more focused modules?**
  _Cohesion score 0.1289198606271777 - nodes in this community are weakly interconnected._