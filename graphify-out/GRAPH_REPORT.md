# Graph Report - screen-recorder  (2026-09-14)

## Corpus Check
- 225 files · ~140,347 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1459 nodes · 3478 edges · 106 communities (68 shown, 25 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `befde8bd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- useStudioController.ts
- CameraBubbleView
- CompositionGeometry.swift
- makeComposition
- validation.ts
- dependencies
- bundle
- README.md
- Timeline.tsx
- main.rs
- compilerOptions
- Project
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
- CaptureEngine
- Clean Mac release acceptance
- download-stats.mjs
- check-launch.ts
- Architecture and contribution guide
- SettingsDialog.tsx
- entry
- edits.ts
- Screen Recorder
- command
- AppError
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
- website/tsconfig.json
- EditorScreen.tsx
- .frame
- shared/types.ts
- messageOf
- .prettierrc.json
- Development standards
- AppKit
- lint-staged
- development-standards.md
- .startExport
- overlayRect
- RenderInstruction
- PreviewRenderMetrics
- RecordingService
- usePreviewEditingController.ts
- color
- useJobsController.ts
- decode
- website/AGENTS.md
- next.config.ts
- next-env.d.ts

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
- `checkedRange()` --calls--> `duration()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `applyEdits()` --calls--> `cameraLayoutSettings()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `sameCameraLayout()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `duration()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts

## Import Cycles
- None detected.

## Communities (106 total, 25 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.22
Nodes (28): Codable, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings, Cursor (+20 more)

### Community 1 - "useStudioController.ts"
Cohesion: 0.14
Nodes (17): defaultEdits(), RunAction, createPreviewPlayback(), McpConfig, Modal, Model, Settings, Tab (+9 more)

### Community 2 - "CameraBubbleView"
Cohesion: 0.13
Nodes (13): CameraBubbleView, .shape, CGPoint, NSCoder, NSRect, PreviewView, CGRect, CGSize (+5 more)

### Community 3 - "CompositionGeometry.swift"
Cohesion: 0.18
Nodes (17): CameraLayout, CameraSettings, Equatable, cameraOutputRuns(), cameraRect(), CameraRun, cameraVisible(), CameraVisual (+9 more)

### Community 4 - "makeComposition"
Cohesion: 0.23
Nodes (17): AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, BuiltComposition, .instruction, makeComposition(), mediaStructure(), CMPersistentTrackID (+9 more)

### Community 5 - "validation.ts"
Cohesion: 0.05
Nodes (44): absolutePath, CommandMetadata, descriptions, examples, model, none, permissionOverrides, projectId (+36 more)

### Community 6 - "dependencies"
Cohesion: 0.11
Nodes (19): lucide-react, @modelcontextprotocol/sdk, next, dependencies, lucide-react, @modelcontextprotocol/sdk, next, react (+11 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 8 - "README.md"
Cohesion: 0.21
Nodes (3): Design system, Third-party notices, Website compatibility marks

### Community 9 - "Timeline.tsx"
Cohesion: 0.13
Nodes (25): defaultAutoZoom(), Range, IconButton(), useStableCallback(), TimelineClip(), TrimHandle(), useTimelineDrag(), TimelineGap (+17 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "Project"
Cohesion: 0.11
Nodes (9): setup(), archiveManifest(), atomicJSON(), hasLegacyProject(), ProjectStore, EditingService, duration(), Project (+1 more)

### Community 13 - "devDependencies"
Cohesion: 0.04
Nodes (45): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+37 more)

### Community 14 - "check-desktop.ts"
Cohesion: 0.07
Nodes (20): artifacts, client, finish(), native, pattern, app, created, dataDir (+12 more)

### Community 15 - "check-desktop-ai.ts"
Cohesion: 0.12
Nodes (13): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+5 more)

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
Cohesion: 0.16
Nodes (19): checkRevision(), projectSchema, sourceSchema, cursorClicks(), appDataDir, Document, summarySchema, AISettings (+11 more)

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
Cohesion: 0.08
Nodes (29): client, isolated, server, service, commandRegistry, isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema (+21 more)

### Community 53 - ".command"
Cohesion: 0.14
Nodes (20): AVPlayer, NativeApp, Any, AVPlayerItem, CheckedContinuation, CMTime, Never, Project (+12 more)

### Community 55 - "NativeFailure"
Cohesion: 0.13
Nodes (21): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), pcmData() (+13 more)

### Community 56 - ".main"
Cohesion: 0.21
Nodes (11): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, Project (+3 more)

### Community 57 - "App.tsx"
Cohesion: 0.22
Nodes (11): formatTime(), App(), StudioDialogs(), StudioController, EditorScreen(), revealRange(), PlaybackToolbar(), JobNotifications() (+3 more)

### Community 58 - "CaptureEngine"
Cohesion: 0.06
Nodes (51): AVAssetWriter, AVAssetWriterInput, AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CFMachPort (+43 more)

### Community 59 - "Clean Mac release acceptance"
Cohesion: 0.33
Nodes (6): Clean Mac release acceptance, Editor and long recording, Evidence result, Installation and portability, Projects, recording and recovery, Real MCP clients

### Community 62 - "check-launch.ts"
Cohesion: 0.06
Nodes (33): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+25 more)

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.40
Nodes (5): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants

### Community 64 - "SettingsDialog.tsx"
Cohesion: 0.14
Nodes (19): formatMcpConfig(), McpClient, outputSize(), Switch(), Field(), AboutDialog(), AuthorFooter(), Dialog() (+11 more)

### Community 65 - "entry"
Cohesion: 0.08
Nodes (25): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+17 more)

### Community 66 - "edits.ts"
Cohesion: 0.24
Nodes (19): applyEdits(), AudioWindow, checkedRange(), coalesceSegments(), found(), mergeRanges(), silenceCuts(), sourceSpan() (+11 more)

### Community 67 - "Screen Recorder"
Cohesion: 0.25
Nodes (8): Connect Claude or Codex, Contribute, Create, edit and keep your work, Develop, License, Local processing and current limits, Screen Recorder, Try the development preview

### Community 68 - "command"
Cohesion: 0.12
Nodes (20): StudioHeader(), useAssistantController(), exportTranscript(), saveKey(), saveSettings(), useJobsController(), cancelJob(), poll() (+12 more)

### Community 69 - "AppError"
Cohesion: 0.20
Nodes (6): AppError, parseProject(), subtitleText(), parseDocument(), AssistantService, Job

### Community 70 - "Launch readiness — 13 September 2026"
Cohesion: 0.33
Nodes (6): Alignment delivered, Current development artifact, Launch readiness — 13 September 2026, Real MCP evidence, Still needed before public beta, What was actually checked

### Community 71 - "ai.ts"
Cohesion: 0.19
Nodes (9): ai, directory, operationsSchema, defaultSettings, hashFile(), LocalAI, { $schema: _editSchemaDialect, ...editSchema }, defaultMcpPermissions (+1 more)

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

### Community 80 - "website/tsconfig.json"
Cohesion: 0.12
Nodes (15): next-env.d.ts, .next/types/**/*.ts, node_modules, out, **/*.ts, ../tsconfig.json, **/*.tsx, compilerOptions (+7 more)

### Community 81 - "EditorScreen.tsx"
Cohesion: 0.26
Nodes (14): EditOperation, PanelIntro(), RangeSummary(), Slider(), DraftPreviewContext, ErrorContext, CanvasPanel(), OverlaysPanel() (+6 more)

### Community 82 - ".frame"
Cohesion: 0.17
Nodes (17): AVAsynchronousVideoCompositionRequest, AVVideoCompositing, AVVideoCompositionRenderContext, CanvasSettings, CGAffineTransform, ScreenrecCompositor, .requiredPixelBufferAttributesForRenderContext, .sourcePixelBufferAttributes (+9 more)

### Community 83 - "shared/types.ts"
Cohesion: 0.11
Nodes (20): cameraAt(), cameraLayoutSettings(), cameraOutputLayouts(), CameraRun, sameCameraLayout(), Asset, AutoZoomSettings, CameraLayout (+12 more)

### Community 84 - "messageOf"
Cohesion: 0.21
Nodes (8): RpcRequest, RpcResponse, useProjectThumbnailController(), ProjectThumbnail(), desktop, sendCommand(), messageOf(), retriable

### Community 85 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 86 - "Development standards"
Cohesion: 0.33
Nodes (5): Architecture and tests, Development standards, Repository knowledge graph, Required checks, TypeScript and lint

### Community 87 - "AppKit"
Cohesion: 0.26
Nodes (6): AppKit, AVFoundation, CoreImage, CoreText, ScreenCaptureKit, Security

### Community 88 - "lint-staged"
Cohesion: 0.40
Nodes (5): lint-staged, *.{js,mjs,ts,tsx}, *.{json,css,html,md,yml,yaml}, eslint --fix --max-warnings 0 --no-warn-ignored, prettier --write

### Community 93 - ".startExport"
Cohesion: 0.14
Nodes (14): AVAssetExportSession, CChar, screenrec_attach_window(), screenrec_command(), ExportJob, .result, Any, Never (+6 more)

### Community 94 - "overlayRect"
Cohesion: 0.27
Nodes (11): CTFramesetter, CanvasLayout, overlayRect(), CGFloat, CGRect, CGSize, CIImage, String (+3 more)

### Community 95 - "RenderInstruction"
Cohesion: 0.27
Nodes (10): AVVideoCompositionInstructionProtocol, CameraRun, CMTimeRange, RenderInstruction, CIImage, CMPersistentTrackID, CMTime, CursorEvent (+2 more)

### Community 96 - "PreviewRenderMetrics"
Cohesion: 0.47
Nodes (5): PreviewRenderMetrics, Any, Bool, Double, String

### Community 98 - "usePreviewEditingController.ts"
Cohesion: 0.14
Nodes (16): PlaybackState, PreviewGeometry, PreviewItem, PreviewPlayback, Send, useNativePreviewController(), accent(), clamp() (+8 more)

### Community 99 - "color"
Cohesion: 0.29
Nodes (6): color(), CGFloat, NSColor, render(), Int, String

### Community 100 - "useJobsController.ts"
Cohesion: 0.33
Nodes (5): CaptureSettings, RecordingStatus, Chat, SilenceReview, idleRecording

### Community 101 - "decode"
Cohesion: 0.40
Nodes (6): decode(), jsonObject(), readCursor(), Any, Data, T

## Knowledge Gaps
- **409 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `tabWidth`, `printWidth` (+404 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 585 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _409 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useStudioController.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14153846153846153 - nodes in this community are weakly interconnected._
- **Should `CameraBubbleView` be split into smaller, more focused modules?**
  _Cohesion score 0.12987012987012986 - nodes in this community are weakly interconnected._