# Graph Report - screen-recorder  (2026-09-14)

## Corpus Check
- 200 files · ~134,584 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1327 nodes · 3362 edges · 86 communities (52 shown, 22 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 266 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `717c567a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- command
- Composition.swift
- CaptureEngine
- CaptureDialog.tsx
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
- mcp.ts
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
- Bridge.swift
- contracts/commands.ts
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
- infrastructure/rpc.ts
- .command
- prepare-site-download.mjs
- NativeFailure
- .main
- Project
- EditorScreen.tsx
- AppClient
- download-stats.mjs
- check-launch.ts
- Architecture and contribution guide
- App.tsx
- entry
- edits.ts
- Screen Recorder
- check-interactions.ts
- Launch readiness — 13 September 2026
- MCP setup
- Privacy
- Validation and release
- ScreenCursor feature parity
- Product website
- check-capture-input.sh
- Editor interaction and capture validation
- THIRD_PARTY_NOTICES.md
- shared/types.ts
- .prettierrc.json
- Development standards
- lint-staged
- development-standards.md

## God Nodes (most connected - your core abstractions)
1. `AppError` - 66 edges
2. `Project` - 52 edges
3. `CaptureEngine` - 43 edges
4. `NativeFailure` - 35 edges
5. `scripts` - 35 edges
6. `ProjectStore` - 33 edges
7. `NativeApp` - 30 edges
8. `command()` - 28 edges
9. `applyEdits()` - 27 edges
10. `ApplicationService` - 27 edges

## Surprising Connections (you probably didn't know these)
- `applyEdits()` --calls--> `defaultAutoZoom()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts
- `RecordingService` --references--> `Project`  [EXTRACTED]
  server/services/RecordingService.ts → shared/types.ts
- `RecordingService` --references--> `RecordingStatus`  [EXTRACTED]
  server/services/RecordingService.ts → shared/types.ts
- `assistant()` --calls--> `duration()`  [EXTRACTED]
  server/services/ai.ts → shared/timeline.ts
- `assistant()` --calls--> `outputRanges()`  [EXTRACTED]
  server/services/ai.ts → shared/timeline.ts

## Import Cycles
- None detected.

## Communities (86 total, 22 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.17
Nodes (33): Codable, Audio, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings, Cursor (+25 more)

### Community 1 - "command"
Cohesion: 0.10
Nodes (29): useAssistantController(), exportTranscript(), saveKey(), saveSettings(), useJobsController(), cancelJob(), poll(), useProjectController() (+21 more)

### Community 2 - "Composition.swift"
Cohesion: 0.07
Nodes (60): AVAsynchronousVideoCompositionRequest, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, AVVideoCompositing, AVVideoCompositionInstructionProtocol, AVVideoCompositionRenderContext, CameraLayout (+52 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.06
Nodes (49): AVAssetWriter, AVAssetWriterInput, AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CFMachPort (+41 more)

### Community 4 - "CaptureDialog.tsx"
Cohesion: 0.30
Nodes (8): AppCapabilities, CaptureSettings, useCaptureDialogController(), permission(), useStableCallback(), RangeDrag, useTimelineSelection(), CaptureDialog()

### Community 5 - "validation.ts"
Cohesion: 0.08
Nodes (24): audio, autoZoom, camera, cameraLayout, canvas, captions, color, cursor (+16 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 9 - "Timeline.tsx"
Cohesion: 0.16
Nodes (23): defaultAutoZoom(), Range, TimelineClip(), TrimHandle(), useTimelineDrag(), TimelineGap, TimelineInterval, useTimelineGeometry() (+15 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "AppError"
Cohesion: 0.06
Nodes (39): setup(), AppError, checkRevision(), errorOf(), parseProject(), projectSchema, sourceSchema, time (+31 more)

### Community 13 - "devDependencies"
Cohesion: 0.05
Nodes (43): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+35 more)

### Community 14 - "check-desktop.ts"
Cohesion: 0.18
Nodes (7): app, created, dataDir, env, projectsDir, resources, video

### Community 15 - "mcp.ts"
Cohesion: 0.23
Nodes (11): isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema, methodSchemas, object(), CommandController, assertMcpPermission(), callAppTool() (+3 more)

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "usePreviewEditingController.ts"
Cohesion: 0.13
Nodes (18): CameraLayoutSettings, cameraEdit(), PlaybackState, PreviewGeometry, PreviewItem, PreviewPlayback, Send, useNativePreviewController() (+10 more)

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
Cohesion: 0.10
Nodes (17): AppKit, AVFoundation, CChar, CoreImage, screenrec_attach_window(), screenrec_command(), NativeCallback, NSColor (+9 more)

### Community 30 - "contracts/commands.ts"
Cohesion: 0.13
Nodes (14): absolutePath, model, none, permissionOverrides, projectId, provider, readOnly, revision (+6 more)

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

### Community 52 - "infrastructure/rpc.ts"
Cohesion: 0.18
Nodes (11): client, isolated, server, service, socketPath, readLines(), serveSocket(), pending (+3 more)

### Community 53 - ".command"
Cohesion: 0.13
Nodes (23): AVAssetExportSession, AVPlayer, AVPlayerItem, ExportJob, .result, NativeApp, PreviewView, Any (+15 more)

### Community 55 - "NativeFailure"
Cohesion: 0.13
Nodes (21): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), pcmData() (+13 more)

### Community 56 - ".main"
Cohesion: 0.18
Nodes (16): CGImage, NativeCheck, Bool, CGRect, Data, Int, Project, String (+8 more)

### Community 57 - "Project"
Cohesion: 0.13
Nodes (22): Job, McpPermissions, Project, RecordingStatus, RunAction, createPreviewPlayback(), Modal, Model (+14 more)

### Community 58 - "EditorScreen.tsx"
Cohesion: 0.21
Nodes (16): EditOperation, Switch(), Field(), PanelIntro(), RangeSummary(), Slider(), DraftPreviewContext, ErrorContext (+8 more)

### Community 59 - "AppClient"
Cohesion: 0.18
Nodes (6): artifacts, client, finish(), native, pattern, AppClient

### Community 62 - "check-launch.ts"
Cohesion: 0.09
Nodes (21): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+13 more)

### Community 63 - "Architecture and contribution guide"
Cohesion: 0.40
Nodes (5): Adding behavior, Architecture and contribution guide, Checks, Interactive preview and recording, Invariants

### Community 64 - "App.tsx"
Cohesion: 0.12
Nodes (22): formatTime(), outputSize(), App(), IconButton(), AboutDialog(), AuthorFooter(), Dialog(), StudioDialogs() (+14 more)

### Community 65 - "entry"
Cohesion: 0.09
Nodes (23): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+15 more)

