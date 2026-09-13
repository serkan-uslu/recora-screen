# MCP setup

Open Screen Recorder once before connecting. Its Node runtime and MCP entry point are bundled, so end users do not install Node. Settings → MCP provides the configuration for the running installation.

The examples below assume the app is in `/Applications`. Adjust both paths together if you keep it elsewhere.

## Codex

Add this to your Codex MCP configuration:

```toml
[mcp_servers.screen_recorder]
command = "/Applications/Screen Recorder.app/Contents/Resources/bin/node"
args = ["/Applications/Screen Recorder.app/Contents/Resources/mcp.mjs"]
startup_timeout_sec = 30
tool_timeout_sec = 120
```

See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp).

## Claude Code

```sh
claude mcp add --transport stdio screen-recorder -- "/Applications/Screen Recorder.app/Contents/Resources/bin/node" "/Applications/Screen Recorder.app/Contents/Resources/mcp.mjs"
```

See the [official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

## Claude Desktop

Merge this entry into `~/Library/Application Support/Claude/claude_desktop_config.json`, preserving your other servers, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "screen-recorder": {
      "command": "/Applications/Screen Recorder.app/Contents/Resources/bin/node",
      "args": ["/Applications/Screen Recorder.app/Contents/Resources/mcp.mjs"]
    }
  }
}
```

## Development

Run `npm run dev` first. Use absolute paths to this repository's `resources/bin/node` and `resources/mcp.mjs` in the examples above. `npm run mcp` also starts the source MCP entry point for debugging. Do not run a second project service: the desktop app owns state and the MCP process only connects to it.

The service uses a per-user Unix socket at `~/Library/Application Support/Screen Recorder/service.sock` with a private directory and file permissions. Closing or reconnecting an MCP client does not stop an ongoing recording. macOS still controls access to screen, camera, microphone, and input events.

`permissions_request` with `kind: "screen"` or `kind: "input"` opens the corresponding System Settings privacy pane if access remains ungranted after the request. The command returns the actual permission state; opening Settings does not grant access. Quit and reopen after granting screen recording. If Settings shows an enabled entry but the app still cannot access it, remove the outdated entry and add the current app build. `input` requests optional typing-activity detection; mouse movement and click capture work independently of this permission.

## Command contract

Tools expose the same validated commands as the UI. Tool names replace dots and slashes with underscores; for example `project.open` becomes `project_open`. `tools/list` supplies the current JSON Schemas.

| Area | Examples |
| --- | --- |
| Projects | `project_list`, `project_create`, `project_open`, `project_rename`, `project_save`, `project_import`, `project_delete` |
| Recording | `app_capabilities`, `permissions_request`, `recording_start`, `recording_pause`, `recording_resume`, `recording_stop`, `recording_camera` |
| Editing | `timeline_apply`, `history_undo`, `history_redo`, `asset_import`, `transcript_export` |
| Preview/export | `preview_load`, `preview_draft`, `preview_seek`, `preview_frame`, `preview_play`, `preview_pause`, `export_start` |
| AI/settings | `ai_transcribe`, `ai_cleanSilence`, `ai_assistant`, `ai_models_list`, `ai_models_download`, `settings_get`, `settings_update`, `keychain_set`, `keychain_delete` |
| Jobs | `jobs_list`, `jobs_get`, `jobs_cancel` |

Read `project_open` before writing and supply its `revision` as `expectedRevision`. Stale revisions fail without changing the project. A `timeline_apply` batch is atomic and uses one undo step. Timed input uses **current output timeline milliseconds**, except `clip.trim`'s explicit `sourceStartMs`/`sourceEndMs` and `source.restore`'s removed **source** range. Returned project annotations use **source milliseconds**. When cutting several intervals, submit cuts from the latest interval backwards so earlier cuts do not shift later inputs.

```json
{
  "projectId": "ID_FROM_PROJECT_OPEN",
  "expectedRevision": 7,
  "requestId": "hide-camera-example-1",
  "operations": [
    { "type": "camera.hide", "startMs": 10000, "endMs": 20000, "hidden": true }
  ]
}
```

Use a unique `requestId` for a mutation and reuse it only for an identical retry in the same app session. The service retains the latest 1,000 retry receipts. Recording also requires an empty, idle project; export refuses to overwrite existing files.

`timeline_apply` also supports `canvas.update`, `autoZoom.update`, `zoom.update`, `speed`, `clip.trim`, `clip.merge`, and `source.restore`. Use `transcript.text` with a cue's `id` and new `text` to edit words without changing source timestamps. Speed changes apply to every media track through the same mapping; old projects without a segment speed use 1×. `export_start` derives dimensions from the canvas when both dimensions are omitted; explicit dimensions must be supplied together. The 720p, 1080p, and 4K presets include portrait and square output.

`preview_draft` accepts the same `projectId`, `expectedRevision`, and `operations` as an edit batch, after `preview_load` selects the project. It changes only the native preview: saved edits, revisions, and undo history stay intact. Use `timeline_apply` to commit or `preview_load` to restore the saved composition. Send at most one draft request at a time and coalesce interactive updates.

AI, model downloads, and exports return a Job with `id`. Poll `jobs_get` with `{ "jobId": "..." }` until completed, failed, or cancelled. `jobs_cancel` cancels a running operation. Export paths must be absolute, new `.mp4` files outside project storage. `preview_frame` returns a PNG image as MCP image content, plus its local path.

Example prompt: “Open my React tutorial. Suggest silence cuts, preserve system audio, and show me the proposed intervals. Then hide my camera between 10 and 20 seconds, add a title for the first 3 seconds, and export a 1080p MP4 to Movies.”

The optional in-app cloud assistant uses the same editing validation. MCP itself does not need a cloud API key. Connected model clients may send returned transcript or preview content to their provider; see [Privacy](privacy.md).
