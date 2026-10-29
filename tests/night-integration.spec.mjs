import { test, expect } from '@playwright/test';
import CATALOG from '../src/data/night-game.json' with { type: 'json' };
import ACHIEVEMENTS from '../src/data/night-achievements.json' with { type: 'json' };

const SAVE_KEY = 'cv-night-save-v2';
const browserErrors = new WeakMap();

async function installClock(page) {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.clock.setFixedTime(2);
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});

test.afterEach(async ({ page }) => {
  const forbidden = await page.locator('#gate [style],#gate style,#gate script,#gate [onclick],#gate [oninput],#gate [onchange]').evaluateAll(elements => elements.map(element => element.outerHTML.slice(0, 300)));
  expect(forbidden).toEqual([]);
  expect(browserErrors.get(page)).toEqual([]);
});

const freshSave = overrides => ({
  version: 2,
  gold: 5000,
  stats: { runs: 0, wins: 0, kills: 0, goldEarned: 0, evolutions: 0, relics: 0, bestKills: 0, bestTime: 0 },
  powerUps: {},
  unlocked: [],
  settings: { audio: false, quality: 'high' },
  ...overrides,
});

async function openGame(page, save) {
  if (save !== undefined) await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SAVE_KEY, value: save });
  await page.goto('/');
  await page.locator('#play').click();
  await expect(page.locator('#gate')).toBeVisible();
}

async function readSave(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
}

async function resolveChoices(page) {
  for (let i = 0; i < 40; i++) {
    const state = await page.locator('#gate').getAttribute('data-state');
    if (state === 'playing') return;
    if (state === 'upgrade') await page.locator('button[data-choice]').first().click();
    else if (state === 'chest') await page.locator('.g-chest-collect').click();
    else if (state === 'arsenal') await page.locator('.g-arsenal-skip').click();
    else if (state === 'arcana') await page.locator('button[data-run-arcana]').first().click();
    else if (state === 'merchant') await page.locator('.g-merchant-leave').click();
    else throw new Error(`Unexpected state while resolving a normal choice: ${state}`);
  }
  throw new Error('Normal choices did not converge back to gameplay.');
}

async function trackCamera(page) {
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const transform = proto.setTransform, translate = proto.translate;
    proto.setTransform = function (...args) {
      if (this.canvas.matches('.g-arena')) this.__cameraPending = true;
      return transform.apply(this, args);
    };
    proto.translate = function (x, y) {
      if (this.__cameraPending && this.canvas.matches('.g-arena')) {
        window.__nightCamera = { x, y };
        this.__cameraPending = false;
      }
      return translate.call(this, x, y);
    };
  });
}

test('deployment choices are real controls and every initial stage is reachable', async ({ page }) => {
  await installClock(page);
  await openGame(page);
  await expect(page.locator('button[data-stage]')).toHaveCount(CATALOG.stages.length);
  await expect(page.locator('[data-stage="spire"]')).toBeDisabled();
  for (const id of ['cathedral', 'library', 'foundry', 'void']) {
    const option = page.locator(`button[data-stage="${id}"]`);
    await expect(option).toBeEnabled();
    await option.click();
    await expect(page.locator('#gate')).toHaveAttribute('data-stage', id);
  }
  await page.locator('button[data-character="operator"]').click();
  await expect(page.locator('#gate')).toHaveAttribute('data-character', 'operator');
  await page.locator('#g-mode').selectOption('standard');
  await page.locator('#g-hyper').check();
  await page.locator('#g-hurry').check();
  await page.locator('.g-start').click();
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('.g-hud')).toBeVisible();
  await expect(page.locator('.g-clock b')).toHaveText('00:00');
  await expect(page.locator('.g-wave-label')).toHaveText('SURVIVE 30:00');
  await page.keyboard.press('Escape');
  await expect(page.locator('#gate')).toHaveCount(0);
});

