import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectSaveState,
  subscribeProjectSave,
  trackProjectWrite,
} from "@/src/services/projectSaveState";

test("save status follows project persistence, keeps failures visible, and ignores non-edit work", async () => {
  const projectId = "save-status-fixture";
  const seen: string[] = [];
  const unsubscribe = subscribeProjectSave(() => seen.push(projectSaveState(projectId)));
  let release = () => {};
  const pending = trackProjectWrite(
    "timeline.apply",
    { projectId },
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  assert.equal(projectSaveState(projectId), "saving");
  assert.equal(projectSaveState("other-project"), "saved");
  await assert.rejects(
    trackProjectWrite("asset.import", { projectId }, async () => {
      throw new Error("disk full");
    }),
    /disk full/,
  );
  assert.equal(projectSaveState(projectId), "saving");
  release();
  await pending;
  assert.equal(projectSaveState(projectId), "failed");
  await trackProjectWrite("preview.load", { projectId }, async () => true);
  assert.equal(projectSaveState(projectId), "failed");
  assert.equal(
    await trackProjectWrite("project.save", { projectId }, async () => "persisted"),
    "persisted",
  );
  assert.equal(projectSaveState(projectId), "saved");
  unsubscribe();
  assert.deepEqual(seen, ["saving", "saving", "saving", "failed", "saving", "saved"]);
});
