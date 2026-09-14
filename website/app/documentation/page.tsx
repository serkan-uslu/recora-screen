import type { Metadata } from "next";
import { product } from "@/shared/brand";
import { site } from "@/website/lib/site";

export const metadata: Metadata = {
  title: "Documentation",
  description: `User and technical documentation for ${product.name}, the open-source macOS screen recorder controlled through MCP.`,
  alternates: { canonical: `${site.SITE_URL}documentation/` },
  openGraph: {
    title: `Documentation — ${product.name}`,
    description: `Creator and contributor documentation for ${product.name}.`,
    url: `${site.SITE_URL}documentation/`,
  },
};

export default function DocumentationPage() {
  return (
    <main id="main">
      <header className="docs-hero wrap">
        <p className="eyebrow">FOR CREATORS AND CONTRIBUTORS</p>
        <h1>
          Documentation<span className="accent">.</span>
        </h1>
        <p>
          Learn the complete recording workflow, connect Claude or Codex, understand local data and
          permissions, or start contributing to the app.
        </p>
      </header>

      <div className="docs-layout wrap">
        <aside className="docs-toc" aria-label="On this page">
          <span className="eyebrow">ON THIS PAGE</span>
          <a href="#overview">Overview</a>
          <a href="#record">Record</a>
          <a href="#edit">Edit</a>
          <a href="#ai">Local AI</a>
          <a href="#mcp">MCP</a>
          <a href="#projects">Projects & privacy</a>
          <a href="#architecture">Architecture</a>
          <a href="#develop">Development</a>
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
                <strong>Create a project.</strong> Choose New project on the Projects screen and
                give the draft a useful name.
              </li>
              <li>
                <strong>Choose Record.</strong> Capture an entire display, one window or a selected
                region.
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
            <h3>Timeline</h3>
            <p>
              Drag the playhead to scrub with a live preview. Drag across the Screen, Camera, Audio
              or empty timeline area to select a range. Every row has a context menu; use Shift-drag
              over an existing effect to create a range selection.
            </p>
            <ul>
              <li>
                Cut or keep a selection, split and merge clips, change speed, and undo or redo.
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
            <h3>Direct manipulation</h3>
            <p>
              Select the camera, text or an image in the preview. Drag to move it and use corner
              handles to resize it. Slider and pointer changes render immediately and create one
              undo step when the gesture ends. Press Escape during a gesture to restore its starting
              value.
            </p>
            <h3>Captions and export</h3>
            <p>
              Edit transcript cues, burn captions into the video or save SRT/VTT. Export produces a
              separate MP4, so the project and original media remain editable.
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
              Desktop and copy the generated configuration for the current installation.
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
              Project folders live under <code>~/Movies/Screen Recorder Projects/</code>. Each
              folder contains the project document, a previous valid backup, original media and
              imported assets. Saves are atomic. Deleting a project moves its folder and owned
              source media to macOS Trash; previously exported videos stay where you saved them.
            </p>
            <p>
              Recording, editing and local AI do not upload your footage. A connected model client
              may send requested transcripts or preview frames to its own provider. Review that
              client's privacy policy before connecting sensitive work. Read the{" "}
              <a href={`${product.repository}/blob/main/docs/privacy.md`}>full privacy model</a>.
            </p>
          </section>

          <section className="docs-section" id="architecture">
            <p className="eyebrow">TECHNICAL GUIDE</p>
            <h2>Understand the architecture.</h2>
            <pre className="docs-architecture">
              <code>{`React views → React controllers → command service → desktop transport
                                      ↓
UI / MCP / socket → CommandController → ApplicationService
                                      ├─ domain edits and cursor analysis
                                      ├─ atomic ProjectStore and background Jobs
                                      ├─ local / optional cloud AI
                                      └─ native Swift capture and composition`}</code>
            </pre>
            <p>
              Node owns project state and application commands. The React UI and external MCP
              clients call the same schemas and use cases. Swift handles ScreenCaptureKit,
              AVFoundation, AVPlayer preview and export composition; frames do not pass through
              React. Tauri keeps the desktop shell and native bridge small.
            </p>
            <ul>
              <li>
                <code>src/features</code> contains creator-facing views;{" "}
                <code>src/controllers</code> owns UI orchestration.
              </li>
              <li>
                <code>server/services</code> contains application use cases;{" "}
                <code>server/domain</code> contains timeline rules.
              </li>
              <li>
                <code>server/contracts</code> validates commands and persisted data at trust
                boundaries.
              </li>
              <li>
                <code>native</code> owns capture, playback geometry and preview/export composition
                parity.
              </li>
              <li>
                <code>shared</code> contains cross-layer project and timeline types;{" "}
                <code>design-system</code> contains theme tokens.
              </li>
            </ul>
            <p>
              See the{" "}
              <a href={`${product.repository}/blob/main/docs/architecture.md`}>
                architecture and contribution guide
              </a>{" "}
              for invariants, edit timing and migration rules.
            </p>
          </section>

          <section className="docs-section" id="develop">
            <p className="eyebrow">CONTRIBUTING</p>
            <h2>Build it with us.</h2>
            <p>
              Development requires macOS 15+, Xcode and command-line tools, Rust, Node.js 22.12+,
              Git and CMake. Clone the repository, then run:
            </p>
            <pre>
              <code>{`npm ci
npm run prepare:whisper
npm run dev`}</code>
            </pre>
            <p>Before submitting a change, run the repository checks that match your work:</p>
            <pre>
              <code>{`npm run check
npm run build
npm run test:native
npm run desktop:check
npm run build:site
npm run test:e2e`}</code>
            </pre>
            <p>
              Native checks require macOS and Xcode. Start with{" "}
              <a href={`${product.repository}/blob/main/AGENTS.md`}>development standards</a>, then
              read the <a href={`${product.repository}/blob/main/docs/release.md`}>release guide</a>
              . Open an issue on{" "}
              <a data-author="repository" href={product.repository}>
                GitHub
              </a>{" "}
              or email <a href="mailto:info@serkanuslu.com">info@serkanuslu.com</a>.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