test('shop spends persistent gold and opening the game never credits a run', async ({ page }, testInfo) => {
  await openGame(page, freshSave());
  await page.locator('[data-tab="shop"]').click();
  const purchase = page.locator('[data-buy]:enabled').first();
  const id = await purchase.getAttribute('data-buy');
  await purchase.click();
  const bought = await readSave(page);
  expect(bought.gold).toBeLessThan(5000);
  expect(bought.gold).toBeGreaterThanOrEqual(0);
  expect(bought.powerUps[id]).toBe(1);
  expect(bought.stats.runs).toBe(0);
  await page.keyboard.press('Escape');
  await page.locator('#play').click();
  await expect(page.locator('#gate')).toBeVisible();
  expect(await readSave(page)).toEqual(bought);
  await page.locator('[data-tab="guide"]').click();
  await expect(page.locator('.g-union-guide')).toHaveCount(CATALOG.unions.length);
  for (const union of CATALOG.unions) {
    const recipe = page.locator('.g-union-guide').filter({ has: page.getByRole('heading', { name: union.name, exact: true }) });
    for (const id of union.weapons) await expect(recipe).toContainText(CATALOG.weapons.find(item => item.id === id).name);
    await expect(recipe).toContainText(CATALOG.passives.find(item => item.id === union.passive).name);
  }
  await expect(page.locator('.g-recipe')).toHaveCount(CATALOG.weapons.length);
  for (const weapon of CATALOG.weapons) {
    const recipe = page.locator('.g-recipe').filter({ has: page.getByRole('heading', { name: weapon.name, exact: true }) });
    await expect(recipe).toContainText(weapon.evolution.name);
    await expect(recipe).toContainText(CATALOG.passives.find(item => item.id === weapon.evolution.passive).name);
  }
  await page.locator('[data-guide="bestiary"]').click();
  await expect(page.locator('.g-bestiary article')).toHaveCount(CATALOG.enemies.length);
  await page.locator('[data-guide="arsenal"]').click();
  await expect(page.locator('.g-recipe')).toHaveCount(CATALOG.weapons.length);
  await page.locator('[data-guide="progress"]').click();
  await expect(page.locator('.g-achievements article')).toHaveCount(ACHIEVEMENTS.length);
  await expect(page.locator('.g-collection article')).toHaveCount(CATALOG.weapons.length);
  for (const achievement of ACHIEVEMENTS) await expect(page.getByRole('progressbar', { name: `${achievement.name} progress`, exact: true })).toHaveAttribute('max', String(achievement.target));
  await page.locator('.g-intro').evaluate(panel => { panel.scrollTop = 0; });
  await page.screenshot({ path: `artifacts/night-progress-${testInfo.project.name}.png`, caret: 'initial' });
  await page.locator('[data-tab="shop"]').click();
  await page.locator('.g-refund').click();
  const refunded = await readSave(page);
  expect(refunded.gold).toBe(5000);
  expect(Object.values(refunded.powerUps).every(level => level === 0)).toBe(true);
  expect(refunded.stats.runs).toBe(0);
});

test('payload signatures stay literal and vulnerability dossiers link to their CWE', async ({ page }, testInfo) => {
  await openGame(page);
  await page.locator('[data-tab="guide"]').click();
  await expect(page.locator('.g-recipe .g-payload-signature')).toHaveCount(CATALOG.weapons.length);
  await expect(page.locator('.g-recipe .g-payload-signature').filter({ hasText: '{{ 7 * 7 }} → 49' })).toHaveCount(1);
  await expect(page.locator('.g-payload-signature *')).toHaveCount(0);
  await page.locator('[data-guide="bestiary"]').click();
  for (const enemy of CATALOG.enemies) {
    const dossier = page.locator('.g-bestiary article').filter({ has: page.getByRole('heading', { name: enemy.name, exact: true }) });
    await expect(dossier.locator('code')).toHaveText(enemy.threat.signature);
    await expect(dossier.locator('a')).toHaveAttribute('href', enemy.threat.reference);
    await expect(dossier.locator('a')).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.locator('.g-payload-signature *')).toHaveCount(0);
  for (const width of [320, 600]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.locator('.g-bestiary').evaluate(root => root.scrollWidth <= root.clientWidth)).toBe(true);
    expect(await page.locator('.g-intro').evaluate(root => root.scrollWidth <= root.clientWidth)).toBe(true);
  }
  await page.setViewportSize(testInfo.project.use.viewport);
  await page.locator('.g-intro').evaluate(panel => { panel.scrollTop = 0; });
  await page.screenshot({ path: `artifacts/night-intel-${testInfo.project.name}.png`, caret: 'initial' });
});

