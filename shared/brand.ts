import packageInfo from "@/package.json";

export const author = {
  name: "Serkan Uslu",
  github: "https://github.com/serkan-uslu",
  linkedin: "https://www.linkedin.com/in/serkan-uslu",
  medium: "https://medium.com/@serkan-uslu",
  website: "https://serkanuslu.com",
  email: "info@serkanuslu.com",
  repository: "https://github.com/serkan-uslu/recora-screen",
} as const;

// Bundle IDs and storage paths stay stable so upgrades retain permissions and projects.
export const product = {
  name: "Recora Screen",
  mcpServerName: "recora-screen",
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
  status: "public-beta",
  downloadUrl:
    "https://github.com/serkan-uslu/recora-screen/releases/download/v0.1.1/Recora-Screen_0.1.1_macOS-arm64.dmg",
  assetName: `Recora-Screen_${product.version}_macOS-arm64.dmg`,
} as const;
