# Design system

Desktop and website both import `design-system/tokens.css`. The desktop uses its shared dark palette. The marketing website overrides surface and text tokens in `website/src/styles.css` with a light, WCAG AA palette while retaining the same semantic token names.

```css
:root {
  --color-accent: #4ade80; /* primary actions, focus and accent tints */
  --bg: #10111a;
  --surface: #171824;
  --raised: #202131;
  --line: #34364a;
  --text: #f5f5fa;
  --color-neutral: #a5a9b8;
}
```

The app's existing decorative tints are derived with CSS `color-mix`; accent changes propagate to those tints. Camera, info/audio, warning and danger each have semantic base colors so editing tracks and error states remain distinguishable. White and black tokens are mixing endpoints. Recheck contrast after changing them.

Use existing `--accent`, `--bg`, `--surface`, `--text`, `--muted`, `--line` aliases in new components. Typography and radius tokens are in the same file. Desktop layout styles remain in `src/styles.css`; responsive marketing styles live in `website/src/styles.css` so desktop minimum widths cannot leak into the site.

Project canvas colors, overlay colors and subtitle colors are user content. They intentionally remain part of each project rather than changing when the application theme changes. The Recora Screen product mark is `design-system/product-icon.svg`; the app imports it and the website build copies it to `icon.svg`.

Use semantic HTML, visible keyboard focus, labels for controls and the shared native `Dialog` for modal focus management. Help and About are available only from the Projects sidebar. Author links are centralized in `shared/brand.ts`.

The marketing header stays fixed with a full-width surface and an inner content container. Its current section uses `aria-current`. Hero motion is limited to the recording pulse and typewriter value proposition; both stop when the visitor requests reduced motion.

The configured macOS icons are generated from the same SVG, preserving the app identifier and project storage paths:

```sh
npx tauri icon design-system/product-icon.svg -o .cache/product-icons
cp .cache/product-icons/32x32.png .cache/product-icons/128x128.png .cache/product-icons/128x128@2x.png .cache/product-icons/icon.icns src-tauri/icons/
```

Product version, platform, description and URLs come from `shared/brand.ts`; the MCP server version reads `package.json`. Compatibility marks are documented separately in `THIRD_PARTY_NOTICES.md`.
