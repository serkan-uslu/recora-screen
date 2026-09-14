import { product, release } from "@/shared/brand";
import { siteValues } from "@/website/src/site-config";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
export const site = siteValues(
  process.env.NEXT_PUBLIC_SITE_URL || product.website,
  process.env.NEXT_PUBLIC_DOWNLOAD_URL || release.downloadUrl,
);

export function assetPath(path: string) {
  return `${basePath}/${path.replace(/^\/+/, "")}`;
}

export const downloadUrl =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL ||
  release.downloadUrl ||
  assetPath(`downloads/${release.assetName}`);
