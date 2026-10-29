import { test, expect } from '@playwright/test';
import { CATALOG } from '../src/scripts/night/engine.js';
import { freshSave, SAVE_KEY } from '../src/scripts/night/save.js';
import { OPERATIONS } from '../src/scripts/night/operations.js';

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const messages = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.clock.setFixedTime(2);
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype, transform = proto.setTransform, translate = proto.translate;
    proto.setTransform = function (...args) { if (this.canvas.matches('.g-arena')) this.__pendingCamera = true; return transform.apply(this, args); };
    proto.translate = function (x, y) { if (this.__pendingCamera && this.canvas.matches('.g-arena')) { window.__vaultCamera = { x, y }; this.__pendingCamera = false; } return translate.call(this, x, y); };
  });

});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.locator('#gate [style],#gate style,#gate script,#gate [onclick]').count()).toBe(0);
});
async function open(page, fixture) {
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { key: SAVE_KEY, value: fixture });
  await page.goto('/'); await page.locator('#play').click();
  await expect(page.locator('#gate')).toBeVisible();
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function resolve(page) {
  for (let i = 0; i < 45; i++) {
    const state = await page.locator('#gate').getAttribute('data-state');
    if (['playing', 'result', 'merchant'].includes(state)) return state;
    if (state === 'upgrade') {
      const choices = page.locator('[data-choice]'), names = await choices.locator('b').allTextContents();
      const priorities = ['wand', 'whip', 'armor', 'health', 'cooldown', 'might', 'area', 'orbit', 'rune'].map(id => [...CATALOG.weapons, ...CATALOG.passives].find(item => item.id === id)?.name);
      const index = priorities.map(name => names.indexOf(name)).find(index => index >= 0);
      const passive = names.findIndex(name => CATALOG.passives.some(item => item.name === name));
      if (index === undefined && passive < 0 && await page.locator('.g-reroll').isEnabled()) { await page.keyboard.press('r'); continue; }
      await page.keyboard.press(String((index ?? Math.max(0, passive)) + 1));
    } else if (state === 'chest') await page.locator('.g-chest-collect').click();
    else if (state === 'arcana') await page.locator('[data-run-arcana]').first().click();
    else if (state === 'arsenal') {
      const wand = page.locator('[data-arsenal="wand"]');
      await (await wand.count() ? wand : page.locator('[data-arsenal]').first()).click();
    } else if (state === 'dead') throw new Error('The operation ended before demonstrating its objective.');
    else throw new Error(`Unexpected overlay: ${state}`);
  }
  throw new Error('Pending rewards did not resolve.');
}

test('directed vault is reached by movement, freezes time and grants the selected weapon', async ({ page }, testInfo) => {
  const fixture = freshSave(CATALOG); fixture.collection.weapons = CATALOG.weapons.map(item => item.id);
  await open(page, fixture); await page.locator('.g-start').click();
  const origin = await page.evaluate(() => window.__vaultCamera), target = CATALOG.stages[0].arsenal;
  for (let step = 0; step < 100; step++) {
    const state = await page.locator('#gate').getAttribute('data-state');
    if (state === 'arsenal') break;
    await resolve(page);
    const camera = await page.evaluate(() => window.__vaultCamera);
    const dx = target.x - (origin.x - camera.x), dy = target.y - (origin.y - camera.y);
    const keys = [Math.abs(dx) > 4 ? dx > 0 ? 'd' : 'a' : null, Math.abs(dy) > 4 ? dy > 0 ? 's' : 'w' : null].filter(Boolean);
    for (const key of keys) await page.keyboard.down(key);
    await page.clock.runFor(100);
    for (const key of keys) await page.keyboard.up(key);
  }
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'arsenal');
  await expect(page.locator('[data-arsenal="wand"]')).toBeVisible();
  const clock = await page.locator('.g-clock b').textContent();
  await page.clock.runFor(2000); await expect(page.locator('.g-clock b')).toHaveText(clock);
  await page.screenshot({ path: `artifacts/night-vault-${testInfo.project.name}.png`, caret: 'initial' });
  await page.locator('[data-arsenal="wand"]').click();
  await resolve(page);
  await expect(page.locator('.g-weapon-slots .g-slot[title*="SSTI Probe"]')).toHaveCount(1);
  await expect(page.locator('.g-weapon-slots .g-slot canvas')).toHaveCount(2);
});

test('an operation completes through play and banks only its one-time main bounty', async ({ page }, testInfo) => {
  test.setTimeout(150000);
  const fixture = freshSave(CATALOG); fixture.gold = 5000;
  fixture.powerUps = Object.fromEntries(CATALOG.powerUps.map(item => [item.id, item.maxLevel]));
  fixture.operations.rank = OPERATIONS.config.maxRank;
  await open(page, fixture); await page.locator('[data-tab="operations"]').click();
  await expect(page.locator('[data-operation]')).toHaveCount(OPERATIONS.chapters.length);
  await expect(page.locator('[data-operation="weaponization"]')).toBeDisabled();
  await page.screenshot({ path: `artifacts/night-operations-${testInfo.project.name}.png`, caret: 'initial' });
  await page.locator('[data-operation="foothold"]').click();
  // Secure a homing weapon from the actual authored vault before kiting the horde.
  const origin = await page.evaluate(() => window.__vaultCamera), vault = CATALOG.stages[0].arsenal;
  for (let step = 0; step < 100; step++) {
    const state = await page.locator('#gate').getAttribute('data-state');
    if (state === 'arsenal') { await resolve(page); break; }
    await resolve(page);
    const camera = await page.evaluate(() => window.__vaultCamera);
    const dx = vault.x - (origin.x - camera.x), dy = vault.y - (origin.y - camera.y);
    if (Math.hypot(dx, dy) < 8) break;
    const keys = [Math.abs(dx) > 4 ? dx > 0 ? 'd' : 'a' : null, Math.abs(dy) > 4 ? dy > 0 ? 's' : 'w' : null].filter(Boolean);
    for (const key of keys) await page.keyboard.down(key);
    await page.clock.runFor(100);
    for (const key of keys) await page.keyboard.up(key);
  }
  for (let tick = 0; tick < 400; tick++) {
    const state = await resolve(page);
    if (state === 'result') break;
    if (state === 'merchant') { await page.locator('.g-merchant-leave').click(); continue; }
    const key = ['d', 's', 'a', 'w'][Math.floor(tick / 4) % 4];
    await page.keyboard.down(key); await page.clock.runFor(500); await page.keyboard.up(key);
  }
  await expect(page.locator('.g-result')).toBeVisible();
  const after = await saved(page);
  expect(after.operations.completed).toContain('foothold');
  expect(after.operations.runs).toBe(1);
  expect(after.operations.gold).toBeGreaterThanOrEqual(OPERATIONS.chapters[0].operationGold);
  expect(after.gold).toBe(fixture.gold + OPERATIONS.chapters[0].mainBounty);
  expect(after.stats).toEqual(fixture.stats);
  await page.locator('.g-lobby-button').click();
  await expect(page.locator('[data-operation="weaponization"]')).toBeEnabled();
  await page.locator('[data-operation="foothold"]').click();
  await page.locator('.g-pause').click(); await page.locator('.g-paused .g-retire').click();
  const replay = await saved(page);
  expect(replay.gold).toBe(after.gold);
  expect(replay.operations.runs).toBe(2);
  expect(replay.stats).toEqual(fixture.stats);
});
