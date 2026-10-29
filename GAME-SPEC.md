# Patch the Night — current game specification

Original offensive-security survival game for the static portfolio. The selected comparison scope is **single-player base-game-inspired mechanics**, with original content and balancing. No poncle/Castlevania assets, names, logos or music are reused. Research data remains separate from fictional gameplay. This specification does not assert a commercial parity percentage.

Entry stays explicit through PRESS START or `#play`, with dynamic game import and external lazy CSS. Reduced motion blocks game entry; Escape exits. The portfolio remains readable before first paint and without JavaScript. Strict CSP forbids inline style attributes, inline handlers and third-party scripts.

## Content snapshot

The source of counts, rules and display content is data, not template constants.

| Content | Current catalog |
| --- | --- |
| Operators | 6 |
| Stages | 5 |
| Weapons | 14: twelve offensive attack patterns and two defensive/control archetypes |
| Passives | 12 |
| Enemy species | 10, with elite and multi-phase boss variants |
| Arcana | 6 |
| Shared persistent power-ups | 8 |
| Two-weapon unions | 3 |
| Operation chapters | 3 in The Disclosure Protocol |
| Adaptive music movements | 6, with stage pitch/presentation variants |

Stages: `cathedral` (The Attack Surface), `library` (The Forbidden Repository), `foundry` (The Exploit Foundry), `void` (Ring Zero), and `spire` (The Cloud Spire). The first four remain available initially; Spire requires a normal victory, with previously earned stage access preserved. Horizontal/vertical corridor walls and foundry pillars have matching visible geometry and actual collision.

Operators: `hunter`, `researcher`, `operator`, `reverser`, `cryptanalyst`, `phantom`. The first three are available initially. Later unlock conditions are machine-readable and progress from real results.

Weapons retain stable IDs: `whip`, `knife`, `wand`, `orbit`, `pool`, `rune`, `lightning`, `axe`, `cross`, `pentagram`, `fireball`, `birds`, `aegis`, `lancet`. Each has eight normal levels and a compatible passive evolution. Weapon unlock conditions are in `src/data/night-progression.json`; prior discoveries and earned operator starters remain usable.

## Modules and data ownership

- `src/scripts/night/engine.js`: DOM-free seeded simulation, combat, acquisition, state transitions, bounded world and results; exports `CATALOG` and `createRun`.
- `src/data/night-game.json`: gameplay catalog, numeric balance, stage geometry/formations, landmarks, recipes and fictional threat metadata.
- `src/scripts/night/save.js`: version-two save loading/sanitization, purchases/refunds, operator augments, discovered-weapon seals, content access, collections, milestones and banking.
- `src/data/night-progression.json` and `night-achievements.json`: unlock conditions and milestone rewards.
- `src/scripts/night/operations.js` and `src/data/night-operations.json`: isolated chapter progression, objective evaluation, economy, ranks, ascension and one-time main rewards.
- `src/scripts/night/renderer.js`: original cached Canvas2D sprites, stages, enemy telegraphs, weapon/control effects, landmarks, map and portraits.
- `src/scripts/night/audio.js` and `src/data/night-music.json`: original adaptive soundtrack, independent mix buses, combat cues and bounded scheduling.
- `src/scripts/night/intel.js`: bounded narration and actual class totals, without modifying combat.
- `src/scripts/vgate.js`, `vgate.css` and `src/data/night-interface.json`: accessible modal, deployment contracts, menus, game inputs, UI state, operation flow and presentation copy.

## Core survival systems

The historical acceptance baseline comprised thirty core-loop systems and nine later gates: Limit Break, real unions, matching stage geometry, authored formations, guarded rescue, in-run merchants, milestones/collections, knockback and a relic/rescue/final-boss secret objective. Expanded gate IDs 40–51 in `GAME-PARITY.md` continue that audit history; they are not a commercial-content denominator.

Automatic attacks, XP pickups, escalating levels, random upgrade choices, ordinary six-weapon/six-passive capacity, eight-level weapons, passive stat changes, compatible late-cache evolution, multiple treasure rewards, breakable props, healing/gold/magnet/bomb/freeze pickups, elites, bosses, contact damage/armor/invulnerability, revival, Reroll/Skip/Banish, stage hazards, authored waves, exploration relics, guarded rescue, broker purchases, minimap, persistent gold/upgrades/unlocks, achievements/collections, per-weapon result statistics and keyboard/touch/gamepad controls are working systems.

Standard hunts last thirty minutes and quick hunts ten; Hurry accelerates the stage clock, Hyper changes movement/pressure, and Endless continues through escalating cycles. Normal finite survival at its deadline counts as a clear. The optional **Final Confrontation** contract instead enters overtime and requires actual defeat of the final boss. Defeating a final boss may also finish a finite hunt early. Result wording/statistics must distinguish surviving the deadline from defeating a boss.

### Build planning and defensive archetypes

The player can select a weapon limit from one through the normal cap, toggle arcana and Limit Break, seal discovered weapons and enable/disable earned augments. The selected starter always remains usable. Every acquisition path enforces the applicable unlocks, seals and capacity. Exhausted reward pools fall back legally; they never trap a paused choice.

