# Graph Report - screen-recorder  (2026-09-13)

## Corpus Check
- 48 files · ~44,391 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 698 nodes · 1429 edges · 29 communities (22 shown, 4 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 104 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- .main
- App.tsx
- makeComposition
- CaptureEngine
- edits.ts
- service.ts
- scripts
- bundle
- Screen Recorder
- rpc.ts
- main.rs
- compilerOptions
- AppError
- devDependencies
- ApplicationService
- Jobs
- permissions
- verify-bundle.mjs
- Bridge.swift
- prepare-runtime.mjs
- prepare-whisper.mjs
- desktop.mjs
- build.sh
- check.sh script
- native/README.md
- screen-recorder

## God Nodes (most connected - your core abstractions)
1. `AppError` - 40 edges
2. `CaptureEngine` - 36 edges
3. `NativeFailure` - 29 edges
4. `ApplicationService` - 26 edges
5. `ProjectStore` - 22 edges
6. `makeComposition()` - 21 edges
7. `App()` - 21 edges
8. `NativeApp` - 18 edges
9. `ScreenrecCompositor` - 17 edges
10. `scripts` - 17 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `duration()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `ExportDialog()` --calls--> `duration()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `TranscriptPanel()` --calls--> `timelineTime()`  [EXTRACTED]
  src/App.tsx → shared/timeline.ts
- `audioReader()` --calls--> `NativeFailure`  [INFERRED]
  native/Audio.swift → native/Models.swift
- `pcmData()` --calls--> `NativeFailure`  [INFERRED]
  native/Audio.swift → native/Models.swift

## Import Cycles
- None detected.

## Communities (29 total, 4 thin omitted)

### Community 0 - ".main"
Cohesion: 0.06
Nodes (74): AVAssetExportSession, AVAssetReader, AVAssetReaderTrackOutput, AVPlayer, AVPlayerItem, Codable, Foundation, analyzeAudio() (+66 more)

### Community 1 - "App.tsx"
Cohesion: 0.05
Nodes (50): formatTime(), AppCapabilities, Asset, CameraSettings, CaptureSettings, CaptureSource, Device, EditOperation (+42 more)

### Community 2 - "makeComposition"
Cohesion: 0.06
Nodes (43): AppKit, AVAsynchronousVideoCompositionRequest, AVFoundation, AVMutableAudioMix, AVMutableComposition, AVMutableVideoComposition, AVVideoCompositing, AVVideoCompositionInstructionProtocol (+35 more)

### Community 3 - "CaptureEngine"
Cohesion: 0.09
Nodes (37): AVAssetWriter, AVAssetWriterInput, AVCaptureConnection, AVCaptureOutput, AVCaptureSession, AVCaptureVideoDataOutputSampleBufferDelegate, CaptureSettings, CGSize (+29 more)

### Community 4 - "edits.ts"
Cohesion: 0.08
Nodes (31): created, env, video, ai, audio, directory, original, text (+23 more)

### Community 5 - "service.ts"
Cohesion: 0.06
Nodes (41): eventSchema, AudioWindow, absolutePath, emptyRecording, model, NativeCall, none, projectId (+33 more)

### Community 6 - "scripts"
Cohesion: 0.05
Nodes (42): lucide-react, @modelcontextprotocol/sdk, dependencies, lucide-react, @modelcontextprotocol/sdk, react, react-dom, @tauri-apps/api (+34 more)

### Community 7 - "bundle"
Cohesion: 0.05
Nodes (36): app, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, ../native/build/libscreenrec.dylib, app, security (+28 more)

### Community 8 - "Screen Recorder"
Cohesion: 0.07
Nodes (24): Claude Code, Claude Desktop, Codex, Command contract, Development, MCP setup, Local processing, MCP (+16 more)

### Community 9 - "rpc.ts"
Cohesion: 0.12
Nodes (18): client, isolated, server, service, pending, send(), service, callAppTool() (+10 more)

### Community 10 - "main.rs"
Cohesion: 0.12
Nodes (23): AppHandle, Arc, Box, c_char, Child, ChildStdin, Mutex, Reply (+15 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2023, node, server, shared, src, vite/client (+15 more)

### Community 12 - "AppError"
Cohesion: 0.21
Nodes (4): ProjectStore, AppError, checkRevision(), Project

### Community 13 - "devDependencies"
Cohesion: 0.11
Nodes (19): esbuild, devDependencies, esbuild, @tauri-apps/cli, tsx, @types/node, @types/react, @types/react-dom (+11 more)

### Community 14 - "ApplicationService"
Cohesion: 0.23
Nodes (4): cursorClicks(), ready, ApplicationService, setup()

### Community 15 - "Jobs"
Cohesion: 0.19
Nodes (3): Jobs, atomicJSON(), Job

### Community 16 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, dialog:allow-open, dialog:allow-save, main, opener:allow-open-path, opener:allow-reveal-item-in-dir, description, identifier (+3 more)

### Community 17 - "verify-bundle.mjs"
Cohesion: 0.35
Nodes (10): binariesIn(), walk(), dependencies(), inside(), portableReference(), run(), runpaths(), systemPath() (+2 more)

### Community 18 - "Bridge.swift"
Cohesion: 0.22
Nodes (8): CChar, screenrec_attach_window(), screenrec_command(), NativeCallback, ScreenCaptureKit, Security, UnsafeMutableRawPointer, UnsafePointer

### Community 19 - "prepare-runtime.mjs"
Cohesion: 0.29
Nodes (6): archive, bytes, cache, extracted, marker, root

### Community 20 - "prepare-whisper.mjs"
Cohesion: 0.40
Nodes (4): buildDir, checkout, current, output

### Community 21 - "desktop.mjs"
Cohesion: 0.50
Nodes (3): args, child, env

## Knowledge Gaps
- **196 isolated node(s):** `Security`, `CoreMedia`, `CoreText`, `.sourcePixelBufferAttributes`, `.requiredPixelBufferAttributesForRenderContext` (+191 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 297 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CaptureEngine` connect `CaptureEngine` to `.main`, `makeComposition`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `duration()` connect `edits.ts` to `App.tsx`, `service.ts`, `ApplicationService`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `NativeFailure` connect `CaptureEngine` to `.main`, `Bridge.swift`, `makeComposition`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `NativeFailure` (e.g. with `analyzeAudio()` and `audioReader()`) actually correct?**
  _`NativeFailure` has 21 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Security`, `CoreMedia`, `CoreText` to the rest of the system?**
  _196 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `.main` be split into smaller, more focused modules?**
  _Cohesion score 0.05605124685426676 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05093167701863354 - nodes in this community are weakly interconnected._