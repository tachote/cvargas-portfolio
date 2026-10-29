# Portfolio and Patch the Night verification

Local rework, October 29, 2026. No remote deployment was performed. Research, professional certifications, awards and article bodies are unchanged. At Cristian's explicit request, the three existing articles were enabled for production output, the English C2 profile entry was removed and self-assessed AI 9/10 and Cloud 7/10 attributes were added.

## Portfolio visual and interaction review

Three implementation agents separately owned visual styling, archive/navigation behavior and original SVG artwork. Integration preserved the single reading column, clean avatar hero, section order, local fonts, strict CSP and opt-in game.

- Search reaches disclosures inside the extended index; text and class filters combine; counts exclude the repeated featured record. Empty states and reset use real records, preserve input focus and restore the reader's prior open/closed index state.
- Native per-CVE disclosures expose the original vulnerability detail on touch, keyboard and no-JavaScript pages. No research facts were rewritten.
- Writing and Talks are independent sections and navigation destinations. Following Cristian's explicit publication request, Writing displays the three existing articles, with matching entries in `/blog/`; Talks contains the three existing public talks. Both article frontmatter and grimoire visibility flags were updated, without changing article bodies.
- Chapter links update `aria-current="location"`; native progress reflects page position. All primary content renders without JavaScript or reveal effects.
- Desktop 1280×800, mobile 390×844 and additional width checks at 320, 600, 768 and 1440 px passed without horizontal overflow. Original artwork, the hero, Skills, Contact and full-page composition were inspected in `artifacts/portfolio-*` captures.
- Before publication approval, an isolated `DRAFTS=1` build in `.astro/draft-review` verified the article layout at desktop/mobile widths with `noindex`. After approval, production checks verify all three article routes return 200, appear in Writing and the blog index, carry no draft banner or `noindex`, and remain free of inline styles/scripts and horizontal overflow. Future records marked as drafts remain excluded.
- Portfolio lifecycle tests freeze browser time while checking modal controls, preventing a real random level-up from replacing the pause control during a UI-only assertion. Combat progression remains tested separately through ordinary engine and browser inputs.
- Game browser assertions handle queued level choices and compare class totals against the final banked result, rather than an intentionally throttled live HUD.

The user's development server remains on port 4321. Verification servers on ports 4322/4323 are temporary and stopped after their checks.

After enabling the three approved articles, `npm run test:e2e -- tests/portfolio.spec.mjs tests/portfolio-experience.spec.mjs --workers=2` passed **20/20** viewport cases in 17.5 seconds. The production build passed, all article routes returned 200, Writing and `/blog/` linked them, draft banners/`noindex` were absent, and article layouts passed at 320 px and desktop/mobile widths. Captures are stored as `artifacts/blog-*-desktop.png` / `blog-*-mobile.png` and the updated Writing captures.

## Castle entrance and epic visual pass

Four agents separately owned the cinematic entrance, the original identity/artwork, the presentation stylesheet and a read-only integration audit. The parent integrated the home page, bounded decorative motion and final fixes. No professional facts, article publication states, game rules or audio opt-in behavior changed during this pass.