**Sandbox Aegis** (`aegis`) absorbs real incoming hits using finite charges and delayed recharge. Its evolution, **Unbroken Boundary**, retaliates on an actual block. Capacity changes cannot refill consumed charges for free, and invulnerability does not consume additional charges.

**Race-Window Lance** (`lancet`) rotates a directional freezing corridor independently of movement aim. Its evolution, **Deterministic Horizon**, additionally removes a bounded fraction of current target HP. Bosses resist both control and HP reduction. Neither base defensive weapon hides conventional damage behind its description; zero-speed weapons omit meaningless speed Limit Break choices.

Unions require two maxed source weapons, a compatible passive and an eligible late cache. They consume the second weapon, free a real slot and preserve merged damage/kills/discovery history:

- **Supply Chain Collapse:** Recon Ravens + Forged JWT, with Packet Velocity.
- **Allocator Sovereign:** Stack Pivot + Heap Spray, with the `area` passive.
- **Crash to Shell:** Fuzzing Storm + RCE Payload, with the `cooldown` passive.

The data catalog is authoritative for recipe names and multipliers. Evolved and union attacks must change actual behavior/output rather than only UI labels.

### Extended world and reward mechanics

- **Endless cycles:** `cycle` and `cycleTime` expose the loop. Boundaries preserve total elapsed time/build/progress, restart local wave/event/arcana schedules and broker stock, and accumulate pressure. The final authored formation is processed before resetting its clock. Endless does not trigger finite-run completion.
- **Inverse:** changes real enemy HP/speed/spawn pressure, gold and XP growth. Its broker offers a real revival and at most one additional arcana slot per run with an immediate seeded draft. This is original balancing, not a reproduction of the official mode's numeric formula.
- **Curse:** changes enemy HP, movement speed, spawn frequency and average quantity while keeping allocation bounded.
- **Guarded floor passives:** approaching a stage item summons its guardian; only its actual defeat opens the pickup. These authored acquisitions can exceed the ordinary passive-slot limit; normal level choices cannot create that exception. Landmarks and their guardians survive saturated budgets and destructive combat purges.
- **Bounty frenzy:** qualifying gold gains trigger a timed chain. Actual kills/pickups generate/extend rewards within a finite cap; economy totals reach the final result and persistence. Paused gameplay also freezes the chain timer.
- **Directed arsenal vault:** an authored landmark opens a paused list of legal new weapons. Selection grants the chosen weapon once and preserves queued levels. A full/exhausted pool or voluntary skip grants the defined bounty fallback without duplicating a claim.
- **Arcana packs:** timed rewards draft up to three seeded legal cards. Reroll/skip consume their own resources, respect the active capacity and preserve pending experience. Starting cards, timed rewards and broker additions share the same legality rules.
- **Kill Switch:** its ordinary purge may erase existing combat loot; protected exploration landmarks and evolved Full Disclosure evidence survive according to catalog rules.

## Engine API

`createRun(options)` accepts:

```js
{
  characterId, stageId, mode, hyper, hurry, inverse,
  weaponLimit, arcanaEnabled, limitBreak, finalBossRequired,
  sealed, unlockedWeapons, eggs, arcanaId, meta, seed
}
```

`mode` is `quick`, `standard` or `endless`. Omitted engine-only unlock lists allow the full catalog for standalone simulations; the browser shell supplies the profile's explicit legal list and validates stage deployment. `meta` is shared purchased power; `eggs` is the selected operator's enabled artifact count. Numeric options and IDs are clamped/validated.

State values: `playing`, `upgrade`, `chest`, `arcana`, `arsenal`, `merchant`, `dead`, `won`. UI pause is owned by the shell, which stops simulation ticks. Choices, caches, arcana, arsenal and merchant states also stop gameplay time.

Methods: `tick(dt,input)`, `choose(index)`, `reroll()`, `skip()`, `banish(index)`, `collectChest()`, `selectArcana(id)`, `rerollArcana()`, `skipArcana()`, `selectWeapon(id)`, `skipArsenal()`, `buyMerchant(id)`, `leaveMerchant()`, `revive()`, `drainEvents()`, `getResult()`. Invalid/inapplicable actions return false without granting a reward.

Important state includes `player`, `enemies`, `projectiles`, `pickups`, `props`, `obstacles`, `effects`, `weapons`, `passives`, `arcana`, `choices`, `arcanaChoices`, `arsenalChoices`, `merchantOffers`, `objective`, `stageItems`, `goldFever`, `cycle`, `cycleTime`, `overtime`, time/XP/gold/level, contract settings and actual `stats`. Results copy contract, collection, cycle/frenzy/floor-item and per-weapon provenance data rather than exposing a live mutable simulation.

All random gameplay decisions use the run's seeded RNG. Spatial hashing, culling and catalog caps bound enemies, projectiles, pickups, effects and world storage. Cosmetic quality may reduce rendering/audio voices but must not remove dangerous telegraphs or alter collision.

## Persistence and progression

The `cv-night-save-v2` key remains compatible with existing version-two saves. Missing new optional fields receive defaults. Invalid IDs, duplicate seals, out-of-range counts and unsupported records are sanitized; denied storage remains playable.

