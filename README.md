# Cristian Vargas · The Night Archive

A static Astro portfolio with an original gothic visual identity and an optional offensive-security survivor game, **Patch the Night**.

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
- Fictional game content and balance: `src/data/night-game.json`; item unlocks: `night-progression.json`; operation chapters: `night-operations.json`; interface copy: `night-interface.json`; original game score: `night-music.json`.
- Portfolio chapter labels and research controls: `src/data/portfolio-ui.json`.
- Research: `src/data/cves.json`, normalized and sorted by `src/data/cves.ts`.
- Credentials, awards and skill evidence remain in their original data files.
- Publications: `src/content/blog/`. Drafts remain excluded from the production build. Use `DRAFTS=1 npm run build` only for private editorial preview.
- `featured_cve` chooses the featured advisory by its existing ID. No new claims or advisories were added.

Read `AGENTS.md`, `DESIGN.md` and `CONTENT.md` before editing. Site copy remains in English. The illustration `assets-unused/fx/archive-night.svg` (not deployed) and interface icons are original vector artwork created for this portfolio.

## The illuminated archive

The portfolio shares the game's gothic palette and visual language: a moonlit architectural vault, the original hunter portrait, sealed research specimen, bound grimoire, attribute ledger, credential niches and a flame seal in the Save Room. The architectural, specimen and seal illustrations are original local vectors; the new castle and cratered moon extend the same palette. The hero remains free of statistics and credentials.

Chapter links follow the reading position on desktop and form a compact in-flow index on mobile. The research archive supports combined product/CVE/text search and vulnerability-class filters across every disclosure, including the extended index. Counts come from unique research records. Clearing filters restores the reader's previous disclosure state. Native per-row disclosures expose the existing vulnerability details to keyboard, touch and no-JavaScript visitors.

Writing and Talks are separate sections. The three existing articles were approved for publication by the owner and now appear in Writing and `/blog/`; future drafts stay private. Writing falls back to the existing Medium profile only when no public article is available. Talks presents the existing talk records without embeds. Self-assessed skills include the owner-requested AI 9/10 and Cloud 7/10; the English C2 profile entry was removed at the owner's request.

`src/scripts/portfolio.js` progressively enhances the static archive and chapter navigation. Primary content never depends on animations or JavaScript; game assets still load only through explicit entry. No external libraries, embedded media or third-party requests were added.

## Castle entrance and living archive

The first unanchored home visit in each tab session presents a brief original castle-and-moon entrance with the owner's name. It closes after 1.75 seconds plus a 0.55-second fade, or immediately on a click, scrolling or keyboard dismissal. The artwork never intercepts the portfolio's first click, steals focus, locks scrolling or starts sound or the game. Deep links bypass it; reduced motion and no-JavaScript visitors receive the static portfolio directly. A footer control replays the entrance. Failed artwork and unavailable session storage remain safe to browse.

`CastleEntrance.astro` contains the scene; `castle-entrance.js` shares the home page's external script bundle to avoid Astro inlining a small standalone script. Labels and timing live in `portfolio-entrance.json`. The original SVG castle and cratered moon are shared by the entrance and hero; `BrandMark.astro` and the favicon use a matching CV gate crest. The icon family has consistent linework without external icon services.

`portfolio-epic.css` supplies the moonlit scene, portrait arch, engraved research ledger, book/transmission panels, credential niches and illuminated chapter navigation. `portfolio-motion.js` adds bounded scroll depth, pointer tilt and section accents through classes only. Content never starts hidden; touch and reduced-motion visitors retain the complete layout. Work uses event-driven frames and disconnects on page departure; static artwork stays available without JavaScript.

## Optional ambience

The **MUSIC OFF** control at the lower right starts **Moonlit Archive**, an original slow minor-key score with organ-like pads, bass and bells. Open its settings to adjust volume. Controls appear on the portfolio and articles; no AudioContext is created before explicit playback. Volume is remembered when storage permits, while each fresh page starts with music off.

Ambience pauses while the minigame is open or the tab is hidden, then resumes only if already enabled. Game audio remains independently opt-in. Cached-page navigation preserves a working control; normal page departure closes its audio context. Reduced motion disables the decorative audio-meter animation.

The score and mix settings live in `src/data/portfolio-music.json`; `src/scripts/ambience.js` synthesizes the music locally with Web Audio. No audio downloads, external players or third-party music are used.

## Patch the Night

Click **PRESS START** or visit `/#play`. `/play/` redirects to that same entry point. The game code and CSS are loaded only after explicit entry; reduced-motion mode disables entry entirely. All research remains available in the initial static HTML.