- Original local vector artwork: `portfolio-castle.svg` (approximately 13.5 KB), `portfolio-moon.svg` (approximately 7.7 KB), a matching CV gate crest and favicon, and refined compatible interface icons. Castle/moon assets are shared by the entrance and hero.
- The entrance is hidden by default in HTML, appears briefly once per tab session on the unanchored home route, and remains transparent to pointer interaction. Skip, Enter/Escape/Space/Tab, scrolling, image failure, visibility and page departure dismiss it. No focus trap, inert content, scroll lock, automatic audio or game startup is introduced. A footer replay is available when motion is permitted.
- Fourteen new desktop/mobile cases verify the real name, initial legibility, timed exit, reload/session behavior, replay, immediate click-through game entry, deep links, live reduced-motion changes, denied session storage, failed artwork and no-JavaScript access. Timers use a paused browser clock; ordinary UI input still opens and closes the actual game.
- Initial visual review found the name's opacity starting at zero and the moon behind navigation. The name now starts at 85% opacity, and the moon is lower. Independent review found the crest's missing default class; the corrected mark measures 28×28 at 320 px. The portrait keeps the required `#0E0A12` background.
- Production review caught Astro automatically inlining the small component script. Its import now shares the existing external home bundle, keeping the no-inline CSP contract. The complete portfolio subset passed 40/40 cases after these fixes; the final production suite passed 75 cases with one intentional desktop touch skip and no failures. Game integration now settles the archive's two one-shot startup frames before checking idle animation work, so it distinguishes initialization from a continuing game loop. Stage-capture checks also resolve a legitimate queued upgrade before trying to pause, instead of waiting for a control hidden by the choice screen.
- Root and independent Chromium checks at 1280×800, 390×844 and widths 320/390/600/768/1280/1440 found no horizontal overflow or page errors. Reduced motion removes the decorative animations and tilt; all sections remain readable before enhancement. Pointer tilt, scroll depth and section accents use class changes, with no injected style attributes or permanent JavaScript animation loop.
- Production captures: `artifacts/portfolio-entrance-desktop.png`, `portfolio-entrance-mobile.png` and the refreshed `portfolio-hero-*`, `portfolio-full-*`, `portfolio-skills-*` and `portfolio-contact-*` views. Additional development-only composition captures use the `portfolio-epic-*` prefix and can include Astro's development toolbar.

## Optional portfolio music

