export const events = [
  "Download Click",
  "Source Click",
  "Contact Click",
  "Author Link Click",
  "Navigation Click",
  "Feature Preview",
  "FAQ Open",
] as const;
export type AnalyticsEvent = (typeof events)[number];
export type AnalyticsSink = (
  event: AnalyticsEvent,
  options: { props: Record<string, string> },
) => void;

/** Only explicit, non-personal properties cross the analytics boundary. */
export function track(
  sink: AnalyticsSink | undefined,
  event: string,
  placement: string,
) {
  if (!events.includes(event as AnalyticsEvent)) return;
  try {
    sink?.(event as AnalyticsEvent, {
      props: {
        placement: placement.slice(0, 80),
        version: "0.1.0",
        platform: "macOS-arm64",
      },
    });
  } catch {
    /* Analytics must never prevent navigation or downloads. */
  }
}

type Plausible = AnalyticsSink & {
  q?: unknown[];
  init: (options?: object) => void;
  o?: object;
};
declare global {
  interface Window {
    plausible?: Plausible;
  }
}

export function initializeAnalytics(scriptUrl: string | undefined) {
  if (
    !scriptUrl ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl
  )
    return;
  const url = new URL(scriptUrl);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Analytics script must use HTTPS");
  const queued = ((...args: unknown[]) => {
    (queued.q ??= []).push(args);
  }) as Plausible;
  queued.init = (options = {}) => {
    queued.o = options;
  };
  window.plausible = queued;
  queued.init({ fileDownloads: false, outboundLinks: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = url.href;
  document.head.append(script);
  return queued;
}
