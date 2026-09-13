# Product website

The marketing site is plain HTML, TypeScript and CSS, built with the existing Vite dependency. It uses the desktop theme tokens without shipping React, Node, the recorder service or user projects to visitors.

```sh
npm run dev:site      # http://127.0.0.1:4174
npm run build:site    # website/dist — upload these static files
npm run preview:site  # preview the built static output
npm run test:site
```

The page contains feature details, an interactive editor illustration, a workflow, MCP setup link, FAQ, developer contact links and an actual DMG download. The illustration is not a recording or a claim of a live assistant response.

## Downloads and releases

Without `VITE_DOWNLOAD_URL`, `build:site` copies the existing packaged Apple silicon DMG into `website/public/downloads/` and then into the site output. Run `npm run desktop:build` first to make a fresh package. Download binaries are ignored by Git. A missing package fails the build instead of publishing a broken button.

For a public release, set `VITE_DOWNLOAD_URL` in `website/.env.local` to the exact HTTPS release asset URL. This value is public and contains no credentials. Test the final link after deployment. The current copy clearly labels v0.1.0 as an early preview with public notarization pending; update that copy and platform/version metadata only when a corresponding verified public release exists.

Nothing in these scripts publishes a GitHub release or deploys the site. Before Product Hunt, publish the notarized release, configure the actual download URL and analytics, deploy `website/dist`, and use that public site URL for the listing. Add the deployment's canonical URL and social preview image at that point.

## Analytics

Copy `website/.env.example` to `website/.env.local`. Set `VITE_PLAUSIBLE_SCRIPT_URL` to the HTTPS `pa-*.js` script URL from your Plausible website settings, then rebuild. No account, paid plan or external tracker is created by the repository. With no URL configured, no analytics script loads. Do Not Track and Global Privacy Control disable loading too.

Plausible automatically captures pageviews. The site's manual custom events are:

| Event | Meaning |
| --- | --- |
| `Download Click` | The visitor clicked the DMG/release link |
| `Navigation Click` | A navigation CTA was activated |
| `Source Click` | Repository or MCP documentation link |
| `Contact Click` | Email link |
| `Author Link Click` | Developer profile or website |
| `Feature Preview` | Screen/camera/caption illustration control |
| `FAQ Open` | FAQ expanded |

Create matching custom event goals in the Plausible dashboard. Properties contain only placement, version and platform; never add email addresses, project names, transcripts or local paths. Automatic outbound/download events are disabled in initialization to keep these custom counts clear. Tracker errors never block a link.

**Download Click measures intent, not a completed download.** For released binaries use GitHub release asset `download_count` for the distribution count; do not label button clicks as completed installs. No download counter is fabricated on the page.

Run `npm run stats:downloads` to report actual GitHub asset counts for the latest 100 releases. An empty release list reports zero; locally served DMG downloads are not included in GitHub counts.

After deployment, verify one real pageview and each event in your dashboard, including placement. Localhost is excluded by Plausible by default. Browser blockers can reduce counts. This analytics integration is only on the website; there is no desktop telemetry.

Implementation follows Plausible's [custom event API](https://plausible.io/docs/custom-event-goals) and [initialization options](https://plausible.io/docs/script-extensions).
