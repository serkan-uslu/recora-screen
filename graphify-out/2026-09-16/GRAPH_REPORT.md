# Graph Report - screen-recorder  (2026-09-16)

## Corpus Check
- 250 files · ~161,978 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1574 nodes · 3989 edges · 99 communities (62 shown, 24 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 359 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a6d489b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- StudioDialogs.tsx
- AppKit
- ProjectStore
- validation.ts
- contracts/commands.ts
- dependencies
- bundle
- README.md
- Project
- main.rs
- compilerOptions
- ProjectStore.ts
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
- Editor effects and media
- screen-recorder
- ai.ts
- makeComposition
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
- edits.ts
- .command
- prepare-site-download.mjs
- NativeFailure
- .main
- ApplicationService.ts
- CaptureEngine
- Clean Mac release acceptance
- download-stats.mjs
- check-launch.ts
- Architecture and contribution guide
- EditorScreen.tsx
- entry
- Timeline
- Recora Screen
- check-interactions.ts
- Launch readiness — 13 September 2026
- AppError
- MCP setup
- Privacy
- Validation and release
- release.md
- check-clean-install.mjs
- Product website
- check-capture-input.sh
- Editor interaction and capture validation
- website/tsconfig.json
- OverlaysPanel.tsx
- RenderInstruction
- shared/types.ts
- .prettierrc.json
- Development standards
- development-standards.md
- lint-staged
- command
- screenrec_command
- vercel.json
- usePreviewEditingController.ts
- RecordingService
- website/AGENTS.md
- next.config.ts
- next-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `AppError` - 69 edges
2. `Project` - 59 edges
3. `CaptureEngine` - 42 edges
4. `duration()` - 41 edges
5. `NativeFailure` - 40 edges
6. `scripts` - 38 edges
7. `ProjectStore` - 36 edges
8. `ApplicationService` - 36 edges
9. `NativeApp` - 33 edges
10. `applyEdits()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `checkedRange()` --calls--> `sourceRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `applyEdits()` --calls--> `segmentSourceDuration()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `applyEdits()` --calls--> `defaultAutoZoom()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts
- `fixture()` --calls--> `defaultEdits()`  [EXTRACTED]
  server/editor-selection.test.ts → shared/types.ts
- `RecordingService` --references--> `Project`  [EXTRACTED]
  server/services/RecordingService.ts → shared/types.ts

## Import Cycles
- None detected.

## Communities (99 total, 24 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.22
Nodes (30): Codable, Audio, AudioClip, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings (+22 more)

### Community 1 - "StudioDialogs.tsx"
Cohesion: 0.13
Nodes (19): outputSize(), AppCapabilities, CaptureSettings, ExportOptions, Zoom, AboutDialog(), Dialog(), StudioDialogs() (+11 more)

### Community 2 - "AppKit"
Cohesion: 0.05
Nodes (34): AppKit, AVAssetWriter, AVAssetWriterInput, AVFoundation, CoreImage, CoreMedia, CoreText, ImageIO (+26 more)

### Community 3 - "ProjectStore"
Cohesion: 0.14
Nodes (6): setup(), archiveManifest(), atomicJSON(), ProjectStore, EditingService, ProjectSummary

### Community 4 - "validation.ts"
Cohesion: 0.07
Nodes (26): audio, audioClip, autoZoom, camera, cameraLayout, canvas, captions, color (+18 more)

### Community 5 - "contracts/commands.ts"
Cohesion: 0.08
Nodes (33): absolutePath, CommandMetadata, commandRegistry, descriptions, examples, isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema (+25 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 8 - "README.md"
Cohesion: 0.19
Nodes (4): Design system, Native media module, Third-party notices, Website compatibility marks

### Community 9 - "Project"
Cohesion: 0.18
Nodes (20): segmentSourceDuration(), Project, Range, useStableCallback(), TimelineClip(), TrimHandle(), useTimelineDrag(), TimelineGap (+12 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "ProjectStore.ts"
Cohesion: 0.16
Nodes (15): checkRevision(), projectSchema, sourceSchema, time, cursorClicks(), Document, summarySchema, AISettings (+7 more)

### Community 13 - "devDependencies"
Cohesion: 0.04
Nodes (47): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+39 more)

### Community 14 - "check-desktop.ts"
Cohesion: 0.08
Nodes (20): artifacts, client, finish(), native, pattern, app, created, dataDir (+12 more)

### Community 15 - "check-desktop-ai.ts"
Cohesion: 0.12
Nodes (13): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+5 more)

### Community 16 - "permissions"
Cohesion: 0.15
Nodes (12): core:default, core:window:allow-start-dragging, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description (+4 more)

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

### Community 24 - "Editor effects and media"
Cohesion: 0.22
Nodes (9): Arrows and privacy covers, Automatic zooms and clip settings, Cursor and camera effects, Editor effects and media, Get started, GIF export, Imported audio, Timeline commands (+1 more)

### Community 29 - "ai.ts"
Cohesion: 0.21
Nodes (8): ai, directory, operationsSchema, defaultSettings, hashFile(), LocalAI, { $schema: _editSchemaDialect, ...editSchema }, TranscriptSegment

### Community 30 - "makeComposition"
Cohesion: 0.23
Nodes (17): AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, BuiltComposition, .instruction, makeComposition(), mediaStructure(), CMPersistentTrackID (+9 more)

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

### Community 52 - "edits.ts"
Cohesion: 0.07
Nodes (56): automaticZooms(), CursorActivity, retain(), eventSchema, sameTarget(), applyEdits(), AudioWindow, checkedRange() (+48 more)

### Community 53 - ".command"
Cohesion: 0.10
Nodes (30): AVAssetExportSession, AVPlayer, NativeApp, Any, AVPlayerItem, CheckedContinuation, CMTime, Never (+22 more)

### Community 55 - "NativeFailure"
Cohesion: 0.14
Nodes (22): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), audioWaveform() (+14 more)

