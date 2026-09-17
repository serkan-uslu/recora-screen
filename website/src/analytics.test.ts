import test from "node:test";
import assert from "node:assert/strict";
import { product } from "@/shared/brand";
import { track } from "@/website/src/analytics";

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
          version: product.version,
          platform: product.platform,
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
