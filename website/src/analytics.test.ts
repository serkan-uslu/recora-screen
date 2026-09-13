import test from "node:test";
import assert from "node:assert/strict";
import { track } from "./analytics";

test("analytics records intentional clicks, rejects unknown events and cannot break downloads", () => {
  const received: unknown[] = [];
  const sink = (...args: unknown[]) => {
    received.push(args);
  };
  track(sink, "Download Click", "download");
  track(sink, "untrusted-event", "ignored");
  assert.deepEqual(received, [
    [
      "Download Click",
      {
        props: {
          placement: "download",
          version: "0.1.0",
          platform: "macOS-arm64",
        },
      },
    ],
  ]);
  assert.doesNotThrow(() => track(undefined, "Download Click", "download"));
  assert.doesNotThrow(() =>
    track(
      () => {
        throw new Error("blocked");
      },
      "Download Click",
      "download",
    ),
  );
});
