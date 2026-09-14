import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { product, release } from "@/shared/brand";
import { siteValues, replaceSiteValues } from "@/website/src/site-config";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, root), ...process.env };
  const values = siteValues(
    env.VITE_SITE_URL || product.website,
    env.VITE_DOWNLOAD_URL || release.downloadUrl,
  );
  return {
    root,
    resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    base: "./",
    server: { host: "127.0.0.1", port: 4174, strictPort: true },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    build: { outDir: "dist", emptyOutDir: true },
    plugins: [
      {
        name: "product-metadata",
        transformIndexHtml(html) {
          return replaceSiteValues(html, values);
        },
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "robots.txt",
            source: `User-agent: *\nAllow: /\nSitemap: ${values.SITE_URL}sitemap.xml\n`,
          });
          this.emitFile({
            type: "asset",
            fileName: "sitemap.xml",
            source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${values.SITE_URL.replaceAll("&", "&amp;")}</loc></url></urlset>`,
          });
        },
      },
    ],
  };
});
