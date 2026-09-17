import type { Metadata } from "next";
import { product } from "@/shared/brand";
import { site } from "@/website/lib/site";

export const metadata: Metadata = {
  title: "Documentation",
  description: `User documentation for ${product.name}, the open-source macOS screen recorder controlled through MCP.`,
  alternates: { canonical: `${site.SITE_URL}documentation/` },
  openGraph: {
    title: `Documentation — ${product.name}`,
    description: `Creator documentation for ${product.name}.`,
    url: `${site.SITE_URL}documentation/`,
  },
};

export default function DocumentationPage() {
  return (
    <main id="main">
      <header className="docs-hero wrap">
        <p className="eyebrow">FOR CREATORS</p>
        <h1>
          Documentation<span className="accent">.</span>
        </h1>
        <p>
          Learn the complete recording workflow, connect Claude or Codex, and understand local data
          and permissions.
        </p>
      </header>

      <div className="docs-layout wrap">
        <aside className="docs-toc" aria-label="On this page">
          <span className="eyebrow">ON THIS PAGE</span>
          <a href="#overview">Overview</a>
          <a href="#record">Record or import</a>
          <a href="#edit">Edit</a>
          <a href="#ai">Local AI</a>
          <a href="#mcp">MCP</a>
          <a href="#projects">Projects & privacy</a>
        </aside>

        <article className="docs-content">
          <section className="docs-section" id="overview">
            <p className="eyebrow">START HERE</p>
            <h2>A studio that stays on your Mac.</h2>
            <p>
              {product.name} records your screen, camera, microphone and system audio as separate
              sources. You can edit without changing the original media, save any number of local
              projects, and export H.264/AAC MP4 in 1080p or 4K.
            </p>
            <div className="docs-grid">
              <div className="docs-card">
                <h3>Requirements</h3>
                <p>
                  Apple silicon · macOS {product.minimumMacOS}+ · enough free disk space for source
                  media.
                </p>
              </div>
              <div className="docs-card">
                <h3>What stays local</h3>
                <p>
                  Recording, timeline editing, project storage, export and downloaded Whisper
                  models.
                </p>
              </div>
              <div className="docs-card">
                <h3>What is optional</h3>
                <p>OpenAI or Anthropic assistance and external Claude/Codex MCP clients.</p>
              </div>
              <div className="docs-card">
                <h3>License</h3>
                <p>
                  {product.license} licensed source code. No artificial project or recording limit.
                </p>
              </div>
            </div>
          </section>

          <section className="docs-section" id="record">
            <p className="eyebrow">CREATOR GUIDE · CAPTURE</p>
            <h2>Record your first take.</h2>
            <ol className="docs-steps">
              <li>
                <strong>Choose Record screen.</strong> Capture setup opens with a new draft; no
                project name is required first. Rename it from the editor header when ready.
              </li>
              <li>
                <strong>Choose a source.</strong> Capture an entire display, one window or a
                selected region.
              </li>
              <li>
                <strong>Select sources.</strong> Enable a camera, microphone and system audio only
                when the take needs them.
              </li>
              <li>
                <strong>Grant macOS access.</strong> Screen Recording is required for capture.
                Camera and Microphone are requested when selected.
              </li>
              <li>
                <strong>Start the take.</strong> Pause, resume or hide the camera bubble while
                recording. The source tracks remain separate.
              </li>
              <li>
                <strong>Finish when ready.</strong> Finalizing can continue in the background while
                you work in another project.
              </li>
            </ol>
            <h3>Start with an existing video</h3>
            <p>
              Choose Import video on the Projects screen for an MP4, MOV or M4V. The app copies it
              into a new editable project with its duration, dimensions, frame rate and embedded
              audio intact. This does not start a recording or require capture permissions. Its
              soundtrack appears as Video audio; a separate camera or cursor track is not created.
              Open project instead reopens a saved Recora Screen project folder.
            </p>
            <div className="docs-callout">
              <p>
                <strong>Cursor events:</strong> pointer movement works without Input Monitoring.
                Enable Input Monitoring for typing activity and reliable short click/drag events.
                Typed text and key codes are never stored.
              </p>
            </div>
          </section>

          <section className="docs-section" id="edit">
            <p className="eyebrow">CREATOR GUIDE · EDIT</p>
            <h2>Shape the story.</h2>
            <h3>Your first edit</h3>
            <p>
              Follow the first-edit guide above the preview: play, split/delete, then export. Quick
              start stays in the header after dismissing the guide. Click a clip to see its
              properties on the right. The selection label names the object and its time range, so
              you can check what an action will affect before applying it.
            </p>
            <p>
              Edits save automatically. Project options → Save now and ⌘S remain available for
              manual saving. Export video makes a separate MP4 or GIF; the saved project remains
              editable.
            </p>
            <h3>Timeline</h3>
            <p>
              Drag the playhead to scrub with a live preview. Click a video, camera, zoom, layer or
              imported audio clip to select it and see its controls. Drag an empty timeline area or
              Shift-drag across clips to select a range. Every row has a context menu. Selection
              actions keep their own row, so the tracks stay in place when a selection changes.
            </p>
            <p>
              Filmstrips from the original footage and waveforms from decoded audio help locate
              content. Use Preview to check the finished composition. Zoom and Layers use separate
              rows. The delete button follows the selection: Delete video clip, Delete zoom, Delete
              layer or Delete audio clip removes that object; Hide camera clip affects only the
              camera. A time-range selection instead offers Delete time range or Keep only this
              range. Split video cuts at the playhead.
            </p>
            <p>
              Delete or Backspace removes an object selected in the timeline, inspector or preview.
              Deleting a camera clip only hides that camera interval; restore it with the camera
              visibility switch or Undo. Deleting a time range with the keyboard requires timeline
              focus. These shortcuts leave timeline items alone while you edit a text or number
              field. Drag the timeline’s top boundary to adjust its height, or focus the boundary
              and use the Up/Down arrow keys. Escape cancels a resize drag.
            </p>
            <p>
              The timeline must retain some footage: split or trim the final video to remove only
              part of it, or add another clip before deleting it entirely.
            </p>
            <ul>
              <li>
                Cut/delete or keep a selection, split at the playhead, trim clip edges, merge
                adjacent clips, change speed, and undo or redo.
              </li>
              <li>
                Add a manual zoom to a range, then adjust depth, position, motion and cursor
                following.
              </li>
              <li>
                Hide, show or reposition the camera for a selected interval or the entire video.
              </li>
              <li>Adjust microphone and system audio independently.</li>
            </ul>
            <h3>Zoom settings and split clips</h3>
            <p>
              Continuous typing near the same target holds one automatic zoom; pauses and target
              changes create separate moments. Hold controls how long a zoom remains after activity.
              New recordings use this automatically. On an existing recording, open Automatic zoom
              settings in Zoom and choose Redetect automatic zooms to replace the current zooms,
              including manual ones, in one undoable step.
            </p>
            <p>
              Click a zoom in the list to open its settings in a dialog without scrolling the list.
              On the timeline, click once to select, then double-click or choose Edit selected zoom
              to open settings. Done or Escape returns to your list position. Appearance changes
              save immediately; use Update timing for start and duration changes.
            </p>
            <p>
              Select a split camera clip and use This selection for independent position, size,
              shape, mirror, shadow and visibility. Video default changes the base appearance for
              footage without its own layout; existing clip layouts and hidden ranges stay intact.
              Split at the playhead separates a crossing zoom into independently editable zooms.
              Canvas, cursor styling and master audio volumes remain global; repeated source footage
              shares its source-bound effects.
            </p>
            <h3>Move clips and insert media</h3>
            <p>
              Right-click a clip or open Selected clip actions. Move earlier and Move later swap its
              place with the next clip in that direction; Clip position moves it to a chosen
              position. Original zooms, camera layouts, captions and layers follow their footage.
              Cuts and splits affect only the selected occurrence in the output timeline.
            </p>
            <p>
              Choose Add media at playhead → Insert video… or Insert image… to add an intro, cutaway
              or closing card. Inserting inside a clip splits it around the new media. Videos
              support MP4, MOV and M4V up to 2 GB; images support PNG, JPEG and WebP. Files are
              copied into the project. Images start at three seconds: adjust Source in / Source out
              and choose Apply trim to extend them up to 60 seconds.
            </p>
            <p>
              Inserted videos keep their embedded audio, trim and speed, using the system-audio
              volume setting. Inserted media uses the global canvas, without the original
              recording’s camera, cursor effects, captions or layers. Imported music and voiceovers
              stay at their output times, so review their timing after rearranging video.
            </p>
            <p>
              Use Restore deleted footage at playhead to insert a missing original interval without
              reordering the remaining clips. Undo and redo cover timeline edits; source files
              remain intact. Editing uses one video sequence with cuts, without stacked video tracks
              or transition effects.
            </p>
            <h3>Direct manipulation</h3>
            <p>
              Select the camera, text or an image in the preview. Drag to move it and use corner
              handles to resize it. Slider and pointer changes render immediately and create one
              undo step when the gesture ends. Press Escape during a gesture to restore its starting
              value.
            </p>
            <h3>Arrows and privacy covers</h3>
            <p>
              Select an interval, open Layers, and choose Add arrow, Add blur or Add solid cover.
              Drag the layer in the preview; adjust width, height, arrow direction, color or blur
              strength in its properties. Use selected time range changes its timing.
            </p>
            <p>
              Blur softens details; choose a solid cover for sensitive information. Covers are
              opaque and unanimated, stay fixed on the output canvas, and render over the camera and
              captions. Review every covered interval through zooms and layout changes. Original
              media remains in the editable project.
            </p>
            <h3>Imported audio</h3>
            <p>
              Select an interval and choose Audio → Add audio to selection. Supported files are MP3,
              WAV, M4A, AAC, AIFF and CAF up to 500 MB. Each file is copied into the project. Adjust
              Start, End, Skip into audio and Clip volume, or remove the clip. Imported clips appear
              on the Audio timeline row.
            </p>
            <p>
              Music and voiceovers use output time: screen cuts and speed changes do not retime
              them. Playback is clipped at the current video end. Move a clip back into the video if
              a trim leaves it outside the timeline. Undo restores edits; removing a clip retains
              its file in the project.
            </p>
            <h3>Cursor and camera effects</h3>
            <p>
              In Zoom → Cursor → Cursor effects and style, enable motion blur, click bounce, sway or
              Loop cursor path, and choose a light or dark pointer. Cursor effects need recorded
              pointer metadata. Loop blends the last 350 ms toward the first visible pointer
              position; it does not loop the screen footage.
            </p>
            <p>
              In Camera, enable Mirror camera or Shrink camera during zoom. Square cameras have an
              adjustable corner radius, and shadows have an opacity slider. These settings follow
              This selection or Video default just like camera position and size. Saved range
              layouts retain their settings. Canvas → Frame and spacing holds advanced canvas
              controls.
            </p>
            <h3>Captions and export</h3>
            <p>
              Edit transcript cues, burn captions into the video or save SRT/VTT. Export produces a
              separate MP4 or GIF, so the project and original media remain editable. MP4 keeps
              audio and supports up to 4K. GIF is silent: choose 640 or 1280 pixels on the longest
              edge, 15/20/25/30 FPS and continuous looping or one play. GIF supports up to 60
              seconds; trim longer timelines or choose MP4. Export progress and cancellation are
              available for both formats.
            </p>
          </section>

          <section className="docs-section" id="ai">
            <p className="eyebrow">LOCAL AI</p>
            <h2>Remove busywork, keep control.</h2>
            <p>
              Download the multilingual Whisper <code>small</code> model from Settings, or choose{" "}
              <code>base</code> on a lower-resource Mac. After the model download, transcription
              runs offline. Select transcript text to navigate the timeline and review every
              suggested edit before applying it.
            </p>
            <p>
              Silence cleanup uses the microphone track. Its default analysis keeps 150 ms around
              speech, requires a 700 ms gap, and protects ranges with audible system audio.
              Suggested cuts can be reviewed, applied as one undoable action or discarded.
            </p>
            <div className="docs-callout">
              <p>
                The optional in-app assistant uses your OpenAI or Anthropic API key from macOS
                Keychain. Only the prompt and required edit context are sent to the provider you
                choose.
              </p>
            </div>
          </section>

          <section className="docs-section" id="mcp">
            <p className="eyebrow">MODEL CONTEXT PROTOCOL</p>
            <h2>Connect Claude or Codex.</h2>
            <p>
              The bundled local MCP server exposes the same validated project, recording, timeline,
              preview, AI and export commands as the UI. Keep the desktop app open, then go to{" "}
              <strong>Settings & MCP → MCP & shortcuts</strong>. Select Codex, Claude Code or Claude
              Desktop and copy the generated configuration for the current installation. The server
              appears as <code>recora-screen</code>. Remove an older <code>screen-recorder</code>,{" "}
              <code>screenRecorder</code> or <code>screen_recorder</code> entry before adding it.
            </p>
            <div className="docs-grid">
              <div className="docs-card">
                <h3>Codex</h3>
                <p>
                  Copy the generated TOML entry, reconnect Codex and check the server with{" "}
                  <code>/mcp</code>.
                </p>
              </div>
              <div className="docs-card">
                <h3>Claude Code</h3>
                <p>
                  Run the generated <code>claude mcp add</code> command, then verify it with{" "}
                  <code>/mcp</code>.
                </p>
              </div>
              <div className="docs-card">
                <h3>Claude Desktop</h3>
                <p>
                  Merge the generated JSON entry with your existing MCP servers and restart Claude
                  Desktop.
                </p>
              </div>
              <div className="docs-card">
                <h3>No extra Node install</h3>
                <p>The app packages its runtime and resolves the correct MCP entry path for you.</p>
              </div>
            </div>
            <h3>Try a complete request</h3>
            <pre>
              <code>{`Open my tutorial project. Suggest silence cuts and let me review them.
Hide my camera between 10 and 20 seconds, add a title for the first 3 seconds,
and export a 1080p MP4 to Movies.`}</code>
            </pre>
            <h3>Command groups</h3>
            <ul>
              <li>
                <strong>Projects:</strong> list, create, open, rename, import, save and delete.
              </li>
              <li>
                <strong>Recording:</strong> inspect capabilities, request permissions, start, pause,
                resume and stop.
              </li>
              <li>
                <strong>Editing:</strong> atomic timeline batches, camera layouts, assets and
                undo/redo.
              </li>
              <li>
                <strong>Preview & export:</strong> load, seek, render frames, play and start
                cancellable export jobs.
              </li>
              <li>
                <strong>AI:</strong> download models, transcribe, suggest silence cuts and run the
                optional assistant.
              </li>
            </ul>
            <p>
              Read a project before editing and use its latest revision as{" "}
              <code>expectedRevision</code>. Mutations accept a retry-safe request ID. Long
              operations return a job ID for status checks and cancellation. See the{" "}
              <a href={`${product.repository}/blob/main/docs/mcp.md`}>
                complete MCP contract and setup guide
              </a>
              .
            </p>
          </section>

          <section className="docs-section" id="projects">
            <p className="eyebrow">DATA, RECOVERY & PRIVACY</p>
            <h2>Your projects remain yours.</h2>
            <p>
              For upgrade compatibility, project folders remain under{" "}
              <code>~/Movies/Screen Recorder Projects/</code>. Each folder contains the project
              document, a previous valid backup, original media and imported assets. Saves are
              atomic. Deleting a project moves its folder and owned source media to macOS Trash;
              previously exported videos stay where you saved them.
            </p>
            <p>
              Recording, editing and local AI do not upload your footage. A connected model client
              may send requested transcripts or preview frames to its own provider. Review that
              client's privacy policy before connecting sensitive work. Read the{" "}
              <a href={`${product.repository}/blob/main/docs/privacy.md`}>full privacy model</a>.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