Global power-up purchases/refunds remain separate from **operator artifacts**. Each artifact purchase spends banked bounty and increments only one unlocked operator; catalog-defined stat cycles affect that operator's actual next-run modifiers. A deployment toggle permits a clean-stat run without deleting earned artifacts. Refunds never refund artifact installation costs.

Seals require discovery and obey the catalog budget. Weapon access is derived from explicit milestone statistics, previous discoveries and earned starters. Stage access preserves earlier discoveries/wins. Actual Inverse wins, Endless cycles, frenzy reward and floor-item statistics persist with ordinary results.

A normal run is banked once by the shell. Collection entries include union provenance. Achievement payouts are one-time and derived from their data-defined conditions.

## The Disclosure Protocol: isolated Operations

Operations use the engine with chapter-specific setup and objective evaluation:

1. **Initial Foothold:** Hunter in The Attack Surface, two-weapon limit; defeat 100 vulnerabilities before the four-minute deadline.
2. **Weaponize the Primitive:** Researcher in The Forbidden Repository, three-weapon limit; reach level 18 before five minutes.
3. **Coordinated Disclosure:** Reverser in The Exploit Foundry, four-weapon limit; recover the source relic and defeat a boss before seven minutes.

These are current data snapshots; `night-operations.json` remains authoritative. The operation supplies its own starting arcana, budget and purchased ranks; normal shared power-ups, operator artifacts and seals do not leak into its setup. Completing the actual objectives unlocks the next chapter. Deadline expiry without the objective fails the chapter; extraction cannot pretend to complete it.

`freshOperations`, `sanitizeOperations`, `availableOperations`, `createOperationRun`, `operationUpgradeCost`, `purchaseOperationUpgrade`, `recordOperation` and `ascendOperations` own the separate progression. Chapter results carry serial and ascension metadata so one result cannot be recorded repeatedly. Earned run gold and chapter rewards enter the operation budget; only the documented first-clear bounty enters the main wallet, once per chapter across ascensions. Ascension resets chapter progress, budget and purchased ranks while preserving claimed main bounties and applying a bounded operation-only Might bonus.

The browser Operations tab exposes chapter objectives, lock/completion state, budget upgrades, replay and ascension. Replays/restarts stay in the selected chapter flow.

## Original renderer and soundtrack

`createRenderer(canvas,CATALOG)` provides `resize`, `draw`, `drawMenu`, `dispose`; `paintPortrait` renders local menu art. It caches original sprites, animation frames, tiles and effect geometry, culls offscreen work and supports Inverse presentation without copying licensed art. The Cloud Spire, shields, rotating freeze beams, directed vaults and guarded floor passives have specific visuals matching their mechanics.

The six score movements in `night-music.json` are **The Sealed Archive**, **Oath of the Vulnerability Hunter**, **A Thousand Unpatched Gates**, **The Privileged Process**, **Full Disclosure at Dawn** and **The Last Stack Frame**. Stage variants transpose/present this original score; they are not thirty independently composed tracks. Organ-like pads, detuned choir, strings/ostinato, bells, bass and shaped percussion create real arrangement differences across lobby, hunt, intense, boss, victory and defeat states.

`createAudio()` provides `setEnabled`, `pause`, `setScene`, `setVolume`, `setEffectsVolume`, `getTrack`, `tick`, `play`, `dispose`. No game AudioContext exists before relevant user opt-in. An independent transport supports lobby and quiet selection music without advancing the simulation. Music/effects levels route through independent buses. Voice limits, cue reserves and bounded catch-up scheduling prevent combat bursts from creating unbounded nodes. Pause/visibility/exit cleanup and the portfolio ambience handoff remain mandatory.

## Offensive-security presentation

Enemy `threat` records identify a fictional vulnerability class, canonical MITRE CWE reference, literal signature and bounded kill narration. Weapon signatures are escaped code text. Stage scopes, briefings, formations and cached floor inscriptions refer to HTTP parsing, source review, memory exploitation, cloud IAM and kernel privileges.

`createIntel(CATALOG)` reads real events/statistics without changing combat. Its bounded/throttled log resets on every run, milestone claims require actual counts, and live focus follows threats/bosses. Debrief class totals use actual kills; research links prioritize existing matching advisory labels and never invent CVEs or reclassify research data.

## Verification and scope limits

`GAME-PARITY.md` records the initial 39-system baseline and the expanded mechanism matrix, with specific regression evidence. Complete-play simulations are separate from isolated unit fixtures; production browser tests use ordinary UI inputs and local save fixtures, without live-engine cheats. The final whole-suite/build/browser evidence belongs in `QA.md`.

Implemented mechanisms and content breadth are different measures. The game now has working cyclic pressure, original build/economy/control systems, a short isolated operation and adaptive music. It does not reproduce the original's complete roster, weapon/evolution/arcana catalog, secret ecosystem, special-stage campaigns, unlock interactions, numerical balance or soundtrack catalog. Co-op, DLC, licensed crossovers, localization breadth and platform services are outside the selected solo scope. Passing a custom checklist is not a measured commercial parity percentage.
