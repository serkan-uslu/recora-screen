# Architecture and contribution guide

Start with `src/App.tsx`: it composes screens and dialogs. It does not own project persistence or send editing commands.

```text
React views → React controllers → command service → desktop/HTTP transport
                                                       ↓
UI / MCP / socket → CommandController → ApplicationService
                                           ├─ domain edits and cursor analysis
                                           ├─ ProjectStore and Jobs
                                           ├─ local / optional cloud AI
                                           └─ native Swift recording and composition
```

| Directory                  | Responsibility                                                |
| -------------------------- | ------------------------------------------------------------- |
| `src/components/atoms`     | Small visual controls: switches and icon buttons              |
| `src/components/molecules` | Labeled fields, sliders and panel summaries                   |
| `src/components/organisms` | Composed header, dialogs and author footer                    |
| `src/features`             | Project, editor, recording, export, settings and help views   |
| `src/controllers`          | React state, lifecycle, command orchestration and UI actions  |
| `src/services`             | Command envelopes, retry IDs and response/error normalization |
| `src/infrastructure`       | Tauri, file dialogs, URL opening and HTTP transport           |
| `server/controllers`       | Validation, command ordering and idempotency                  |
| `server/contracts`         | Shared command and persisted-data schemas                     |
| `server/services`          | Application use cases, AI and background jobs                 |
| `server/domain`            | Timeline edits and cursor analysis                            |
| `server/infrastructure`    | Atomic project storage and local socket transport             |
| `shared`                   | Project types, timeline mapping and author metadata           |
| `design-system`            | Shared theme tokens                                           |
| `website`                  | Independent, static product website                           |

`server/service.ts` and `server/rpc.ts` remain compatibility exports for existing integrations. Entry points remain `server/main.ts`, `server/browser.ts` and `server/mcp.ts`.

## Adding behavior

1. Define and validate a command in `server/contracts/commands.ts`. Keep persistence validation in `validation.ts`.
2. Implement its use case in `ApplicationService`, using domain functions for edits and `ProjectStore` for persistence. Do not write project JSON in a view or MCP handler.
3. Expose a controller callback. A feature view receives only the state/actions it needs; composed views use `Pick<StudioController, ...>`.
4. Reuse a visual control when the same interaction already exists. Feature-specific controls stay with the feature. Avoid generic repositories, base controllers or extra factories without a second concrete need.
5. Add a regression check for behavior that crosses a boundary, then run `npm test` and `npm run build`.

The React studio controller coordinates the active project, recording and jobs. Capture permissions and native preview each have their own lifecycle controller. Video frames stay in Swift; they do not pass through React or Node.

## Interactive preview and recording

A gesture has a temporary preview state and one persisted edit. Controllers coalesce pointer updates, keep the latest pending draft, and commit once on release. Cancellation restores the saved composition. Project/revision/sequence guards reject stale drafts. Playback and geometry subscriptions do not need to rebuild the inspector.

Swift keeps the current `AVPlayerItem` for visual edits. It replaces the item's video composition to redraw a paused frame and updates the audio mix for volume changes. Media tracks rebuild only when source or timeline structure changes. One seek runs at a time and chases the latest requested position. The compositor and native selection handles share geometry; DOM handlers supply input through the transparent preview surface. Export builds from saved project state.

Camera layouts are source-time intervals in project format v2. The domain maps selected output ranges through cuts/speed, splits overlaps, and preserves unaffected layouts. Preview/export resolve the same short output-time transitions. v1 migration upgrades current documents, automatic backups, and undo/redo snapshots; the originals are archived separately. Unsupported versions never trigger an older-backup fallback.

The timeline is an ordered sequence of source ranges. A segment without `assetId` reads the original recording; a segment with `assetId` reads an imported video or image. Reordering preserves source-bound annotations, while cuts and splits act on the selected output occurrence. Insertion splits the containing segment. Native composition shares this order across preview and export, retimes embedded audio with its video, and renders still images for their segment duration. Original camera, cursor, captions and effects are skipped for inserted media; the canvas remains global. Separately imported audio clips use output time and do not move when the video sequence changes.

Commands serialize per project and, for recorder controls, per recording device. The active recording project remains busy while other projects can be edited. Recording start/stop are asynchronous; the existing stop result remains the completed project. Native capture preparation and file work run outside the main actor. A dedicated input run loop handles pointer sampling and passive input taps before media starts. Only pointer geometry, clicks, drags and typing timing are retained. A small locked status snapshot is readable even when the media queue is busy. Rust forwards native replies to Node on a writer thread so pipe backpressure cannot freeze the app window.

## Invariants

- UI and MCP share validation, revision checks, serialization and retry receipts.
- Failed saves must block project switching. Source media is never overwritten by an edit.
- Preview drafts do not persist or add undo history; committing a gesture uses the normal editing command.
- Recordings and exports protect their own project. Unrelated projects remain editable. Permission state and actual input-monitor state are distinct.
- A retry ID is bound to one command and parameter set. Session receipts retain the latest 1,000 requests, as before.
- Do not replace macOS signing identities casually: permission grants depend on the signed app identity.

## Checks

`npm test` covers persistence/recovery, edits and timing, revision conflicts, MCP parity, jobs and AI atomicity. `npm run test:site` checks event filtering and analytics failure isolation. `npm run typecheck` includes both the desktop UI and website. Native acceptance tools remain documented in the main README; run them when changing native recording/composition.

Interactive and capture validation, including unmeasured acceptance targets, is tracked in [Editor validation](editor-validation.md).
