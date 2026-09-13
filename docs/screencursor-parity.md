# ScreenCursor feature parity

Reference review: 13 September 2026. This comparison uses ScreenCursor's public product pages and visible frames of its linked demonstration, not access to its paid extension.

Sources: [product features](https://screencursor.com/), [vendor comparison](https://screencursor.com/screen-studio-alternative), and [55-second demonstration](https://www.youtube.com/watch?v=whCmzR1mr2A).

## What the reference demonstrates

| Video position | Observed behavior | Required behavior here |
| --- | --- | --- |
| [00:10](https://www.youtube.com/watch?v=whCmzR1mr2A&t=10s) | The view closes in on a spreadsheet menu interaction. | Anticipate an interaction, hold the focus, then follow the pointer smoothly. |
| [00:20](https://www.youtube.com/watch?v=whCmzR1mr2A&t=20s) | Selected zoom has depth, duration, and a follow-cursor control; zoom intervals occupy their own timeline lane. | Edit zoom properties in place, drag or resize their intervals, and preserve one undo step per completed gesture. |
| [00:25](https://www.youtube.com/watch?v=whCmzR1mr2A&t=25s) | Snappy and Gentle motion choices are visible. | Offer both motion profiles for automatic and individual zooms. |
| [00:30](https://www.youtube.com/watch?v=whCmzR1mr2A&t=30s) | Aspect presets, wallpaper/gradient/color/hidden backgrounds, blur, and browser-frame choices are visible. | Compose the recording inside an editable canvas with matching preview and export. |
| [00:40](https://www.youtube.com/watch?v=whCmzR1mr2A&t=40s) | Clip cutting and timeline controls are visible alongside the framing panel. | Trim, split, delete, and change playback speed without shifting independent layers out of sync. |
| [00:45](https://www.youtube.com/watch?v=whCmzR1mr2A&t=45s) | The clip menu exposes playback speed, split, delete, and merge with the previous or next clip. | Provide contextual operations with source-contiguity and speed checks for merging. |
| [00:50](https://www.youtube.com/watch?v=whCmzR1mr2A&t=50s) | A removed interval is striped and the demonstration describes merging it back. | Restore removed source intervals, extend clip edges into available gaps, and merge compatible adjacent clips. |

The product page additionally describes a three-second countdown, automatic treatment of clicks/drags/typing, adjustable motion, local processing, and MP4 export. These are behavior requirements, not a request to copy its artwork or interface branding.

## Implementation and acceptance

1. **Automatic framing:** preserve pointer metadata and coarse typing-activity markers without storing typed text or key codes. Generate editable zooms after recording; expose redetection and lead/hold/gap/depth/motion/follow controls. Recording must remain usable when optional input permission is denied.
2. **Canvas:** provide source, 16:9, 9:16, 1:1, and 4:5 output ratios; original procedural wallpaper presets, gradients, solid color, custom project-owned images, background blur, screen padding, corner rounding, shadow, and browser/minimal/no frame. Frame title comes from the chosen recording window or an editable title. A desktop window title does not guarantee a browser tab's current URL.
3. **Timeline:** add editable zooms, clip speed, trim handles, restoration, and merging. Cuts, speed changes, subtitles, camera visibility, pointer movement, and effects share source/output mapping. Original recordings remain unchanged. Editing only transcript text must never remap its timestamps.
4. **Export and MCP:** every persisted setting uses validated commands shared by UI and MCP, revision checks, and grouped undo. Portrait and square composition must keep its ratio in preview, image frames, and final H.264/AAC export. Existing version-1 project folders must reopen with their prior appearance and timing.

Use `npm test`, `npm run test:native`, and the isolated real-app check `npm run test:desktop -- /absolute/path/to/synthetic.mp4` for regression checks. Hardware and release criteria remain in [release.md](release.md); synthetic checks do not replace permission, long-recording, or clean-Mac validation.

## Verified in the development package

- 26 TypeScript checks pass, including source/output mapping with mixed speeds, undo, old project compatibility, cursor activity, transient preview cancellation ordering, and shared UI/MCP validation.
- Native checks pass for canvas composition, portrait 4K, legacy 4:3 thumbnails, deterministic zoom seeks, and repeated pitch-preserving mixed-speed audio exports. Audio tracks are grouped by source and speed to avoid AVFoundation truncating audio when one track changes rates.
- The actual bundled Node/MCP client passes integration checks against the release app with 43 tools, including portrait preview/export, speed edits, source-preserving transcript text edits, retry IDs, reconnects, and project deletion preserving external output.
- Isolated browser checks cover canvas, zoom properties, speed, partial-transcript edits, trim/restoration, and both merge directions. Actual zoom move, zoom resize, and clip trim pointer gestures each produce one saved revision and one undo entry. Native UI checks confirm the composed portrait image, wallpaper switching, a slider edit and its single undo, editable zoom timing, export presets, and preview hiding behind a dialog. A transient background change was visually confirmed in the native compositor and cancelled back to the saved wallpaper without changing project state. Native `App.drag` automation returned `noWindowsAvailable`; pointer gesture checks used the browser UI.

Real-input automatic framing and the recording countdown still need the hardware/permission checks listed in the release document. This comparison is an implemented macOS feature set with the verification above, not a claim that the competitor's paid product or every hardware scenario has been exhaustively tested.

## Delivery boundary

The agreed product remains a macOS desktop app with camera, separate audio, local transcription, optional cloud AI, and MCP. ScreenCursor also advertises Windows and Linux through Chrome. Those platforms require their own capture implementation and acceptance tests here; the macOS package must not be described as platform parity. No purchase, extension installation, account access, or competitor asset copying was needed for this review.
