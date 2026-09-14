import "@/website/src/styles.css";
import { author } from "@/shared/brand";
import { initializeAnalytics, track } from "@/website/src/analytics";

try {
  if (initializeAnalytics(import.meta.env.VITE_PLAUSIBLE_SCRIPT_URL)) {
    document.querySelector("#analytics-notice")!.textContent =
      "Cookie-free site analytics measure visits and button clicks. No desktop analytics.";
  }
} catch (error) {
  console.warn("Site analytics disabled:", error);
}

for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-author]")) {
  const key = link.dataset.author as keyof typeof author;
  link.href = author[key];
  link.dataset.event ??= "Author Link Click";
  link.dataset.placement ??= key;
}
document.addEventListener("click", (event) => {
  const target =
    event.target instanceof Element ? event.target.closest<HTMLElement>("[data-event]") : null;
  if (target) track(window.plausible, target.dataset.event!, target.dataset.placement ?? "page");
});
for (const video of document.querySelectorAll<HTMLVideoElement>("video[data-demo]")) {
  video.addEventListener("play", () =>
    track(window.plausible, "Demo Play", video.dataset.demo ?? "mcp"),
  );
}
for (const [index, details] of [...document.querySelectorAll("details")].entries()) {
  details.addEventListener("toggle", () => {
    if (details.open) track(window.plausible, "FAQ Open", `question-${index + 1}`);
  });
}
