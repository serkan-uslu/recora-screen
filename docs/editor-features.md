# Editor effects and media

## Get started

Recora Screen opens with a short branded splash while the local workspace service initializes, then takes you directly to your projects. Its cream, forest-green and dark editor palette matches the product website while preserving contrast for long editing sessions.

Choose **Record screen** on the Projects screen to open capture setup directly. A draft is created automatically; rename it from the editor header when ready. Choose **Import video** to begin with an MP4, MOV or M4V instead, or **Open project** to reopen a saved Recora Screen project folder.

Drag the empty top bar to move the desktop window, both in Projects and in the editor. Header buttons keep their normal click actions.

Import video copies the file into a new project and keeps its duration, dimensions, frame rate and embedded audio. It does not start a recording or require capture permissions. The embedded soundtrack is labeled **Video audio**; importing does not create a separate camera track or recorded cursor metadata.

The first-edit guide shows play, split/delete and export in the editor. **Quick start** in the header remains available after dismissing that guide. Choose a clip to see its properties on the right, or Shift-drag to work on a time range. Edits save automatically; **Project options → Save now** and ⌘S are available for manual saving. **Export video** creates a separate MP4 or GIF while the project remains editable.

## Timeline editing

The editor assembles a single sequence without changing source files. Split at the playhead, cut/delete a selected interval, keep only that interval, trim clip edges or change playback speed. Right-click a clip or open Selected clip actions: use Move earlier, Move later or Clip position to reorder it. Undo and redo cover these operations. Merge joins adjacent clips only when they use the same source, contiguous source times and the same speed.

Click a video, camera, zoom, layer or imported audio clip to select it. The selection label identifies the object, and its settings appear on the right. Video properties include trimming, speed, moving and merging; the video’s own controls remain separate from camera and effects. Drag an empty timeline area or Shift-drag across clips to select a time range. Selection actions occupy a reserved row, so selecting or clearing a range does not move the tracks.

Video filmstrips and audio waveforms help locate visual changes and sound. Filmstrips sample the original clip interval before canvas, camera or other effects; use Preview to check the final composition. Waveforms are calculated from decoded audio and account for volume. These previews load progressively while editing remains available. Missing or unreadable audio does not show a fabricated waveform. Zoom and Layers have separate rows. **Split video**, **Delete time range** and **Keep only this range** describe time edits; selecting an object changes the delete action to name that object, such as **Delete zoom** or **Hide camera clip**. A selected zoom or layer does not turn the delete action into a cut through the video.

For a selected object in the timeline, inspector or preview, Delete or Backspace removes the selected video clip, zoom, layer or imported audio clip. Deleting a camera clip hides only that camera interval and leaves the screen footage in place; use the camera visibility switch or Undo to restore it. Choose **Select this time range** to turn an object's interval into a time selection; deleting a time range with the keyboard requires timeline focus. These shortcuts do not delete timeline items while you are editing a text or number field. Drag the timeline's top boundary to change its height, or focus the boundary and use the Up/Down arrow keys. Escape cancels an active resize drag.

The timeline must retain some footage: split or trim the final video to remove only part of it, or add another clip before deleting it entirely.

Choose Add media at playhead → Insert video… or Insert image… to add an intro, a cutaway or a closing card. Inserting inside a clip splits that clip and places the new media between its two parts. MP4, MOV and M4V videos up to 2 GB are inspected by the native decoder; PNG, JPEG and WebP images are also supported. Imported files are copied into the project, so moving the original file does not break the edit. Removing a clip retains its asset for undo and reuse.

Still images start at three seconds; change Source in / Source out and choose Apply trim to extend their source duration up to 60 seconds. Playback speed also changes their output duration. Video clips use their own embedded audio, which follows the clip's trim and speed and the system-audio volume setting. The global canvas applies to inserted media. Recorded camera, cursor metadata, captions and source-bound effects belong to the original recording and do not appear over inserted media. Music and voiceover clips remain anchored to output time; check their timing after inserting or moving video.

Original zooms, camera layouts, captions and layers follow their source footage when clips move; repeated source footage shares those effects. Apply zooms and layers separately to reordered sections when one source interval cannot represent the selection. A cut or split changes only the selected output occurrence, even if a source range appears more than once. Choose Restore deleted footage at playhead to recover a missing original interval without changing the order of remaining clips. This is a single video sequence with cuts; it does not add transition effects or stacked video tracks.

### Timeline commands

Use these operations inside `timeline.apply`; each batch has revision checks and one undo step:

- `clip.move`: `index` identifies the clip in the current sequence; `toIndex` is its index in the final order. Both are zero-based.
- `clip.insert`: `assetId`, `atMs` (output time), and optional `sourceStartMs` / `sourceEndMs`. Import an asset first with `asset.import` using `kind: "video"` or `kind: "image"`.
- `source.restore`: a missing original `startMs` / `endMs` source interval, with optional output `atMs` to choose the insertion point.

