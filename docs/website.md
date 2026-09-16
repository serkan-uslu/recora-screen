# Product website

The site uses Next.js App Router, React, TypeScript and the shared desktop theme tokens. The landing page and documentation share one root layout, header, footer, analytics boundary and metadata configuration. The fixed header keeps the primary links in an accessible mobile menu. It does not ship the recorder service or user projects to visitors. All public copy is English. Vercel Web Analytics is mounted in the root layout for cookie-free pageview measurement; enable Analytics in the Vercel project dashboard after deployment.

```sh
npm run dev:site      # http://127.0.0.1:4174/
npm run build:site    # website/out
npm run preview:site  # preview website/out on port 4174
npm run test:site
```

Stop the development server before using the preview server on the same port. The public address is `https://recora-screen.vercel.app/`. Running or building locally does not publish the site.

## Content and metadata

`shared/brand.ts` supplies product name, description, version, platform, repository, site URL and release state. `website/app/layout.tsx` owns shared structure and default metadata; each route adds only page-specific metadata and content. The name is provisional. Display branding may change later; bundle IDs, storage paths and MCP commands remain stable.

The hero presents MCP control through Claude and Codex below **Edit less.**, followed by a real desktop capture at `website/public/media/editor.jpg` using a clean demonstration project. The MCP section links separately to Codex, Claude Code and Claude Desktop setup. Requests are labelled as examples, not fabricated assistant transcripts. Only captured, reviewed command/result footage should be embedded as a demo video.

Feature copy covers capture, editing, zooms, framing, projects, export, optional local/cloud AI, permissions and privacy. Silence cleanup requires a microphone track. External MCP clients may send requested transcript and preview content to their provider; this differs from local recording and the optional in-app cloud assistant.

Next.js prerenders HTML for `/` and `/documentation/` and generates canonical, Open Graph/Twitter metadata, `robots.txt`, `sitemap.xml` and the web manifest. The actual editor image is the provisional social image. Favicon and header icons use the shared `design-system/product-icon.svg` source.

## Downloads and publication

`NEXT_PUBLIC_SITE_URL` overrides the planned public URL and requires HTTPS without credentials, query or fragment. `NEXT_PUBLIC_DOWNLOAD_URL` replaces the local preview download with an HTTPS release asset URL. These values are public; never place private credentials in `NEXT_PUBLIC_` settings.

Vercel uses the public GitHub Releases download URL from `vercel.json`, so its Linux build does not depend on a locally built macOS DMG. The framework preset is `null` because Vercel serves the generated `website/out` directory as static files rather than as a Next.js server build.

Without a download override, `build:site` copies the current packaged Apple silicon DMG into the ignored `website/public/downloads/` directory. Run `npm run desktop:build` first. A missing local DMG fails the site build instead of producing a broken download. This is a **development preview**, not a verified public beta. Rebuilding can change its checksum under the same development filename.

Vercel deploys the static output from `main` using `vercel.json`. After publication, verify fresh loads of `/` and `/documentation/`, image/assets/favicon, canonical/social URLs, sitemap, MCP links, keyboard navigation and the real DMG transfer. Local builds do not create a release, analytics account or Product Hunt submission. Change public beta labels only when the corresponding verified release exists.

## Analytics

Vercel Analytics loads automatically on a Vercel deployment after Analytics is enabled in the project dashboard. Copy `website/.env.example` to `website/.env.local` and set `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` only when the optional explicit-event integration is also wanted. Do Not Track and Global Privacy Control disable the optional Plausible script. A configured provider does not prove events reached its dashboard.

Plausible captures pageviews. Explicit page events are:

| Event               | Meaning                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `Download Click`    | A DMG/release link was clicked                                                |
| `Navigation Click`  | A section or navigation CTA was activated                                     |
| `Source Click`      | A repository or general MCP documentation link was clicked                    |
| `MCP Setup Click`   | A Codex, Claude Code or Claude Desktop setup link was clicked                 |
| `Demo Play`         | Playback started on an embedded `video[data-demo]`, when footage is available |
| `Contact Click`     | An email link was clicked                                                     |
| `Author Link Click` | A developer profile or website link was clicked                               |
| `FAQ Open`          | A question was expanded                                                       |

Create matching goals in Plausible. Properties contain only placement, version and platform. Never add names, emails, transcripts, project content or local paths. Automatic outbound/download events are disabled to avoid duplicating explicit events. Analytics errors must not interrupt navigation or downloads.

**Download Click measures intent, not a completed download or installation.** `npm run stats:downloads` reports GitHub asset `download_count` for the latest 100 releases separately; local preview transfers are not part of that figure. No install count is collected or displayed.

Verify one production pageview and each available event with its placement in Plausible before marking analytics evidence passed. Localhost is excluded by Plausible by default, and blockers can reduce counts. This integration is site-only; the desktop app has no telemetry.

Reference: Plausible's [custom event API](https://plausible.io/docs/custom-event-goals) and [initialization options](https://plausible.io/docs/script-extensions).
