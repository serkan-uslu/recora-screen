import { Dialog } from "../../components/organisms/Dialog";

const steps = [
  [
    "1. Create your project",
    "Choose New project and give it a name. Each project keeps its recording and edits together on your Mac. Open folder restores an existing project. Use a new project for each new take.",
  ],
  [
    "2. Record your story",
    "Select a screen, window or region, then your camera and microphone. Enable system audio if needed. Grant macOS permissions and refresh sources. Input Monitoring enables typing activity and precise click detection. Pointer movement still records without it. The recording controls show whether monitoring is actually running. If a newly granted permission is not detected, quit and reopen the app.",
  ],
  [
    "3. Find the right moment",
    "Drag the ruler or playhead to scrub with live video. Drag across a track to select a range; use Shift-drag over an existing effect. Use Add zoom, Hide camera, Show camera, or Camera layout for that selection. Move effect blocks or drag their edges to change timing.",
  ],
  [
    "4. Arrange your canvas",
    "Select your camera, text, or image directly in Preview. Drag to move it and use a corner handle to resize it. Camera changes use Selected range when a range is selected; choose Entire video for the base layout. Sliders preview while you drag and save once you release. Escape cancels a gesture; Undo restores its starting state. Original media stays intact.",
  ],
  [
    "5. Find your words",
    "Download a Whisper model in Settings, then generate captions locally. Select a transcript segment to jump to it or cut it. Review silence cleanup before applying it. Optional cloud assistance requires your own API key; keys are stored in Keychain.",
  ],
  [
    "6. Save and share",
    "You can return to Projects and edit another project during recording. The recording project stays locked and its controls remain available. Finalizing means your tracks are being saved. Edits save automatically. Save Draft saves manually. Export creates an MP4 while keeping the project editable. Export captions as SRT or VTT from the Captions panel. Moving a project to Trash preserves previously exported videos.",
  ],
  [
    "7. Connect your assistant",
    "Open Settings & MCP for the local server command and arguments. Use these in Codex or Claude's MCP configuration. The desktop app and MCP use the same validated commands and revision checks.",
  ],
];
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="How to use"
      subtitle="From your first take to your final cut."
      onClose={onClose}
      wide
    >
      <div className="help-content">
        {steps.map(([title, text]) => (
          <section key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </section>
        ))}
        <p>
          <kbd>⌘S</kbd> Save draft · <kbd>⌘Z</kbd> Undo · <kbd>⇧⌘Z</kbd> Redo
        </p>
        <p>Questions or feedback? Open About Serkan Uslu from the Projects sidebar for contact links.</p>
      </div>
    </Dialog>
  );
}
