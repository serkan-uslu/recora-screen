import { useState } from "react";
import { AudioLines, Check, Download, Keyboard, Save, Sparkles, Trash2 } from "lucide-react";
import { Field } from "@/src/components/molecules/Field";
import { Dialog } from "@/src/components/organisms/Dialog";
import { formatMcpConfig, type McpClient } from "@/shared/mcp-config";
import { type Settings, type McpConfig, type Model } from "@/src/controllers/studioTypes";

export function SettingsDialog({
  settings,
  mcp,
  models,
  busy,
  onClose,
  onSave,
  onKey,
  onDownload,
}: {
  settings: Settings | null;
  mcp?: McpConfig | null;
  models: Model[];
  busy: boolean;
  onClose: () => void;
  onSave: (settings: Record<string, unknown>) => void;
  onKey: (provider: string, key: string) => Promise<void>;
  onDownload: (model: string) => void;
}) {
  const [section, setSection] = useState("ai");
  const [provider, setProvider] = useState(settings?.provider || "openai");
  const [key, setKey] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [client, setClient] = useState<McpClient>("codex");
  const mcpConfig = mcp ? formatMcpConfig(client, mcp) : "";
  return (
    <Dialog
      wide
      title="Make yourself at home."
      subtitle="Local AI, your own API keys, and a workspace open to your tools."
      onClose={onClose}
    >
      <div className="settings-tabs">
        <button className={section === "ai" ? "active" : ""} onClick={() => setSection("ai")}>
          <Sparkles size={14} />
          AI & models
        </button>
        <button className={section === "mcp" ? "active" : ""} onClick={() => setSection("mcp")}>
          <Keyboard size={14} />
          MCP & shortcuts
        </button>
      </div>
      {section === "ai" ? (
        <>
          <h3 className="panel-section">LOCAL TRANSCRIPTION</h3>
          <p className="helper">
            Download a multilingual Whisper model once. Transcribe in English, Turkish, or another
            supported language without an internet connection. Silence cleanup also runs locally and
            requires a microphone track; review its suggested cuts before applying them.
          </p>
          <div className="model-list">
            {models.map((model) => (
              <div key={model.id}>
                <span className="model-icon">
                  <AudioLines size={20} />
                </span>
                <div>
                  <strong>
                    {model.name || model.id}
                    <span>{model.id === "small" ? "RECOMMENDED" : "LIGHTWEIGHT"}</span>
                  </strong>
                  <p>
                    {Math.round(model.bytes / 1024 / 1024)} MB ·{" "}
                    {model.id === "small" ? "More accurate" : "Less memory"}
                  </p>
                </div>
                {model.installed ? (
                  <span className="model-installed">
                    <Check size={14} />
                    Installed
                  </span>
                ) : (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => onDownload(model.id)}
                  >
                    <Download size={14} />
                    Download
                  </button>
                )}
              </div>
            ))}
          </div>
          <form
            key={JSON.stringify(settings)}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              onSave({
                transcriptionModel: String(form.get("model")),
                language: String(form.get("language")),
                provider,
                openaiModel: String(form.get("openaiModel")),
                anthropicModel: String(form.get("anthropicModel")),
              });
            }}
          >
            <div className="two-columns">
              <Field label="Default model">
                <select name="model" defaultValue={settings?.transcriptionModel || "small"}>
                  <option value="small">Small · multilingual</option>
                  <option value="base">Base · multilingual</option>
                </select>
              </Field>
              <Field label="Transcription language">
                <select name="language" defaultValue={settings?.language || "auto"}>
                  <option value="auto">Detect automatically</option>
                  <option value="en">English</option>
                  <option value="tr">Turkish</option>
                </select>
              </Field>
            </div>
            <div className="panel-divider" />
            <h3 className="panel-section">YOUR AI ASSISTANT</h3>
            <p className="helper">
              Optional. Your message, transcript and editing context go to the selected provider;
              original recordings are not uploaded by this assistant. The app is free; provider API
              usage is billed separately.
            </p>
            <Field label="Provider">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as "openai" | "anthropic")}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </Field>
            <div className="two-columns">
              <Field label="OpenAI model">
                <input
                  name="openaiModel"
                  required
                  defaultValue={settings?.openaiModel || ""}
                  placeholder="Model ID"
                />
              </Field>
              <Field label="Anthropic model">
                <input
                  name="anthropicModel"
                  required
                  defaultValue={settings?.anthropicModel || ""}
                  placeholder="Model ID"
                />
              </Field>
            </div>
            <div className="dialog-actions">
              <button className="button primary" disabled={busy}>
                <Save size={14} />
                Save preferences
              </button>
            </div>
          </form>
          <div className="panel-divider" />
          <Field
            label={`${provider === "openai" ? "OpenAI" : "Anthropic"} API key`}
            hint="Stored in macOS Keychain. Never stored in your project."
          >
            <div className="input-action">
              <input
                type="password"
                autoComplete="off"
                value={key}
                placeholder={
                  (provider === "openai" ? settings?.hasOpenaiKey : settings?.hasAnthropicKey)
                    ? "A key is saved in Keychain"
                    : "Paste your API key"
                }
                onChange={(e) => setKey(e.target.value)}
              />
              <button
                className="button secondary"
                disabled={!key.trim() || busy}
                onClick={() => {
                  void (async () => {
                    await onKey(provider, key.trim());
                    setKey("");
                  })();
                }}
              >
                Save key
              </button>
            </div>
          </Field>
          {(provider === "openai" ? settings?.hasOpenaiKey : settings?.hasAnthropicKey) && (
            <button
              className="button subtle danger-text"
              disabled={busy}
              onClick={() => void onKey(provider, "")}
            >
              <Trash2 size={13} />
              Remove saved key
            </button>
          )}
        </>
      ) : (
        <>
          <div className="mcp-intro">
            <div className="mcp-badge">MCP</div>
            <h3>Your entire studio, one conversation away.</h3>
            <p>
              Let Claude or Codex create projects, record, edit, transcribe, and export through the
              same commands as this app.
            </p>
          </div>
          <h3 className="panel-section">CONNECT YOUR CLIENT</h3>
          <p className="helper">
            Keep Screen Recorder running while using your client. The command below uses this
            installation’s bundled runtime; no separate Node installation is needed. Copy it again
            if you move the app.
          </p>
          <Field label="MCP client">
            <select
              value={client}
              onChange={(event) => {
                setClient(event.target.value as McpClient);
                setCopyStatus("");
              }}
            >
              <option value="codex">Codex · TOML</option>
              <option value="claude-code">Claude Code · Terminal command</option>
              <option value="claude-desktop">Claude Desktop · JSON</option>
            </select>
          </Field>
          <p className="helper">
            {client === "codex"
              ? "Merge this into ~/.codex/config.toml, preserving your other servers, then reconnect Codex. If you use a custom CODEX_HOME, use its config.toml instead."
              : client === "claude-code"
                ? "Run this in Terminal to add the server for your user account. Run claude mcp get screen-recorder to check it, then use /mcp in Claude Code."
                : "Merge this server into ~/Library/Application Support/Claude/claude_desktop_config.json, preserving other entries, then fully quit and reopen Claude Desktop."}
          </p>
          {mcp ? (
            <pre className="config-example">{mcpConfig}</pre>
          ) : (
            <p className="inline-note" role="status">
              The bundled runtime path is unavailable. Open the desktop app and reopen Settings.
              Browser development mode does not provide a packaged MCP configuration.
            </p>
          )}
          <button
            className="button secondary full"
            disabled={!mcp}
            onClick={() =>
              void navigator.clipboard
                .writeText(mcpConfig)
                .then(() => setCopyStatus("Copied to clipboard"))
                .catch(() => setCopyStatus("Select and copy the configuration above."))
            }
          >
            {copyStatus ||
              (client === "claude-code" ? "Copy Terminal command" : "Copy MCP configuration")}
          </button>
          <p className="helper" role="status" aria-live="polite">
            {copyStatus}
          </p>
          <div className="inline-note">
            macOS recording permissions are granted through the app. Connecting MCP does not bypass
            them. Your client can read transcripts and requested preview frames and may send them to
            its model provider. MCP requires no API key in this app; your client’s plan or usage
            charges may still apply.
          </div>
          <h3 className="panel-section">KEYBOARD SHORTCUTS</h3>
          <div className="shortcut-list">
            <span>
              Save draft<kbd>⌘ S</kbd>
            </span>
            <span>
              Undo<kbd>⌘ Z</kbd>
            </span>
            <span>
              Redo<kbd>⇧ ⌘ Z</kbd>
            </span>
            <span>
              Play / pause preview<kbd>Space</kbd>
            </span>
            <span>
              Split at playhead<kbd>S</kbd>
            </span>
            <span>
              Set up recording<kbd>⇧ ⌘ R</kbd>
            </span>
            <span>
              Pause / resume recording (global)<kbd>⇧ ⌘ 9</kbd>
            </span>
            <span>
              Stop recording (global)<kbd>⇧ ⌘ 0</kbd>
            </span>
          </div>
        </>
      )}
    </Dialog>
  );
}
