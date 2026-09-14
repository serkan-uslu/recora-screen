# Privacy

Screen Recorder stores projects and recordings on your Mac. It does not require an account and does not upload recordings to an application server.

## Local processing

Screen, camera, microphone, and system audio are separate files in the project. The floating camera preview and recorder controls are excluded from the screen source. Hiding the camera in the final composition does not stop the camera source recording; use the separate device control to stop camera capture.

Cursor position and sampled button state are recorded to animate the pointer and generate zooms even without Input Monitoring. Optional macOS Input Monitoring permission enables precise click/drag detection through a passive event tap, including short clicks that sampling can miss, and coarse typing-activity markers. Permission and a successfully running monitor are separate states shown by the recording controls. Typed text and key codes are not stored. Visible on-screen text can be part of the screen recording you select. Browser-frame titles use the selected recording window's title or a title you enter.

Whisper inference and silence analysis run locally. Silence cleanup requires a microphone track, protects audible system audio by default, and lets you review proposed cuts before applying them. Transcription can use recorded microphone or system audio. Model and runtime downloads contact their upstream download hosts. After the model has downloaded, local transcription works offline.

## Optional cloud assistant

The assistant is off until you select a provider and supply an API key. Keys are kept in macOS Keychain, never in a project or source-controlled configuration. The assistant sends your message, transcript, and editing context to OpenAI or Anthropic. Provider API usage is billed by that provider. Screen recordings, camera footage, and original audio are not automatically uploaded.

## MCP

The MCP server runs locally over standard input/output and connects to a private per-user socket. Connected clients can read project content, including names, file paths, edit state, transcripts and requested preview frames, and edit/export recordings. `preview_frame` returns a PNG image to the client, not only a file path. A client such as Claude or Codex may send this returned content to its model provider under that client's settings and policies. Review the client's permissions and data settings before connecting sensitive projects; a local MCP transport does not guarantee local model processing.

MCP itself requires no API key in Screen Recorder. Your chosen client's subscription or API usage can cost money separately from this free, MIT-licensed app. In-app provider keys are not needed for a client to use local project, editing, preview and export tools.

Operating-system screen, microphone, camera, and input-monitoring permissions still apply. The app shows recording state and does not bypass these permissions.

## Removal

Delete Project moves its folder and source media to the macOS Trash. Separately exported video files remain at their chosen locations. Provider keys can be removed through Settings. Downloaded models live in `~/Library/Application Support/Screen Recorder/models/` and can be removed in Finder while the app is closed. Uninstalling the app does not delete your projects.