test('extract banks a run once, displays real weapon results and replay starts fresh', async ({ page }) => {
  await installClock(page);
  await openGame(page, freshSave({ gold: 0 }));
  await page.locator('.g-start').click();
  await page.clock.runFor(1500);
  await resolveChoices(page);
  const equipped = await page.locator('.g-weapon-slots .g-slot canvas').count();
  await page.locator('.g-pause').click();
  await page.locator('.g-screen.g-paused .g-retire').click();
  await expect(page.locator('.g-screen.g-result')).toBeVisible();
  await expect(page.locator('.g-again')).toBeFocused();
  await expect(page.locator('.g-damage-row')).toHaveCount(equipped);
  const banked = await readSave(page);
  expect(banked.stats.runs).toBe(1);
  expect(banked.stats.wins).toBe(0);
  const bonuses = ACHIEVEMENTS.filter(item => banked.achievements.includes(item.id)).reduce((sum, item) => sum + item.gold, 0);
  expect(banked.gold).toBe(banked.stats.goldEarned + bonuses);
  await page.clock.runFor(2000);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await page.setViewportSize({ width: 600, height: 844 });
  expect(await readSave(page)).toEqual(banked);
  await page.locator('.g-again').click();
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('.g-level')).toHaveText('LV. 1');
  await expect(page.locator('.g-clock b')).toHaveText('00:00');
  expect(await readSave(page)).toEqual(banked);
  await page.keyboard.press('Escape');
  await page.locator('#play').click();
  expect(await readSave(page)).toEqual(banked);
});

test('controller moves the camera, dashes, navigates pause and releases on exit', async ({ page }) => {
  await installClock(page);
  await trackCamera(page);
  await page.addInitScript(() => {
    window.__nightPad = { id: 'QA controller', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })) };
    window.__padReads = 0;
    Object.defineProperty(navigator, 'getGamepads', { value: () => { window.__padReads++; return [window.__nightPad]; } });
  });
  await openGame(page);
  const press = async (index, pressed) => page.evaluate(({ index, pressed }) => {
    window.__nightPad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
  }, { index, pressed });
  await page.clock.runFor(120); // Sample the neutral controller before a new A-button edge.
  await press(0, true);
  await page.clock.runFor(120);
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  await press(0, false);
  const before = await page.evaluate(() => window.__nightCamera);
  await page.evaluate(() => { window.__nightPad.axes = [1, 0]; });
  await page.clock.runFor(500);
  const moved = await page.evaluate(() => window.__nightCamera);
  expect(moved.x).toBeLessThan(before.x - 20);
  await page.evaluate(() => { window.__nightPad.axes = [0, 0]; });
  await press(0, true);
  await page.clock.runFor(150);
  await press(0, false);
  await expect(page.locator('.g-dash')).toBeDisabled();
  await press(9, true);
  await page.clock.runFor(100);
  await press(9, false);
  await expect(page.locator('.g-screen.g-paused')).toBeVisible();
  await expect(page.locator('.g-resume')).toBeFocused();
  await press(15, true);
  await page.clock.runFor(220);
  await press(15, false);
  await expect(page.locator('.g-resume')).not.toBeFocused();
  await page.locator('.g-resume').focus();
  await press(0, true);
  await page.clock.runFor(120);
  await press(0, false);
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  await page.keyboard.press('Escape');
  const reads = await page.evaluate(() => window.__padReads);
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => window.__padReads)).toBe(reads);
});

