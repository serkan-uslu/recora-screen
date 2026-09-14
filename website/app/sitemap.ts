import type { MetadataRoute } from "next";
import { site } from "@/website/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${site.SITE_URL}documentation/`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
