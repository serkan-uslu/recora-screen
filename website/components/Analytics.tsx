"use client";

import { track as trackVercel } from "@vercel/analytics";
import { useEffect } from "react";
import { track } from "@/website/src/analytics";

export function Analytics() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest<HTMLElement>("[data-event]") : null;
      if (target) track(trackVercel, target.dataset.event!, target.dataset.placement ?? "page");
    };
    const play = (event: Event) => {
      if (event.target instanceof HTMLVideoElement && event.target.dataset.demo)
        track(trackVercel, "Demo Play", event.target.dataset.demo);
    };
    const toggle = (event: Event) => {
      if (event.target instanceof HTMLDetailsElement && event.target.open)
        track(
          trackVercel,
          "FAQ Open",
          event.target.querySelector("summary")?.textContent ?? "question",
        );
    };
    document.addEventListener("click", click);
    document.addEventListener("play", play, true);
    document.addEventListener("toggle", toggle, true);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("play", play, true);
      document.removeEventListener("toggle", toggle, true);
    };
  }, []);

  return null;
}
