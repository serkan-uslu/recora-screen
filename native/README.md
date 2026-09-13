# Native media module

`./native/build.sh [arm64|x86_64]` builds a macOS 15+ library at `native/build/libscreenrec.dylib`. The install name is `@rpath/libscreenrec.dylib`; bundle it in `Contents/Frameworks`. Builds replace the output atomically, so a running process can retain its previous mapped library. The app needs screen recording, camera, microphone usage descriptions/permissions and audio/video capture entitlements when sandboxed.

Two C symbols are exported:

```c
void screenrec_attach_window(void *nsWindow);
void screenrec_command(const char *json, void (*callback)(const char *json));
```

Requests are `{id,method,params}`. Every accepted request calls the callback exactly once with `{id,result}` or `{id,error:{code,message}}`. The callback JSON pointer is borrowed for the duration of the callback: the caller must copy it. The incoming pointer is copied immediately. AppKit and AVPlayer state changes run on the main actor; sample writing and compositing run on dedicated serial queues. `screenrec_attach_window` receives the host NSWindow pointer, which the app must keep alive.

Native methods match the server bridge:

- `capabilities`, `permissions.request {kind:screen|camera|microphone|input}`. Listing never prompts. Input monitoring is optional: only cursor position/button state is sampled, no keys.
- `recording.start {projectId,projectDir,settings}`, `pause`, `resume`, `stop`, `status`, `camera {visible?,enabled?,shape?}`. Camera `visible` controls the floating preview; `enabled:false` also stops camera hardware. Status includes `cameraRunning`, the actual AVFoundation capture session state. Camera active ranges describe recoverable source footage; hiding a preview preserves recording. Region coordinates use source logical points.
- `preview.load {project,projectDir}`, `bounds {x,y,width,height}`, `seek {timeMs}`, `play`, `pause`, `status`, `frame {project,projectDir,timeMs,path}`. Bounds use top-left CSS coordinates in the window content; zero dimensions hide the native view. Thumbnails are 960×540 PNGs. Player status is `{timeMs,playing}`.
- `export.start {project,projectDir,path,width,height,jobId}` returns `{started:true,jobId}`. Poll `export.status {jobId}` for `{status,progress,path,error?}`; use `export.cancel {jobId}`. Final output is MP4/H.264/AAC and is moved into place without overwrite after successful rendering. Existing destinations produce `file_exists`.
- `audio.analyze {project,projectDir}` returns microphone/system source-time 20ms RMS dB bins. `audio.prepare {projectDir,source,path}` creates mono 16kHz PCM WAV with track startup gaps preserved. `media.inspect {path}` returns duration, dimensions, frame rate and audio presence.
- `project.trash {path}` uses macOS Trash. `keychain.get|set|delete {provider,key?}` stores provider keys in the macOS Keychain.

Recordings contain separate `media/screen.mov`, optional camera/microphone/system files, and cursor JSON. Every source is normalized to the first captured screen frame using native clocks; pause time is removed identically across tracks. Floating recorder windows are excluded from raw screen frames. Window capture uses an auxiliary audio-only display stream when system audio is requested, so unrelated application audio is included too. Camera hardware gaps stay invisible even if AVFoundation holds the previous decoded frame.

Cursor capture holds at most 60 samples, then appends them to JSON. A recovery metadata snapshot is saved every five seconds; media uses one initial one-second fragment and subsequent ten-second fragments. Recovery must inspect readable media duration and clamp stale snapshot duration to it. Cursor loading tolerates an unclosed array or an incomplete last event. Originals are never rewritten by edits. Camera masks, cursor, zoom easing, text/images and captions use one Core Image compositor for deterministic preview, thumbnails and export. No FFmpeg or browser media renderer is needed.

Run `./native/check.sh` for synthetic source/timeline/mask/visibility/seek parity, 1080p and 4K export, preview/export color parity, audio bins, WAV and path/recovery checks. It writes inspection artifacts to a new temporary directory. `./native/check.sh --capture-check` opens a separate synthetic AppKit test window and records only it for a few seconds with microphone/system audio and pause/resume; existing screen and microphone permissions are required. It never requests camera permission. `native/build/native-check --rpc` accepts newline JSON for diagnostics.

Verified here: native ARM64 build, synthetic 4K/1080p media pipeline, short real screen/microphone/system capture and an initial real-camera recording. Still requires physical-device acceptance testing: the complete camera hardware off/on and gap-export sequence, unplug/reconnect, Intel Macs, extended 4K recording/synchronization, display rearrangement, and crash/disk-full scenarios. Camera sample and SCK clocks are aligned in code; the short recording does not establish long-session synchronization.
