import { product } from "@/shared/brand";

const events = [
  "Download Click",
  "Source Click",
  "Contact Click",
  "Author Link Click",
  "Navigation Click",
  "FAQ Open",
  "Demo Play",
  "MCP Setup Click",
] as const;
type AnalyticsEvent = (typeof events)[number];
export type AnalyticsSink = (event: AnalyticsEvent, properties: Record<string, string>) => void;

/** Only explicit, non-personal properties cross the analytics boundary. */
export function track(sink: AnalyticsSink | undefined, event: string, placement: string) {
  if (!events.includes(event as AnalyticsEvent)) return;
  try {
    sink?.(event as AnalyticsEvent, {
      placement: placement.slice(0, 80),
      version: product.version,
      platform: product.platform,
    });
  } catch {
    /* Analytics must never prevent navigation or downloads. */
  }
}