An original Web Audio score is available through the global Music control on the portfolio and articles. Six desktop/mobile cases verify no AudioContext before opt-in, a real nonzero output signal, volume-to-silence behavior, muted/suspended state, remembered volume without autoplay, game audio isolation, hidden-tab pause/resume, cached-page transitions, denied storage, reduced-motion handling, keyboard dismissal and panel bounds at 320 px. `artifacts/portfolio-music-desktop.png` and `portfolio-music-mobile.png` show the control and volume panel.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run test:engine
npm run test:e2e -- --workers=2
```

The browser suite builds production output and starts an isolated server on port 4322. Its tests use normal UI inputs and browser-local save fixtures; there are no production test hooks, time controls, invulnerability toggles or exposed engine instances. The headless simulation tests use seeded runs and isolated unit fixtures separately from the browser shell.

## Simulation and persistence

`npm run test:engine`: **97 passing tests** in the expanded solo implementation. The tests cover:

- Reproducible complete quick and classic hunts, ordinary movement, collection and choices; no fabricated health or invulnerability in the complete-run simulations. Killing the final boss can finish a hunt before its nominal 10/30-minute deadline.
- Six operators across eight seeds: all 48 early-game scenarios reach their first real level choice before 25 seconds.
- Twelve offensive weapons cause actual damage through distinct patterns; Aegis absorbs hits, regenerates bounded charges and retaliates after evolution; Lancet freezes actual movement and its evolution cuts current health with boss resistance. All fourteen compatible evolutions, passive modifiers, configurable one-to-six slots, multi-item treasure and optional Limit Break are covered.
- Three real unions consume a source weapon, free its slot, combine attacks and preserve its damage, kills and discovery provenance: Supply Chain Collapse, Allocator Sovereign and Crash to Shell.
- Enemy behaviors, elites, boss phases, armor, invulnerability, revival and actual weapon knockback with boss resistance and wall collision.
- Separate stage hazards, horizontal and vertical corridor boundaries, foundry pillars, authored formations, breakable props and every pickup effect. The fifth stage, Cloud Spire, unlocks after an ordinary victory; collected stage access survives migration.
- Guardian kills unlock a rescue objective once; merchant purchases spend run gold and alter the run; the relic/rescue/final-boss secret condition grants its reward.
- One-time result banking, exact shop charges/refunds, sanitized or unavailable storage, permanent unlocks, stage clears, collections and one-time milestone rewards. Classic victories earn Full Audit even when the final boss dies early.
- Event-driven operator narration, per-class throttling, bounded logs, reset between runs, boss focus, exact kill milestones, actual class totals and research selection from existing advisories. Intel never changes simulation state.

Expanded system checks additionally cover real Inverse risk/reward and merchant-only services; all four Curse pressure axes; Endless local clocks, escalating ordinary waves, authored events, merchant restocks and additional arcana; protected guarded floor passives beyond six slots; bounded bounty fever; final-boss overtime; directed weapon vaults and three-card arcana drafts. Equipment unlock thresholds, seals, per-operator augmentation charges and actual stats survive sanitized version-two save migration. Three Operations chapters complete through ordinary inputs and keep campaign gold/ranks/ascensions isolated from the main profile, with duplicate-proof first-clear rewards.

Six original music movements use one opt-in AudioContext with bounded voices, stage transposition, scene transitions, quiet overlays and independent music/effects buses. Audio unit checks cover caps, pause/disposal and unsupported contexts. A separate Chromium signal probe measured nonzero output (RMS approximately 0.0106, peak 0.0387) and bounded node lifecycle.

Regression checks include the boss ring's safe inner region, telegraphs surviving saturated visual effects, merchants refusing obsolete purchases, and new bosses preserving rescue guardians at the enemy cap.

## Browser coverage

`npm run test:e2e -- --workers=2`: **75 passing, one intentional desktop touch skip, zero failures** in the final complete run after the castle-entrance pass (approximately 1.3 minutes). The production build passed as part of that run, with no new application warnings. The runner emitted environment-level `NO_COLOR` / `FORCE_COLOR` warnings.

Expansion checks additionally passed as focused suites: advanced controls/stage/music 8/8 and directed vault/campaign play 4/4, followed by the successful complete run above. The campaign, advanced-contract and game-integration tests freeze browser time and set a fixed Date value so simulation seeds and input timing remain reproducible; they select actual rewards with normal numbered keyboard controls. Independent source review and 49 focused Node cases support the expanded mechanism matrix in `GAME-PARITY.md`. These are mechanism checks, not a commercial-content percentage.

Desktop 1280×800 and mobile 390×844; additional width checks at 320, 390, 600 and 1280 pixels. Checks cover:

- Static portfolio research and contact without JavaScript; all drafts excluded from production.
- Game JavaScript and CSS remain unloaded before PRESS START; reduced motion blocks entry and closes an active game when changed.
- Character, stage, arcana and mode selection; field guide, union recipe, progress and collection screens.
- Persistent purchases/refunds, operator-specific augments, discovered-weapon seals, extraction banks a run once, and replay starts a fresh simulation.
- One-weapon Inverse contracts with arcana disabled; independent remembered music/effects levels; one opt-in audio context across menus, pause and exit.
- Normal movement reaches the directed arsenal vault, pauses its clock and equips the selected weapon. An actual operation completes through combat, unlocks its successor, banks only its one-time main bounty and leaves ordinary statistics unchanged.
- The earned Cloud Spire becomes selectable, starts its real vertical stage and records discovery. Advanced controls remain within the viewport at 320 px; the fixed menu header prevents scrolled text from crossing the controls.
- Keyboard movement, numbered choices, reroll/skip/banish, focus trapping, pause and immediate Escape cleanup.
- Native touch drag, pointer cancellation, Dash, and controller movement, dash, pause and menu confirmation.
- Sound creates no AudioContext before opt-in; exit closes the audio context and leaves no animation loop.
- No application console/page errors or inline style/script/event attributes under the production CSP.
- Merchant reachability uses ordinary movement and real collected bounty, rather than mutating the live simulation.
- Literal payload signatures, canonical CWE links, dossier overflow at narrow widths, live intel visibility, bounded changing operator logs and debrief class totals matching the run's kill count.
- Archive search/filter combinations, native detail disclosures, reader-controlled index restoration, seven chapter links, independent Writing/Talks, removal of the English credential and the exact requested AI/Cloud skill levels.

The single desktop touch skip is intentional: native touch behavior is exercised by the mobile project. Screenshots use Playwright `caret: 'initial'` because the default caret-hiding option temporarily writes inline styles to form controls; those are test-runner mutations rather than application behavior.

## Functional coverage and limits

`GAME-SPEC.md` and `GAME-PARITY.md` document verified mechanisms against the solo base-game reference. The expanded implementation includes fourteen weapons, twelve passives, six operators, five original stages, six arcana, three unions and a three-chapter operation. This is a concrete engineering scope, not a measured commercial parity percentage.

Remaining breadth differences include the commercial roster and catalog, complete secret-character/event ecosystem, special stages and progression depth. Cooperation, expansions and platform services are outside the user's selected solo-base scope. The current custom catalog does not establish near-100% commercial parity. Art, terminology, maps, score and balance here are original.

## Visual and performance evidence

- `artifacts/night-lobby-desktop.png`, `night-lobby-mobile.png`, `night-play-desktop.png`, `night-play-mobile.png`: integrated UI and real multiweapon sessions. The gameplay captures use ordinary purchased-power-up fixtures to reach a build quickly; they are not evidence of a complete browser run.
- `artifacts/night-merchant-desktop.png`, `night-merchant-mobile.png`, `night-progress-desktop.png`, `night-progress-mobile.png`: real broker interaction after exploration/combat and the persistent milestones/collection UI.
- `artifacts/night-intel-desktop.png`, `night-intel-mobile.png`, `night-debrief-desktop.png`, `night-debrief-mobile.png`: vulnerability dossiers, literal code signatures and real class totals. Updated gameplay captures show live vulnerability focus and the event-driven operator log.
- `artifacts/night-contract-*`, `night-operations-*` and `night-vault-*` show actual advanced controls, isolated chapter progression and the directed cache. `night-spire-play-*` shows the integrated stage through ordinary deployment. `night-spire-defenses-*` and `night-spire-defense-icons.png` are renderer fixtures for original Spire art, shield charges, beam geometry and frozen enemies; their draws left simulation JSON unchanged.
- Original sprites, animation frames, stage tiles, class badges and weapon effects were inspected at desktop and mobile dimensions. Hostile zones and projectiles use distinct outlines; compact maps leave the player visible.
- A renderer-only Chromium headless stress fixture at 1280×800 used the configured caps: 320 enemies, 280 projectiles, 360 pickups, 72 props and 180 effects. Measured average rendering was approximately 11.3 ms in high quality and 9.7 ms in low quality; p95 spikes reached approximately 24 ms. These measurements are hardware/fixture-specific, not a guarantee of 60 FPS on slow phones.
- Performance mode trims cosmetic work while preserving dangerous telegraphs. Sprites and tiles are cached; offscreen rendering is culled; simulation uses spatial hashing and bounded entity/event storage.

## Review process

Separate implementation agents owned simulation/catalog and original artwork. An independent QA agent checked source mechanisms, exercised browser paths and identified gaps beyond the initial checklist. Findings were fixed and regression-tested rather than counted from UI labels or catalog fields alone. All local servers started by verification are stopped after their suites.


## GitHub integration validation

The release branch was rebased onto the existing production main branch before publication. The existing GitHub Actions → Cloudflare Pages deployment, security headers, sitemap, canonical/Open Graph metadata, WOFF2 font subsets, recorded talk metadata and current professional-skill evidence were preserved. The cinematic portfolio and modular game replace the older visual/game implementation.

After conflict resolution and a clean `npm ci`, the complete Node suite passed **97/97** and the production-browser suite passed **75 cases**, with one intentional desktop touch skip. The browser setup also completed the production build. Curated entrance, hero, skills and gameplay captures were refreshed for the integrated source.
