import { test, expect } from '@playwright/test';
import { CATALOG } from '../src/scripts/night/engine.js';
import { freshSave, SAVE_KEY } from '../src/scripts/night/save.js';
import SCORE from '../src/data/night-music.json' with { type: 'json' };

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const messages = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.clock.setFixedTime(2);
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.locator('#gate [style],#gate style,#gate script,#gate [onclick],#gate [oninput],#gate [onchange]').count()).toBe(0);
});

async function openGame(page, fixture) {
  if (fixture) await page.addInitScript(({ key, save }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(save));
  }, { key: SAVE_KEY, save: fixture });
  await page.goto('/');
  await page.locator('#play').click();
  await expect(page.locator('#gate')).toBeVisible();
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);

test('operator augments and discovered-weapon seals persist through normal menu controls', async ({ page }) => {
  const fixture = freshSave(CATALOG); fixture.gold = CATALOG.config.eggCost * 10;
  fixture.collection.weapons = CATALOG.weapons.map(weapon => weapon.id);
  const [first, second] = CATALOG.characters.filter(character => character.unlocked);
  const sealedId = CATALOG.weapons.find(weapon => weapon.id !== first.weapon).id;
  await openGame(page, fixture);
  await page.locator('[data-tab="shop"]').click();
  await page.locator(`[data-augment="${first.id}"]`).click();
  await page.locator('#g-meta-character').selectOption(second.id);
  await page.locator(`[data-augment="${second.id}"]`).click();
  const bought = await saved(page);
  expect(bought.gold).toBe(fixture.gold - CATALOG.config.eggCost * 2);
  expect(bought.eggs[first.id]).toBe(1); expect(bought.eggs[second.id]).toBe(1);
  expect(bought.stats.runs).toBe(0);
  await expect(page.locator('.g-refund')).toBeDisabled();
  await page.locator('[data-tab="guide"]').click();
  await page.locator('[data-guide="planning"]').click();
  await page.locator(`[data-seal="${sealedId}"]`).click();
  await expect(page.locator(`[data-seal="${sealedId}"]`)).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).sealed).toEqual([sealedId]);
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator('#play').click();
  await page.locator('[data-tab="shop"]').click();
  await expect(page.locator('.g-augment-count>b')).toHaveText('1');
  await page.locator('[data-tab="guide"]').click();
  await page.locator('[data-guide="planning"]').click();
  await expect(page.locator(`[data-seal="${sealedId}"]`)).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).gold).toBe(bought.gold);
});

test('contract controls produce a one-weapon Inverse run with arcana disabled', async ({ page }, testInfo) => {
  await openGame(page);
  const contract = page.locator('.g-contract-options');
  await contract.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(contract).toHaveAttribute('open', '');
  await page.locator('#g-weapon-limit').selectOption('1');
  await page.locator('#g-inverse').check();
  await page.locator('#g-arcana-enabled').uncheck();
  await page.locator('#g-limit-break').uncheck();
  await page.locator('#g-final-boss').check();
  await page.locator('#g-use-eggs').uncheck();
  await expect(page.locator('.g-starting-arcana')).toBeHidden();
  for (const width of [320, testInfo.project.use.viewport.width]) {
    await page.setViewportSize({ width, height: testInfo.project.use.viewport.height });
    expect(await page.locator('.g-intro').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.screenshot({ path: `artifacts/night-contract-${testInfo.project.name}.png`, caret: 'initial' });
  await page.locator('.g-start').click();
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#gate')).toHaveAttribute('data-inverse', 'true');
  await expect(page.locator('.g-weapon-slots .g-slot')).toHaveCount(1);
  await page.locator('.g-pause').click();
  await page.locator('.g-screen.g-paused .g-retire').click();
  await expect(page.locator('.g-damage-row')).toHaveCount(1);
  expect((await saved(page)).stats.runs).toBe(1);
});

test('epic menu music, volume and pause share one opt-in context and close on exit', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.__expandedAudio = { contexts: [], starts: 0 };
    window.AudioContext = class extends Original {
      constructor(...args) { super(...args); window.__expandedAudio.contexts.push(this); }
      createOscillator() { const node = super.createOscillator(), start = node.start.bind(node); node.start = (...args) => { window.__expandedAudio.starts++; return start(...args); }; return node; }
    };
  });
  await openGame(page);
  expect(await page.evaluate(() => window.__expandedAudio.contexts.length)).toBe(0);
  await page.locator('.g-audio').click();
  await expect.poll(() => page.evaluate(() => window.__expandedAudio.starts)).toBeGreaterThan(0);
  await expect(page.locator('.g-audio')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.g-contract-options > summary').click();
  await page.locator('.g-contract-options input[data-game-volume="music"]').fill('21');
  expect((await saved(page)).settings.musicVolume).toBe(.21);
  await page.locator('.g-start').click();
  await page.locator('.g-pause').click();
  await expect(page.locator('.g-track-title')).toHaveText(SCORE.scenes.hunt.title);
  await expect.poll(() => page.evaluate(() => window.__expandedAudio.contexts[0].state)).toBe('suspended');
  await page.locator('.g-pause-volume input[data-game-volume="music"]').fill('34');
  expect((await saved(page)).settings.musicVolume).toBe(.34);
  await page.locator('.g-resume').click();
  await expect.poll(() => page.evaluate(() => window.__expandedAudio.contexts[0].state)).toBe('running');
  expect(await page.evaluate(() => window.__expandedAudio.contexts.length)).toBe(1);
  await page.locator('.g-audio').click();
  await expect.poll(() => page.evaluate(() => window.__expandedAudio.contexts[0].state)).toBe('suspended');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__expandedAudio.contexts[0].state)).toBe('closed');
});


test('an earned cloud spire stage becomes selectable and starts its vertical hunt', async ({ page }, testInfo) => {
  const fixture = freshSave(CATALOG); fixture.stats.wins = 1;
  await openGame(page, fixture);
  await page.locator('button[data-stage="spire"]').click();
  await expect(page.locator('button[data-stage="spire"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.g-stage-description')).toContainText('cloud control plane');
  await page.locator('.g-start').click();
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('.g-banner')).toContainText('Cloud Spire');
  await page.clock.runFor(1000);
  for (let i = 0; i < 10 && await page.locator('#gate').getAttribute('data-state') === 'upgrade'; i++) await page.keyboard.press('1');
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'playing');
  await page.screenshot({ path: `artifacts/night-spire-play-${testInfo.project.name}.png`, caret: 'initial' });
  await page.locator('.g-pause').click();
  await page.locator('.g-screen.g-paused .g-retire').click();
  expect((await saved(page)).collection.stages).toContain('spire');
});
