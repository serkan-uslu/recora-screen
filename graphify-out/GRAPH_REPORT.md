# Graph Report - screen-recorder  (2026-09-13)

## Corpus Check
- 89 files · ~55,557 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 790 nodes · 1535 edges · 51 communities (26 shown, 17 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 100 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- .main
- App.tsx
- makeComposition
- CaptureEngine
- check-desktop-ai.ts
- validation.ts
- scripts
- bundle
- Screen Recorder
- service.test.ts
- main.rs
- compilerOptions
- AppError
- devDependencies
- ApplicationService
- Jobs
- permissions
- verify-bundle.mjs
- types.ts
- prepare-runtime.mjs
- prepare-whisper.mjs
- desktop.mjs
- build.sh
- check.sh script
- native/README.md
- screen-recorder
- service.ts
- edits.ts
- bundle-notices.mjs
- NativeCheck
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

## God Nodes (most connected - your core abstractions)
1. `AppError` - 40 edges
2. `CaptureEngine` - 37 edges
3. `NativeFailure` - 29 edges
4. `ApplicationService` - 26 edges
5. `ProjectStore` - 22 edges
6. `makeComposition()` - 21 edges
7. `App()` - 21 edges
8. `NativeApp` - 18 edges
9. `duration()` - 18 edges
10. `ScreenrecCompositor` - 17 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `duration()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `ExportDialog()` --calls--> `duration()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `TranscriptPanel()` --calls--> `timelineTime()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `screenrec_command()` --calls--> `NativeFailure`  [INFERRED]
  native/Bridge.swift → native/Models.swift
- `makeComposition()` --calls--> `mediaTime()`  [INFERRED]
  native/Composition.swift → native/Models.swift

## Import Cycles
- None detected.

## Communities (51 total, 17 thin omitted)

### Community 0 - ".main"
Cohesion: 0.07
Nodes (67): AVAssetExportSession, AVAssetReader, AVAssetReaderTrackOutput, AVPlayer, AVPlayerItem, Codable, Error, Foundation (+59 more)

### Community 1 - "App.tsx"
Cohesion: 0.07
Nodes (36): formatTime(), RpcResponse, command(), desktop, messageOf(), pickPath(), retriable, App() (+28 more)

### Community 2 - "makeComposition"
Cohesion: 0.05
Nodes (52): AppKit, AVAsynchronousVideoCompositionRequest, AVFoundation, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, AVVideoCompositing, AVVideoCompositionInstructionProtocol (+44 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.07
Nodes (41): AVAssetWriter, AVAssetWriterInput, AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CGPoint (+33 more)

### Community 4 - "check-desktop-ai.ts"
Cohesion: 0.08
Nodes (24): cachedModel, client, dataDir, env, fixture, installedModel, probe, resources (+16 more)

### Community 5 - "validation.ts"
Cohesion: 0.08
Nodes (24): appDataDir, Document, projectsDir, socketPath, audio, camera, captions, captureSchema (+16 more)

### Community 6 - "scripts"
Cohesion: 0.05
Nodes (42): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+34 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (37): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+29 more)

### Community 8 - "Screen Recorder"
Cohesion: 0.07
Nodes (24): Claude Code, Claude Desktop, Codex, Command contract, Development, MCP setup, Local processing, MCP (+16 more)

### Community 9 - "service.test.ts"
Cohesion: 0.10
Nodes (22): finish(), client, isolated, server, service, pending, send(), service (+14 more)

### Community 10 - "main.rs"
Cohesion: 0.12
Nodes (23): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+15 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (24): DOM, DOM.Iterable, ES2023, node, scripts/*.ts, server, shared, src (+16 more)

### Community 12 - "AppError"
Cohesion: 0.17
Nodes (5): ProjectStore, AppError, checkRevision(), Project, ProjectSummary

### Community 13 - "devDependencies"
Cohesion: 0.11
Nodes (19): esbuild, devDependencies, esbuild, @tauri-apps/cli, tsx, @types/node, @types/react, @types/react-dom (+11 more)

### Community 14 - "ApplicationService"
Cohesion: 0.26
Nodes (4): cursorClicks(), ready, ApplicationService, setup()

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "types.ts"
Cohesion: 0.09
Nodes (19): artifacts, client, native, pattern, created, env, resources, video (+11 more)

### Community 19 - "prepare-runtime.mjs"
Cohesion: 0.29
Nodes (6): archive, bytes, cache, extracted, marker, root

### Community 20 - "prepare-whisper.mjs"
Cohesion: 0.40
Nodes (4): buildDir, checkout, current, output

### Community 21 - "desktop.mjs"
Cohesion: 0.50
Nodes (3): args, child, env

### Community 29 - "service.ts"
Cohesion: 0.12
Nodes (18): eventSchema, AudioWindow, absolutePath, emptyRecording, model, none, projectId, provider (+10 more)

### Community 30 - "edits.ts"
Cohesion: 0.29
Nodes (15): assistant(), applyEdits(), checkedRange(), found(), mergeRanges(), outputRanges(), silenceCuts(), sourceSpan() (+7 more)

### Community 31 - "bundle-notices.mjs"
Cohesion: 0.28
Nodes (10): json(), licenseFiles(), main(), missing, npmNotices(), root, rustNotices(), section() (+2 more)

### Community 32 - "NativeCheck"
Cohesion: 0.36
Nodes (5): CGImage, NativeCheck, CGRect, Data, Int

### Community 33 - "package-dmg.mjs"
Cohesion: 0.25
Nodes (7): app, bundleRoot, output, outputDirectory, pending, root, { version }

## Knowledge Gaps
- **237 isolated node(s):** `Security`, `CoreMedia`, `CoreText`, `.sourcePixelBufferAttributes`, `.requiredPixelBufferAttributesForRenderContext` (+232 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 359 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `duration()` connect `edits.ts` to `App.tsx`, `check-desktop-ai.ts`, `validation.ts`, `AppError`, `ApplicationService`, `types.ts`, `service.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `CaptureEngine` connect `CaptureEngine` to `.main`, `makeComposition`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `AppError` connect `AppError` to `check-desktop-ai.ts`, `validation.ts`, `service.test.ts`, `ApplicationService`, `Jobs`, `types.ts`, `service.ts`, `edits.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 21 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Security`, `CoreMedia`, `CoreText` to the rest of the system?**
  _237 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `.main` be split into smaller, more focused modules?**
  _Cohesion score 0.07111372318542462 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06801346801346801 - nodes in this community are weakly interconnected._