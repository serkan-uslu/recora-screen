# Editor interaction and capture validation

## Environment and measured checks

Run date: 2026-09-13. Host: Mac15,8, Apple M3 Max, 64 GiB RAM, macOS 26.4 (25E246). Record the signed application build/commit, media dimensions/fps/duration, display scaling, and whether the preview is warm alongside each desktop result.

| Check | Result | Command / evidence |
| --- | --- | --- |
| Input sampling while main run loop is blocked for 350 ms | Passed: 11 samples | `bash native/check-capture-input.sh` |
| Monitor stops without continued callbacks | Passed | Same check |
| Typing with pointer outside the focused captured window; wrong-window rejection | Passed, pure coordinate/focus cases | Same check |
| Status while media queue is deliberately blocked for 300 ms | Passed: 1,000 reads in 0.21 ms | Same check |
| Click/drag/typing event classification | Passed, mapping check | Same check |
| Native reply JSON and writer protocol | Passed | `CARGO_HOME="$PWD/.cache/cargo" cargo test --manifest-path src-tauri/Cargo.toml native_reply_preserves_protocol` |

The standalone input check had **no Input Monitoring permission**. It verified the live pointer fallback and an explicit `unavailable` state, not an authorized macOS event tap. It did not record screen/audio, change permissions, or measure video-frame latency. The blocked queue test checks status responsiveness; it does not simulate a full disk or measure media synchronization.

## Desktop acceptance record

These rows must be filled from the signed desktop app. A passing build or backend test does not substitute for these gestures.

| Scenario | Required result | Measured result |
| --- | --- | --- |
| Ruler/playhead scrub while paused and playing | Frames update before release; previous playback restored; final error ≤1 frame | User confirmed smooth live timeline scrubbing in the desktop app. Pause/resume and stale-status behavior passed controller tests. Exact native final-target check recorded separately below. |
| Warm slider / preview drag latency | Input-to-render p95 ≤100 ms; record sample count and timing method | Native-only 4K warm update p95 7.50 ms (25 samples). Desktop mixed seeks/updates p95 10.32 ms (291 samples). These measurements exclude the UI/bridge queue; end-to-end result remains unmeasured until timestamped desktop gestures are collected. |
| Repeated visual edits | Player item identity preserved; no black frame or value reset | Native reuse/paused-redraw checks passed. Desktop text add, undo and redo retained item ID `8D45D26C-AEFD-4F9B-9038-F285CB75AF66`; user confirmed smooth sliders/scrub. |
| Slider, camera, text, image gestures | Live move/resize; one undo; Escape/pointer cancellation restores start | User confirmed live slider behavior. Desktop text/image insertion and automatic selection passed; text undo/redo passed. Seven transform/replay checks cover corners, image ratio, fixed text padding and delayed mouseup. Direct canvas gesture confirmation remains pending. |
| Selection / Shift-drag / effect trim | Correct range and selected object; Add zoom / camera actions work | Selection toolbar and existing effects verified in desktop UI. Full Shift-drag/trim gesture matrix remains pending. |
| Camera layouts across cuts/speed | Reopen + undo/redo preserved; transition continuity and short ranges | Six domain/migration checks passed, including history, disjoint ranges, cuts, speed and unsupported versions. Native transitions and shared geometry passed. |
| Retina / portrait / square canvas | Handle geometry matches compositor; image aspect preserved | Native and pure geometry checks passed, including portrait/Retina scaling. Native handles inspected in the desktop preview; full manual display/scaling matrix remains pending. |
| Authorized input tap | Very short click, drag, menu tracking, window move, typing with pointer outside; counts and positions correct | Active in both bounded captures below. Earlier QA capture recorded 3 clicks, 2 drags and 2 typing events. Dedicated very-short-click, menu, moved-window and outside-pointer scenarios remain pending. |
| First pointer after first media frame | ≤200 ms with pointer inside capture bounds; outside pointer remains absent | Passed: first sample 0 ms in both signed-app captures; maximum inter-event gap 34.32 / 35.62 ms. Outside-pointer behavior has only the pure mapping check so far. |
| Pause/resume capture | Metadata and all tracks share the media clock | Passed bounded clock/track checks: 400 ms pause preserved duration exactly at 5,113.4175 / 10,319.4940 ms; metadata stayed monotonic; four separate tracks finalized. A/V perceptual synchronization not measured. |
| Record while editing another project | Edit/save works; recording project locked; Finalizing visible | Concurrent project rename + save passed in 26.95 / 34.38 ms; recording-project mutation rejected as busy. Desktop undo worked in the other editor while Recording HUD remained active. Finalizing phase is covered by service checks; visual capture of the brief phase remains pending. |
| Slow disk and disk full | UI responsive; bounded memory; recoverable media; useful error | Pending |
| Long recording | 60-minute A/V difference ≤80 ms; no duration-dependent memory growth | Pending |
| Native preview/export comparison | Same composition at matched timestamps within codec tolerance | Full native suite passed: 1080p/4K/portrait H.264 with audio, preview pixel parity, cuts/speeds, camera visibility and layouts, text/captions, cursor, backgrounds, cancellation and project switching. |
| Signed package | Bundle verification and DMG; existing signing identity retained | Final DMG and bundle checks passed. Same Apple Development identity retained; screen/input/camera/microphone permissions remained granted after reopening. This is a development-signed build, not a notarized public release. |

