import { Dialog } from "@/src/components/organisms/Dialog";

const firstEdit = [
  [
    "1. Find a moment",
    "Press Space to play or pause. Click the time ruler to jump to a moment. Click a clip to select it; its name and settings appear on the right.",
  ],
  [
    "2. Split and remove",
    "Move the playhead to the start and end of an unwanted moment and choose Split each time. Select the middle video clip and choose Delete clip. Undo restores it.",
  ],
  [
    "3. Export your video",
    "Choose Export video, keep MP4 selected and export. Your edits save automatically on your Mac; the exported video is a separate file.",
  ],
];
const topics = [
  [
    "Start with a recording or a video",
    "Choose Record screen to select a screen, window or region and optional camera/microphone. Or choose Import video to edit an MP4, MOV or M4V without recording first. Open project restores an existing project folder. Rename your project at any time from its title.",
  ],
  [
    "Understand what is selected",
    "The selection heading names the object and time interval. Camera settings affect the selected clip or range by default. Video default changes the base camera layout; saved range layouts keep their own settings. Deleting a camera hides it for that interval; deleting a zoom removes the effect. A video clip deletion removes that portion of the video, including its linked tracks.",
  ],
  [
    "Select a time range",
    "Shift-drag across the timeline, or drag empty track space, to select time explicitly. Delete time range removes that interval from the video; Keep only this range removes footage outside it. Check the selection heading before applying a range edit.",
  ],
  [
    "Move, trim and insert clips",
    "Select a video clip to see its clip properties. Split at the playhead, trim its edges, change speed or move its position in the sequence. Add media inserts video or an image at the playhead. Images start at 3 seconds and can be extended up to 60 seconds. Original source files remain intact.",
  ],
  [
    "Arrange camera, zoom and layers",
    "Select camera, text or images in Preview and drag to move or use the corner handles to resize. Select a split camera clip to change only its appearance and visibility. Click a zoom in its list or double-click it in the timeline to edit in a dialog. Continuous typing holds one automatic zoom. Redetect automatic zooms replaces all zooms, including manual ones, and can be undone. Layers adds text, images, arrows, blur and covers.",
  ],
  [
    "Audio and captions",
    "Audio imports music or voiceovers. Download a Whisper model in Settings before generating captions locally. A transcript segment can jump to its moment or cut it. Silence cleanup needs a microphone track and lets you review suggestions before applying them. System audio is protected by default.",
  ],
  [
    "Recording permissions",
    "Grant macOS permissions and refresh sources. Input Monitoring enables typing activity and precise click detection; pointer movement still records without it. Recording controls show whether monitoring is running. If a newly granted permission is not detected, quit and reopen the app.",
  ],
  [
    "AI and connected assistants",
    "Optional cloud assistance sends your message, transcript and editing context to your chosen provider and requires your own API key. Settings includes MCP configuration for Codex, Claude Code and Claude Desktop. Keep Recora Screen open. Connected clients can send returned transcripts and requested preview frames to their model provider.",
  ],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="Quick start"
      subtitle="Make your first edit in three steps."
      onClose={onClose}
      wide
    >
      <div className="help-content">
        <div className="quick-start-steps">
          {firstEdit.map(([title, text]) => (
            <section key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </section>
          ))}
        </div>
        <section className="help-shortcuts">
          <h3>Useful shortcuts</h3>
          <p>
            <kbd>Space</kbd> Play/pause · <kbd>S</kbd> Split · <kbd>⌘Z</kbd> Undo · <kbd>⇧⌘Z</kbd>{" "}
            Redo
          </p>
          <p>
            <kbd>Delete</kbd> / <kbd>Backspace</kbd> Remove the selected timeline object ·{" "}
            <kbd>Esc</kbd> Cancel a gesture or close a dialog
          </p>
          <p>
            Drag the timeline’s top edge to make it taller. Focus that edge and use <kbd>↑</kbd> /{" "}
            <kbd>↓</kbd> to resize with the keyboard.
          </p>
        </section>
        {topics.map(([title, text]) => (
          <details className="advanced-settings" key={title}>
            <summary>{title}</summary>
            <p>{text}</p>
          </details>
        ))}
      </div>
    </Dialog>
  );
}
