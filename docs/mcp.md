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

## Command contract

Tools expose the same validated commands as the UI. Tool names replace dots and slashes with underscores; for example `project.open` becomes `project_open`. `tools/list` supplies the current JSON Schemas.

| Area | Examples |
| --- | --- |
| Projects | `project_list`, `project_create`, `project_open`, `project_rename`, `project_save`, `project_import`, `project_delete` |
| Recording | `app_capabilities`, `permissions_request`, `recording_start`, `recording_pause`, `recording_resume`, `recording_stop`, `recording_camera` |
| Editing | `timeline_apply`, `history_undo`, `history_redo`, `asset_import`, `transcript_export` |
| Preview/export | `preview_load`, `preview_seek`, `preview_frame`, `preview_play`, `preview_pause`, `export_start` |
| AI/settings | `ai_transcribe`, `ai_cleanSilence`, `ai_assistant`, `ai_models_list`, `ai_models_download`, `settings_get`, `settings_update`, `keychain_set`, `keychain_delete` |
| Jobs | `jobs_list`, `jobs_get`, `jobs_cancel` |

Read `project_open` before writing and supply its `revision` as `expectedRevision`. Stale revisions fail without changing the project. A `timeline_apply` batch is atomic and uses one undo step. All timed input uses **current output timeline milliseconds**. Returned project annotations use **source milliseconds**. When cutting several intervals, submit cuts from the latest interval backwards so earlier cuts do not shift later inputs.

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

AI, model downloads, and exports return a Job with `id`. Poll `jobs_get` with `{ "jobId": "..." }` until completed, failed, or cancelled. `jobs_cancel` cancels a running operation. Export paths must be absolute, new `.mp4` files outside project storage. `preview_frame` returns a PNG image as MCP image content, plus its local path.

Example prompt: “Open my React tutorial. Suggest silence cuts, preserve system audio, and show me the proposed intervals. Then hide my camera between 10 and 20 seconds, add a title for the first 3 seconds, and export a 1080p MP4 to Movies.”

The optional in-app cloud assistant uses the same editing validation. MCP itself does not need a cloud API key. Connected model clients may send returned transcript or preview content to their provider; see [Privacy](privacy.md).
