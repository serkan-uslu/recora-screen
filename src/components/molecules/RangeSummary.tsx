import { type Range } from "../../../shared/types";
import { seconds } from "../../lib/format";

export function RangeSummary({ selection }: { selection: Range }) {
  return (
    <div className="range-summary">
      <span>Selected range</span>
      <code>
        {seconds(selection.startMs)}s — {seconds(selection.endMs)}s
      </code>
    </div>
  );
}