test('touch drag moves the world and touch cancellation releases movement', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch controls run in the mobile project.');
  await installClock(page);
  await trackCamera(page);
  await openGame(page);
  await page.locator('.g-start').click();
  const cdp = await page.context().newCDPSession(page);
  const before = await page.evaluate(() => window.__nightCamera);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 170, y: 420, id: 7 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230, y: 420, id: 7 }] });
  await page.clock.runFor(500);
  const moved = await page.evaluate(() => window.__nightCamera);
  expect(moved.x).toBeLessThan(before.x - 20);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.clock.runFor(500);
  const canceled = await page.evaluate(() => window.__nightCamera);
  expect(Math.abs(canceled.x - moved.x)).toBeLessThanOrEqual(2);
  await page.locator('.g-dash').tap();
  await page.clock.runFor(150);
  await expect(page.locator('.g-dash')).toBeDisabled();
  await cdp.detach();
});

test('a real rescue and relic fund merchant power, pause time and save milestones', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await installClock(page);
  await trackCamera(page);
  const powerUps = Object.fromEntries(CATALOG.powerUps.map(item => [item.id, item.maxLevel]));
  await openGame(page, freshSave({ powerUps, gold: 0 }));
  await page.locator('button[data-character="researcher"]').click();
  await page.locator('button[data-arcana="blood"]').click();
  await page.locator('.g-start').click();
  const origin = await page.evaluate(() => window.__nightCamera);
  const resolveOverlay = async () => {
    const state = await page.locator('#gate').getAttribute('data-state');
    if (state === 'upgrade') {
      const choices = page.locator('button[data-choice]'), names = await choices.locator('b').allTextContents();
      const starter = CATALOG.weapons.find(weapon => weapon.id === 'wand');
      await choices.nth(Math.max(0, names.indexOf(starter.name))).click();
    }
    else if (state === 'chest') await page.locator('.g-chest-collect').click();
    else if (state === 'arsenal') await page.locator('.g-arsenal-skip').click();
    else if (state === 'arcana') await page.locator('button[data-run-arcana]').first().click();
    else if (state === 'dead') await page.locator('.g-revive').click();
    else if (state === 'result') throw new Error('Ordinary player route ended before reaching the merchant.');
    return state;
  };
  const walkTo = async target => {
    for (let step = 0; step < 240; step++) {
      const state = await resolveOverlay();
      if (state === 'merchant') return;
      if (state !== 'playing') continue;
      const camera = await page.evaluate(() => window.__nightCamera);
      const dx = target.x - (origin.x - camera.x), dy = target.y - (origin.y - camera.y);
      if (Math.hypot(dx, dy) < 9) return;
      const keys = [Math.abs(dx) > 5 ? dx > 0 ? 'd' : 'a' : null, Math.abs(dy) > 5 ? dy > 0 ? 's' : 'w' : null].filter(Boolean);
      for (const key of keys) await page.keyboard.down(key);
      await page.clock.runFor(120);
      for (const key of keys) await page.keyboard.up(key);
    }
    throw new Error(`Normal movement did not reach ${target.name || 'stage objective'}.`);
  };
  const stage = CATALOG.stages.find(item => item.id === 'cathedral');
  await walkTo(stage.relic);
  for (let i = 0; i < 12; i++) if (await resolveOverlay() === 'playing') break;
  expect(Number((await page.locator('.g-gold b').textContent()).replace(/[^\d]/g, ''))).toBeGreaterThanOrEqual(CATALOG.config.relicGold);
  await walkTo(stage.objective);
  let rescued = false;
  for (let step = 0; step < 240; step++) {
    if ((await page.locator('.g-announcement').textContent()).includes(CATALOG.ui.rescueText)) { rescued = true; break; }
    if (await resolveOverlay() !== 'playing') continue;
    await page.clock.runFor(250);
  }
  expect(rescued, 'wardens are defeated and the nearby sealed process is genuinely rescued').toBe(true);
  await walkTo(stage.objective);
  for (let i = 0; i < 12; i++) if (await resolveOverlay() === 'playing') break;
  await walkTo(stage.merchant);
  await expect(page.locator('.g-screen.g-merchant')).toBeVisible();
  await expect(page.locator('.g-merchant-leave')).toBeFocused();
  const clock = await page.locator('.g-clock b').textContent();
  const wallet = () => page.locator('.g-merchant-wallet').textContent().then(text => Number(text.replace(/[^\d]/g, '')));
  const before = await wallet();
  await page.clock.runFor(3000);
  await expect(page.locator('.g-clock b')).toHaveText(clock);
  const statOffer = CATALOG.merchantOffers.find(offer => offer.type === 'stat');
  const offer = page.locator(`button[data-merchant-buy="${statOffer.id}"]`);
  await expect(offer).toBeEnabled();
  await page.screenshot({ path: `artifacts/night-merchant-${testInfo.project.name}.png`, caret: 'initial' });
  const id = await offer.getAttribute('data-merchant-buy');
  const cost = Number((await offer.textContent()).replace(/[^\d]/g, ''));
  await offer.click();
  expect(await wallet()).toBe(before - cost);
  await expect(page.locator(`button[data-merchant-buy="${id}"]`)).toBeDisabled();
  await expect(page.locator(`button[data-merchant-buy="${id}"]`)).toHaveText('ACQUIRED');
  await page.locator('.g-merchant-leave').click();
  for (let i = 0; i < 12; i++) if (await resolveOverlay() === 'playing') break;
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  await page.locator('.g-pause').click();
  await page.locator('.g-screen.g-paused .g-retire').click();
  const saved = await readSave(page);
  expect(saved.stats.merchantPurchases).toBe(1);
  expect(saved.stats.relics).toBe(1);
  expect(saved.stats.rescues).toBe(1);
  expect(saved.achievements).toContain('merchant');
  expect(saved.achievements).toContain('rescue');
  expect(saved.collection.weapons).toContain('wand');
});

