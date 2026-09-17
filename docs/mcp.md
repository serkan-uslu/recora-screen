# MCP setup

Open Recora Screen before connecting and keep it running. Its Node runtime and MCP entry point are bundled, so end users do not install Node. **Settings & MCP → MCP & shortcuts → MCP client** provides separate Codex, Claude Code and Claude Desktop configurations using the running installation's actual paths. Copy the configuration again after moving the app. If the runtime path is unavailable, Settings explains this instead of guessing an installation path.

The examples below assume the app is in `/Applications`. Prefer the generated configuration when using another location: it escapes spaces, quotation marks and shell characters correctly. Preserve your other MCP servers when merging configuration. The server is named `recora-screen`. Earlier app versions used `screen-recorder`, `screenRecorder` or `screen_recorder`; remove an old entry before adding the current configuration so the same server is not listed twice.

Recora Screen is free and MCP requires no API key in the app. Your chosen client's plan or usage charges may apply. In-app OpenAI/Anthropic keys are only needed when invoking the optional cloud assistant; ordinary project/edit/preview/export tools do not require them. See [Privacy](privacy.md) before connecting a cloud model client to sensitive content.

## Codex

Merge this into `~/.codex/config.toml`, or the `config.toml` inside your custom `CODEX_HOME`, preserving existing settings. Reconnect Codex after saving:

```toml
[mcp_servers.recora-screen]
command = "/Applications/Recora Screen.app/Contents/Resources/bin/node"
args = ["/Applications/Recora Screen.app/Contents/Resources/mcp.mjs"]
startup_timeout_sec = 30
tool_timeout_sec = 120
```

Run `codex mcp get recora-screen` to inspect the entry. In a Codex session, use `/mcp` to check the available server. See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp).

## Claude Code

```sh
claude mcp add --transport stdio --scope user recora-screen -- '/Applications/Recora Screen.app/Contents/Resources/bin/node' '/Applications/Recora Screen.app/Contents/Resources/mcp.mjs'
```

