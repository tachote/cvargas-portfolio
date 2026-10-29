# Patch the Night: parity audit and acceptance gates

Audit and implementation review: October 29, 2026. The selected scope is an original single-player game inspired by base-game survival systems. The document retains the initial audit, records the mechanisms now implemented, and defines their verification boundaries. It is not a percentage of a commercial game's content or quality.

## Reference boundary

The useful comparison is the solo survival loop and its progression systems. Keep original offensive-security names, art, maps, music and writing. Do not reproduce poncle assets or claim feature equivalence from renamed buttons.

The official 1.0 announcement documents distinct Inverse risk/reward rules, cyclic Endless escalation, recurring merchant inventory and stage-linked alternate music. Those systems are stronger reference points than an indefinitely running timer. The targets below adapt those concepts; their balance values are original and must live in data. [poncle's 1.0 announcement](https://steamcommunity.com/games/1794680/announcements/detail/6186282400405707304), [official announcement feed containing the full text](https://store.steampowered.com/news/posts/?enddate=1666281806&feed=steam_community_announcements).

Adventures are a separate progression surface: chapters use restricted setups and individual win conditions, preserve the main game, and offer reset-based advancement. [poncle's Adventures FAQ](https://poncle.games/adventures-faq).

The current official store lists online co-op and describes local play for up to four people. Its platform services and growing content catalog exceed this static portfolio's existing solo architecture. [Official Steam product page](https://store.steampowered.com/app/1794680/Vampire_Survivors/).

## Current implementation and verification matrix

The current catalog contains **six operators, five stages, fourteen weapons, twelve passives, ten enemy species, six arcana, eight shared power-ups and three two-weapon unions**. Counts are a snapshot of `src/data/night-game.json`, not a claim of matching the original catalog. The expansion adds a genuine shield/recharge archetype (`aegis`), a rotating directional freeze archetype (`lancet`), The Cloud Spire's vertical corridor, two additional unions, an isolated three-chapter operation and six adaptive musical movements.

**Verified mechanism** below means the current source was reviewed and its specific Node regression cases passed. A focused expansion batch passed 49/49 cases on this review; the parent integration report supplies the final whole-suite/build/browser results. Unit fixtures establish mechanics, while the cited complete-play cases separately establish reachability. Automated audio checks establish note scheduling, routing and lifecycle; subjective listening quality is a separate judgment.

| Gate | Status in the selected scope | Current mechanism and focused evidence |
| --- | --- | --- |
| 40 — Endless cycles | Verified mechanism | `_syncCycle` preserves the build and total clock, restarts local waves/events/arcana and broker stock, and applies accumulating pressure. `tests/night-expanded.test.mjs`: cycle/reset/restock fixture, final-minute formation boundary, and an ordinary-play run beyond the first 30-minute cycle. |
| 41 — Inverse | Verified mechanism | Enemy health/speed/spawn pressure, bounty and growth change; the broker offers a revival and one additional seeded arcana slot. `tests/night-expanded.test.mjs` and `tests/night-defense.test.mjs`: actual stats/rewards, shared capacity and stale/unaffordable purchase rejection. This is original balancing, not the official numerical formula. |
| 42 — Curse | Verified mechanism | HP, speed, frequency and average batch quantity all respond, with bounded spawn work. `tests/night-expanded.test.mjs`: four-axis Curse regression. |
| 43 — Seals, slots and floor exceptions | Verified mechanism | Discovered-weapon seals persist; starting weapons remain; weapon limits apply across acquisition paths. Guarded authored floor items alone can exceed normal passive capacity. `tests/night-expanded.test.mjs`, `tests/night-progression.test.mjs` and `tests/night-arsenal.test.mjs`: legal reward paths, saturation protection, malformed-save handling and reload. |
| 44 — Operator augments | Verified mechanism | Purchases spend banked bounty once and increment only the selected operator's artifacts; catalog stat cycles affect actual run stats. `tests/night-progression.test.mjs`: purchase/isolation/reload/refund/cap cases; `tests/night-expanded.test.mjs`: actual modifier increments. |
| 45 — Bounty fever | Verified mechanism | A finite chain window triggers frenzy, qualifying gains extend its bounded timer, kills generate real coins, and statistics bank normally. `tests/night-expanded.test.mjs` and `tests/night-progression.test.mjs`: activation/expiry/reward/persistence cases. |
| 46 — Content unlocks | Verified mechanism, small original tree | `night-progression.json` gates weapon access; The Cloud Spire unlocks after a normal victory. Prior discoveries, earned starters and stage access survive. `tests/night-progression.test.mjs` and `tests/night-arsenal.test.mjs`: exact thresholds, reload and enforcement on random/directed/broker/raw rewards. |
| 47 — Directed arsenal vault | Verified mechanism | Authored vault pickups present the complete legal new-weapon pool, pause the simulation, grant the selected weapon once, and fall back to bounty when exhausted. `tests/night-arsenal.test.mjs`: ordinary movement, legal pool, queued XP, duplicate rejection and landmark survival. The authored availability is an original adaptation, not a commercial rarity match. |
| 48 — Operations | Verified mechanism, one short campaign | The Disclosure Protocol has three sequential chapters, restricted loadouts, explicit objectives, isolated budget/ranks and capped ascension. `tests/night-operations.test.mjs`: normal-input complete campaign, failure/extraction rejection, serial banking, reload, isolated purchases and replay-safe first-clear rewards. |
| 49 — Arcana draft and toggles | Verified mechanism | Timed packs contain up to three seeded legal cards; reroll/skip preserve pending XP and consume their resources. Normal/Endless/Inverse capacities share one rule; Arcana and Limit Break toggles affect actual rewards. `tests/night-arsenal.test.mjs`, `tests/night-expanded.test.mjs` and `tests/night-defense.test.mjs`. |
| 50 — Co-op | Outside selected solo scope; not implemented | One player, build and input vector remain. Multiple controller support controls the same survivor. Neither local multi-survivor play nor networked multiplayer is claimed. |
| 51 — Adaptive original soundtrack | Verified mechanism; subjective quality separate | Six movements, stage pitch variants, escalating orchestration, boss percussion, victory/defeat cues and independent music/effects buses. `tests/night-audio.test.mjs`: actual scheduled arrangement differences, audible-path separation, polyphony/catch-up bounds, opt-in and cleanup. |

Additional verified expansion mechanisms:

- **Sandbox Aegis → Unbroken Boundary:** finite hit absorption, delayed charge recovery, capacity limits, invulnerability and evolved retaliation with real damage/kill credit. **Race-Window Lance → Deterministic Horizon:** an actual rotating freeze corridor and bounded current-HP cuts with boss resistance. `tests/night-defense.test.mjs` checks both complete data-driven level/evolution paths and excludes meaningless zero-speed Limit Break rewards.
- **Allocator Sovereign** combines Stack Pivot and Heap Spray; **Crash to Shell** combines Fuzzing Storm and RCE Payload. Both consume their second source, free a slot, change attacks and retain merged damage credit. Dedicated cases in `tests/night-arsenal.test.mjs` supplement the original Supply Chain Collapse union tests.
- **Final Confrontation** is an optional finite-run contract: reaching the deadline enters overtime while the final boss remains alive. The normal survival-clear rule remains available. `tests/night-expanded.test.mjs` verifies the live boss, overtime and actual final defeat.
- **The Cloud Spire** has its own original presentation, a corridor bounded on the x-axis with travel along y, timed formations, IAM sweeps, guarded floor items and a directed vault. `tests/night-defense.test.mjs` verifies vertical corridor collision; `tests/night-progression.test.mjs` verifies earned access.

## Historical starting implementation


Before this expansion, the catalog had six operators, four stages, twelve weapons, twelve passives, six arcana, eight persistent power-ups and one union. The 39 accepted gates in `GAME-SPEC.md` describe substantial working systems, including distinct weapon patterns, evolved effects, real unions, Limit Break, guarded rescue objectives, geometry, a merchant, stage hazards and authored formations.

Evidence anchors:

- `src/scripts/night/engine.js`: `_weaponStats`, `_candidates`, `_applyReward`, `_openChest`, `_openMerchant`, `_authoredEvents`, `_wave`, `_step`, `getResult`.
- `src/scripts/night/save.js`: `freshSave`, `loadSave`, `purchase`, `recordRun`, `awardAchievements`.
- `src/scripts/vgate.js`: deployment options, guide/progression, shop, paused-state presentation and result banking.
- `tests/night-engine.test.mjs` and `tests/night-save.test.mjs`: complete seeded runs, weapon effects, evolutions, unions, merchant and persistence regressions.

The following were the initial audit findings; the current matrix above supersedes their missing-feature status:

1. Endless already repeated the authored event schedule through `_eventCycle`, but ordinary waves still used global elapsed time and the merchant did not replenish by cycle.
2. Curse affected HP/frequency, while movement speed and batch quantity did not respond.
3. Run-local Banish existed, while persistent pre-run seals did not.
4. Shared permanent power-ups existed, while individual operator augmentation did not.
5. Greed healed on collected gold and added cache gold, but there was no timed bounty chain.
6. Timed arcana selection exposed the whole remaining pool and used a fixed capacity.
7. Normal survival at the deadline counted as a win even with the optional final boss alive. That rule remains intentional; the new Final Confrontation contract explicitly selects boss-required overtime instead.

## Expansion gates

The original acceptance contracts are retained below. Their current status is the matrix above. Catalog fields, screenshots or a menu label alone do not verify a mechanical gate.

### 40. Endless cycles with escalating replay pressure — P0

Original gap: authored events repeat, but ordinary enemy selection never returns to the opening composition and merchant purchases remain exhausted.

Acceptance:

- Expose a stable cycle index and a clock within the cycle. Advancing across a boundary retains total time, level, equipped build, experience, position and earned gold.
- The ordinary wave pool and authored event timing restart their local progression while documented cycle modifiers increase enemy pressure.
- Restock appropriate merchant offers once per boundary; expired purchased offers cannot be charged again within the same cycle. Global and per-cycle purchase counters have separate meanings.
- Endless never spawns the normal finite-run end encounter and never becomes `won` merely because a cycle elapsed.
- Keep the existing enemy, projectile, pickup and event caps.

Reproduce: seeded fixtures immediately before and after two cycle boundaries; compare eligible wave kinds, enemy HP/damage/cadence and merchant purchase state. Then run a complete multi-cycle ordinary-input simulation and assert caps and survival state.

### 41. Inverse as a real difficulty/reward mode — P0

Original gap: no option, state, reward modifier or merchant branch for Inverse.

Acceptance:

- A pre-run control changes actual enemy durability/escalation and gold reward calculations using catalog values; results retain the selected mode.
- The base mode remains unchanged when the control is off. Do not implement difficulty as a visual flip alone.
- Its expanded merchant services must grant the resources shown, respect prices/limits and reject obsolete purchases. Any extra arcana capacity must be enforced consistently.
- A reduced-motion-safe visual treatment can identify the mode; visual inversion may remain optional.

Reproduce: same seed, operator and stage with only Inverse changed. Assert actual spawned enemy stats, collected gold, merchant inventory and saved result metadata. Verify both finite and Endless combinations.

### 42. Complete the Curse pressure contract — P0

Original gap: HP and frequency respond to Curse; speed and quantity do not.

Acceptance:

- State clearly which enemy properties and spawn parameters Curse changes. Apply those changes to actual spawned entities and waves, with sensible lower/upper bounds.
- Equipping or increasing the passive updates subsequent spawns without corrupting existing enemies or causing unbounded allocation.
- A neutral-Curse run remains behaviorally identical to the established baseline.

Reproduce: identical seeded early and late fixtures at neutral and raised Curse. Measure HP, speed, ordinary batch size and spawn interval; saturate the entity budget and confirm bounded work.

### 43. Persistent seals and configurable weapon slots — P0

Original gap: run-local Banish works; every new run still uses the fixed catalog slot cap and unrestricted nonstarter item pool.

Acceptance:

- A catalog-limited pre-run seal set survives reload and filters both ordinary upgrades and other applicable equipment rewards.
- A selected starting weapon can never be silently removed. Reject conflicting seals or explicitly explain and apply the starter exception.
- A chosen weapon limit applies to candidates, merchant choices and directed rewards, while owned weapons can still level/evolve. Union consumption genuinely frees capacity.
- Preserve a legal fallback reward path when the selected pool is exhausted. Empty choices must not softlock a run.
- If authored floor passives may exceed the normal passive-slot cap, treat that as an explicit acquisition exception: level-up rewards must not grant a random extra slot. Repeated contact with one floor item cannot duplicate it.
- Validate IDs, duplicates, budgets and slot limits while loading old or malformed saves.

Reproduce: inspect upgrade candidate sets across multiple seeds and full inventories; exercise merchant rewards and a union with a one/two-slot limit; reload sanitized seal state and verify the next run uses it.

### 44. Individual operator augments — P0

Original gap: all persistent purchases are shared power-ups; saves contain no per-operator growth record.

Acceptance:

- An original augmentation equivalent spends the displayed currency and stores bounded gains for the selected operator only.
- Gains alter the next run's actual computed stats and survive recalculation after later upgrades.
- An enable/disable option permits a clean-stat run without deleting earned augments.
- Purchases are atomic: insufficient funds, unknown operators, invalid quantities and invalid stats cannot grant a benefit.
- Version-two saves keep all existing gold, unlocks, achievements and collections when new optional fields are absent.

Reproduce: buy for one operator, reload, compare that operator enabled/disabled and a different operator. Verify exact currency delta and real combat/player-stat differences. Test corrupt and denied storage.

### 45. Timed bounty fever with a real reward chain — P0

Original gap: Greed's existing heal/cache effects do not form a timed economy loop.

Acceptance:

- A documented gameplay trigger starts a finite fever timer; qualifying kills/pickups extend it only within data-defined limits.
- Its rewards affect collected/run gold and final banking, with separate actual chain totals and maximum-chain statistics.
- Choice, chest, merchant and pause screens freeze the timer along with gameplay. Expiry ends its effects once.
- Coin generation respects pickup merging/caps and cannot turn a single trigger into unbounded entities or duplicate persistent rewards.

Reproduce: trigger, extend, cap, expire and retrigger a seeded chain; compare actual bounty to a control run. Pause at a choice and confirm both timers remain frozen. Bank once and reload.

### 46. Item and stage unlock progression — P1

Original gap: achievements grant currency, later operators unlock from global statistics, and the collection records discoveries. Those are not an item/stage unlock tree.

Acceptance:

- New gated content has machine-readable, attainable conditions and visible progress; locked records are excluded from upgrade/candidate/deployment paths.
- Fulfillment unlocks content once and the next valid run can actually use it.
- Preserve existing users' earned content and the established accessible starter stages; do not manufacture progress by taking features away.

Reproduce: fresh profile, partial progress, exact threshold, reload and usable content. Check that a failed/abandoned run does not receive an unrelated stage-clear unlock.

### 47. Directed weapon cache — P1

Original gap: normal caches grant owned upgrades/evolutions; the broker offers a random subset. Neither lets a player deliberately select a new legal weapon from an eligible catalog.

Acceptance:

- A rare original cache opens a paused selection using actual unlocked, unsealed, slot-legal equipment.
- Choosing applies a real weapon reward once, closes the cache and preserves queued level choices.
- A full build, exhausted pool or consumed union source has a defined legal fallback. Closing/extraction cannot duplicate its reward.

Reproduce: empty/full inventory, sealed/locked choices, union sources, pending XP levels and repeated selection rejection. Browser evidence must reach the screen through normal pickups or a legitimate saved fixture.

### 48. Separate miniature campaign progression — P1

Original gap: all runs use the same global meta progression and duration/boss win contract.

Acceptance:

- An original offensive-security operation contains multiple authored chapters with different starting restrictions and explicit attainable objectives.
- Campaign currency/unlocks are isolated from ordinary runs except documented completion rewards.
- Completing a chapter unlocks its successor; replaying or reloading cannot repeatedly bank its first-clear reward.
- A campaign reset/ascension preserves its own earned advancement and leaves the main save intact.

Reproduce: complete the sequence through normal seeded actions, reload between chapters, then reset/advance and verify main-game currency, collection and operator augments remain correct.

### 49. Arcana draft and capacity consistency — P1

Original gap: timed arcana choices list every remaining card; all award/purchase paths use the same fixed capacity.

Acceptance:

- Timed rewards offer a seeded, bounded draft from the legal remaining pool, with documented reroll/skip behavior.
- Starting choice, timed draft and merchant awards share one capacity rule, including any mode-specific extra slot.
- Existing effects remain actual combat/economy modifiers; exhausted pools and duplicate cards never trap the paused state.
- Pre-run arcana and Limit Break toggles must affect their actual candidate/timed-reward paths. Turning either off must leave normal upgrades and legal full-build fallback rewards available.

Reproduce: identical seeds produce identical packs; rerolls consume only their resource; a full or exhausted pool resumes legally. Check purchased extra capacity against later timed rewards and obsolete broker offers.

### 50. Genuine cooperative play — excluded from selected solo scope

Original gap: the engine has one `player`, one viewport, one build and one input vector. Additional controllers currently control the same survivor.

Acceptance:

- At least two independently controlled survivors have distinct positions, health and builds; shared experience/upgrade/pause rules are explicit.
- Enemy targeting, revival, loot, camera boundaries and victory conditions work with both players.
- Disconnecting a controller and leaving/restarting a run cannot strand input or duplicate banking.
- Online cooperation is a separate scope requiring synchronization and hosting; local input support is not online multiplayer.

Reproduce: two input devices act simultaneously and demonstrably affect different actors; one survivor dies/revives; a shared level choice, boss, result and disconnect all complete correctly. A second portrait or cursor does not count.

### 51. Original adaptive epic soundtrack — quality gate

Original gap: game music is a fixed short electronic pattern; the portfolio's original organ/bell ambience is a separate player. Audio does not follow the stage, boss phase or run intensity.

Acceptance:

- Compose original stage/phase arrangements with a coherent gothic motif and clear escalation into boss/climax/victory, rather than only raising volume.
- Stage/phase inputs change audible orchestration or note scheduling; transitions avoid retrigger storms and retain a bounded voice/node budget.
- Music and effects have usable independent levels. No audio context exists before the relevant user opt-in, and one muted mode cannot accidentally reactivate another soundtrack.
- Preserve pause/visibility/exit cleanup and the portfolio-to-game audio handoff. Reduced motion changes visual meters, not the user's sound preference.

Reproduce: actual nonzero output signal; instrumented note/arrangement differences for two stages and a boss transition; repeated state changes; mute, pause, hidden tab, return to portfolio and exit. Review listening quality separately from automated signal tests.

## Completion reporting

Report three distinct outcomes:

1. **Verified gameplay systems:** link passing engine/save/browser cases for each completed gate.
2. **Original content breadth:** give actual data-derived counts and list the stages/operators/weapons added.
3. **Remaining differences:** distinguish the implemented short operation and small unlock tree from the original's broader campaigns, content catalog, secret ecosystem, cooperation, platform services and balance.

Do not turn `completed / 51` into a claimed Vampire Survivors percentage. A custom checklist omits commercial content breadth, secret interactions, current free updates, DLC, cooperation variants, localization and platform services. Epic music and an impressive screenshot improve this game's quality; they do not prove global parity.


## Remaining breadth and intentional differences

The selected solo mechanical scope is substantially broader than the original portfolio minigame. It still does not reproduce every base-game character, weapon, evolution, arcana interaction, pickup, secret condition, special-stage rule or campaign. The small original unlock tree, three unions and one short operation are implemented systems with their own content; they are not the original's entire unlock, union or Adventure catalogs. Stage/phase soundtrack variants do not imply a matching commercial soundtrack catalog.

Local and online cooperation are outside this selected solo scope. DLC, licensed crossovers, platform achievements/cloud services, localization breadth and platform-specific integrations are also outside scope. Exact enemy population limits, random distributions, damage scaling, progression rates and Inverse/Endless formulas are original balancing choices. Those differences remain material even when every applicable mechanism in this document has a passing test.


## Final integration evidence

The complete Node suite passed **97/97**. The complete production-browser suite passed **75 cases**, with one intentional desktop touch skip and no failures, across desktop and mobile. Its web-server step also passed the production build. Directed-vault access and operation completion used ordinary movement/combat/choices; advanced controls, stage unlocks, music lifecycle, CSP, responsive bounds and persistence were verified separately. See `QA.md` for reproduction, evidence distinctions and limits.