test('corrupt and denied browser storage do not block a playable session', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{corrupt'), SAVE_KEY);
  await openGame(page);
  await page.locator('.g-start').click();
  await expect(page.locator('.g-hud')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage is denied', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Storage is denied', 'SecurityError'); };
  });
  await page.reload();
  await page.locator('#play').click();
  await page.locator('.g-start').click();
  await expect(page.locator('.g-hud')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#gate')).toHaveCount(0);
});

test('pause freezes the clock and keyboard focus stays inside every visible screen', async ({ page }) => {
  await installClock(page);
  await openGame(page);
  await page.locator('.g-start').click();
  await page.keyboard.down('d');
  await page.clock.runFor(2000);
  await page.keyboard.up('d');
  await resolveChoices(page);
  await page.locator('.g-pause').click();
  const paused = page.locator('.g-screen.g-paused');
  await expect(paused).toBeVisible();
  const clock = await page.locator('.g-clock b').textContent();
  await page.clock.runFor(5000);
  await expect(page.locator('.g-clock b')).toHaveText(clock);
  for (const key of ['Shift+Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab']) {
    await page.keyboard.press(key);
    expect(await page.locator('#gate').evaluate(root => root.contains(document.activeElement))).toBe(true);
  }
  await page.locator('.g-resume').click();
  await expect(paused).toBeHidden();
  for (let i = 0; i < 20 && await page.locator('.g-clock b').textContent() === clock; i++) {
    await resolveChoices(page);
    await page.clock.runFor(200);
  }
  await expect(page.locator('.g-clock b')).not.toHaveText(clock);
});

