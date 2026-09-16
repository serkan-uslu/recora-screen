import type { CameraLayoutSettings, Project, Range } from "@/shared/types.js";

export type CameraRun = CameraLayoutSettings & Range;
export const cameraLayoutSettings = ({
  shape,
  x,
  y,
  size,
  shadow,
  mirror,
  radius,
  shadowOpacity,
  zoomReactive,
}: CameraLayoutSettings): CameraLayoutSettings => ({
  shape,
  x,
  y,
  size,
  shadow,
  ...(mirror === undefined ? {} : { mirror }),
  ...(radius === undefined ? {} : { radius }),
  ...(shadowOpacity === undefined ? {} : { shadowOpacity }),
  ...(zoomReactive === undefined ? {} : { zoomReactive }),
});
export const sameCameraLayout = (a: CameraLayoutSettings, b: CameraLayoutSettings) =>
  a.shape === b.shape &&
  a.x === b.x &&
  a.y === b.y &&
  a.size === b.size &&
  a.shadow === b.shadow &&
  (a.mirror ?? false) === (b.mirror ?? false) &&
  (a.radius ?? 0.09) === (b.radius ?? 0.09) &&
  (a.shadowOpacity ?? 0.4) === (b.shadowOpacity ?? 0.4) &&
  (a.zoomReactive ?? false) === (b.zoomReactive ?? false);

/** Project source layouts onto output time; cuts within one target never restart its transition. */
export function cameraOutputLayouts(project: Pick<Project, "edits">): CameraRun[] {
  const { camera, segments } = project.edits;
  const layouts = camera.layouts;
  const runs: CameraRun[] = [];
  let elapsed = 0;
  for (const segment of segments) {
    if (segment.assetId) {
      const endMs = elapsed + (segment.endMs - segment.startMs) / (segment.speed ?? 1);
      runs.push({ ...cameraLayoutSettings(camera), startMs: elapsed, endMs });
      elapsed = endMs;
      continue;
    }
    let source = segment.startMs,
      index = 0;
    while (source < segment.endMs) {
      while (index < layouts.length && layouts[index]!.endMs <= source) index++;
      const layout = layouts[index];
      const active = layout && layout.startMs <= source;
      const end = Math.min(
        segment.endMs,
        active ? layout.endMs : (layout?.startMs ?? segment.endMs),
      );
      const target = active ? layout : camera;
      const next = elapsed + (end - source) / (segment.speed ?? 1);
      const last = runs.at(-1);
      if (last && sameCameraLayout(last, target)) last.endMs = next;
      else runs.push({ ...cameraLayoutSettings(target), startMs: elapsed, endMs: next });
      elapsed = next;
      source = end;
    }
  }
  return runs;
}

/** The native compositor uses this same centered, output-time smoothstep rule. */
export function cameraAt(project: Pick<Project, "edits">, timeMs: number): CameraLayoutSettings {
  const runs = cameraOutputLayouts(project);
  for (let index = 1; index < runs.length; index++) {
    const before = runs[index - 1]!,
      after = runs[index]!;
    const transition = Math.min(300, before.endMs - before.startMs, after.endMs - after.startMs);
    const start = after.startMs - transition / 2;
    if (timeMs < start || timeMs > start + transition) continue;
    const progress = Math.max(0, Math.min(1, (timeMs - start) / transition));
    const eased = progress * progress * (3 - 2 * progress);
    return {
      ...cameraLayoutSettings(progress < 0.5 ? before : after),
      x: before.x + (after.x - before.x) * eased,
      y: before.y + (after.y - before.y) * eased,
      size: before.size + (after.size - before.size) * eased,
    };
  }
  return cameraLayoutSettings(
    runs.find((run) => timeMs < run.endMs) ?? runs.at(-1) ?? project.edits.camera,
  );
}
