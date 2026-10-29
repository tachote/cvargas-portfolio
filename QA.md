# Verification and review

## Verified

- Production build: `ASTRO_TELEMETRY_DISABLED=1 npm run build`.
- Browser suite: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` — 12 passing checks across desktop and mobile.
- Chromium screenshots at 1280×800 and 390×844: home, skills anchor and optional game entry.
- No horizontal overflow at 320, 390, 600 and 1280 px.
- Research remains present in static HTML and usable with JavaScript disabled.
- All original CVE, award, certification, skill and draft source files remain unchanged.
- Production excludes all three draft posts. A separate local draft build was inspected at desktop and mobile sizes with no console errors, no horizontal overflow and `noindex`. Draft captures are ignored by Git.
- No inline script elements, style elements, style attributes or inline event handlers in production home output.
- Both the game JavaScript and stylesheet load only after explicit entry.
- Reduced-motion mode blocks game entry and closes an open game when the preference changes.
- Keyboard focus stays within the game and returns to the launch button on exit; background inert state and scrolling are restored.

Full-run checks pass on desktop and mobile: upgrades are offered, a hunt reaches a titled result screen, replay starts a fresh run and Escape restores the portfolio.

## Independent reviews applied

The game implementation was delegated to a separate agent. Two subsequent agents independently inspected design and technical behavior. Their reviews were based on source and supplied screenshots; their browser attempts were interrupted, so browser results above are from the primary agent.

Applied findings: larger mobile navigation/contact targets; readable game hint; full-width mobile hero actions; visible affected versions; distinct relic emblems; corrected company link; matching enemy classes and CVEs; graceful missing-canvas cleanup; lazy stylesheet loading; no animation rendering while paused.

## Limits and next ideas

An unattended repeated-run script initially restarted runs by pressing Space after the results screen focused its replay button. That harness behavior was corrected; its earlier timeouts are not treated as a stability result. Review also caught and corrected a results-heading selector that could target the wrong heading. No claim of six hours of uninterrupted active development is made.

Potential later improvements: a dedicated case-study page for a confirmed advisory, original expanded artwork for each vulnerability class, and optional sound effects with an explicit mute control. Publishing draft research still requires the owner's review.

Production deployment has not been performed. This branch is intended for review before merging.