Persisted `TimelineSegment.assetId` is optional: absent means original footage; present identifies an imported video or image. Clip timing is relative to that source. Existing projects keep the same format and default source behavior. Read the latest project before deriving clip indices; earlier operations in the same batch can change those indices.

## Automatic zooms and clip settings

Continuous typing near the same target holds one automatic zoom instead of repeatedly zooming out and back in. A pause or a different target starts a separate moment. Hold controls how long the zoom stays after activity; generation respects clip boundaries and playback speed.

New recordings use this behavior automatically. For an existing recording, open Zoom → Automatic zoom settings → Redetect automatic zooms. Redetection replaces all current zooms, including manual ones, in one undoable step; existing projects are not silently rewritten.

Click a zoom in the list to open Zoom settings without moving the list. A timeline zoom is selected with one click; double-click it or choose Edit selected zoom to open the same dialog. Done or Escape closes the dialog and returns to your list position. Appearance changes save immediately; use Update timing to apply the start and duration fields.

Select a camera clip after splitting and keep **This selection** active. Position, size, shape, mirror, shadow and visibility affect that clip’s interval, shown in the panel. **Video default** changes the base appearance for footage without its own camera layout; existing clip layouts and hidden ranges are preserved. Split at the playhead also separates a zoom crossing the cut into independent zooms with the same starting settings. Canvas, cursor styling and master audio volumes remain project-wide; repeated copies of the same source footage still share source-bound effects. Canvas → Frame and spacing contains the detailed canvas controls.

## Arrows and privacy covers

Select an output timeline interval and open Layers. Add an arrow, blur or solid cover. Drag the layer in the native preview, resize it with corner handles, or use the position, width and height sliders. Arrow direction is clockwise in degrees; its color is editable. Blur strength is adjustable. Use selected time range changes the interval. Layer edits are undoable.

Covers stay anchored to the output canvas, so review placement throughout zooms and layout changes. Blur is not guaranteed to conceal readable text: choose an opaque solid cover for sensitive details. Covers render last, over camera and captions, without fade or slide even if a client requests animation. Project originals remain unchanged and still contain the covered information.

MCP uses `overlay.add` / `overlay.update` in `timeline.apply`; `kind` additionally accepts `arrow`, `blur`, `redact`. Optional `height` is a canvas fraction (0.02–1), `rotation` is 0–360 degrees, and `blur` is 4–100. Existing text/image projects load unchanged. Timing uses the existing output-to-source mapping.

## Imported audio

Select a range and use Audio → Add audio to selection. MP3, WAV, M4A, AAC, AIFF and CAF up to 500 MB are validated by the native audio decoder and copied to project assets. Set start/end output times, source offset and volume (0–200%). Files are retained when clips are removed so undo remains safe. Multiple clips can overlap.

`asset.import` accepts `kind: "audio"` and returns the project with the new audio asset and duration. Use `audioClip.add`, `audioClip.update`, `audioClip.remove` in `timeline.apply`. A clip contains `assetId`, `startMs`, `endMs`, `offsetMs`, `volume` and a generated `id`. Unlike screen effects these times stay anchored to output time through screen cuts and speed changes. Native composition clips playback to the video end; restoring video duration makes retained clips audible again.

## GIF export

Choose Export → Animated GIF, a longest edge of 640 or 1280 pixels, 15/20/25/30 FPS and optional continuous looping. GIF has no audio. Trim timelines longer than 60 seconds or choose MP4. The same native composition renders captions, camera and effects. GIF jobs report progress, can be cancelled, and publish the file only after successful encoding. Existing files and project media are never overwritten.

MCP: `export.start` accepts `format: "gif"`, `gifFps`, `loop`, `width`, `height` and a `.gif` path. Both dimensions must be even and at most 1280. MP4 remains the default. GIF defaults to 15 FPS with looping. The 60-second/1280-pixel ceiling bounds encoding work; choose MP4 for longer or higher-resolution output.

## Cursor and camera effects

Zoom → Cursor → Cursor effects and style offers motion blur, click bounce, directional sway, loop and dark/light styles. These render in native preview, MP4 and GIF and need recorded cursor metadata. Loop blends the final 350 ms (or half a short video) toward the initial pointer position when both samples exist; it does not alter the screen footage or synthesize missing metadata. MCP `cursor.update` supports optional `motionBlur`, `bounce`, `sway`, `loop` booleans and `style: "dark" | "light"`.

Camera adds `mirror`, `radius` (0–0.5, square only), `shadowOpacity` (0–1) and `zoomReactive`. They are supported by `camera.update` and `camera.layout.set`, follow the selection/default scope, and retain old defaults when absent. Zoom-reactive scaling divides bubble size by the active zoom scale; editing handles use the same geometry as rendered output.
