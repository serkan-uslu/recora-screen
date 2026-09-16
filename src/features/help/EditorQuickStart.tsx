import { useState } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/src/components/atoms/IconButton";

const dismissedKey = "screen-recorder.editor-guide-dismissed";

export function EditorQuickStart({ onHelp }: { onHelp: () => void }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissedKey) === "true";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;
  return (
    <aside className="editor-quick-start" aria-label="First edit guide">
      <p>
        <strong>Your first edit</strong> Play to find a moment → Split and delete a clip → Export
        video
      </p>
      <button className="button tiny" onClick={onHelp}>
        Show me how
      </button>
      <IconButton
        label="Dismiss first edit guide"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(dismissedKey, "true");
          } catch {
            /* The guide can still be dismissed when storage is unavailable. */
          }
        }}
      >
        <X size={14} />
      </IconButton>
    </aside>
  );
}
