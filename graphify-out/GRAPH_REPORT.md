# Graph Report - screen-recorder  (2026-09-14)

## Corpus Check
- 209 files · ~135,306 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1373 nodes · 3358 edges · 90 communities (54 shown, 24 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b56fe6bf`
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
- CaptureInputMonitor
- permissions
- verify-bundle.mjs
- useStudioController
- prepare-runtime.mjs
- prepare-whisper.mjs
- desktop.mjs
- build.sh
- check.sh script
- native/README.md
- screen-recorder
- command
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
- TrackWriter
- check-desktop-ai.ts
- download-stats.mjs
- check-launch.ts
- Architecture and contribution guide
- SettingsDialog.tsx
- entry
- edits.ts
- Screen Recorder
- useProjectController
- .startExport
- Launch readiness — 13 September 2026
- LocalAI
- MCP setup
- Privacy
- Validation and release
- ScreenCursor feature parity
- RecordingService
- Product website
- check-capture-input.sh
- Editor interaction and capture validation
- THIRD_PARTY_NOTICES.md
- ProjectsScreen.tsx
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
- `temporalPatch()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts
- `applyEdits()` --calls--> `cameraLayoutSettings()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `sameCameraLayout()`  [EXTRACTED]
  server/domain/edits.ts → shared/camera.ts
- `applyEdits()` --calls--> `defaultAutoZoom()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts
- `silenceCuts()` --calls--> `outputRanges()`  [EXTRACTED]
  server/domain/edits.ts → shared/timeline.ts

## Import Cycles
- None detected.

## Communities (90 total, 24 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.20
Nodes (30): Codable, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings, color() (+22 more)

### Community 1 - "useStudioController.ts"
Cohesion: 0.18
Nodes (15): RunAction, McpConfig, Modal, Model, Settings, Tab, Chat, useExportController() (+7 more)

### Community 2 - "makeComposition"
Cohesion: 0.05
Nodes (42): AppKit, AVFoundation, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, CoreImage, CoreText, CameraBubbleView (+34 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.13
Nodes (23): AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CMClock, FileHandle, CaptureEngine (+15 more)

### Community 4 - "RenderInstruction"
Cohesion: 0.06
Nodes (60): AVAsynchronousVideoCompositionRequest, AVVideoCompositing, AVVideoCompositionInstructionProtocol, AVVideoCompositionRenderContext, CameraLayout, CameraRun, CameraSettings, CanvasSettings (+52 more)

### Community 5 - "validation.ts"
Cohesion: 0.05
Nodes (46): absolutePath, CommandMetadata, descriptions, examples, model, none, permissionOverrides, projectId (+38 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 9 - "shared/types.ts"
Cohesion: 0.05
Nodes (93): cameraAt(), cameraLayoutSettings(), cameraOutputLayouts(), CameraRun, sameCameraLayout(), formatTime(), outputRanges(), outputSize() (+85 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "AppError"
Cohesion: 0.11
Nodes (11): setup(), AppError, checkRevision(), parseProject(), cursorClicks(), archiveManifest(), hasLegacyProject(), parseDocument() (+3 more)

### Community 13 - "devDependencies"
Cohesion: 0.05
Nodes (43): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+35 more)

### Community 14 - "check-desktop.ts"
Cohesion: 0.07
Nodes (19): artifacts, client, finish(), native, pattern, app, created, dataDir (+11 more)

### Community 15 - "CaptureInputMonitor"
Cohesion: 0.12
Nodes (20): CFMachPort, CFRunLoop, CGEvent, CGEventType, CoreMedia, CaptureCheck, CaptureInputMonitor, cursorPosition() (+12 more)

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "useStudioController"
Cohesion: 0.24
Nodes (8): createPreviewPlayback(), reconcileProjectRefresh(), useStudioController(), cancelDraftPreview(), draftPreview(), history(), importImage(), scheduleDraftPreview()

### Community 19 - "prepare-runtime.mjs"
Cohesion: 0.29
Nodes (6): archive, bytes, cache, extracted, marker, root

### Community 20 - "prepare-whisper.mjs"
Cohesion: 0.40
Nodes (4): buildDir, checkout, current, output

### Community 21 - "desktop.mjs"
Cohesion: 0.50
Nodes (3): args, child, env

### Community 29 - "command"
Cohesion: 0.22
Nodes (15): useAssistantController(), exportTranscript(), saveKey(), saveSettings(), useJobsController(), cancelJob(), poll(), useRecordingController() (+7 more)

### Community 30 - "ApplicationService.ts"
Cohesion: 0.14
Nodes (22): projectSchema, sourceSchema, time, eventSchema, appDataDir, atomicJSON(), Document, AISettings (+14 more)

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

### Community 52 - "service.test.ts"
Cohesion: 0.09
Nodes (26): client, isolated, server, service, commandRegistry, isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema (+18 more)

### Community 53 - ".command"
Cohesion: 0.14
Nodes (19): AVPlayer, NativeApp, Any, AVPlayerItem, CheckedContinuation, CMTime, Never, Project (+11 more)

### Community 55 - "NativeFailure"
Cohesion: 0.14
Nodes (20): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), pcmData() (+12 more)

### Community 56 - ".main"
Cohesion: 0.20
Nodes (13): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, Project (+5 more)

### Community 57 - "App.tsx"
Cohesion: 0.36
Nodes (6): App(), IconButton(), StudioHeader(), StudioController, JobNotifications(), RecordingHud()

### Community 58 - "TrackWriter"
Cohesion: 0.27
Nodes (8): AVAssetWriter, AVAssetWriterInput, Bool, CGSize, CMSampleBuffer, CMTime, URL, TrackWriter

### Community 59 - "check-desktop-ai.ts"
Cohesion: 0.09
Nodes (17): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+9 more)

### Community 62 - "check-launch.ts"
Cohesion: 0.09
Nodes (21): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+13 more)

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.40
Nodes (5): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants

