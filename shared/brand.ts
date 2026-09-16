import packageInfo from "@/package.json";

export const author = {
  name: "Serkan Uslu",
  github: "https://github.com/serkan-uslu",
  medium: "https://medium.com/@serkan-uslu",
  website: "https://serkanuslu.com",
  email: "info@serkanuslu.com",
  repository: "https://github.com/serkan-uslu/recora-screen",
} as const;

// Display branding may change; bundle IDs, storage paths and MCP tool names do not.
export const product = {
  name: "Recora Screen",
  description: "The open-source screen recorder you can control with Claude and Codex.",
  tagline: "The screen recorder you can edit with Claude or Codex",
  website: "https://recora-screen.vercel.app/",
  repository: author.repository,
  version: packageInfo.version,
  platform: "macOS-arm64",
  minimumMacOS: "15",
  license: "MIT",
} as const;

export const release = {
  status: "development-preview",
  // Set only after the exact signed, notarized artifact passes release acceptance.
  downloadUrl: "",
  assetName: `Recora-Screen_${product.version}_macOS-arm64.dmg`,
} as const;