This makes the server available to your user account across projects. Run `claude mcp get recora-screen`, then use `/mcp` in Claude Code to check its connection. See the [official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

## Claude Desktop

Merge this entry into `~/Library/Application Support/Claude/claude_desktop_config.json`, preserving your other servers, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "recora-screen": {
      "command": "/Applications/Recora Screen.app/Contents/Resources/bin/node",
      "args": ["/Applications/Recora Screen.app/Contents/Resources/mcp.mjs"]
    }
  }
}
```

See the [local MCP setup guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) for Claude Desktop's configuration and troubleshooting. Use the local desktop client for this stdio setup; this is not a remote HTTPS connector.

## Verify your connection

Use a disposable demo project in each client. A successful configuration parse is only the first check; verify the returned tools and resulting project state as well.

1. Ask the client to use `app_capabilities` and `project_list`. The app must be open and native capture capabilities should be available.
2. Ask it to create a project named **MCP connection check**, then open it with `project_open`. For timeline testing, record a short take in this project or import a test MP4 with `project_import`.
3. Ask it to add a title for the first second with `timeline_apply`, using the latest `expectedRevision`. Confirm the title in the app, then undo with `history_undo` and confirm its removal.
4. Ask it to load the project with `preview_load` and request `preview_frame` at 500 ms. Confirm that an image is returned. The client may send this image to its provider.
5. Ask it to export a 1080p MP4 to a new absolute file path outside project storage. Poll the returned export job with `jobs_get` until it completes, then open the video.

Run these steps separately in Codex, Claude Code and Claude Desktop before claiming all three clients have passed a release's acceptance checks. Record client versions, app version, commit and results in the release validation record. Existing automated MCP protocol checks do not by themselves prove the full user flow in each client.

## Development

Run `npm run dev` first. Use absolute paths to this repository's `resources/bin/node` and `resources/mcp.mjs` in the examples above. `npm run mcp` also starts the source MCP entry point for debugging. Do not run a second project service: the desktop app owns state and the MCP process only connects to it.

For upgrade compatibility, the service keeps its existing per-user Unix socket at `~/Library/Application Support/Screen Recorder/service.sock` with a private directory and file permissions. Closing or reconnecting an MCP client does not stop an ongoing recording. macOS still controls access to screen, camera, microphone, and input events.

`permissions_request` with `kind: "screen"` or `kind: "input"` opens the corresponding System Settings privacy pane if access remains ungranted after the request. The command returns the actual permission state; opening Settings does not grant access. Quit and reopen after granting screen recording. If Settings shows an enabled entry but the app still cannot access it, remove the outdated entry and add the current app build. `input` enables optional typing activity and precise passive click/drag detection. Pointer movement and sampled button state still work without it; very short clicks require the event tap. `recording_status.monitoring` reports whether the monitor actually started, its failure message when applicable, and event counts. No typed text or keycodes are recorded.

## Command contract

Tools expose the same validated commands as the UI. Tool names replace dots and slashes with underscores; for example `project.open` becomes `project_open`. `tools/list` supplies the current JSON Schemas.

| Area           | Examples                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projects       | `project_list`, `project_create`, `project_open`, `project_rename`, `project_save`, `project_import`, `project_delete`                                                      |
| Recording      | `app_capabilities`, `permissions_request`, `recording_start`, `recording_pause`, `recording_resume`, `recording_stop`, `recording_camera`                                   |
| Editing        | `timeline_apply`, `camera_layout_set`, `camera_layout_remove`, `history_undo`, `history_redo`, `asset_import`, `transcript_export`                                          |
| Preview/export | `preview_load`, `preview_draft`, `preview_reset`, `preview_geometry`, `preview_selection`, `preview_seek`, `preview_frame`, `preview_play`, `preview_pause`, `export_start` |
| AI/settings    | `ai_transcribe`, `ai_cleanSilence`, `ai_assistant`, `ai_models_list`, `ai_models_download`, `settings_get`, `settings_update`, `keychain_set`, `keychain_delete`            |
| Jobs           | `jobs_list`, `jobs_get`, `jobs_cancel`                                                                                                                                      |

Read `project_open` before writing and supply its `revision` as `expectedRevision`. Stale revisions fail without changing the project. A `timeline_apply` batch is atomic and uses one undo step. Timed input uses **current output timeline milliseconds**, except `clip.trim`/`clip.insert`'s explicit `sourceStartMs`/`sourceEndMs` and `source.restore`'s removed **source** range. Returned recording annotations use **source milliseconds**; imported audio clip timing stays in **output milliseconds**. When cutting several intervals, submit cuts from the latest interval backwards so earlier cuts do not shift later inputs.

```json
{
  "projectId": "ID_FROM_PROJECT_OPEN",
  "expectedRevision": 7,
  "requestId": "hide-camera-example-1",
  "operations": [{ "type": "camera.hide", "startMs": 10000, "endMs": 20000, "hidden": true }]
}
```

Use a unique `requestId` for a mutation and reuse it only for an identical retry in the same app session. The service retains the latest 1,000 retry receipts. Recording also requires an empty, idle project; export refuses to overwrite existing files.

`timeline_apply` also supports `canvas.update`, `autoZoom.update`, `zoom.update`, `speed`, `clip.trim`, `clip.merge`, `clip.move`, `clip.insert`, and `source.restore`. Use `clip.move` with zero-based `index` and final-order `toIndex`; use `clip.insert` with an imported video/image `assetId`, output `atMs`, and optional `sourceStartMs` / `sourceEndMs`. Inserting inside a clip splits it. `source.restore` accepts an optional output `atMs` to insert missing original footage without reordering retained clips. See the [timeline editing contract](editor-features.md#timeline-commands).

Use `transcript.text` with a cue's `id` and new `text` to edit words without changing source timestamps. Speed changes retime a clip and its associated source audio; imported music/voiceover clips stay anchored to output time. Old projects without a segment speed use 1×. `export_start` derives dimensions from the canvas when both dimensions are omitted; explicit dimensions must be supplied together. The 720p, 1080p, and 4K presets include portrait and square output.

`preview_draft` accepts the same `projectId`, `expectedRevision`, and `operations` as an edit batch, after `preview_load` selects the project. It changes only the native preview: saved edits, revisions, and undo history stay intact. Supply an increasing `sequence` for a gesture stream. Use `timeline_apply` to commit or `preview_reset` with the project revision and a later sequence to restore the saved composition. Send at most one draft request at a time and coalesce interactive updates. Visual drafts reuse the current player item and never enter exports or undo history. `preview_geometry` returns current visible object bounds; `preview_selection` selects a camera or overlay for native editing handles (or accepts `null` to clear selection).

`preview_metrics` returns bounded latency samples and p95, and accepts `reset: true` to begin a measurement. `latencyMs` measures native command arrival to compositor completion. Optional `inputAtMs` (Unix milliseconds) on seek/draft/reset also measures input-to-compositor time, including the controller and bridge; neither measure includes display scanout. `preview_status.itemId` identifies the player item for reuse checks. `preview_selection.color` accepts a hex color for native handles.

`camera_layout_set` accepts `projectId`, `expectedRevision`, `startMs`, `endMs`, and a `settings` patch (`x`, `y`, `size`, `shape`, `shadow`). Its times refer to the output timeline, like other range edits. `camera_layout_remove` takes the same range without settings to restore the base camera layout there. Both also work as operations inside `timeline_apply`. Persisted ranges use source time, retain cut gaps, and animate position/size with short smooth transitions. Global `camera.update` and `camera.hide` retain their existing meanings.

`recording_status.phase` distinguishes `starting`, `recording`, `paused`, `finalizing`, and `idle`. During recording or finalization, other projects remain editable and the recording project stays protected. `recording_stop` still waits for and returns the final Project; it does not return a Job. Disconnecting a client does not stop recording.

AI, model downloads, and exports return a Job with `id`. Poll `jobs_get` with `{ "jobId": "..." }` until completed, failed, or cancelled. `jobs_cancel` cancels a running operation. Export paths must be absolute, new `.mp4` or `.gif` files matching the requested format, outside project storage. `preview_frame` returns a PNG image as MCP image content, plus its local path.

Example prompt: “Open my React tutorial. Suggest silence cuts, preserve system audio, and show me the proposed intervals. Then hide my camera between 10 and 20 seconds, add a title for the first 3 seconds, and export a 1080p MP4 to Movies.”

Local transcription needs a downloaded Whisper model and an audio track. Silence cleanup requires a microphone track; it protects audible system audio by default and returns proposed cuts unless you request application. Review those intervals before committing them. The optional in-app cloud assistant uses the same editing validation and has separate provider billing. Connected model clients may send returned transcript or preview content to their provider; see [Privacy](privacy.md).

## Additional editor features

See [timeline editing, arrows, privacy covers, imported audio, GIF export and cursor/camera controls](editor-features.md) for the UI workflow, exact operation fields, timing rules and limits. All edits use `timeline_apply`, retain revision checks and support undo. `asset_import` accepts image, audio and video kinds; `export_start` accepts `format: "gif"`, `gifFps` and `loop`.
