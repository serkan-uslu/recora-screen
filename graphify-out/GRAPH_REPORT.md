# Graph Report - screen-recorder  (2026-09-16)

## Corpus Check
- 242 files · ~157,755 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1532 nodes · 3943 edges · 94 communities (58 shown, 23 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 359 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `69531ea4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Models.swift
- messageOf
- AppKit
- CompositionGeometry.swift
- validation.ts
- contracts/commands.ts
- dependencies
- bundle
- Editor effects and media
- Project
- main.rs
- compilerOptions
- RenderInstruction
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
- overlayRect
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
- check-interactions.ts
- download-stats.mjs
- check-launch.ts
- PreviewRenderMetrics
- EditorScreen.tsx
- entry
- Timeline
- .renderContextChanged
- useTimelineMedia.ts
- TranscriptionService.ts
- check-clean-install.mjs
- check-capture-input.sh
- ProjectStore
- website/tsconfig.json
- OverlaysPanel.tsx
- .frame
- useStudioController.ts
- .prettierrc.json
- Development standards
- lint-staged
- shared/types.ts
- useProjectController
- .startExport
- vercel.json
- usePreviewEditingController.ts
- AppError
- useRecordingController
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
- `applyEdits()` --calls--> `defaultCanvas()`  [EXTRACTED]
  server/domain/edits.ts → shared/types.ts
- `fixture()` --calls--> `defaultEdits()`  [EXTRACTED]
  server/editor-selection.test.ts → shared/types.ts

## Import Cycles
- None detected.

## Communities (94 total, 23 thin omitted)

### Community 0 - "Models.swift"
Cohesion: 0.20
Nodes (31): Codable, Audio, AudioClip, CameraLayout, CameraSettings, CanvasSettings, Captions, CaptureSettings (+23 more)

### Community 1 - "messageOf"
Cohesion: 0.10
Nodes (25): formatMcpConfig(), McpClient, AppCapabilities, CaptureSettings, ExportOptions, mcpPermissionCategories, McpPermissionCategory, AboutDialog() (+17 more)

### Community 2 - "AppKit"
Cohesion: 0.05
Nodes (34): AppKit, AVAssetWriter, AVAssetWriterInput, AVFoundation, CoreImage, CoreMedia, CoreText, ImageIO (+26 more)

### Community 3 - "CompositionGeometry.swift"
Cohesion: 0.16
Nodes (21): CameraLayout, CameraSettings, Equatable, cameraOutputRuns(), CameraRun, cameraVisible(), CameraVisual, continuousZooms() (+13 more)

### Community 4 - "validation.ts"
Cohesion: 0.07
Nodes (26): audio, audioClip, autoZoom, camera, cameraLayout, canvas, captions, color (+18 more)

### Community 5 - "contracts/commands.ts"
Cohesion: 0.09
Nodes (28): absolutePath, CommandMetadata, commandRegistry, descriptions, examples, isReadOnly(), mcpPermissionCategory(), mcpPermissionsSchema (+20 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+9 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 8 - "Editor effects and media"
Cohesion: 0.05
Nodes (34): Arrows and privacy covers, Automatic zooms and clip settings, Cursor and camera effects, Editor effects and media, Get started, GIF export, Imported audio, Timeline commands (+26 more)

### Community 9 - "Project"
Cohesion: 0.15
Nodes (25): segmentSourceDuration(), defaultAutoZoom(), Project, Range, TimelineSegment, cameraVisibilityEdits(), useStableCallback(), TrimHandle() (+17 more)

### Community 10 - "main.rs"
Cohesion: 0.11
Nodes (26): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+18 more)

### Community 11 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2023, node, playwright.config.ts, scripts/*.ts, server, shared (+22 more)

### Community 12 - "RenderInstruction"
Cohesion: 0.22
Nodes (13): AVVideoCompositionInstructionProtocol, CameraRun, RenderInstruction, CGAffineTransform, CGSize, CIImage, CMPersistentTrackID, CMTime (+5 more)

### Community 13 - "devDependencies"
Cohesion: 0.04
Nodes (49): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, husky (+41 more)

### Community 14 - "check-desktop.ts"
Cohesion: 0.06
Nodes (25): artifacts, client, finish(), native, pattern, app, created, dataDir (+17 more)

### Community 15 - "check-desktop-ai.ts"
Cohesion: 0.12
Nodes (12): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+4 more)

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

### Community 24 - "overlayRect"
Cohesion: 0.29
Nodes (11): CTFramesetter, CanvasLayout, overlayRect(), CGFloat, CGRect, CGSize, CIImage, Overlay (+3 more)

### Community 29 - "ai.ts"
Cohesion: 0.18
Nodes (10): ai, directory, operationsSchema, assistant(), defaultSettings, hashFile(), LocalAI, models (+2 more)

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
Nodes (54): automaticZooms(), CursorActivity, retain(), eventSchema, sameTarget(), applyEdits(), AudioWindow, checkedRange() (+46 more)

### Community 53 - ".command"
Cohesion: 0.13
Nodes (23): AVPlayer, NativeApp, Any, AVPlayerItem, CheckedContinuation, CMTime, Never, Project (+15 more)

### Community 55 - "NativeFailure"
Cohesion: 0.14
Nodes (22): AVAssetReader, AVAssetReaderTrackOutput, Error, Foundation, LocalizedError, analyzeAudio(), audioReader(), audioWaveform() (+14 more)

### Community 56 - ".main"
Cohesion: 0.22
Nodes (13): CGImage, NativeCheck, Bool, CGRect, Data, Double, Int, Project (+5 more)

### Community 57 - "ApplicationService.ts"
Cohesion: 0.17
Nodes (10): errorOf(), ready, setup(), AISettings, ApplicationService, emptyRecording, EditingService, ExportService (+2 more)

### Community 58 - "CaptureEngine"
Cohesion: 0.07
Nodes (41): AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CFMachPort, CFRunLoop, CGEvent (+33 more)

### Community 59 - "check-interactions.ts"
Cohesion: 0.22
Nodes (6): audioInspection(), inspect(), parseProcessSample(), ProcessSample, readProcessSample(), { values }

### Community 62 - "check-launch.ts"
Cohesion: 0.06
Nodes (35): Check, checks, Evidence, evidenceSchema, requiredAcceptance, root, author, product (+27 more)

### Community 63 - "PreviewRenderMetrics"
Cohesion: 0.40
Nodes (6): PreviewRenderMetrics, Any, Bool, Double, String, Sendable

### Community 64 - "EditorScreen.tsx"
Cohesion: 0.12
Nodes (19): formatTime(), App(), IconButton(), AuthorFooter(), useProjectThumbnailController(), StudioController, SilenceControls(), TimelineClip() (+11 more)

### Community 65 - "entry"
Cohesion: 0.08
Nodes (25): entry, ignoreBinaries, ignoreDependencies, project, $schema, cmake, ffmpeg, ffprobe (+17 more)

### Community 66 - "Timeline"
Cohesion: 0.33
Nodes (8): Timeline(), menuPosition(), openClipMenu(), openTrackMenu(), selectClip(), selectOverlay(), selectTarget(), selectZoom()

### Community 68 - "useTimelineMedia.ts"
Cohesion: 0.35
Nodes (7): TimelineMedia, TimelineMediaRange, timelineMediaSchema, TimelineFilmstrip(), TimelineWaveform(), cache, useTimelineMedia()

### Community 71 - "TranscriptionService.ts"
Cohesion: 0.17
Nodes (9): projectSchema, sourceSchema, time, cursorClicks(), Jobs, PreviewService, emptyRecording, NativeCall (+1 more)

### Community 79 - "ProjectStore"
Cohesion: 0.15
Nodes (11): object(), parseProject(), appDataDir, archiveManifest(), atomicJSON(), Document, hasLegacyProject(), parseDocument() (+3 more)

### Community 80 - "website/tsconfig.json"
Cohesion: 0.12
Nodes (15): next-env.d.ts, .next/types/**/*.ts, node_modules, out, **/*.ts, ../tsconfig.json, **/*.tsx, compilerOptions (+7 more)

### Community 81 - "OverlaysPanel.tsx"
Cohesion: 0.24
Nodes (15): sourceRanges(), EditOperation, Switch(), Field(), PanelIntro(), RangeSummary(), Slider(), cameraEdit() (+7 more)

### Community 82 - ".frame"
Cohesion: 0.17
Nodes (18): AVAsynchronousVideoCompositionRequest, AVVideoCompositing, CanvasSettings, color(), CGFloat, ScreenrecCompositor, .requiredPixelBufferAttributesForRenderContext, .sourcePixelBufferAttributes (+10 more)

### Community 83 - "useStudioController.ts"
Cohesion: 0.11
Nodes (27): RecordingStatus, RunAction, createPreviewPlayback(), McpConfig, Modal, Model, Settings, Tab (+19 more)

### Community 85 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 86 - "Development standards"
Cohesion: 0.33
Nodes (5): Architecture and tests, Development standards, Repository knowledge graph, Required checks, TypeScript and lint

### Community 88 - "lint-staged"
Cohesion: 0.40
Nodes (5): lint-staged, *.{js,mjs,ts,tsx}, *.{json,css,html,md,yml,yaml}, eslint --fix --max-warnings 0 --no-warn-ignored, prettier --write

### Community 93 - "shared/types.ts"
Cohesion: 0.11
Nodes (18): Asset, AudioClip, CameraLayoutSettings, CameraSettings, CanvasSettings, CaptureSource, defaultCanvas(), Device (+10 more)

### Community 94 - "useProjectController"
Cohesion: 0.12
Nodes (16): StudioHeader(), useProjectController(), backToLibrary(), confirmDelete(), importProject(), openProject(), renameProject(), saveDraft() (+8 more)

### Community 95 - ".startExport"
Cohesion: 0.11
Nodes (18): AVAssetExportSession, CChar, decode(), requiredString(), Any, timelineDuration(), screenrec_attach_window(), screenrec_command() (+10 more)

### Community 96 - "vercel.json"
Cohesion: 0.40
Nodes (4): buildCommand, framework, outputDirectory, $schema

### Community 98 - "usePreviewEditingController.ts"
Cohesion: 0.14
Nodes (17): outputSize(), PlaybackState, PreviewGeometry, PreviewItem, PreviewPlayback, Send, useNativePreviewController(), accent() (+9 more)

### Community 99 - "AppError"
Cohesion: 0.14
Nodes (6): setup(), AppError, checkRevision(), AssistantService, RecordingService, CommandParams

### Community 101 - "useRecordingController"
Cohesion: 0.52
Nodes (7): useRecordingController(), finishRecording(), runRecording(), startRecording(), toggleCameraDevice(), toggleCameraVisibility(), toggleRecordingPause()

## Knowledge Gaps
- **402 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `tabWidth`, `printWidth` (+397 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 580 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `Project` connect `Project` to `messageOf`, `usePreviewEditingController.ts`, `AppError`, `validation.ts`, `TranscriptionService.ts`, `check-desktop.ts`, `check-desktop-ai.ts`, `ProjectStore`, `OverlaysPanel.tsx`, `useStudioController.ts`, `edits.ts`, `shared/types.ts`, `check-interactions.ts`, `ai.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 32 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 32 INFERRED edges - model-reasoned connections that need verification._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _402 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `messageOf` be split into smaller, more focused modules?**
  _Cohesion score 0.1036036036036036 - nodes in this community are weakly interconnected._
- **Should `AppKit` be split into smaller, more focused modules?**
  _Cohesion score 0.05388471177944862 - nodes in this community are weakly interconnected._