- WASD/arrows move; Space dashes; P pauses; M toggles the minimap; Escape exits immediately. Touch drag and gamepad controls are supported.
- Choose among six operators and five stages. Quick hunts last ten minutes; classic hunts last thirty. Hurry doubles the clock; Hyper increases movement and pressure. Inverse changes actual enemy durability, movement, spawns and bounty. Endless repeats escalating thirty-minute cycles, resets wave progression, restocks the broker and permits additional arcana.
- Fourteen weapons include twelve offensive patterns, Sandbox Aegis charge-based protection and Race-Window Lance directional freezing. Choose one to six weapon slots. Weapons have eight normal levels, compatible evolutions and optional Limit Break; three genuine unions consume a source weapon, combine its attack pattern and free its slot. Six ordinary passive slots can be exceeded by guarded stage items. Arcana rewards use seeded three-card drafts with reroll/skip controls.
- Stages have distinct encounters: cathedral encirclements, repository firewall lanes, foundry eruptions, kernel gravity wells and the Cloud Spire's vertical IAM control plane. The Spire unlocks after an ordinary hunt victory. Authored timed events add rushes, rings and elite formations. Repository walls and foundry pillars have matching visual and physical collision. Elites and multi-phase bosses drop in-game loot; hazardous attacks are telegraphed. Defeating the final boss can complete the hunt before its time limit.
- Collect experience, bounty, caches, emergency patches and relics. Reach the Zero-Day Vault to choose a legal new weapon directly. Chained bounty pickups trigger a timed frenzy with real bonus gold. Reroll, skip or banish choices; upgrades, caches, drafts, brokers and pause screens stop simulation time.
- Explore to rescue quarantined researchers after defeating their wardens. Trade current-run bounty with the Grey-Hat Broker for immediate power, or keep it for permanent upgrades after extraction. Collecting the relic, completing the rescue and defeating the final privileged process reveals the stage's secret objective.
- Extract or finish a run to bank bounty once. Buy shared power-ups or individual operator augments, disable augments for a clean run, and seal discovered weapons before deployment. Progress unlocks additional equipment and operators. Optional final-boss-required contracts continue into overtime until the boss is defeated. Version-two saves preserve existing progress and sanitize new fields.
- Operations offer a separate three-chapter solo campaign with restricted setups, distinct objectives, its own budget, ranks and ascensions. Main-profile first-clear rewards are paid once; chapter gold and statistics remain isolated.
- Milestones grant one-time bounty rewards. The Progress page tracks stage clears, collections, rescues, unions and operator unlocks without duplicating claimed rewards.
- Weapons carry literal payload signatures: HTTP desync, SQL injection, SSTI, stack pivots, ROP and forged JWTs. Vulnerability dossiers name each threat class and link to its MITRE CWE; nearby enemies display compact class tags.
- Live vulnerability intel follows nearby threats and bosses. A bounded operator log reacts to actual kills, choices and milestones. Each stage has its own scope, rules of engagement and technical floor markings; the debrief totals exploited classes and prioritizes existing research from those classes.
- The original Disclosure Requiem has six adaptive movements: lobby, hunt, intense combat, boss, victory and defeat. Organ, choir, strings, bells and percussion change with stage and battle state. Music and effects have independent remembered volume controls. Sound requires opt-in; hidden tabs and pause suspend audio. All art and music are original; performance mode reduces decoration while preserving hazards.
- Game bounty is fictional. Result links point to existing research, and gameplay never invents CVE claims.

The DOM-free seeded simulation is in `src/scripts/night/engine.js`; original cached Canvas2D artwork is in `renderer.js`; `save.js` handles persistence, `operations.js` isolates the chapter campaign, `audio.js` handles sound, and `intel.js` turns simulation events into technical flavor without changing combat. `src/scripts/vgate.js` owns the accessible modal, controls and UI. These modules and the game stylesheet remain outside the initial portfolio load.

## Security and accessibility

Astro generates a per-page content security policy. Stylesheets are external; UI code does not inject inline styles. There are no external embeds or runtime dependencies. The game traps focus, makes the background inert, restores focus and scroll behavior on exit, and pauses when the document loses visibility. Semantic severity meters, accessible labels, keyboard links, reduced-motion handling and mobile disclosure cards are included.

See `GAME-SPEC.md` for the explicit functional coverage target, `QA.md` for verification evidence and `artifacts/night-*` for integrated review screenshots. Functional coverage does not imply reproduction of the commercial game's entire content catalog. Production publication is separate from local implementation.

## Browser checks

```sh
npx playwright install chromium
npm run test:engine
npm run test:e2e
```

If Chromium is already installed, `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` selects that executable. The browser suite builds production output and starts an isolated preview server on port 4322. It covers static research without JavaScript, draft exclusion, lazy assets, keyboard/touch/controller controls, upgrades, pause/exit cleanup, audio opt-in, persistent purchases/refunds, extraction, replay, reduced motion and responsive widths. Node tests exercise deterministic complete ten/thirty-minute runs, combat, all weapon evolutions, stage hazards and progression separately from browser rendering.
