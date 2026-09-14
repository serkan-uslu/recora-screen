import test from "node:test";
import assert from "node:assert/strict";
import { siteValues } from "@/website/src/site-config";

test("Pages metadata preserves its project path and rejects unsafe deployment URLs", () => {
  const values = siteValues(
    "https://example.github.io/screen-recorder",
    "https://github.com/a/b/releases/download/v1/app.dmg?x=1&y=2",
  );
  assert.equal(values.SOCIAL_IMAGE, "https://example.github.io/screen-recorder/media/editor.jpg");
  assert.equal(values.DOWNLOAD_URL, "https://github.com/a/b/releases/download/v1/app.dmg?x=1&y=2");
  assert.throws(() => siteValues("http://example.com"));
  assert.throws(() => siteValues("https://user:password@example.com"));
  assert.throws(() => siteValues("https://example.com/?campaign=foo"));
  assert.throws(() => siteValues("https://example.com", "javascript:alert(1)"));
});
