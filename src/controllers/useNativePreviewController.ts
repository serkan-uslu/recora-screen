import { useEffect, useRef, useState } from "react";
import { type Project } from "@/shared/types";
import { outputSize } from "@/shared/timeline";
import { command, desktop, messageOf } from "@/src/api";

export function useNativePreviewController({
  project,
  hidden,
  onError,
}: {
  project: Project;
  hidden: boolean;
  onError: (error: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const output = outputSize(project);
  const aspect = output.width / output.height;
  const previewWidth = Math.min(stageSize.width, stageSize.height * aspect);
  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setStageSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!desktop) {
      setReady(true);
      return;
    }
    setReady(false);
    void command("preview.load", { projectId: project.id })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) onError(messageOf(e));
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, onError]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !desktop) return;
    const bounds = () => {
      const r = el.getBoundingClientRect();
      void command("preview.bounds", {
        x: r.x,
        y: r.y,
        width: hidden || !ready ? 0 : r.width,
        height: hidden || !ready ? 0 : r.height,
      }).catch(() => {});
    };
    bounds();
    const observer = new ResizeObserver(bounds);
    observer.observe(el);
    window.addEventListener("resize", bounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", bounds);
      void command("preview.bounds", { x: 0, y: 0, width: 0, height: 0 }).catch(() => {});
    };
  }, [hidden, ready]);
  return {
    desktop,
    ref,
    stageRef,
    aspect,
    previewWidth,
    ready,
  };
}
