import type { MetadataRoute } from "next";
import { site } from "@/website/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${site.SITE_URL}sitemap.xml` };
}
