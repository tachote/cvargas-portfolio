import gameStyles from './vgate.css?url';
import { CATALOG, createRun } from './night/engine.js';
import { createRenderer, paintPortrait } from './night/renderer.js';
import { ACHIEVEMENTS, achievementProgress, awardAchievements, loadSave, persistSave, purchase, powerUpCost, refundPowerUps, recordRun, purchaseAugment, toggleSeal, unlockedWeapons, weaponUnlockStatus, stageUnlockStatus } from './night/save.js';
import { createAudio } from './night/audio.js';
import { createIntel } from './night/intel.js';
import INTERFACE from '../data/night-interface.json';
import { OPERATIONS, availableOperations, createOperationRun, recordOperation, purchaseOperationUpgrade, operationUpgradeCost, ascendOperations } from './night/operations.js';

let stylesheetPromise;
function loadStylesheet() {
  if (!stylesheetPromise) stylesheetPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = gameStyles; link.dataset.gameStyles = 'true';
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => { link.remove(); stylesheetPromise = undefined; reject(new Error('The game stylesheet could not be loaded. Please try again.')); }, { once: true });
    document.head.appendChild(link);
  });
  return stylesheetPromise;
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = value => { const s = Math.max(0, Math.floor(value || 0)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const num = value => Math.floor(value || 0).toLocaleString('en-US');
const art = (kind, id, size = 44) => `<canvas class="g-item-art" width="${size}" height="${size}" data-art-kind="${esc(kind)}" data-art-id="${esc(id)}" aria-hidden="true"></canvas>`;
const find = (records, id) => records.find(item => item.id === id);
const weaponTitle = weapon => { const def = find(CATALOG.weapons, weapon.id); return weapon.union ? weapon.union.name || weapon.unionName || def.union?.name || def.evolution.name : weapon.evolved ? def.evolution.name : def.name; };
const unlockLabel = character => { const rule = character.unlockRequirement; return rule ? `${num(rule.value)} ${(rule.value === 1 ? rule.stat.replace(/s$/, '') : rule.stat).toUpperCase()}` : 'LOCKED'; };

/** Engine, renderer, audio and stylesheet are loaded only on explicit entry. */
export async function openGate(CVES) {
  if (!CVES?.length || document.getElementById('gate') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  await loadStylesheet();
  if (document.getElementById('gate') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const controller = new AbortController(), { signal } = controller;
  const previousFocus = document.activeElement;
  const background = [...document.body.children].map(node => [node, node.inert]);
  const save = loadSave(CATALOG), audio = createAudio(), intel = createIntel(CATALOG);
  const root = document.createElement('div');
  root.id = 'gate'; root.className = 'g-menu'; root.dataset.state = 'menu';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'g-heading');
  root.innerHTML = `
  <canvas class="g-arena" aria-label="Survivor arena. Move with WASD, arrows, a controller or touch. Attacks are automatic."></canvas>
  <div class="g-top"><span class="g-brand"><span aria-hidden="true">✦</span> CV / NIGHT ARCHIVE</span><div class="g-top-actions"><button type="button" class="g-audio" aria-pressed="false">SOUND OFF</button><button type="button" class="g-pause" hidden aria-label="Pause game">Ⅱ</button><button type="button" class="g-exit">Exit · Esc</button></div></div>
  <div class="g-hud" hidden><div class="g-xp-row"><span class="g-level">LV. 1</span><progress class="g-xp" value="0" max="1" aria-label="Experience until next level"></progress></div><div class="g-hud-row"><div class="g-life"><div><span>INTEGRITY</span><b class="g-hp-label"></b></div><progress class="g-hp" value="1" max="1" aria-label="Player health"></progress></div><div class="g-clock"><b>00:00</b><span class="g-wave-label">BREACH WINDOW</span></div><div class="g-score"><b>0</b><span>EXPLOITED</span></div><div class="g-gold"><b>0</b><span>BOUNTY</span></div></div><div class="g-boss" hidden><span></span><progress max="1" value="1" aria-label="Boss health"></progress></div></div>
  <div class="g-fever" hidden><span>${esc(INTERFACE.feverTitle)}</span><b></b><progress value="0" max="1" aria-label="Bounty fever remaining"></progress></div>
  <aside class="g-live-intel" hidden aria-label="Vulnerability intel"><span class="g-intel-label">${esc(CATALOG.ui.intelTitle)}</span><div><b class="g-threat-class"></b><span class="g-threat-cwe"></span></div><span class="g-threat-name"></span><code class="g-threat-code"></code></aside><aside class="g-oplog" hidden aria-label="Operator exploit log"><span>${esc(CATALOG.ui.feedTitle)}</span><ol></ol></aside>
  <div class="g-screen g-intro" data-view="menu"><div class="g-lobby"><header class="g-lobby-heading"><div><p class="g-eyebrow">OFFENSIVE SECURITY / HORDE SURVIVAL</p><h1 id="g-heading">PATCH <span>THE NIGHT</span><span class="g-title-mark" aria-hidden="true">✦</span></h1><p class="g-subtitle">${esc(CATALOG.ui.lobbySubtitle)}</p></div><div class="g-bank"><span>BOUNTY VAULT</span><b class="g-wallet">${num(save.gold)}</b></div></header><nav class="g-tabs" aria-label="Game menu"><button type="button" data-tab="deploy" aria-selected="true">01 / DEPLOY</button><button type="button" data-tab="shop" aria-selected="false">02 / POWER UPS</button><button type="button" data-tab="guide" aria-selected="false">03 / FIELD GUIDE</button><button type="button" data-tab="operations" aria-selected="false">${esc(INTERFACE.operationsTab)}</button></nav><div class="g-tab-content"></div><p class="g-lobby-note">Original game &amp; art · fictional threats, real research · progress saved on this device</p></div></div>
  <div class="g-screen g-choice" data-view="upgrade" hidden><div class="g-overlay-header"><p class="g-eyebrow">EXPLOIT CHAIN / LEVEL <span class="g-choice-level"></span></p><h2 tabindex="-1">${esc(CATALOG.ui.choiceTitle)}</h2><p class="g-choice-note">Choose a weapon or passive. The breach waits while you decide.</p></div><div class="g-upgrades"></div><div class="g-choice-actions"><button type="button" class="g-reroll g-secondary"></button><button type="button" class="g-skip g-secondary"></button><button type="button" class="g-banish g-secondary" aria-pressed="false"></button></div><p class="g-key-hint">Number keys choose · R rerolls · Every slot changes your build</p></div>
  <div class="g-screen g-chest" data-view="chest" hidden><p class="g-eyebrow">BOUNTY CACHE / CHAIN REACTION</p><div class="g-chest-sigil" aria-hidden="true">▣</div><h2 tabindex="-1">${esc(CATALOG.ui.chestTitle)}</h2><p class="g-choice-note">Compatible max-level weapons evolve in eligible caches.</p><div class="g-chest-rewards"></div><button type="button" class="g-chest-collect g-primary">CLAIM THE CACHE <span>↗</span></button></div>
  <div class="g-screen g-arcana" data-view="arcana" hidden><p class="g-eyebrow">FORBIDDEN KNOWLEDGE</p><h2 tabindex="-1">Rewrite the rules.</h2><p class="g-choice-note">Stack a new arcana on your existing exploit chain.</p><div class="g-arcana-options"></div><div class="g-choice-actions"><button type="button" class="g-arcana-reroll g-secondary"></button><button type="button" class="g-arcana-skip g-secondary"></button></div></div>
  <div class="g-screen g-arsenal" data-view="arsenal" hidden><p class="g-eyebrow">ZERO-DAY VAULT / DIRECTED ACQUISITION</p><h2 tabindex="-1">${esc(INTERFACE.arsenalTitle)}</h2><p class="g-choice-note">${esc(INTERFACE.arsenalHint)}</p><div class="g-arsenal-options"></div><button type="button" class="g-arsenal-skip g-secondary">${esc(INTERFACE.arsenalSkip)}</button></div>
  <div class="g-screen g-paused" data-view="paused" hidden><p class="g-eyebrow">${esc(CATALOG.ui.pauseKicker)}</p><h2>${esc(CATALOG.ui.pauseTitle)}</h2><p class="g-pause-summary"></p><div class="g-pause-build"></div><div class="g-pause-actions"><button type="button" class="g-resume g-primary">RESUME THE HUNT ↗</button><button type="button" class="g-restart g-secondary">Start a new run</button><button type="button" class="g-retire g-secondary">Extract &amp; bank bounty</button></div><div class="g-soundtrack-panel"><span class="g-track-label">${esc(INTERFACE.nowPlaying)}</span><b class="g-track-title"></b><div class="g-pause-volume"></div></div><div class="g-pause-settings"><label><input type="checkbox" class="g-low-fx"> Performance mode</label><span>M toggles minimap · P resumes</span></div></div>
  <div class="g-screen g-death" data-view="dead" hidden><p class="g-eyebrow">SEGMENTATION FAULT</p><h2 tabindex="-1">${esc(CATALOG.ui.deathTitle)}</h2><p class="g-death-note"></p><button type="button" class="g-revive g-primary">RESTORE CHECKPOINT ↗</button><button type="button" class="g-retire g-secondary">End run &amp; bank bounty</button></div>
  <div class="g-screen g-merchant" data-view="merchant" hidden><p class="g-eyebrow">THE BROKER / OFF-GRID SERVICES</p><h2 tabindex="-1">Everything has a price.</h2><p class="g-choice-note">Spend this run’s bounty on an edge. The stage clock waits.</p><p class="g-merchant-wallet"></p><div class="g-merchant-offers"></div><button type="button" class="g-merchant-leave g-primary">BACK TO THE BREACH ↗</button></div>
  <div class="g-screen g-result" data-view="result" hidden><p class="g-eyebrow g-result-kicker"></p><h2 tabindex="-1"></h2><p class="g-result-description"></p><p class="g-rule-summary"></p><div class="g-result-stats"></div><div class="g-unlocks"></div><div class="g-damage-report"></div><div class="g-threat-report"></div><p class="g-disclosure">Game bounty is fictional. These advisories are real research from this portfolio.</p><div class="g-advisories"></div><div class="g-result-actions"><button type="button" class="g-again g-primary">HUNT AGAIN ↗</button><button type="button" class="g-lobby-button g-secondary">Change build</button><button type="button" class="g-back g-secondary">Back to portfolio</button></div></div>
  <div class="g-bottom" hidden><div class="g-inventory"><div class="g-weapon-slots" aria-label="Equipped weapons"></div><div class="g-passive-slots" aria-label="Equipped passives"></div></div><div class="g-bottom-actions"><button type="button" class="g-map-toggle g-secondary" aria-pressed="true" aria-label="Toggle minimap">MAP · M</button><button type="button" class="g-dash">DASH <span>READY</span></button></div></div>
  <div class="g-banner" hidden role="status"></div><div class="g-announcement" aria-live="polite" role="status"></div>`;
  background.forEach(([node]) => { node.inert = true; }); document.body.append(root); document.documentElement.classList.add('gate-open');
  const $ = selector => root.querySelector(selector);
  const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal });
  let renderer;
  try { renderer = createRenderer($('.g-arena'), CATALOG); }
  catch (error) { background.forEach(([node, inert]) => { node.inert = inert; }); root.remove(); document.documentElement.classList.remove('gate-open'); throw error; }
  let run, raf = 0, closed = false, paused = false, view = 'menu', tab = 'deploy', last = 0, lastHud = 0, lastInventory = '', banked = false, lastIntel = '';
  let characterId = save.unlocked[0] || CATALOG.characters[0].id, stageId = CATALOG.stages[0].id;
  let mode = 'quick', hyper = false, hurry = false, inverse = false, weaponLimit = CATALOG.config.weaponSlots, arcanaEnabled = true, limitBreak = true, finalBossRequired = false, useEggs = true, arcanaId = CATALOG.arcana[0]?.id, mapVisible = true;
  let pointer = null, keys = {}, dashRequested = false, banishing = false, bannerTimer, padInterval, lastPadButtons = [], padNavTime = 0, padSeen = false;
  let viewport = { ...CATALOG.config.defaultViewport };
  function announce(text) { $('.g-announcement').textContent = text; }
  function paint(node = root) { node.querySelectorAll('[data-art-kind]').forEach(canvas => paintPortrait(canvas, canvas.dataset.artKind, canvas.dataset.artId)); }
  function draw() { if (run && view !== 'menu') renderer.draw(run, { pointer, showMap: mapVisible, quality: save.settings.quality }); else renderer.drawMenu({ stageId, characterId, inverse }); }
  function resize() { viewport = renderer.resize(root.clientWidth, root.clientHeight, Math.min(devicePixelRatio || 1, 2)); if (run) run.viewport = viewport; draw(); }
  function focus(selector) { $(selector)?.focus({ preventScroll: true }); }
  function focusable() { return [...root.querySelectorAll('button,a[href],input,select,summary')].filter(e => !e.disabled && !e.closest('[hidden]') && e.getClientRects().length); }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; keys = {}; pointer = null; dashRequested = false; }
  function setView(next) {
    stopLoop(); view = next; root.className = `g-state-${next}`; root.dataset.state = next;
    root.querySelectorAll('[data-view]').forEach(panel => { panel.hidden = panel.dataset.view !== next; });
    $('.g-hud').hidden = !run || next === 'menu' || next === 'result'; $('.g-bottom').hidden = next !== 'playing';
    $('.g-fever').hidden = next !== 'playing' || !run?.goldFever?.active;
    $('.g-live-intel').hidden = next !== 'playing'; $('.g-oplog').hidden = next !== 'playing';
    $('.g-pause').hidden = !['playing', 'paused'].includes(next); $('.g-pause').textContent = next === 'paused' ? '▶' : 'Ⅱ';
    $('.g-pause').setAttribute('aria-label', next === 'paused' ? 'Resume game' : 'Pause game');
    if (next !== 'playing') { clearTimeout(bannerTimer); $('.g-banner').hidden = true; }
    syncMusic(); audio.pause(next === 'paused' || document.hidden);
    draw();
    if (next === 'playing') { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function banner(text) { $('.g-banner').textContent = text; $('.g-banner').hidden = false; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { $('.g-banner').hidden = true; }, 3200); announce(text); }
  function syncMusic() {
    const duration = Number.isFinite(run?.duration) ? run.duration : CATALOG.config.endlessCycleDuration;
    const time = run?.goldFever?.active ? duration : run?.mode === 'endless' ? run.cycleTime : run?.time || 0;
    const track = audio.setScene({ stageId: run?.stageId || stageId, time, duration, boss: !!run?.enemies.some(e => e.boss && e.hp > 0), state: view, quality: save.settings.quality });
    if ($('.g-track-title')) $('.g-track-title').textContent = track.title;
  }
  async function toggleSound() {
    const next = !save.settings.audio; save.settings.audio = next; audioButton();
    audio.setVolume(save.settings.musicVolume); audio.setEffectsVolume(save.settings.effectsVolume);
    const enabled = await audio.setEnabled(next);
    if (closed) return; save.settings.audio = enabled; audioButton(); syncMusic(); persistSave(save);
  }
  function audioButton() { $('.g-audio').textContent = save.settings.audio ? 'SOUND ON' : 'SOUND OFF'; $('.g-audio').setAttribute('aria-pressed', String(save.settings.audio)); }

  function renderLobby(restoreSelector) {
    root.dataset.character = characterId; root.dataset.stage = stageId; $('.g-wallet').textContent = num(save.gold);
    root.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'deploy') {
      const character = find(CATALOG.characters, characterId), stage = find(CATALOG.stages, stageId);
      $('.g-tab-content').innerHTML = `
      <div class="g-deploy-grid"><section class="g-character-panel" aria-labelledby="g-operator-title"><div class="g-panel-heading"><span>01 / YOUR OPERATOR</span><span>${CATALOG.characters.length} DOSSIERS</span></div><div class="g-character-detail">${art('character', characterId, 160)}<div><p class="g-eyebrow">BREACH SPECIALIST</p><h2 id="g-operator-title">${esc(character.name)}</h2><p>${esc(character.bonus || character.description)}</p><span class="g-character-specialty">${esc(character.specialty || character.description)}</span><span class="g-starting-weapon">STARTER / ${esc(find(CATALOG.weapons, character.weapon)?.name)}</span></div></div><div class="g-characters" aria-label="Choose character">${CATALOG.characters.map(c => { const locked = !save.unlocked.includes(c.id); return `<button type="button" data-character="${esc(c.id)}" class="g-character-card${locked ? ' g-locked' : ''}" aria-pressed="${c.id === characterId}" ${locked ? 'disabled' : ''} title="${esc(locked ? c.unlock : c.bonus)}">${art('character', c.id, 64)}<span>${esc(c.name)}</span><small>${locked ? esc(unlockLabel(c)) : 'AVAILABLE'}</small></button>`; }).join('')}</div><div class="g-operator-footer"><span>AUTO ATTACKS</span><span>MOVE TO SURVIVE</span></div></section>
      <section class="g-stage-panel" aria-labelledby="g-stage-title"><div class="g-panel-heading"><span id="g-stage-title">02 / ATTACK SURFACE</span><span>${CATALOG.stages.length} STAGES</span></div><div class="g-stages">${CATALOG.stages.map((s, i) => `<button type="button" class="g-stage-card"${stageUnlockStatus(save, CATALOG).find(record => record.id === s.id).unlocked ? '' : ' disabled'} data-stage="${esc(s.id)}" aria-pressed="${s.id === stageId}">${art('stage', s.id, 180)}<span class="g-stage-index">0${i + 1}</span><strong>${esc(s.name)}</strong><span class="g-stage-difficulty">${esc(stageUnlockStatus(save, CATALOG).find(record => record.id === s.id).unlocked ? s.difficulty || '' : s.unlock)}</span></button>`).join('')}</div><div class="g-stage-description"><b>${esc(stage.name)}</b><code>${esc(stage.scope)}</code><p>${esc(stage.description)}</p></div><div class="g-run-options"><label>BREACH WINDOW<select id="g-mode"><option value="quick"${mode === 'quick' ? ' selected' : ''}>${esc(CATALOG.ui.quickLabel)}</option><option value="standard"${mode === 'standard' ? ' selected' : ''}>${esc(CATALOG.ui.standardLabel)}</option><option value="endless"${mode === 'endless' ? ' selected' : ''}>${esc(CATALOG.ui.endlessLabel)}</option></select></label><div class="g-modifiers"><label><input id="g-hyper" type="checkbox"${hyper ? ' checked' : ''}> Hyper <small>Faster movement &amp; threats</small></label><label><input id="g-hurry" type="checkbox"${hurry ? ' checked' : ''}> Hurry <small>Double the stage clock</small></label></div></div></section></div>
      ${contractHTML()}<details class="g-mission-brief"><summary>${esc(CATALOG.ui.briefingLabel)} / ${esc(stage.name)}</summary><p>${esc(stage.briefing)}</p></details><section class="g-starting-arcana" aria-label="Starting arcana"${arcanaEnabled ? '' : ' hidden'}><div><span class="g-panel-label">03 / FORBIDDEN KNOWLEDGE</span><p>A rule to build around.</p></div><div class="g-arcana-picker">${CATALOG.arcana.map(a => `<button type="button" data-arcana="${esc(a.id)}" aria-pressed="${a.id === arcanaId}" title="${esc(a.description)}">${art('weapon', a.id, 30)}<span>${esc(a.name)}</span></button>`).join('')}</div></section>
      <div class="g-deploy-footer"><p class="g-controls"><kbd>WASD</kbd> / arrows · <kbd>SPACE</kbd> dash · <kbd>P</kbd> pause<br>Touch: drag to move · Controller: left stick / A</p><button type="button" class="g-start g-primary">ENTER THE BREACH <span aria-hidden="true">↗</span></button></div>`;
    } else if (tab === 'operations') {
      $('.g-tab-content').innerHTML = operationsHTML();
    } else if (tab === 'shop') {
      $('.g-tab-content').innerHTML = `<div class="g-shop-heading"><div><p class="g-eyebrow">PERSISTENT PRIVILEGES</p><h2>Invest your bounty.</h2><p>Permanent bonuses. Every operator. Every run.</p></div><span class="g-save-label">${num(save.stats.runs)} RUNS / ${num(save.stats.kills)} EXPLOITED</span></div><div class="g-shop-grid">${CATALOG.powerUps.map(item => { const level = save.powerUps[item.id] || 0, maxed = level >= item.maxLevel, cost = powerUpCost(item, level); return `<article class="g-shop-card">${art('weapon', item.id)}<div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><span class="g-shop-level">${'◆'.repeat(level)}${'◇'.repeat(Math.max(0, item.maxLevel - level))} <span>${level}/${item.maxLevel}</span></span></div><button type="button" data-buy="${esc(item.id)}" class="g-secondary" aria-label="Buy ${esc(item.name)} power up for ${num(cost)} gold"${maxed || save.gold < cost ? ' disabled' : ''}>${maxed ? 'MAXED' : `${num(cost)} GOLD`}</button></article>`; }).join('')}</div>${augmentHTML()}<p class="g-shop-notice" role="status"></p>`;
    } else {
      $('.g-tab-content').innerHTML = `<div class="g-guide-heading"><p class="g-eyebrow">REVERSE ENGINEER YOUR BUILD</p><h2>The exploit codex.</h2><p>Find stage relics, rescue quarantined researchers and trade with the Grey-Hat Broker. Max weapons, carry compatible passives and open boss caches to evolve your exploit chain.</p></div><div class="g-guide-tabs"><button type="button" data-guide="arsenal" aria-pressed="true">Evolution recipes</button><button type="button" data-guide="bestiary" aria-pressed="false">Threat intelligence</button><button type="button" data-guide="progress" aria-pressed="false">Progress</button><button type="button" data-guide="planning" aria-pressed="false">${esc(INTERFACE.planningTab)}</button></div><div class="g-guide-content">${guideHTML('arsenal')}</div>`;
    }
    if (tab === 'shop') {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'g-secondary g-refund';
      button.textContent = 'Refund all power ups'; button.disabled = !Object.values(save.powerUps).some(Boolean);
      $('.g-shop-heading').append(button);
    }
    paint($('.g-tab-content')); draw(); if (restoreSelector) focus(restoreSelector);
  }
  function signatureHTML(id) { const item = find(CATALOG.weapons, id); return item?.signature ? `<code class="g-payload-signature">${esc(item.signature)}</code>` : ''; }
  function runRulesText() {
    return [run.operation?.title, run.inverse ? INTERFACE.inverse : '', `${run.weaponLimit} WEAPON SLOTS`, !run.arcanaEnabled ? 'ARCANA OFF' : '', !run.limitBreakEnabled ? 'LIMIT BREAK OFF' : '', run.finalBossRequired ? INTERFACE.confrontation : '', run.eggs ? `${num(run.eggs)} AUGMENTS` : ''].filter(Boolean).join(' · ');
  }
  function volumeHTML() {
    return [['music', 'musicVolume', INTERFACE.musicVolume, INTERFACE.defaultMusicVolume], ['effects', 'effectsVolume', INTERFACE.effectsVolume, INTERFACE.defaultEffectsVolume]].map(([kind, key, label, fallback]) => {
      const value = Math.round((save.settings[key] ?? fallback) * 100);
      return `<label class="g-volume-control">${esc(label)}<input type="range" min="0" max="100" step="1" value="${value}" data-game-volume="${kind}"/><output>${value}%</output></label>`;
    }).join('');
  }
  function contractHTML() {
    const rule = (id, label, hint, value) => `<label><input type="checkbox" id="${id}"${value ? ' checked' : ''}/><span>${esc(label)}<small>${esc(hint)}</small></span></label>`;
    return `<details class="g-contract-options"><summary>${esc(INTERFACE.rulesTitle)}</summary><p>${esc(INTERFACE.rulesHint)}</p><div class="g-contract-grid"><label class="g-limit-select">${esc(INTERFACE.weaponLimit)}<select id="g-weapon-limit">${Array.from({ length: CATALOG.config.weaponSlots }, (_, i) => `<option value="${i + 1}"${weaponLimit === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>${rule('g-inverse', INTERFACE.inverse, INTERFACE.inverseHint, inverse)}${rule('g-arcana-enabled', INTERFACE.arcana, INTERFACE.arcanaHint, arcanaEnabled)}${rule('g-limit-break', INTERFACE.limitBreak, INTERFACE.limitBreakHint, limitBreak)}${rule('g-final-boss', INTERFACE.confrontation, INTERFACE.confrontationHint, finalBossRequired)}${rule('g-use-eggs', INTERFACE.eggs, `${INTERFACE.eggsHint} ${num(save.eggs?.[characterId])} ${INTERFACE.augmentCount}.`, useEggs)}</div>${volumeHTML()}</details>`;
  }
  function augmentHTML() {
    const installed = save.eggs?.[characterId] || 0, maxed = installed >= CATALOG.config.maxEggs, cost = CATALOG.config.eggCost || 0;
    return `<section class="g-augment-panel"><div><p class="g-eyebrow">${esc(INTERFACE.augmentTitle)}</p><p>${esc(INTERFACE.augmentHint)}</p><label><span>OPERATOR</span><select id="g-meta-character">${CATALOG.characters.filter(c => save.unlocked.includes(c.id)).map(c => `<option value="${esc(c.id)}"${characterId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>${art('character', characterId, 80)}<div class="g-augment-count"><b>${num(installed)}</b><span>${esc(INTERFACE.augmentCount)}</span><button type="button" class="g-secondary" data-augment="${esc(characterId)}"${maxed || save.gold < cost ? ' disabled' : ''}>${maxed ? esc(INTERFACE.augmentMaxed) : `${esc(INTERFACE.augmentBuy)} / ${num(cost)} GOLD`}</button></div></section>`;
  }
  function planningHTML() {
    const sealed = save.sealed || [];
    return `<div class="g-planning-heading"><h3>${esc(INTERFACE.sealTitle)}</h3><p>${esc(INTERFACE.sealHint)}</p><span>${sealed.length} / ${CATALOG.config.sealLimit || 0} SEALED</span></div><div class="g-seal-grid">${CATALOG.weapons.map(w => { const active = sealed.includes(w.id), discovered = save.collection.weapons.includes(w.id); return `<article class="${active ? 'g-sealed' : ''}">${art('weapon', w.id, 48)}<h3>${esc(w.name)}</h3>${signatureHTML(w.id)}<button type="button" class="g-secondary" data-seal="${esc(w.id)}" aria-pressed="${active}"${!discovered || !active && sealed.length >= CATALOG.config.sealLimit ? ' disabled' : ''}>${!discovered ? esc(INTERFACE.sealLocked) : active ? esc(INTERFACE.unsealAction) : esc(INTERFACE.sealAction)}</button></article>`; }).join('')}</div>`;
  }
  function collectionHTML() {
    const statuses = new Map(weaponUnlockStatus(save, CATALOG).map(item => [item.id, item]));
    return `<div class="g-collection">${CATALOG.weapons.map(w => { const status = statuses.get(w.id), discovered = save.collection.weapons.includes(w.id); return `<article class="${discovered ? 'g-discovered' : ''}">${art('weapon', w.id, 56)}<span>${esc(w.name)}</span><small>${save.collection.evolutions.includes(w.id) ? 'EVOLVED' : discovered ? 'DISCOVERED' : status.unlocked ? esc(INTERFACE.weaponAvailable) : esc(INTERFACE.weaponLocked)}</small>${!status.unlocked ? `<p>${esc(status.label)}</p><progress max="${status.target}" value="${status.progress}" aria-label="${esc(w.name)} unlock progress"></progress>` : ''}</article>`; }).join('')}</div>`;
  }
  function operationsHTML() {
    const progress = save.operations, cost = operationUpgradeCost(progress), chapters = availableOperations(progress);
    return `<header class="g-operation-heading"><p class="g-eyebrow">ISOLATED CAMPAIGN / ${esc(INTERFACE.operationAscension)} ${progress.ascensions + 1}</p><h2>${esc(OPERATIONS.title)}</h2><p>${esc(OPERATIONS.description)}</p><div><b>${num(progress.gold)} ${esc(INTERFACE.operationBudget)}</b><span>${esc(INTERFACE.operationRank)} ${progress.rank} / ${OPERATIONS.config.maxRank}</span></div></header><div class="g-operation-grid">${chapters.map((chapter, index) => `<article class="${chapter.completed ? 'g-operation-complete' : ''}"><span class="g-eyebrow">CHAPTER ${index + 1}${chapter.completed ? ' / COMPLETE' : ''}</span>${art('stage', chapter.stageId, 180)}<h3>${esc(chapter.name)}</h3><p>${esc(chapter.description)}</p><code>${esc(chapter.objectiveText)}</code><small>${esc(find(CATALOG.characters, chapter.characterId)?.name)} / ${chapter.weaponLimit} WEAPON SLOTS / ${clock(chapter.duration)}</small><button type="button" class="g-secondary" data-operation="${esc(chapter.id)}"${chapter.unlocked ? '' : ' disabled'}>${esc(!chapter.unlocked ? OPERATIONS.ui.locked : chapter.completed ? INTERFACE.operationReplay : INTERFACE.operationStart)}</button></article>`).join('')}</div><div class="g-operation-actions"><div><h3>${esc(OPERATIONS.ui.upgradeName)}</h3><p>${esc(OPERATIONS.ui.upgradeDescription)}</p><button type="button" class="g-secondary g-operation-upgrade"${progress.rank >= OPERATIONS.config.maxRank || progress.gold < cost ? ' disabled' : ''}>${num(cost)} OPERATION GOLD</button></div><div><h3>${esc(OPERATIONS.ui.ascensionName)}</h3><p>${esc(OPERATIONS.ui.ascensionDescription)}</p><button type="button" class="g-secondary g-operation-ascend"${progress.completed.length < OPERATIONS.chapters.length || progress.ascensions >= OPERATIONS.config.maxAscensions ? ' disabled' : ''}>${esc(OPERATIONS.ui.ascensionName)} ↗</button></div></div>`;
  }
  function showArsenal() {
    $('.g-arsenal-options').innerHTML = run.arsenalChoices.map(choice => `<button type="button" class="g-upgrade g-arsenal-choice" data-arsenal="${esc(choice.id)}">${art('weapon', choice.id, 56)}<b>${esc(choice.name)}</b>${signatureHTML(choice.id)}<span>${esc(choice.description)}</span></button>`).join('');
    setView('arsenal'); paint($('.g-arsenal')); focus('[data-arsenal]');
  }
  function guideHTML(section) {
    if (section === 'planning') return planningHTML();
    if (section === 'progress') return `<div class="g-progress-summary"><span>${save.achievements.length} / ${ACHIEVEMENTS.length} BOUNTY MILESTONES</span><span>${save.collection.weapons.length} / ${CATALOG.weapons.length} WEAPONS DISCOVERED</span></div><div class="g-achievements">${ACHIEVEMENTS.map(a => { const earned = save.achievements.includes(a.id), progress = achievementProgress(save, a); return `<article class="${earned ? 'g-achievement-earned' : ''}"><span class="g-achievement-mark" aria-hidden="true">${earned ? '✦' : '◇'}</span><div><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p><progress max="${a.target}" value="${progress}" aria-label="${esc(a.name)} progress"></progress><small>${num(progress)} / ${num(a.target)} <span>${earned ? 'BOUNTY CLAIMED' : `+${num(a.gold)} GOLD`}</span></small></div></article>`; }).join('')}</div><h3 class="g-collection-title">Arsenal collection</h3>${collectionHTML()}`;
    if (section === 'bestiary') return `<div class="g-bestiary">${CATALOG.enemies.map(e => `<article>${art('enemy', e.id, 80)}<div><div class="g-threat-tags"><b>${esc(e.threat.tag)}</b><a href="${esc(e.threat.reference)}" target="_blank" rel="noopener noreferrer">${esc(e.threat.cwe)} ↗</a></div><h3>${esc(e.name)}</h3><p class="g-vulnerability-name">${esc(e.threat.name)}</p><code class="g-payload-signature">${esc(e.threat.signature)}</code><p>${esc(e.description)}</p><small>${esc(e.behavior).toUpperCase()}</small></div></article>`).join('')}</div>`;
    const unions = (CATALOG.unions || []).map(u => `<article class="g-union-guide"><p class="g-eyebrow">WEAPON UNION / FREE AN ARSENAL SLOT</p><h3>${esc(u.name)}</h3><p>${esc(u.description)}</p><div class="g-recipe-chain">${u.weapons.map(id => `<span>${esc(find(CATALOG.weapons, id)?.name)} / MAX</span>`).join('<b>+</b>')}${u.passive ? `<b>+</b><span>${esc(find(CATALOG.passives, u.passive)?.name)}</span>` : ''}<b>→</b><strong>${esc(u.name)}</strong></div><p>Claim an eligible boss cache. The second weapon is absorbed; its damage history joins the union.</p></article>`).join('');
    return `${unions}<div class="g-recipes">${CATALOG.weapons.map(w => `<article class="g-recipe">${art('weapon', w.id, 48)}<div><h3>${esc(w.name)}</h3>${signatureHTML(w.id)}<p>${esc(w.description)}</p><div class="g-recipe-chain"><span>MAX LEVEL</span><b>+</b><span>${esc(find(CATALOG.passives, w.evolution?.passive)?.name)}</span><b>→</b><strong>${esc(w.evolution?.name)}</strong></div><small>${esc(w.evolution?.description)}</small></div></article>`).join('')}</div>`;
  }

  function start(operationId = null) {
    stopLoop(); paused = false; banked = false; banishing = false; lastInventory = ''; lastHud = 0;
    run = operationId ? createOperationRun({ chapterId: operationId, progress: save.operations, seed: Date.now() >>> 0 }) : createRun({ characterId, stageId, mode, hyper, hurry, inverse, weaponLimit, arcanaEnabled, limitBreak, finalBossRequired, sealed: [...(save.sealed || [])], unlockedWeapons: unlockedWeapons(save, CATALOG), eggs: useEggs ? save.eggs?.[characterId] || 0 : 0, arcanaId, meta: { ...save.powerUps }, seed: Date.now() >>> 0 });
    if (!run) { setView('menu'); return; }
    run.viewport = viewport; intel.reset(run); lastIntel = '';
    if (save.settings.audio) void audio.setEnabled(true);
    setView('playing'); hud(); focus('.g-pause'); banner(`${run.stage.name} / BREACH INITIATED`);
  }
  function hud() {
    if (!run) return;
    syncMusic();
    root.dataset.inverse = String(run.inverse);
    $('.g-fever').hidden = view !== 'playing' || !run.goldFever?.active;
    if (run.goldFever?.active) { $('.g-fever b').textContent = `${num(run.goldFever.gold)} GOLD / ${num(run.goldFever.chain)} ${INTERFACE.feverChain}`; $('.g-fever progress').max = CATALOG.config.goldFeverMaxDuration; $('.g-fever progress').value = run.goldFever.remaining; }
    $('.g-clock b').textContent = clock(run.time);
    $('.g-wave-label').textContent = run.operation ? `${INTERFACE.operationObjective} ${run.operation.progress}/${run.operation.target}` : run.overtime ? INTERFACE.overtime : run.mode === 'endless' ? `${INTERFACE.cycleTitle} ${(run.cycle || 0) + 1} / ${clock(run.cycleTime)}` : `SURVIVE ${clock(run.duration)}`;
    $('.g-hp').max = run.player.maxHp; $('.g-hp').value = Math.max(0, run.player.hp);
    $('.g-hp-label').textContent = `${Math.max(0, Math.ceil(run.player.hp))} / ${Math.ceil(run.player.maxHp)}`;
    $('.g-life').classList.toggle('g-danger', run.player.hp < run.player.maxHp * .3);
    $('.g-score b').textContent = num(run.kills); $('.g-gold b').textContent = num(run.gold);
    $('.g-level').textContent = `LV. ${run.level}`; $('.g-xp').max = run.xpNeed; $('.g-xp').value = run.xp;
    $('.g-dash').disabled = run.player.dashCooldown > 0;
    $('.g-dash span').textContent = run.player.dashCooldown > 0 ? `${run.player.dashCooldown.toFixed(1)}s` : 'READY';
    const boss = run.enemies.find(e => e.boss && e.hp > 0);
    $('.g-boss').hidden = !boss;
    if (boss) { $('.g-boss span').textContent = `${find(CATALOG.enemies, boss.kind)?.name || 'CRITICAL THREAT'} / PHASE ${(boss.phase || 0) + 1}`; $('.g-boss progress').max = boss.maxHp; $('.g-boss progress').value = boss.hp; }
    renderIntel();
    const signature = JSON.stringify([run.weapons.map(w => [w.id, w.level, w.evolved, w.union]), run.passives]);
    if (signature !== lastInventory) {
      lastInventory = signature;
      $('.g-weapon-slots').innerHTML = Array.from({ length: run.weaponLimit || CATALOG.config.weaponSlots }, (_, i) => { const w = run.weapons[i], def = w && find(CATALOG.weapons, w.id); return `<span class="g-slot${w?.evolved ? ' g-evolved' : ''}" title="${esc(w ? `${weaponTitle(w)} · ${w.level}` : 'Empty weapon slot')}">${w ? `${art('weapon', w.id, 32)}<small>${w.evolved ? '✦' : w.level}</small>` : '<span>+</span>'}</span>`; }).join('');
      $('.g-passive-slots').innerHTML = Array.from({ length: Math.max(CATALOG.config.passiveSlots, run.passives.length) }, (_, i) => { const p = run.passives[i]; return `<span class="g-slot g-passive-slot" title="${esc(p ? `${find(CATALOG.passives, p.id)?.name} · ${p.level}` : 'Empty passive slot')}">${p ? `${art('weapon', p.id, 24)}<small>${p.level}</small>` : '<span>·</span>'}</span>`; }).join('');
      paint($('.g-inventory'));
    }
  }
  function showChoices() {
    banishing = false; $('.g-banish').setAttribute('aria-pressed', 'false');
    $('.g-choice-note').textContent = 'Choose a weapon or passive. The breach waits while you decide.';
    $('.g-choice-level').textContent = String(run.level);
    $('.g-upgrades').innerHTML = run.choices.map((c, i) => `<button type="button" class="g-upgrade" data-choice="${i}"><span class="g-upgrade-top"><span>${esc(c.type).toUpperCase()}</span><kbd>${i + 1}</kbd></span>${art('weapon', c.id, 72)}<b>${esc(c.name)}</b>${signatureHTML(c.id)}<span class="g-upgrade-description">${esc(c.description)}</span><small>${c.level ? `LEVEL ${c.level}` : 'TAKE THE UPGRADE'}<span aria-hidden="true">↗</span></small></button>`).join('');
    $('.g-reroll').textContent = `REROLL / ${run.rerolls}`; $('.g-reroll').disabled = !run.rerolls;
    $('.g-skip').textContent = `SKIP / ${run.skips}`; $('.g-skip').disabled = !run.skips;
    $('.g-banish').textContent = `BANISH / ${run.banishes}`; $('.g-banish').disabled = !run.banishes;
    setView('upgrade'); paint($('.g-choice')); focus('.g-upgrade');
  }
  function showChest() {
    $('.g-chest-rewards').innerHTML = run.chestRewards.map(reward => `<article>${art('weapon', reward.id || 'gold', 64)}<div><span>${esc(reward.type || 'BOUNTY').toUpperCase()}</span><h3>${esc(reward.name || find(CATALOG.weapons, reward.id)?.name || 'Bounty cache')}</h3><p>${esc(reward.description)}</p></div></article>`).join('');
    setView('chest'); paint($('.g-chest')); focus('.g-chest-collect');
  }
  function showArcana() {
    const available = run.arcanaChoices || [];
    $('.g-arcana-options').innerHTML = available.map(a => `<button type="button" class="g-upgrade" data-run-arcana="${esc(a.id)}">${art('weapon', a.id, 64)}<b>${esc(a.name)}</b><span>${esc(a.description)}</span></button>`).join('');
    $('.g-arcana-reroll').textContent = `${INTERFACE.arcanaReroll} / ${run.rerolls}`; $('.g-arcana-reroll').disabled = !run.rerolls;
    $('.g-arcana-skip').textContent = `${INTERFACE.arcanaSkip} / ${run.skips}`; $('.g-arcana-skip').disabled = !run.skips;
    setView('arcana'); paint($('.g-arcana')); focus('[data-run-arcana]');
  }
  function showMerchant() {
    $('.g-merchant-wallet').textContent = `${num(run.gold)} RUN GOLD AVAILABLE`;
    $('.g-merchant-offers').innerHTML = run.merchantOffers.map(offer => `<article>${art('weapon', offer.icon || offer.weaponId || offer.id, 56)}<h3>${esc(offer.name)}</h3><p>${esc(offer.description)}</p><button type="button" class="g-secondary" data-merchant-buy="${esc(offer.id)}" aria-label="Buy ${esc(offer.name)} for ${num(offer.cost)} gold" title="${esc(offer.disabledReason || '')}"${offer.disabled || offer.purchased || run.gold < offer.cost ? ' disabled' : ''}>${offer.purchased ? 'ACQUIRED' : `${num(offer.cost)} GOLD`}</button></article>`).join('');
    setView('merchant'); paint($('.g-merchant')); focus('.g-merchant-leave');
  }
  function syncRun() {
    hud();
    if (run.state === 'upgrade') showChoices();
    else if (run.state === 'chest') showChest();
    else if (run.state === 'arcana') showArcana();
    else if (run.state === 'arsenal') showArsenal();
    else if (run.state === 'merchant') showMerchant();
    else if (run.state === 'won') result(true);
    else if (run.state === 'dead') {
      if (run.revives > 0) { $('.g-death-note').textContent = `${run.revives} checkpoint${run.revives === 1 ? '' : 's'} available. Keep your arsenal and return to the attack surface.`; setView('dead'); focus('.g-revive'); }
      else result(false);
    } else if (run.state === 'playing' && view !== 'playing') { setView('playing'); focus('.g-pause'); }
  }
  function pause() {
    if (!run) return;
    if (view === 'playing') {
      paused = true; $('.g-pause-volume').innerHTML = volumeHTML(); $('.g-pause-summary').textContent = `${run.character.name} / ${run.stage.name} / ${clock(run.time)}`;
      $('.g-pause-build').innerHTML = run.weapons.map(w => { const def = find(CATALOG.weapons, w.id); return `<div>${art('weapon', w.id, 40)}<span>${esc(weaponTitle(w))}<small>LEVEL ${w.level} / ${num(w.damage)} DAMAGE</small></span></div>`; }).join('');
      $('.g-low-fx').checked = save.settings.quality === 'low'; setView('paused'); paint($('.g-paused')); focus('.g-resume'); announce('Game paused.');
    } else if (view === 'paused') { paused = false; setView('playing'); focus('.g-pause'); }
  }
  function result(won, extracted = false) {
    if (!run || banked) return;
    banked = true;
    const previousWeapons = new Set(unlockedWeapons(save, CATALOG));
    const stats = { ...run.getResult(), won };
    let unlocked = [], earned = [], operationReward;
    if (run.operation) {
      operationReward = recordOperation(save.operations, stats);
      if (operationReward.recorded) save.gold += operationReward.mainBounty;
    } else { unlocked = recordRun(save, stats, CATALOG); earned = awardAchievements(save); }
    persistSave(save);
    const newWeapons = unlockedWeapons(save, CATALOG).filter(id => !previousWeapons.has(id));
    const operationChapter = run.operation && OPERATIONS.chapters.find(chapter => chapter.id === run.operation.id);
    const bankedGold = run.gold + (operationReward?.firstClear ? operationChapter.operationGold : 0);
    $('.g-result-kicker').textContent = won ? 'BREACH CONTAINED / CHAIN COMPLETE' : extracted ? 'CLEAN EXTRACTION / BOUNTY SECURED' : 'PROCESS TERMINATED / KNOWLEDGE RETAINED';
    $('.g-result h2').textContent = won ? CATALOG.ui.winTitle : extracted ? CATALOG.ui.extractTitle : CATALOG.ui.lostTitle;
    $('.g-result-description').textContent = run.operation ? `${run.operation.title} · ${clock(run.time)}. ${INTERFACE.operationSaved}` : `${run.character.name} · ${run.stage.name} · ${clock(run.time)} survived. Your bounty has been banked.`;
    $('.g-result .g-rule-summary').textContent = runRulesText();
    $('.g-result-stats').innerHTML = [[run.kills, 'EXPLOITED'], [run.level, 'LEVEL'], [bankedGold, run.operation ? INTERFACE.operationBankLabel : 'GOLD BANKED'], [run.stats.evolutions, 'EVOLUTIONS']].map(([v, label]) => `<div><b>${num(v)}</b><span>${label}</span></div>`).join('');
    $('.g-unlocks').textContent = [unlocked.length ? `NEW OPERATORS / ${unlocked.join(' · ')}` : '', earned.length ? `MILESTONES / ${earned.map(a => a.name).join(' · ')} / +${num(earned.reduce((sum, a) => sum + a.gold, 0))} GOLD` : '', newWeapons.length ? `${INTERFACE.weaponUnlocked} / ${newWeapons.map(id => find(CATALOG.weapons, id)?.name).join(' · ')}` : '', operationReward?.mainBounty ? `FIRST CLEAR / +${num(operationReward.mainBounty)} MAIN BOUNTY` : ''].filter(Boolean).join(' · ');
    const weapons = [...run.weapons].sort((a, b) => b.damage - a.damage), maxDamage = Math.max(1, ...weapons.map(w => w.damage || 0));
    $('.g-damage-report').innerHTML = `<div class="g-panel-heading"><span>${esc(CATALOG.ui.debriefTitle)}</span><span>ACTUAL HITS</span></div>${weapons.map(w => { const def = find(CATALOG.weapons, w.id); return `<div class="g-damage-row">${art('weapon', w.id, 30)}<span>${esc(weaponTitle(w))}</span><progress max="${maxDamage}" value="${w.damage || 0}" aria-label="${esc(def.name)} damage"></progress><b>${num(w.damage)}</b><small>${num(w.kills)} KILLS</small></div>`; }).join('')}`;
    const links = $('.g-advisories'); links.replaceChildren();
    for (const cve of intel.research(CVES, run)) {
      try { const url = new URL(cve.advisory_url, location.origin); if (!['https:', 'http:'].includes(url.protocol)) continue; const a = document.createElement('a'); a.href = url.href; a.textContent = `${cve.id} ↗`; links.append(a); } catch { /* Invalid research URLs never become links. */ }
    }
    renderThreatReport();
    setView('result'); paint($('.g-result')); focus('.g-again'); audio.pause(false); audio.play(won ? 'win' : 'death');
  }
  function events() {
    for (const event of run.drainEvents()) {
      intel.event(event, run);
      if (event.type !== 'hit' || event.player) audio.play(event.type);
      if (['boss', 'evolution', 'union', 'arcana', 'revive', 'stage', 'rescue', 'objective', 'cycle', 'goldfever', 'stageitem'].includes(event.type) || event.type === 'pickup' && event.kind === 'relic') banner(event.text || event.type.toUpperCase());
    }
  }
  function renderIntel() {
    const current = intel.snapshot(run);
    const signature = JSON.stringify(current);
    if (signature === lastIntel) return;
    lastIntel = signature;
    $('.g-threat-class').textContent = current.threat?.tag || '';
    $('.g-threat-cwe').textContent = current.threat?.cwe || '';
    $('.g-threat-name').textContent = current.threat?.name || '';
    $('.g-threat-code').textContent = current.threat?.signature || '';
    const list = $('.g-oplog ol'); list.replaceChildren();
    for (const entry of current.entries) {
      const row = document.createElement('li'), time = document.createElement('time'), text = document.createElement('span');
      time.textContent = clock(entry.time); text.textContent = entry.text; row.append(time, text); list.append(row);
    }
  }
  function renderThreatReport() {
    const report = intel.report(run);
    $('.g-threat-report').innerHTML = report.length ? `<div class="g-panel-heading"><span>${esc(CATALOG.ui.bestiaryLabel)}</span><span>ROOT CAUSES OBSERVED</span></div><div class="g-threat-totals">${report.map(t => `<span title="${esc(t.name)}"><b>${esc(t.tag)}</b><span>${num(t.count)}</span><small>${esc(t.cwe)}</small></span>`).join('')}</div>` : '';
  }
  function pollPad() {
    const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
    if (!pad) { lastPadButtons = []; padSeen = false; return { dx: 0, dy: 0 }; }
    const buttons = pad.buttons.map(b => b.pressed);
    if (!padSeen) { lastPadButtons = buttons; padSeen = true; }
    const pressed = i => buttons[i] && !lastPadButtons[i];
    if (pressed(9)) pause();
    if (view === 'playing') { if (pressed(0) || pressed(1)) dashRequested = true; }
    else {
      const now = performance.now(), direction = (buttons[13] || buttons[15] || pad.axes[1] > .6 || pad.axes[0] > .6) ? 1 : (buttons[12] || buttons[14] || pad.axes[1] < -.6 || pad.axes[0] < -.6) ? -1 : 0;
      if (direction && now - padNavTime > 180) { const items = focusable(), index = items.indexOf(document.activeElement); items[(index + direction + items.length) % items.length]?.focus(); padNavTime = now; }
      if (pressed(0) && root.contains(document.activeElement)) document.activeElement.click();
    }
    lastPadButtons = buttons;
    const axis = n => Math.abs(pad.axes[n] || 0) > .18 ? pad.axes[n] : 0;
    return { dx: axis(0) + (buttons[15] ? 1 : 0) - (buttons[14] ? 1 : 0), dy: axis(1) + (buttons[13] ? 1 : 0) - (buttons[12] ? 1 : 0) };
  }
  function loop(now) {
    raf = 0; if (closed || view !== 'playing' || paused) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    const pad = pollPad(); if (view !== 'playing') return;
    let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + pad.dx;
    let dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) + pad.dy;
    if (pointer) { dx = (pointer.x - pointer.ox) / 52; dy = (pointer.y - pointer.oy) / 52; if (Math.hypot(dx, dy) < .1) dx = dy = 0; }
    run.tick(dt, { dx, dy, dash: dashRequested });
    if (dashRequested) audio.play('dash'); dashRequested = false; events(); audio.tick(dt);
    if (run.state !== 'playing') { syncRun(); return; }
    if (now - lastHud > 100) { lastHud = now; hud(); }
    draw(); raf = requestAnimationFrame(loop);
  }

  on(root, 'click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.matches('.g-exit,.g-back')) exit();
    else if (button.matches('.g-start,.g-again,.g-restart')) start(button.matches('.g-again,.g-restart') ? run?.operation?.id : null);
    else if (button.dataset.operation) start(button.dataset.operation);
    else if (button.matches('.g-operation-upgrade')) { if (purchaseOperationUpgrade(save.operations)) { persistSave(save); renderLobby('.g-operation-upgrade'); } }
    else if (button.matches('.g-operation-ascend')) { if (ascendOperations(save.operations)) { persistSave(save); renderLobby('[data-operation]'); } }
    else if (button.matches('.g-lobby-button')) { const operation = !!run?.operation; run = undefined; paused = false; setView('menu'); tab = operation ? 'operations' : 'deploy'; renderLobby(); focus('.g-start'); }
    else if (button.matches('.g-pause,.g-resume')) pause();
    else if (button.matches('.g-retire')) result(false, view === 'paused');
    else if (button.matches('.g-revive')) { if (run.revive() !== false) { paused = false; events(); syncRun(); } }
    else if (button.matches('.g-dash')) dashRequested = true;
    else if (button.matches('.g-map-toggle')) { mapVisible = !mapVisible; button.setAttribute('aria-pressed', String(mapVisible)); draw(); }
    else if (button.matches('.g-audio')) void toggleSound();
    else if (button.dataset.augment) { if (purchaseAugment(save, button.dataset.augment, CATALOG)) { persistSave(save); renderLobby(`[data-augment="${characterId}"]`); $('.g-shop-notice').textContent = INTERFACE.augmentApplied; } }
    else if (button.dataset.seal) { if (toggleSeal(save, button.dataset.seal, CATALOG)) { persistSave(save); $('.g-guide-content').innerHTML = planningHTML(); paint($('.g-guide-content')); focus(`[data-seal="${button.dataset.seal}"]`); } else announce(INTERFACE.sealFull); }
    else if (button.matches('.g-refund')) { const returned = refundPowerUps(save, CATALOG); persistSave(save); renderLobby(); $('.g-shop-notice').textContent = `${num(returned)} gold refunded. Try a different build.`; focus('[data-tab="shop"]'); }
    else if (button.dataset.tab) { tab = button.dataset.tab; renderLobby(); }
    else if (button.dataset.character) { characterId = button.dataset.character; renderLobby(`[data-character="${characterId}"]`); }
    else if (button.dataset.stage) { stageId = button.dataset.stage; renderLobby(`[data-stage="${stageId}"]`); }
    else if (button.dataset.arcana) { arcanaId = button.dataset.arcana; renderLobby(`[data-arcana="${arcanaId}"]`); }
    else if (button.dataset.buy) { const id = button.dataset.buy; if (purchase(save, id, CATALOG)) { persistSave(save); renderLobby(`[data-buy="${id}"]`); $('.g-shop-notice').textContent = `${find(CATALOG.powerUps, id).name} upgraded. Applied to your next run.`; } }
    else if (button.dataset.guide) { root.querySelectorAll('[data-guide]').forEach(e => e.setAttribute('aria-pressed', String(e === button))); $('.g-guide-content').innerHTML = guideHTML(button.dataset.guide); paint($('.g-guide-content')); }
    else if (button.dataset.choice !== undefined) { const i = Number(button.dataset.choice), choice = run.choices[i], ok = banishing ? run.banish(i) : run.choose(i); if (ok !== false) { if (!banishing && choice) intel.choice(choice, run); events(); syncRun(); } }
    else if (button.matches('.g-reroll')) { if (run.reroll() !== false) showChoices(); }
    else if (button.matches('.g-skip')) { if (run.skip() !== false) syncRun(); }
    else if (button.matches('.g-banish')) { banishing = !banishing; button.setAttribute('aria-pressed', String(banishing)); $('.g-choice-note').textContent = banishing ? 'Choose an item to remove it from this run’s upgrade pool.' : 'Choose a weapon or passive. The breach waits while you decide.'; }
    else if (button.matches('.g-chest-collect')) { run.collectChest(); events(); syncRun(); }
    else if (button.dataset.merchantBuy) { if (run.buyMerchant(button.dataset.merchantBuy) !== false) { events(); hud(); syncRun(); } }
    else if (button.matches('.g-merchant-leave')) { run.leaveMerchant(); syncRun(); }
    else if (button.matches('.g-arcana-reroll')) { if (run.rerollArcana()) showArcana(); }
    else if (button.matches('.g-arcana-skip')) { if (run.skipArcana()) { events(); syncRun(); } }
    else if (button.dataset.arsenal) { if (run.selectWeapon(button.dataset.arsenal)) { $('.g-arsenal-options').replaceChildren(); events(); syncRun(); } }
    else if (button.matches('.g-arsenal-skip')) { if (run.skipArsenal()) { $('.g-arsenal-options').replaceChildren(); events(); syncRun(); } }
    else if (button.dataset.runArcana) { run.selectArcana(button.dataset.runArcana); events(); syncRun(); }
  });
  on(root, 'change', event => {
    if (event.target.id === 'g-mode') mode = event.target.value;
    if (event.target.id === 'g-hyper') hyper = event.target.checked;
    if (event.target.id === 'g-hurry') hurry = event.target.checked;
    if (event.target.id === 'g-inverse') { inverse = event.target.checked; draw(); }
    if (event.target.id === 'g-weapon-limit') weaponLimit = Number(event.target.value);
    if (event.target.id === 'g-limit-break') limitBreak = event.target.checked;
    if (event.target.id === 'g-final-boss') finalBossRequired = event.target.checked;
    if (event.target.id === 'g-use-eggs') useEggs = event.target.checked;
    if (event.target.id === 'g-arcana-enabled') { arcanaEnabled = event.target.checked; $('.g-starting-arcana').hidden = !arcanaEnabled; }
    if (event.target.id === 'g-meta-character') { characterId = event.target.value; renderLobby('#g-meta-character'); }
    if (event.target.matches('[data-game-volume]')) { const key = event.target.dataset.gameVolume === 'effects' ? 'effectsVolume' : 'musicVolume'; save.settings[key] = Number(event.target.value) / 100; if (key === 'effectsVolume') audio.setEffectsVolume(save.settings[key]); else audio.setVolume(save.settings[key]); persistSave(save); event.target.parentElement.querySelector('output').textContent = `${event.target.value}%`; }
    if (event.target.matches('.g-low-fx')) { save.settings.quality = event.target.checked ? 'low' : 'high'; persistSave(save); draw(); }
  });
  on(window, 'keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'escape') { event.preventDefault(); event.stopImmediatePropagation(); exit(); return; }
    if (key === 'tab') {
      const items = focusable(), first = items[0], final = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); final?.focus(); }
      else if (!event.shiftKey && (document.activeElement === final || !root.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      return;
    }
    if (key === 'p' && !event.repeat) { event.preventDefault(); pause(); return; }
    if (key === 'm' && run && ['playing', 'paused'].includes(view) && !event.repeat) { event.preventDefault(); mapVisible = !mapVisible; $('.g-map-toggle').setAttribute('aria-pressed', String(mapVisible)); draw(); }
    if (view === 'arcana' || view === 'arsenal') {
      if (/^[1-9]$/.test(key)) { event.preventDefault(); root.querySelectorAll(view === 'arcana' ? '[data-run-arcana]' : '[data-arsenal]')[Number(key) - 1]?.click(); }
      if (view === 'arcana' && key === 'r' && !event.repeat) { event.preventDefault(); $('.g-arcana-reroll').click(); }
    }
    if (view === 'upgrade') {
      if (/^[1-9]$/.test(key)) { event.preventDefault(); $(`[data-choice="${Number(key) - 1}"]`)?.click(); }
      if (key === 'r' && !event.repeat) { event.preventDefault(); $('.g-reroll').click(); }
    }
    if (view !== 'playing') return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) { event.preventDefault(); keys[key] = true; }
    if (key === ' ' && !event.repeat) dashRequested = true;
  }, { capture: true });
  on(window, 'keyup', event => { delete keys[event.key.toLowerCase()]; });
  on($('.g-arena'), 'pointerdown', event => { if (view !== 'playing' || pointer) return; $('.g-arena').setPointerCapture(event.pointerId); pointer = { id: event.pointerId, ox: event.clientX, oy: event.clientY, x: event.clientX, y: event.clientY }; });
  on($('.g-arena'), 'pointermove', event => { if (pointer?.id === event.pointerId) { pointer.x = event.clientX; pointer.y = event.clientY; } });
  const release = event => { if (pointer?.id === event.pointerId) pointer = null; };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on($('.g-arena'), type, release);
  on(window, 'resize', resize);
  on(window, 'blur', () => { keys = {}; pointer = null; if (view === 'playing') pause(); });
  on(document, 'visibilitychange', () => { if (document.hidden && view === 'playing') pause(); audio.pause(document.hidden || view === 'paused'); });
  on(document, 'focusin', event => { if (!root.contains(event.target)) focusable()[0]?.focus(); });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  on(motion, 'change', event => { if (event.matches) exit(); });
  padInterval = setInterval(() => { if (view !== 'playing' && !closed) pollPad(); }, 100);
  function exit() {
    if (closed) return;
    closed = true; stopLoop(); clearInterval(padInterval); clearTimeout(bannerTimer);
    controller.abort(); audio.dispose(); renderer.dispose(); root.remove(); document.documentElement.classList.remove('gate-open');
    background.forEach(([node, inert]) => { if (node.isConnected) node.inert = inert; });
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  audio.setVolume(save.settings.musicVolume); audio.setEffectsVolume(save.settings.effectsVolume);
  if (save.settings.audio) void audio.setEnabled(true);
  audioButton(); resize(); renderLobby(); setView('menu'); focus('.g-start');
}
