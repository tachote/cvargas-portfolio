# Cristian Vargas · The Night Archive

A static Astro portfolio with an original gothic visual identity and an optional vulnerability survivor game, **Patch the Night**.

## Local development

Requires Node 20.19+, 22.12+, or a current supported Node release.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

On restricted development machines, use a writable npm cache (`npm ci --cache /tmp/cvargas-npm`) and set `ASTRO_TELEMETRY_DISABLED=1` if the home configuration directory is read-only.

Cloudflare Pages: build command `npm run build`, output directory `dist`. No runtime services, API keys or third-party scripts are required.

## Content

- Contact and hero: `src/data/site.json`.
- Research: `src/data/cves.json`, normalized and sorted by `src/data/cves.ts`.
- Credentials, awards and skill evidence remain in their original data files.
- Publications: `src/content/blog/`. Drafts remain excluded from the production build. Use `DRAFTS=1 npm run build` only for private editorial preview.
- `featured_cve` chooses the featured advisory by its existing ID. No new claims or advisories were added.

Read `AGENTS.md`, `DESIGN.md` and `CONTENT.md` before editing. Site copy remains in English. The illustration `public/fx/archive-night.svg` and interface icons are original vector artwork created for this portfolio.

## Patch the Night

Click **PRESS START** or visit `/#play`. `/play/` redirects to that same entry point. The game code and CSS are loaded only after explicit entry; reduced-motion mode disables entry entirely. All research remains available in the initial static HTML.

- WASD/arrows move; Space dashes; P pauses; Escape exits immediately.
- On touch screens, drag the arena to move and tap Dash.
- Automatic attacks, knowledge gems, three-choice upgrades, escalating waves and a critical threat encounter.
- Runs last two minutes of active play. Upgrade selection and pauses stop the timer.
- Personal best stays in local browser storage and tolerates storage being unavailable.
- Game scores are distinct from real portfolio research. Result links point to the existing advisories.

## Security and accessibility

Astro generates a per-page content security policy. Stylesheets are external; UI code does not inject inline styles. There are no external embeds or runtime dependencies. The game traps focus, makes the background inert, restores focus and scroll behavior on exit, and pauses when the document loses visibility. Semantic severity meters, accessible labels, keyboard links, reduced-motion handling and mobile disclosure cards are included.

See `QA.md` for verification evidence and `artifacts/` for review screenshots. Production publication is separate from the implementation branch.

## Browser checks

```sh
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed, `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` selects that executable. The suite builds production output and starts an isolated preview server on port 4322. It covers static research without JavaScript, draft exclusion, lazy game assets, keyboard focus, pause/exit cleanup, reduced motion and responsive widths.
