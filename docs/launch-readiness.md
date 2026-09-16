# Launch readiness — 13 September 2026

Implementation and draft assets are prepared. **This build is not a verified public beta.** No commit, tag, GitHub Release, Pages deployment or Product Hunt submission was created by this work.

## Alignment delivered

| Surface          | Prepared change                                                                                                                                              | Remaining dependency                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Product metadata | Shared name, description, version, macOS target and repository/site URLs; MCP version reads the package version                                              | Separate naming decision; keep technical IDs and project folders stable       |
| Desktop          | Codex TOML, Claude Code terminal command, Claude Desktop JSON generated from the running installation                                                        | Final client acceptance on the release candidate                              |
| Visual identity  | Shared temporary SVG in app header, site/favicon and generated macOS icons; shared theme/font tokens                                                         | Final name/logo approval                                                      |
| Website          | MCP directly beneath “Edit less.”, actual editor capture, actual Codex result video and trace, client setup links, canonical/social metadata, sitemap/robots | Public hosting and approved release URL                                       |
| Repository       | Product-first README, privacy/permission/AI-cost conditions and proposed GitHub metadata (local marketing materials)                                         | Apply metadata and push the reviewed source in the separate publication step  |
| Distribution     | Exact-asset/evidence-gated manual Pages workflow, fail-closed launch checker                                                                                 | Developer ID, notarization and acceptance evidence                            |
| Analytics        | Plausible event integration including MCP setup and demo play; clicks distinguished from GitHub download counts                                              | Account script and dashboard event verification; currently **disabled**       |
| Product Hunt     | English form copy, maker comment, FAQ/replies, announcements, 11 correctly sized SVG/PNG draft boards and real 15-second Codex proof                         | Remaining clean captures, final branding and full 60–75-second campaign video |

The public repository still has no description/homepage/topics and no releases; the intended Pages URL still returns 404. These are intentionally pending external publication, not completed work. Local site: `http://127.0.0.1:4174/`.

## What was actually checked

- `npm test`: **53 passed** after the application changes.
- `npm run test:site`: **2 passed**; safe metadata escaping, subdirectory URLs and event behavior.
- `npm run test:launch`: self-check passed; incorrect release URLs and incomplete evidence reject readiness.
- `npm run test:native`: preview, paused visual changes, timeline mapping, audio mix and composition/export checks passed. The synthetic 640×360 paused-update test reported p95 2.525 ms; this is **not** 4K gesture-to-display or long-recording acceptance.
- `npm run desktop:build`: completed; full typecheck, frontend/service build, bundled dependencies and DMG integrity check passed.
- `npm run verify:bundle -- <app>`: passed; four portable arm64 Mach-O binaries, bundled Node/Whisper and JavaScript without a developer PATH, valid signature. This does not prove notarization or a clean-Mac install.
- Final packaged stdio MCP handshake: version 0.1.0, 49 tools, `settings_get` succeeded, no stderr.
- `npm run build:site`: completed; every built local HTML asset/link resolves, no unresolved placeholders or root-relative media paths remain for Pages.
- `python3 marketing/product-hunt/check-kit.py`: passed text limits, 11 board dimensions, draft labeling, capture hashes/aspect ratios and caption timing.
- Real desktop Settings UI: switched through all three client formats and confirmed installation-specific command paths and matching explanatory copy.
- Website browser: actual screenshot and provider icons load; MCP proof/video/trace and client links appear. Narrow layout checked visually; 1280px layout has no horizontal overflow. Keyboard navigation reached the MCP section and its 15-second video played to completion without a media error. The local DMG returned HTTP 200 and matched the packaged SHA-256. In-app browser full-page stitching showed duplicate bands, so that screenshot is not used as product evidence.

Host: Apple M3 Max, 64 GiB RAM, macOS 26.4. This host is not a clean macOS 15 installation.

## Real MCP evidence

The actual Codex trace (retained in local marketing materials) records Codex CLI 0.153.1 using the configured model to create/open/rename/undo a disposable draft, and a separate clean 12-second window recording to apply a zoom/title, request a preview frame and complete a 1080p MP4 export. The edit/export trace contains the latter scenario; the draft round-trip trace is preserved in `.cache/launch-clients/`.

The demonstrated edit used explicit parameters. It proves tool execution and results, not an evaluation of unconstrained natural-language editing quality. The project contains fictional Fieldnotes content, no personal desktop, camera or audio. The 15-second proof adds explanatory captions and holds the last frame for approximately 3 seconds; it is not the full campaign video.

Live external rename and zoom updates were observed in the same open desktop editor. An earlier update appeared stale until reopening; subsequent checks did not reproduce it. Retain this observation for release-candidate testing rather than claiming a fix.

Claude Code could not run model calls: its OAuth session was expired. Claude Desktop model-flow acceptance has not been run. Client-format UI correctness does not count as those client workflows passing.

## Current development artifact

- Filename: `Recora-Screen_0.1.0_macOS-arm64.dmg`
- Version: `0.1.0`; product/package/lock/Tauri/Cargo versions match.
- Size: 47851962 bytes.
- SHA-256: `bf900a9208e893982205a5425b1bd08365844c56bd43acd0c33d62cc7a3888aa`
- Source: working tree based on `63998206f34f7a21736a665042e71b912f0b30d1`, with uncommitted changes; **no immutable release commit asserted**.
- Shared UI/MCP registry: 49 commands, derived from schemas.
- Signature verification passes with Apple Development. No Developer ID Application identity is available; Gatekeeper assessment rejects the app and no notarization ticket is stapled.

This is the single observation of the current rebuilt DMG. It supersedes historical development-artifact checksums; never attach this observation to a later rebuilt file merely because its filename is unchanged. `docs/releases/0.1.0.json` remains a pending release-evidence template. A finished `release-evidence.json` belongs beside the exact release DMG and must identify its commit and checksum.

## Still needed before public beta

1. Final naming decision and clean campaign captures for automatic zoom, camera layout, microphone silence review and captions. Produce the complete 60–75-second real demo after the verified candidate is chosen.
2. Authenticate Claude clients and verify each real workflow. Verify both optional cloud providers on the candidate without exposing keys.
3. Supply the public Plausible script URL; verify real pageviews and configured events after deployment. Do not call clicks installs.
4. Obtain Developer ID Application signing access, notarize and verify a clean Mac installation. Bind recording permissions/devices, recovery, long A/V sync/memory, Turkish/English offline Whisper and preview/export regression evidence to that candidate.
5. Review and commit the intended source, tag once, publish matching DMG + evidence, then run the manual Pages workflow and inspect the real download/analytics flow. Product Hunt form submission remains separate.

The launch checker currently returns **NOT READY** intentionally. Missing approvals, credentials or unperformed acceptance checks are never converted into passes.
