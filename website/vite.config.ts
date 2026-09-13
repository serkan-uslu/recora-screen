import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig(({ mode }) => {
  const download = loadEnv(mode, root).VITE_DOWNLOAD_URL;
  if (download && new URL(download).protocol !== "https:")
    throw new Error("Download URL must use HTTPS");
  return {
    root,
    base: "./",
    server: { host: "127.0.0.1", port: 4174, strictPort: true },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    build: { outDir: "dist", emptyOutDir: true },
    plugins: [
      {
        name: "release-download-link",
        transformIndexHtml(html) {
          // Keep downloads working when JavaScript or analytics is blocked.
          return download
            ? html.replace(
                'href="./downloads/Screen-Recorder_0.1.0_macOS-arm64.dmg"',
                `href="${new URL(download).href.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`,
              )
            : html;
        },
      },
    ],
  };
});
