# Graph Report - screen-recorder  (2026-09-14)

## Corpus Check
- 226 files · ~140,396 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1463 nodes · 3480 edges · 103 communities (64 shown, 26 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `be1a0e5b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- studioTypes.ts
- makeComposition
- CaptureInputMonitor
- contracts/commands.ts
- validation.ts
- dependencies
- bundle
- README.md
- Project
- main.rs
- compilerOptions
- AppError
- devDependencies
- check-interactions.ts
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
- NativeFailure
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
- mcp.ts
- .main
- prepare-site-download.mjs
- prepareAudio
- .canvasAndSpeedChecks
- AppClient
- CaptureEngine
- Clean Mac release acceptance
- download-stats.mjs
- check-launch.ts
- Architecture and contribution guide
- App.tsx
- entry
- edits.ts
- Screen Recorder
- command
- useStudioController.ts
- Launch readiness — 13 September 2026
- check-local-ai.ts
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
- RenderInstruction
- shared/types.ts
- messageOf
- .prettierrc.json
- Development standards
- check-desktop.ts
- lint-staged
- development-standards.md
- screenrec_command
- services/commands.ts
- CommandController
- vercel.json
- usePreviewEditingController.ts
- useJobsController.ts
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
- `applyEdits()` --calls--> `cameraLayoutSettings()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `sameCameraLayout()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `defaultAutoZoom()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts
- `RecordingService` --references--> `Project`  [EXTRACTED]
  server/services/RecordingService.ts → shared/types.ts

## Import Cycles
- None detected.

## Communities (103 total, 26 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.17
Nodes (34): Codable, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings, color() (+26 more)

### Community 1 - "studioTypes.ts"
Cohesion: 0.15
Nodes (15): Job, RunAction, McpConfig, Modal, Model, Settings, Tab, Chat (+7 more)

### Community 2 - "makeComposition"
Cohesion: 0.05
Nodes (44): AppKit, AVAssetExportSession, AVFoundation, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, CoreImage, CoreText (+36 more)

### Community 3 - "CaptureInputMonitor"
Cohesion: 0.12
Nodes (20): CFMachPort, CFRunLoop, CGEvent, CGEventType, CoreMedia, CaptureCheck, CaptureInputMonitor, cursorPosition() (+12 more)

### Community 4 - "contracts/commands.ts"
Cohesion: 0.11
Nodes (18): absolutePath, CommandMetadata, descriptions, examples, methodSchemas, model, none, permissionOverrides (+10 more)

### Community 5 - "validation.ts"
Cohesion: 0.08
Nodes (24): audio, autoZoom, camera, cameraLayout, canvas, captions, color, cursor (+16 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 8 - "README.md"
Cohesion: 0.21
Nodes (3): Design system, Third-party notices, Website compatibility marks

### Community 9 - "Project"
Cohesion: 0.14
Nodes (25): defaultAutoZoom(), Project, Range, TimelineSegment, useStableCallback(), TrimHandle(), useTimelineDrag(), TimelineGap (+17 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "AppError"
Cohesion: 0.05
Nodes (48): client, isolated, server, service, setup(), AppError, checkRevision(), errorOf() (+40 more)

### Community 13 - "devDependencies"
Cohesion: 0.04
Nodes (47): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+39 more)

### Community 14 - "check-interactions.ts"
Cohesion: 0.20
Nodes (7): audioInspection(), inspect(), parseProcessSample(), ProcessSample, readProcessSample(), { values }, AppCapabilities

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

### Community 30 - "NativeFailure"
Cohesion: 0.16
Nodes (13): AVAssetWriter, AVAssetWriterInput, Error, LocalizedError, Bool, CGSize, CMSampleBuffer, CMTime (+5 more)

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

### Community 52 - "mcp.ts"
Cohesion: 0.40
Nodes (8): commandRegistry, isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema, assertMcpPermission(), callAppTool(), createMcpServer(), toolMethods

### Community 53 - ".main"
Cohesion: 0.12
Nodes (28): AVPlayer, NativeApp, Any, AVPlayerItem, CheckedContinuation, CMTime, Never, Project (+20 more)

### Community 55 - "prepareAudio"
Cohesion: 0.16
Nodes (17): AVAssetReader, AVAssetReaderTrackOutput, FileHandle, Foundation, analyzeAudio(), audioReader(), pcmData(), prepareAudio() (+9 more)

### Community 56 - ".canvasAndSpeedChecks"
Cohesion: 0.25
Nodes (9): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, String (+1 more)

### Community 57 - "AppClient"
Cohesion: 0.18
Nodes (6): artifacts, client, finish(), native, pattern, AppClient

### Community 58 - "CaptureEngine"
Cohesion: 0.13
Nodes (22): AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CMClock, CaptureEngine, Any (+14 more)

### Community 59 - "Clean Mac release acceptance"
Cohesion: 0.33
Nodes (6): Clean Mac release acceptance, Editor and long recording, Evidence result, Installation and portability, Projects, recording and recovery, Real MCP clients

### Community 62 - "check-launch.ts"
Cohesion: 0.06
Nodes (33): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+25 more)

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.40
Nodes (5): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants

### Community 64 - "App.tsx"
Cohesion: 0.10
Nodes (27): formatMcpConfig(), McpClient, formatTime(), App(), IconButton(), AboutDialog(), AuthorFooter(), Dialog() (+19 more)

### Community 65 - "entry"
Cohesion: 0.08
Nodes (25): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+17 more)

