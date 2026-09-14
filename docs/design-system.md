# Design system

Desktop and website both import `design-system/tokens.css`. Change the base color codes there to rebrand both surfaces; no React edits are required.

```css
:root {
  --color-accent: #9fc9ff; /* primary actions, focus and accent tints */
  --bg: #151717;
  --surface: #1b1d1d;
  --raised: #222424;
  --line: #2c2f2e;
  --text: #e8e9e5;
  --color-neutral: #858c89;
}
```

The app's existing decorative tints are derived with CSS `color-mix`; accent changes propagate to those tints. Camera, info/audio, warning and danger each have semantic base colors so editing tracks and error states remain distinguishable. White and black tokens are mixing endpoints. Recheck contrast after changing them.

Use existing `--accent`, `--bg`, `--surface`, `--text`, `--muted`, `--line` aliases in new components. Typography and radius tokens are in the same file. Desktop layout styles remain in `src/styles.css`; responsive marketing styles live in `website/src/styles.css` so desktop minimum widths cannot leak into the site.

Project canvas colors, overlay colors and subtitle colors are user content. They intentionally remain part of each project rather than changing when the application theme changes. The temporary product mark is `design-system/product-icon.svg`; the app imports it and the website build copies it to `icon.svg`. Final rebranding waits for the separate name decision.

Use semantic HTML, visible keyboard focus, labels for controls and the shared native `Dialog` for modal focus management. Help and About are available only from the Projects sidebar. Author links are centralized in `shared/brand.ts`.

The configured macOS icons are generated from the same temporary SVG, preserving the app identifier and project storage paths:

```sh
npx tauri icon design-system/product-icon.svg -o .cache/product-icons
cp .cache/product-icons/32x32.png .cache/product-icons/128x128.png .cache/product-icons/128x128@2x.png .cache/product-icons/icon.icns src-tauri/icons/
```

Product version, platform, description and URLs come from `shared/brand.ts`; the MCP server version reads `package.json`. Compatibility marks are documented separately in `THIRD_PARTY_NOTICES.md`.
