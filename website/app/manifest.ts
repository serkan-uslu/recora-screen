import type { MetadataRoute } from "next";
import { product } from "@/shared/brand";
import { assetPath } from "@/website/lib/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: product.name,
    short_name: product.name,
    description: product.description,
    start_url: assetPath(""),
    display: "standalone",
    background_color: "#151717",
    theme_color: "#d8ec97",
    icons: [{ src: assetPath("icon.svg"), sizes: "any", type: "image/svg+xml" }],
  };
}