Use disposable projects for capture/failure tests. Keep original projects and existing exports intact. Save latency samples, media inspection output, and screenshots with the test artifacts; report unmeasured targets as unmeasured.

Desktop automation could click accessibility controls, insert layers, use menus and inspect screenshots, but coordinate click/drag returned `noWindowsAvailable`. No alternate input-injection mechanism was used. The user's manual slider/scrub confirmation is recorded separately from automated checks. Project menus closed when another opened and on Escape; About opened as a separate dashboard modal, with Medium/contact links; editor Help/author controls were absent.

The 4K warm test uses a synthetic 3840 × 2160 H.264/30 fps screen source with a separate camera track. Native command-to-compositor samples are in the temporary run `screenrec-native-check-6370249E-3478-430F-B149-BEA704124922/preview-metrics.json`. Desktop mixed samples from the 22.30-second 4K QA project and the short display recording are retained in `.cache/acceptance/desktop-native-metrics-build2.json`. Display scanout is outside both timings. The earlier `.cache/acceptance/editor-samples.json` polling run was idle and is not latency evidence.

Final verification: 52 TypeScript regression tests passed (`.cache/acceptance/final-tests.log`), plus the complete native suite (`final-native-all.log`) and 4K preview check (`final-native-4k.log`). Latest warm native 4K p95 was 5.54 ms. Ten ordered rapid-seek bursts finished at the newest target within one frame with the queue drained. An earlier checker incorrectly assumed `async let` launch order was execution order; explicit actor-entry handshakes fixed the checker, without changing production seek behavior.

Final package: `src-tauri/target/release/bundle/dmg/Screen-Recorder_0.1.0_macOS-arm64.dmg`, SHA256 `01cfa4e1f1dd11440057cde7c9eaa4e2ae51dd82544a300d5df54104904fea59`. Signing authority: `Apple Development: Serkan USLU (T254TZSFNR)`. Build and embedded runtime checks are retained in `.cache/acceptance/final-build.log` and `final-bundle.log`.

The packaged stdio MCP server exposed all 49 tools, including camera layouts and preview geometry/selection/metrics; reading the v2 QA project and recording status succeeded (`.cache/acceptance/final-mcp.log`). `graphify update .` completed; its Swift parser reported partial extraction of `native/Bridge.swift`, while the actual Swift compiler and native tests passed.

The final app was left open on `QA editor interactions`, a copy of the original recording with a test title and image. Its persisted edits survived restart. The separate manual question asks for camera/text/image move, corner resize and single-step undo. No timestamped gestures had arrived when the report was written (`final-gesture-samples.json` had zero samples); input-to-compositor p95 is therefore still unmeasured. This does not invalidate the separately measured native-only latency above.

## Signed-app bounded capture reports

Both runs used the existing signed application and already granted macOS permissions. The diagnostic did not request permissions, generate mouse/keyboard input, or alter existing projects. Disposable QA projects and local artifacts remain available for review. Screen capture requested 1920 × 1080 at 30 fps; the camera run used FaceTime HD Camera at 1280 × 720, MacBook Pro Microphone, and system audio (both audio tracks 48 kHz stereo). No Continuity devices were used.

| Run | Outcome | Local report |
| --- | --- | --- |
| 10-second display capture with pause/resume | Passed; 295 pointer samples, first 0 ms, max gap 34.32 ms, authorized tap active, status RPC p95 1.66 ms, stop 98.66 ms | `.cache/acceptance/interactions-014ef9fc-6199-4355-a774-d895d61acb93/result.json` |
| 20-second screen/camera/microphone/system capture with pause/resume | Capture passed; 603 pointer samples, first 0 ms, max gap 35.62 ms, authorized tap active, status RPC p95 1.91 ms, stop 260.02 ms | `.cache/acceptance/interactions-ca7fa2cb-9dc9-4426-aa99-32a1cb084592/recovered-result.json` |

The second diagnostic initially failed **after successful capture** because its report used video-only `media.inspect` on an audio-only MOV. Audio inspection now uses macOS `afinfo`; `recovered-result.json` was reconstructed read-only from the preserved journal, project and media. The original `failure.json` is retained. No repeat capture was needed. Future diagnostic failures preserve incremental `journal.jsonl`, snapshots and the final QA project.

For the camera run, the source duration was 20,069.2584 ms; AVFoundation inspected screen/camera durations were 20,070.0000 / 20,068.3333 ms. `afinfo` estimated microphone/system audio-frame durations at 20,053.333 / 20,096.000 ms. These duration checks do **not** establish presentation-offset alignment, lip sync, or 60-minute drift. No audible/visual synchronization marker or sustained memory measurement was performed. Status RPC latency is also not input-to-render latency.

An earlier intended 30-second QA capture ended cleanly at 17,851.66 ms, with no native error and a final mouse release 8.17 ms before stopping; evidence is consistent with an external Finish action. Its 546 metadata events were monotonic with a 34.33 ms maximum gap. It is not counted as a completed 30-second test.

Run `npx tsx scripts/check-interactions.ts --self-check` without connecting to the app. Use `--capture --seconds 10 --pause-resume` only when a bounded real display recording is intended; camera, microphone and system audio require explicit flags. The diagnostic never launches a replacement app or changes permission settings.
