"use client";

import { useEffect } from "react";
import { initializeAnalytics, track } from "@/website/src/analytics";

export function Analytics() {
  useEffect(() => {
    try {
      if (initializeAnalytics(process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL)) {
        const notice = document.querySelector("#analytics-notice");
        if (notice)
          notice.textContent =
            "Cookie-free site analytics measure visits and button clicks. No desktop analytics.";
      }
    } catch (error) {
      console.warn("Site analytics disabled:", error);
    }

    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest<HTMLElement>("[data-event]") : null;
      if (target)
        track(window.plausible, target.dataset.event!, target.dataset.placement ?? "page");
    };
    const play = (event: Event) => {
      if (event.target instanceof HTMLVideoElement && event.target.dataset.demo)
        track(window.plausible, "Demo Play", event.target.dataset.demo);
    };
    const toggle = (event: Event) => {
      if (event.target instanceof HTMLDetailsElement && event.target.open)
        track(
          window.plausible,
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