test('audio stays opt-in and exit closes its context and animation loop', async ({ page }) => {
  await installClock(page);
  await page.addInitScript(() => {
    const probe = { frames: 0, contexts: [] };
    window.__nightProbe = probe;
    const originalFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => originalFrame(time => {
      probe.frames++;
      callback(time);
    });
    const OriginalAudioContext = window.AudioContext;
    if (OriginalAudioContext) window.AudioContext = class extends OriginalAudioContext {
      constructor(...args) { super(...args); probe.contexts.push(this); }
    };
  });
  await openGame(page);
  expect(await page.evaluate(() => window.__nightProbe.contexts.length)).toBe(0);
  await page.clock.runFor(100); // Settle the archive's one-shot startup frames before testing idle work.
  const menuFrames = await page.evaluate(() => window.__nightProbe.frames);
  await page.clock.runFor(1500);
  expect(await page.evaluate(() => window.__nightProbe.frames)).toBe(menuFrames);
  await page.locator('.g-audio').click();
  await page.locator('.g-start').click();
  await page.clock.runFor(1000);
  await expect.poll(() => page.evaluate(() => window.__nightProbe.contexts.length)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#gate')).toHaveCount(0);
  const exitFrames = await page.evaluate(() => window.__nightProbe.frames);
  await page.clock.runFor(1500);
  expect(await page.evaluate(() => window.__nightProbe.frames)).toBe(exitFrames);
  expect(await page.evaluate(() => window.__nightProbe.contexts.every(context => context.state === 'closed'))).toBe(true);
});

test('normal level choices support reroll, banish and skip while time waits', async ({ page }) => {
  test.setTimeout(90000);
  await installClock(page);
  const powerUps = Object.fromEntries(CATALOG.powerUps.map(item => [item.id, item.maxLevel]));
  await openGame(page, freshSave({ powerUps }));
  await page.locator('button[data-character="researcher"]').click();
  await page.locator('button[data-arcana="blood"]').click();
  await page.locator('.g-start').click();
  const nextUpgrade = async () => {
    for (let i = 0; i < 180; i++) {
      const state = await page.locator('#gate').getAttribute('data-state');
      if (state === 'upgrade') return;
      if (state === 'chest') await page.locator('.g-chest-collect').click();
      else if (state === 'dead') await page.locator('.g-revive').click();
      else if (state === 'arsenal') await page.locator('.g-arsenal-skip').click();
    else if (state === 'arcana') await page.locator('[data-run-arcana]').first().click();
      else if (state === 'result') throw new Error('Ordinary purchased build died before the next upgrade.');
      const key = ['d', 's', 'a', 'w'][Math.floor(i / 5) % 4];
      await page.keyboard.down(key);
      await page.clock.runFor(500);
      await page.keyboard.up(key);
    }
    throw new Error('No normal level upgrade within 90 seconds.');
  };
  await nextUpgrade();
  await expect(page.locator('button.g-upgrade').first()).toBeFocused();
  const clock = await page.locator('.g-clock b').textContent();
  await page.clock.runFor(3000);
  await expect(page.locator('.g-clock b')).toHaveText(clock);
  await expect(page.locator('.g-reroll')).toContainText('3');
  await page.locator('.g-reroll').click();
  await expect(page.locator('.g-reroll')).toContainText('2');
  const banned = await page.locator('button.g-upgrade b').first().textContent();
  await page.locator('.g-banish').click();
  await expect(page.locator('.g-banish')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('button.g-upgrade').first().click();
  await nextUpgrade();
  expect(await page.locator('button.g-upgrade b').allTextContents()).not.toContain(banned);
  await expect(page.locator('.g-banish')).toContainText('2');
  await page.locator('.g-skip').click();
  await nextUpgrade();
  await expect(page.locator('.g-skip')).toContainText('2');
  await page.keyboard.press('1');
  // A burst of collected XP can queue several legitimate choices before time resumes.
  await resolveChoices(page);
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
});

test('integrated art remains readable on narrow layouts and shows a real multiweapon hunt', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await installClock(page);
  const powerUps = Object.fromEntries(CATALOG.powerUps.map(item => [item.id, item.maxLevel]));
  await openGame(page, freshSave({ powerUps }));
  for (const width of [320, 390, 600, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.locator('#gate').evaluate(root => root.scrollWidth <= root.clientWidth)).toBe(true);
    expect(await page.locator('.g-intro').evaluate(panel => panel.scrollWidth <= panel.clientWidth)).toBe(true);
  }
  await page.setViewportSize(testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 800 });
  await page.locator('button[data-character="researcher"]').click();
  await page.locator('button[data-arcana="blood"]').click();
  await page.locator('.g-intro').evaluate(panel => { panel.scrollTop = 0; });
  await page.screenshot({ path: `artifacts/night-lobby-${testInfo.project.name}.png`, caret: 'initial' });
  await page.locator('.g-start').click();
  await expect(page.locator('.g-live-intel')).toBeVisible();
  const initialLog = await page.locator('.g-oplog li>span').allTextContents();
  for (let tick = 0; tick < 120; tick++) {
    const state = await page.locator('#gate').getAttribute('data-state');
    if (state === 'upgrade') {
      const buttons = page.locator('button.g-upgrade');
      const names = await buttons.locator('b').allTextContents();
      const newWeapon = names.findIndex(name => CATALOG.weapons.some(weapon => weapon.name === name && weapon.id !== 'wand'));
      await buttons.nth(Math.max(0, newWeapon)).click();
    } else if (state === 'chest') await page.locator('.g-chest-collect').click();
    else if (state === 'arsenal') await page.locator('.g-arsenal-skip').click();
    else if (state === 'arcana') await page.locator('[data-run-arcana]').first().click();
    else if (state === 'dead') await page.locator('.g-revive').click();
    else if (state === 'result') throw new Error('Multiweapon screenshot run ended before capture.');
    const key = ['d', 's', 'a', 'w'][Math.floor(tick / 5) % 4];
    await page.keyboard.down(key);
    await page.clock.runFor(500);
    await page.keyboard.up(key);
    if (tick > 70 && await page.locator('.g-weapon-slots .g-slot canvas').count() >= 2 && await page.locator('#gate').getAttribute('data-state') === 'playing') break;
  }
  expect(await page.locator('.g-weapon-slots .g-slot canvas').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  const kills = Number((await page.locator('.g-score b').textContent()).replaceAll(',', ''));
  expect(kills).toBeGreaterThan(0);
  expect(await page.locator('.g-oplog li').count()).toBeLessThanOrEqual(CATALOG.intel.maxFeed);
  expect(await page.locator('.g-oplog li>span').allTextContents()).not.toEqual(initialLog);
  await expect(page.locator('.g-threat-cwe')).toHaveText(/^CWE-\d+$/);
  await page.screenshot({ path: `artifacts/night-play-${testInfo.project.name}.png`, caret: 'initial' });
  await page.locator('.g-pause').click();
  await expect(page.locator('.g-live-intel')).toBeHidden();
  await expect(page.locator('.g-oplog')).toBeHidden();
  await page.locator('.g-screen.g-paused .g-retire').click();
  const counts = await page.locator('.g-threat-totals>span>span').allTextContents();
  const resultKills = Number((await page.locator('.g-result-stats>div>b').first().textContent()).replaceAll(',', ''));
  // The live HUD is throttled; the banked result and class report use the same final simulation snapshot.
  expect(resultKills).toBeGreaterThanOrEqual(kills);
  expect(counts.reduce((total, count) => total + Number(count.replaceAll(',', '')), 0)).toBe(resultKills);
  await page.screenshot({ path: `artifacts/night-debrief-${testInfo.project.name}.png`, caret: 'initial' });
});