### Community 64 - "SettingsDialog.tsx"
Cohesion: 0.17
Nodes (14): formatMcpConfig(), McpClient, mcpPermissionCategories, McpPermissionCategory, AboutDialog(), AuthorFooter(), Dialog(), StudioDialogs() (+6 more)

### Community 65 - "entry"
Cohesion: 0.09
Nodes (23): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+15 more)

### Community 66 - "edits.ts"
Cohesion: 0.18
Nodes (20): applyEdits(), AudioWindow, checkedRange(), coalesceSegments(), found(), mergeRanges(), silenceCuts(), sourceSpan() (+12 more)

### Community 67 - "Screen Recorder"
Cohesion: 0.25
Nodes (8): Connect Claude or Codex, Contribute, Create, edit and keep your work, Develop, License, Local processing and current limits, Screen Recorder, Try the development preview

### Community 68 - "useProjectController"
Cohesion: 0.20
Nodes (6): useProjectController(), backToLibrary(), confirmDelete(), importProject(), openProject(), saveDraft()

### Community 69 - ".startExport"
Cohesion: 0.12
Nodes (18): AVAssetExportSession, CChar, decode(), readCursor(), requiredString(), Any, Data, screenrec_command() (+10 more)

### Community 70 - "Launch readiness — 13 September 2026"
Cohesion: 0.33
Nodes (6): Alignment delivered, Current development artifact, Launch readiness — 13 September 2026, Real MCP evidence, Still needed before public beta, What was actually checked

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

### Community 81 - "ProjectsScreen.tsx"
Cohesion: 0.48
Nodes (4): useProjectThumbnailController(), ProjectsScreen(), ProjectThumbnail(), date()

### Community 84 - "desktop"
Cohesion: 0.31
Nodes (5): RpcRequest, RpcResponse, desktop, sendCommand(), retriable

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
- **365 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `tabWidth`, `printWidth` (+360 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 528 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `AppError` connect `AppError` to `edits.ts`, `validation.ts`, `LocalAI`, `RecordingService`, `check-desktop.ts`, `service.test.ts`, `ApplicationService.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _365 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `makeComposition` be split into smaller, more focused modules?**
  _Cohesion score 0.05499735589635114 - nodes in this community are weakly interconnected._
- **Should `CaptureEngine` be split into smaller, more focused modules?**
  _Cohesion score 0.1289198606271777 - nodes in this community are weakly interconnected._