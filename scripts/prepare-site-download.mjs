import { copyFile, mkdir, rm, readFile } from "node:fs/promises";
import { loadEnv } from "vite";
const productPackage = JSON.parse(await readFile("package.json", "utf8"));
const file = `Screen-Recorder_${productPackage.version}_macOS-arm64.dmg`;
await copyFile("design-system/product-icon.svg", "website/public/icon.svg");
const env = { ...loadEnv("production", "website"), ...process.env };
if (env.VITE_DOWNLOAD_URL) {
  const url = new URL(env.VITE_DOWNLOAD_URL);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("VITE_DOWNLOAD_URL must use HTTPS");
  await rm(`website/public/downloads/${file}`, { force: true });
} else {
  await mkdir("website/public/downloads", { recursive: true });
  try {
    await copyFile(
      `src-tauri/target/release/bundle/dmg/${file}`,
      `website/public/downloads/${file}`,
    );
  } catch (error) {
    throw new Error(
      "Build the desktop DMG first with npm run desktop:build, or configure VITE_DOWNLOAD_URL in website/.env.local.",
      { cause: error },
    );
  }
}
