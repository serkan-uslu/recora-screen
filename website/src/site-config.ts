import { product, release } from "@/shared/brand";

function httpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Public site and download URLs must use HTTPS without credentials");
  return url;
}

export function siteValues(site: string, download = "") {
  const url = httpsUrl(site);
  if (url.search || url.hash) throw new Error("Site URL must not include a query or fragment");
  url.pathname = url.pathname.replace(/\/?$/, "/");
  const beta = String(release.status) === "public-beta";
  return {
    PRODUCT_NAME: product.name,
    PRODUCT_DESCRIPTION: product.description,
    SITE_URL: url.href,
    SOCIAL_IMAGE: new URL("media/editor.jpg", url).href,
    REPOSITORY: product.repository,
    VERSION: product.version,
    MINIMUM_MACOS: product.minimumMacOS,
    LICENSE: product.license,
    DOWNLOAD_URL: download ? httpsUrl(download).href : `./downloads/${release.assetName}`,
    RELEASE_LABEL: beta ? "Public beta" : "Development preview",
    RELEASE_NOTE: beta
      ? "Public beta for Apple silicon. See release notes for known limitations."
      : "Preview build: public beta validation and notarization are pending.",
  };
}

export function replaceSiteValues(html: string, values: Record<string, string>) {
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Unknown site placeholder: ${key}`);
    return values[key]!.replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  });
}
