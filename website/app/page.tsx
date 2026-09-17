import type { Metadata } from "next";
import Image from "next/image";
import { product } from "@/shared/brand";
import { HeroTypewriter } from "@/website/components/HeroTypewriter";
import { assetPath, downloadUrl, site } from "@/website/lib/site";

export const metadata: Metadata = { alternates: { canonical: site.SITE_URL } };

export default function HomePage() {
  return (
    <main id="main">
      <section className="hero wrap">
        <p className="eyebrow">
          <span className="record-dot"></span> OPEN-SOURCE SCREEN RECORDER FOR MACOS
        </p>
        <h1>
          <HeroTypewriter />
        </h1>
        <a
          className="hero-mcp"
          href="#mcp"
          data-event="Navigation Click"
          data-placement="hero-mcp-card"
        >
          <span className="agent-logos">
            <span className="agent-mark codex-mark">
              <Image src={assetPath("brands/codex.png")} width="40" height="40" alt="" />
              <b>Codex</b>
            </span>
            <span className="agent-mark claude-mark">
              <Image src={assetPath("brands/claude.png")} width="40" height="40" alt="" />
              <b>Claude</b>
            </span>
          </span>
          <span className="hero-mcp-copy">
            <small>WORKS WITH CLAUDE &amp; CODEX · MCP</small>
            <strong>Direct the whole studio.</strong>
            <span>Create projects, edit timelines and export by asking.</span>
          </span>
        </a>
        <p className="intro">{product.description}</p>
        <p className="hero-description">
          Record your screen, camera and audio, or import a video and start editing.
          <br className="desktop-break" />
          Select a clip, remove unwanted moments and export up to 4K. Quick start help stays close
          by, and edits save automatically. Connect Claude or Codex through MCP for more help.
        </p>
        <div className="actions">
          <a
            className="button"
            href="#download"
            data-event="Navigation Click"
            data-placement="hero-download"
          >
            Download for macOS <span>↓</span>
          </a>
          <a
            className="text-link"
            data-event="Navigation Click"
            data-placement="hero-mcp"
            href="#mcp"
          >
            Claude + Codex via MCP <span>↓</span>
          </a>
        </div>
        <p className="fine">
          Apple silicon · macOS {product.minimumMacOS}+ · Local projects · {product.license}{" "}
          licensed
        </p>
        <figure className="product-proof">
          <Image
            src={assetPath("media/editor.jpg")}
            width="1231"
            height="768"
            alt="Actual desktop editor: independent screen, camera, audio and effects tracks in a clean demonstration project"
          />
          <figcaption>
            Captured in the desktop app using a clean demonstration project. Original media stays
            editable.
          </figcaption>
        </figure>
      </section>
      <div className="manifesto wrap">
        <span>YOUR WORK. YOUR DEVICE.</span>
        <p>
          No upload before you can edit.
          <br />
          No account between you and your next idea.
        </p>
        <span className="seal">
          LOCAL
          <br />
          BY DEFAULT ↗
        </span>
      </div>
      <section className="wrap section" id="features">
        <div className="section-heading">
          <p className="eyebrow">FROM FIRST TAKE TO FINAL CUT</p>
          <h2>
            Everything your story needs.
            <br />
            <span className="muted">Room to make it your own.</span>
          </h2>
        </div>
        <div className="feature-grid">
          <article className="feature wide">
            <span className="feature-number">01 / CAPTURE</span>
            <h3>
              A screen. A camera.
              <br />
              Your point of view.
            </h3>
            <p>
              Record a screen, window or region with separate camera, microphone and system audio
              tracks. Mirror your camera, tune its corners and shadow, or let it shrink
              automatically during zooms.
            </p>
            <div className="capture-art" aria-hidden="true">
              <div>
                YOUR SCREEN<span>▣</span>
              </div>
              <i>YOU</i>
            </div>
          </article>
          <article className="feature">
            <span className="feature-number">02 / EDIT</span>
            <h3>Find your flow.</h3>
            <p>
              Select a clip to see its controls. Filmstrips and audio waveforms help you find the
              moment; separate Zoom and Layers rows keep effects visible. Split, delete, trim or
              reorder, with actions that name what they change. Undo keeps the original media safe.
            </p>
            <div className="cut-art" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
              <span>↶ Undo, whenever.</span>
            </div>
          </article>
          <article className="feature">
            <span className="feature-number">03 / FOCUS</span>
            <h3>Point out what matters.</h3>
            <p>
              Continuous typing holds the zoom steady. Edit zoom settings in a dialog without losing
              your list position. Change a selected camera clip’s appearance or the video default,
              with the scope shown beside the controls. Add arrows, blur and covers.
            </p>
            <div className="focus-art" aria-hidden="true">
              ↖<span>2×</span>
            </div>
          </article>
          <article className="feature wide ai-feature">
            <span className="feature-number">04 / A LITTLE HELP</span>
            <h3>
              Less busywork.
              <br />
              More of your voice.
            </h3>
            <p>
              Transcribe Turkish, English and more with local Whisper. Edit through your words and
              review suggested cuts from your microphone pauses. Silence cleanup requires a recorded
              microphone track. Audible system audio is protected by default. Bring your OpenAI or
              Anthropic key for optional editing assistance and YouTube copy.
            </p>
            <div className="transcript-art">
              <span>00:12</span> Let’s start with the idea.
              <br />
              <span>00:16</span>
              <mark>Then make it our own.</mark>
              <small>Whisper runs locally after model download.</small>
            </div>
          </article>
          <article className="feature">
            <span className="feature-number">05 / FRAME</span>
            <h3>Give the story room.</h3>
            <p>
              Choose solid, gradient or image backgrounds. Set the aspect ratio, padding, rounded
              corners, shadow and browser frame for every destination.
            </p>
          </article>
          <article className="feature">
            <span className="feature-number">06 / KEEP CREATING</span>
            <h3>Every idea gets a home.</h3>
            <p>
              A focused branded opening takes you straight into your local workspace. Start with
              Record screen or Import video, follow the first-edit guide, and reopen Quick start
              whenever needed. Automatic saves and portable project folders keep your work ready for
              the next session.
            </p>
          </article>
          <article className="feature">
            <span className="feature-number">07 / SHARE</span>
            <h3>Ready for your audience.</h3>
            <p>
              Export H.264/AAC MP4 up to 4K or a looping GIF up to 60 seconds. Burn in captions or
              save SRT/VTT. Your project remains editable after export.
            </p>
          </article>
        </div>
      </section>
      <section className="wrap section workflow" id="workflow">
        <div>
          <p className="eyebrow">ONE IDEA. THREE SIMPLE STEPS.</p>
          <h2>
            Less setup.
            <br />
            <em>More showing.</em>
          </h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Record or import.</h3>
              <p>
                Record screen opens capture setup. Import video opens an existing MP4, MOV or M4V.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Keep the good bits.</h3>
              <p>
                Select a clip, split it and remove an unwanted part. Adjust camera or zoom where
                needed. Your edits save automatically.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Put it out there.</h3>
              <p>Export your video. Share your tutorial, walkthrough or next big idea.</p>
            </div>
          </li>
        </ol>
      </section>
      <section className="wrap mcp-section" id="mcp">
        <div>
          <p className="eyebrow">YOUR ASSISTANT. YOUR STUDIO.</p>
          <h2>
            Say it.
            <br />
            <em>Shape it.</em>
          </h2>
          <p>
            Connect Codex, Claude Code or Claude Desktop to the bundled local MCP server. Create
            projects, control recordings, edit timelines and export through the same validated
            commands as the app.
          </p>
          <a
            className="text-link"
            href={`${product.repository}/blob/main/docs/mcp.md`}
            data-event="Source Click"
            data-placement="mcp"
          >
            Read the MCP setup ↗
          </a>
        </div>
        <div className="conversation">
          <div className="mcp-client-links" aria-label="Choose your MCP client">
            <a
              href={`${product.repository}/blob/main/docs/mcp.md#codex`}
              data-event="MCP Setup Click"
              data-placement="codex"
            >
              Codex ↗
            </a>
            <a
              href={`${product.repository}/blob/main/docs/mcp.md#claude-code`}
              data-event="MCP Setup Click"
              data-placement="claude-code"
            >
              Claude Code ↗
            </a>
            <a
              href={`${product.repository}/blob/main/docs/mcp.md#claude-desktop`}
              data-event="MCP Setup Click"
              data-placement="claude-desktop"
            >
              Claude Desktop ↗
            </a>
          </div>
          <span>RECORDED WITH CODEX · ACTUAL MCP RESULT</span>
          <p>Add a 1.6× zoom, place a timed title, and export a 1080p MP4.</p>
          <hr />
          <span>ONE EDIT, FROM PROMPT TO EXPORT</span>
          <p>
            <code>timeline_apply</code> → <code>preview_frame</code> → <code>export_start</code>
          </p>
          <video
            className="mcp-proof"
            data-demo="codex-proof"
            controls
            playsInline
            preload="none"
            poster={assetPath("media/editor.jpg")}
            aria-label="Real Codex MCP edit and export demonstration"
          >
            <source src={assetPath("media/codex-proof.mp4")} type="video/mp4" />
            <track
              kind="captions"
              src={assetPath("media/codex-proof.vtt")}
              srcLang="en"
              label="English"
            />
          </video>
          <small>
            Actual app export from a clean 12-second fixture; the final frame holds for 3 seconds.
            Captions explain the recorded tool calls. No camera or audio is used in this sample.
          </small>
          <p className="mcp-privacy">
            Codex CLI flow verified on this development build. Claude client acceptance remains
            pending. <a href={assetPath("media/codex-proof.json")}>Read the actual tool trace ↗</a>
          </p>
          <p className="mcp-privacy">
            Recording and editing run on your Mac. Connected AI clients may send requested
            transcripts and preview frames to their provider.
          </p>
        </div>
      </section>
      <section className="wrap section faq" id="faq">
        <div>
          <p className="eyebrow">A FEW GOOD QUESTIONS</p>
          <h2>
            Before your
            <br />
            first take.
          </h2>
        </div>
        <div>
          <details>
            <summary>Is it free and open source?</summary>
            <p>
              Yes. The source is available under the MIT license. There are no artificial project or
              recording length limits. Available disk space and your Mac determine capacity. Local
              tools need no API key. Optional cloud providers and connected AI clients use their own
              billing or plans.
            </p>
          </details>
          <details>
            <summary>Which Macs can run it?</summary>
            <p>
              The current download targets Apple silicon Macs running macOS 15 or later. Node.js is
              included with the app. The public beta is Developer ID signed and Apple notarized.
            </p>
          </details>
          <details>
            <summary>Does my recording leave my Mac?</summary>
            <p>
              Recording, editing and Whisper transcription run locally. Model downloads need an
              internet connection. Optional cloud assistance sends the necessary transcript, edit
              context and your prompt to the provider you choose. External MCP clients may also send
              requested transcripts and preview frames to their own provider.
            </p>
          </details>
          <details>
            <summary>Can I edit after exporting?</summary>
            <p>
              Absolutely. Export produces a separate video. The project retains its original media,
              camera intervals, effects and captions for future edits.
            </p>
          </details>
          <details>
            <summary>What permissions does it need?</summary>
            <p>
              Screen recording, camera and microphone permissions depend on what you capture.
              Pointer movement works without Input Monitoring. Enable it for typing activity and
              precise click detection; typed text and key codes are never stored. macOS manages
              these permissions in Privacy & Security.
            </p>
          </details>
          <details>
            <summary>How do I get help or contribute?</summary>
            <p>
              Open an issue on GitHub, suggest an improvement, or email
              <a href="mailto:info@serkanuslu.com" data-event="Contact Click" data-placement="faq">
                info@serkanuslu.com
              </a>
              . Contributions and thoughtful feedback are welcome.
            </p>
          </details>
        </div>
      </section>
      <section className="download wrap" id="download">
        <p className="eyebrow">YOUR NEXT GREAT VIDEO STARTS HERE</p>
        <h2>
          Go on.
          <br />
          Make your <em>next take.</em>
        </h2>
        <p>A small studio for the things you know.</p>
        <a
          className="button"
          data-download
          href={downloadUrl}
          download
          data-event="Download Click"
          data-placement="download"
        >
          Download for Apple silicon <span>↓</span>
        </a>
        <p className="fine">
          v{product.version} · macOS {product.minimumMacOS}+ · {site.RELEASE_LABEL}
        </p>
        <p className="release-note">
          {site.RELEASE_NOTE}
          <br />
          Prefer to build it yourself?
          <a href={product.repository} data-event="Source Click" data-placement="download">
            Get the source.
          </a>
        </p>
      </section>
    </main>
  );
}