### Community 56 - ".main"
Cohesion: 0.18
Nodes (17): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, Project (+9 more)

### Community 57 - "ApplicationService.ts"
Cohesion: 0.15
Nodes (11): client, isolated, server, service, errorOf(), appDataDir, ready, ready() (+3 more)

### Community 58 - "CaptureEngine"
Cohesion: 0.07
Nodes (42): AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CFMachPort, CFRunLoop, CGEvent (+34 more)

### Community 59 - "Clean Mac release acceptance"
Cohesion: 0.33
Nodes (6): Clean Mac release acceptance, Editor and long recording, Evidence result, Installation and portability, Projects, recording and recovery, Real MCP clients

### Community 62 - "check-launch.ts"
Cohesion: 0.06
Nodes (33): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+25 more)

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.40
Nodes (5): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants

### Community 64 - "EditorScreen.tsx"
Cohesion: 0.13
Nodes (18): formatTime(), App(), IconButton(), AuthorFooter(), useProjectThumbnailController(), StudioController, SilenceControls(), PlaybackToolbar() (+10 more)

### Community 65 - "entry"
Cohesion: 0.08
Nodes (25): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+17 more)

### Community 66 - "Timeline"
Cohesion: 0.33
Nodes (8): Timeline(), menuPosition(), openClipMenu(), openTrackMenu(), selectClip(), selectOverlay(), selectTarget(), selectZoom()

### Community 67 - "Recora Screen"
Cohesion: 0.25
Nodes (8): Connect Claude or Codex, Contribute, Create, edit and keep your work, Develop, License, Local processing and current limits, Recora Screen, Try the development preview

### Community 69 - "check-interactions.ts"
Cohesion: 0.22
Nodes (6): audioInspection(), inspect(), parseProcessSample(), ProcessSample, readProcessSample(), { values }

