import { type Range } from "@/shared/types";
import { formatTimecode } from "@/src/lib/format";

export function RangeSummary({ selection }: { selection: Range }) {
  return (
    <div className="range-summary">
      <span>{selection.endMs > selection.startMs ? "Selected time" : "Select a time range"}</span>
      <code>
        {formatTimecode(selection.startMs)} — {formatTimecode(selection.endMs)}
      </code>
    </div>
  );
}