### Community 66 - "edits.ts"
Cohesion: 0.06
Nodes (51): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+43 more)

### Community 67 - "Screen Recorder"
Cohesion: 0.25
Nodes (8): Connect Claude or Codex, Contribute, Create, edit and keep your work, Develop, License, Local processing and current limits, Screen Recorder, Try the development preview

### Community 68 - "check-interactions.ts"
Cohesion: 0.33
Nodes (3): audioInspection(), inspect(), { values }

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

### Community 84 - "shared/types.ts"
Cohesion: 0.10
Nodes (23): formatMcpConfig(), McpClient, Asset, AutoZoomSettings, CameraSettings, CanvasSettings, CaptureSource, defaultMcpPermissions (+15 more)

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
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 508 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `Project` connect `Project` to `App.tsx`, `edits.ts`, `check-interactions.ts`, `validation.ts`, `CaptureDialog.tsx`, `Timeline.tsx`, `AppError`, `check-desktop.ts`, `usePreviewEditingController.ts`, `shared/types.ts`, `EditorScreen.tsx`, `AppClient`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `AppError` connect `AppError` to `edits.ts`, `validation.ts`, `mcp.ts`, `infrastructure/rpc.ts`, `AppClient`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _365 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `command` be split into smaller, more focused modules?**
  _Cohesion score 0.09747899159663866 - nodes in this community are weakly interconnected._
- **Should `Composition.swift` be split into smaller, more focused modules?**
  _Cohesion score 0.07367737747484583 - nodes in this community are weakly interconnected._