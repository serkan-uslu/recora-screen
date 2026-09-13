# Privacy

Screen Recorder stores projects and recordings on your Mac. It does not require an account and does not upload recordings to an application server.

## Local processing

Screen, camera, microphone, and system audio are separate files in the project. The floating camera preview and recorder controls are excluded from the screen source. Hiding the camera in the final composition does not stop the camera source recording; use the separate device control to stop camera capture.

Cursor position and clicks are recorded to animate the pointer and generate zooms. Text typed into other applications is not collected as keyboard event data. Visible on-screen text can be part of the screen recording you select.

Whisper inference and silence analysis run locally. Model and runtime downloads contact their upstream download hosts. After the model has downloaded, local transcription works offline.

## Optional cloud assistant

The assistant is off until you select a provider and supply an API key. Keys are kept in macOS Keychain, never in a project or source-controlled configuration. The assistant sends your message, transcript, and editing context to OpenAI or Anthropic. Provider API usage is billed by that provider. Screen recordings, camera footage, and original audio are not automatically uploaded.

## MCP

The MCP server runs locally over standard input/output and connects to a private per-user socket. Connected clients can read project content, including transcripts and requested preview frames, and edit/export recordings. The MCP client and its model provider may process content returned by tools according to their own settings.

Operating-system screen, microphone, camera, and input-monitoring permissions still apply. The app shows recording state and does not bypass these permissions.

## Removal

Delete Project moves its folder and source media to the macOS Trash. Separately exported video files remain at their chosen locations. Provider keys can be removed through Settings. Downloaded models live in `~/Library/Application Support/Screen Recorder/models/` and can be removed in Finder while the app is closed. Uninstalling the app does not delete your projects.