### Community 66 - "edits.ts"
Cohesion: 0.21
Nodes (21): applyEdits(), checkedRange(), coalesceSegments(), found(), mergeRanges(), silenceCuts(), sourceSpan(), subtitleText() (+13 more)

### Community 67 - "Screen Recorder"
Cohesion: 0.25
Nodes (8): Connect Claude or Codex, Contribute, Create, edit and keep your work, Develop, License, Local processing and current limits, Screen Recorder, Try the development preview

### Community 68 - "command"
Cohesion: 0.13
Nodes (19): useAssistantController(), exportTranscript(), saveKey(), saveSettings(), useJobsController(), cancelJob(), poll(), useProjectController() (+11 more)

### Community 69 - "useStudioController.ts"
Cohesion: 0.20
Nodes (7): createPreviewPlayback(), PlaybackState, PreviewGeometry, PreviewItem, PreviewPlayback, Send, reconcileProjectRefresh()

### Community 70 - "Launch readiness — 13 September 2026"
Cohesion: 0.33
Nodes (6): Alignment delivered, Current development artifact, Launch readiness — 13 September 2026, Real MCP evidence, Still needed before public beta, What was actually checked

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
Cohesion: 0.21
Nodes (18): EditOperation, Switch(), Field(), PanelIntro(), RangeSummary(), Slider(), DraftPreviewContext, ErrorContext (+10 more)

### Community 82 - "RenderInstruction"
Cohesion: 0.06
Nodes (60): AVAsynchronousVideoCompositionRequest, AVVideoCompositing, AVVideoCompositionInstructionProtocol, AVVideoCompositionRenderContext, CameraLayout, CameraRun, CameraSettings, CanvasSettings (+52 more)

### Community 83 - "shared/types.ts"
Cohesion: 0.09
Nodes (24): object(), operationsSchema, Document, hasLegacyProject(), summarySchema, assistant(), { $schema: _editSchemaDialect, ...editSchema }, Asset (+16 more)

### Community 84 - "messageOf"
Cohesion: 0.27
Nodes (7): useAuthorLinks(), open(), useNativePreviewController(), useProjectThumbnailController(), ProjectThumbnail(), desktop, messageOf()

### Community 85 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 86 - "Development standards"
Cohesion: 0.33
Nodes (5): Architecture and tests, Development standards, Repository knowledge graph, Required checks, TypeScript and lint

### Community 87 - "check-desktop.ts"
Cohesion: 0.18
Nodes (7): app, created, dataDir, env, projectsDir, resources, video

### Community 88 - "lint-staged"
Cohesion: 0.40
Nodes (5): lint-staged, *.{js,mjs,ts,tsx}, *.{json,css,html,md,yml,yaml}, eslint --fix --max-warnings 0 --no-warn-ignored, prettier --write

### Community 93 - "screenrec_command"
Cohesion: 0.29
Nodes (6): CChar, screenrec_attach_window(), screenrec_command(), NativeCallback, UnsafeMutableRawPointer, UnsafePointer

### Community 94 - "services/commands.ts"
Cohesion: 0.40
Nodes (4): RpcRequest, RpcResponse, sendCommand(), retriable

### Community 96 - "vercel.json"
Cohesion: 0.50
Nodes (3): buildCommand, outputDirectory, $schema

### Community 98 - "usePreviewEditingController.ts"
Cohesion: 0.14
Nodes (18): projectSchema, cameraAt(), cameraLayoutSettings(), cameraOutputLayouts(), CameraRun, sameCameraLayout(), CameraLayoutSettings, cameraEdit() (+10 more)

### Community 100 - "useJobsController.ts"
Cohesion: 0.33
Nodes (5): CaptureSettings, RecordingStatus, Chat, SilenceReview, idleRecording

## Knowledge Gaps
- **412 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `tabWidth`, `printWidth` (+407 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 588 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _412 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `studioTypes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14761904761904762 - nodes in this community are weakly interconnected._
- **Should `makeComposition` be split into smaller, more focused modules?**
  _Cohesion score 0.053075396825396824 - nodes in this community are weakly interconnected._