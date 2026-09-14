import { useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { type Settings } from "@/src/controllers/studioTypes";

export function AssistantPanel({
  messages,
  settings,
  disabled,
  onSettings,
  onSend,
}: {
  messages: { role: "user" | "assistant"; text: string }[];
  settings: Settings | null;
  disabled: boolean;
  onSettings: () => void;
  onSend: (prompt: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const configured =
    settings?.provider === "anthropic" ? settings.hasAnthropicKey : settings?.hasOpenaiKey;
  return (
    <div className="assistant-panel">
      <div className="assistant-intro">
        <span>
          <Sparkles size={22} />
        </span>
        <h3>Your creative co-pilot.</h3>
        <p>
          Describe the edit.
          <br />
          Keep the creative decisions.
        </p>
      </div>
      {!configured && (
        <div className="inline-note">
          <p>Connect your own OpenAI or Anthropic API key to use the assistant.</p>
          <button className="button secondary full" onClick={onSettings}>
            Connect an API key
          </button>
        </div>
      )}
      <div className="assistant-examples">
        <span>TRY SOMETHING LIKE</span>
        {[
          "Hide my camera for the first 20 seconds.",
          "Add a title to the opening five seconds.",
          "Write a YouTube description and chapters.",
        ].map((example) => (
          <button key={example} onClick={() => setPrompt(example)}>
            {example}
            <ArrowRight size={13} />
          </button>
        ))}
      </div>
      <div className="chat-messages" aria-live="polite">
        {messages.map((message, i) => (
          <div className={`chat-message ${message.role}`} key={i}>
            <span>{message.role === "user" ? "YOU" : "ASSISTANT"}</span>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      <form
        className="assistant-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!prompt.trim() || disabled || !configured) return;
          const value = prompt.trim();
          setPrompt("");
          void onSend(value);
        }}
      >
        <textarea
          aria-label="Ask AI assistant"
          placeholder="What would you like to change?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <div>
          <span>{settings?.provider === "anthropic" ? "Anthropic" : "OpenAI"}</span>
          <button
            aria-label="Send to assistant"
            disabled={disabled || !configured || !prompt.trim()}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
      <p className="helper assistant-privacy">
        <ShieldCheck size={11} />
        Only transcript, edit information, and your request are sent to your provider.
      </p>
    </div>
  );
}