### Community 70 - "Launch readiness — 13 September 2026"
Cohesion: 0.29
Nodes (6): Alignment delivered, Current development artifact, Launch readiness — 13 September 2026, Real MCP evidence, Still needed before public beta, What was actually checked

### Community 71 - "AppError"
Cohesion: 0.22
Nodes (4): AppError, AssistantService, ExportService, TranscriptionService

### Community 72 - "MCP setup"
Cohesion: 0.25
Nodes (8): Additional editor features, Claude Code, Claude Desktop, Codex, Command contract, Development, MCP setup, Verify your connection

### Community 73 - "Privacy"
Cohesion: 0.40
Nodes (5): Local processing, MCP, Optional cloud assistant, Privacy, Removal

### Community 74 - "Validation and release"
Cohesion: 0.29
Nodes (7): Hardware acceptance before public release, Historical development validation, One record per release candidate, Reproduce checks, Signing and distribution, Validation and release, Website publication after the approved release

### Community 75 - "release.md"
Cohesion: 0.25
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

### Community 81 - "OverlaysPanel.tsx"
Cohesion: 0.19
Nodes (21): sourceRanges(), CameraLayoutSettings, defaultAutoZoom(), EditOperation, Switch(), Field(), PanelIntro(), RangeSummary() (+13 more)

### Community 82 - "RenderInstruction"
Cohesion: 0.05
Nodes (71): AVAsynchronousVideoCompositionRequest, AVVideoCompositing, AVVideoCompositionInstructionProtocol, AVVideoCompositionRenderContext, CameraLayout, CameraRun, CameraSettings, CanvasSettings (+63 more)

### Community 83 - "shared/types.ts"
Cohesion: 0.08
Nodes (34): formatMcpConfig(), McpClient, Asset, AudioClip, CameraSettings, CanvasSettings, CaptureSource, Device (+26 more)

### Community 85 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 86 - "Development standards"
Cohesion: 0.33
Nodes (5): Architecture and tests, Development standards, Repository knowledge graph, Required checks, TypeScript and lint

### Community 88 - "lint-staged"
Cohesion: 0.40
Nodes (5): lint-staged, *.{js,mjs,ts,tsx}, *.{json,css,html,md,yml,yaml}, eslint --fix --max-warnings 0 --no-warn-ignored, prettier --write

### Community 94 - "command"
Cohesion: 0.06
Nodes (42): TimelineMedia, TimelineMediaRange, timelineMediaSchema, RpcRequest, RpcResponse, StudioHeader(), useAssistantController(), exportTranscript() (+34 more)

### Community 95 - "screenrec_command"
Cohesion: 0.29
Nodes (6): CChar, screenrec_attach_window(), screenrec_command(), NativeCallback, UnsafeMutableRawPointer, UnsafePointer

### Community 96 - "vercel.json"
Cohesion: 0.50
Nodes (3): buildCommand, outputDirectory, $schema

### Community 98 - "usePreviewEditingController.ts"
Cohesion: 0.12
Nodes (20): PlaybackState, PreviewGeometry, PreviewItem, PreviewPlayback, Send, openExport(), useNativePreviewController(), accent() (+12 more)

## Knowledge Gaps
- **430 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `tabWidth`, `printWidth` (+425 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 608 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Project` connect `Project` to `StudioDialogs.tsx`, `usePreviewEditingController.ts`, `ProjectStore`, `validation.ts`, `check-interactions.ts`, `RecordingService`, `AppError`, `ProjectStore.ts`, `check-desktop.ts`, `check-desktop-ai.ts`, `OverlaysPanel.tsx`, `shared/types.ts`, `edits.ts`, `ai.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 32 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 32 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _430 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `StudioDialogs.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12962962962962962 - nodes in this community are weakly interconnected._
- **Should `AppKit` be split into smaller, more focused modules?**
  _Cohesion score 0.05388471177944862 - nodes in this community are weakly interconnected._