import { test, expect } from '@playwright/test';
import entrance from '../src/data/portfolio-entrance.json' with { type: 'json' };
import site from '../src/data/site.json' with { type: 'json' };

const errors = new WeakMap();
const panel = page => page.locator('#castle-entrance');
const replay = page => page.locator('[data-entrance-replay]');

test.beforeEach(async ({ page }) => {
  const messages = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.locator('[style],style,script:not([src]),[onclick],[oninput],[onchange]').count()).toBe(0);
});

test('the castle entrance renders the real name, exits on time and only auto-plays once per session', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(panel(page)).toBeVisible();
  const [firstName, ...surname] = site.name.split(' ');
  await expect(page.locator('.castle-entrance-name>span')).toHaveText(firstName);
  await expect(page.locator('.castle-entrance-name>strong')).toHaveText(surname.join(' '));
  expect(await page.locator('.castle-entrance-title').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThanOrEqual(.8);
  await expect(page.locator('.hero h1')).toBeVisible();
  expect(await page.locator('.home').evaluate(element => element.inert)).toBe(false);
  expect(await panel(page).evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none');
  expect(await page.locator('#gate').count()).toBe(0);
  await page.clock.runFor(850);
  await page.screenshot({ path: `artifacts/portfolio-entrance-${testInfo.project.name}.png`, caret: 'initial' });
  await page.clock.runFor(entrance.durationMs + entrance.fadeMs - 850 + 100);
  await expect(panel(page)).toBeHidden();
  await page.reload();
  await expect(replay(page)).toBeVisible();
  await expect(panel(page)).toBeHidden();
  await expect(replay(page)).toHaveText(entrance.replay);
  await replay(page).click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
});

test('a first click passes through the entrance and opens the opt-in game immediately', async ({ page }) => {
  await page.goto('/');
  await expect(panel(page)).toBeVisible();
  await page.locator('#play').click();
  await expect(panel(page)).toBeHidden();
  await expect(page.locator('#gate')).toBeVisible();
  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'menu');
  await page.keyboard.press('Escape');
  await expect(page.locator('#gate')).toHaveCount(0);
  await expect(page.locator('#play')).toBeFocused();
});

test('deep links skip the entrance without overriding research or explicit game entry', async ({ page }) => {
  await page.goto('/#skills');
  await expect(replay(page)).toBeVisible();
  await expect(panel(page)).toBeHidden();
  await expect(page.locator('#skills')).toBeVisible();
  expect(await page.evaluate(key => sessionStorage.getItem(key), entrance.sessionKey)).toBeNull();
  await page.goto('/#play');
  await expect(page.locator('#gate')).toBeVisible();
  await expect(panel(page)).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#gate')).toHaveCount(0);
});

test('reduced motion disables entry and replay, including a live preference change', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(panel(page)).toBeHidden();
  await expect(replay(page)).toBeHidden();
  await expect(page.locator('.hero h1')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(replay(page)).toBeVisible();
  await replay(page).click();
  await expect(panel(page)).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(panel(page)).toBeHidden();
  await expect(replay(page)).toBeHidden();
});

test('denied session storage remains readable and actual scrolling dismisses the entrance', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() { throw new DOMException('Storage is unavailable.', 'SecurityError'); },
  }));
  await page.goto('/');
  await expect(panel(page)).toBeVisible();
  await page.mouse.wheel(0, 180);
  await expect(panel(page)).toBeHidden();
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).overflowY)).not.toBe('hidden');
  await expect(page.locator('.hero h1')).toBeVisible();
});

test('failed decorative artwork cannot strand the entrance or prevent immediate game entry', async ({ page }) => {
  await page.route('**/fx/portfolio-castle.svg', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '' }));
  await page.goto('/');
  await expect(replay(page)).toBeVisible();
  await expect(panel(page)).toBeHidden();
  await replay(page).click();
  await expect(panel(page)).toBeHidden();
  await page.locator('#play').click();
  await expect(page.locator('#gate')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('without JavaScript the decorative entrance and replay stay hidden and content stays available', async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto(baseURL);
    await expect(panel(staticPage)).toBeHidden();
    await expect(replay(staticPage)).toBeHidden();
    await expect(staticPage.getByRole('heading', { name: site.name })).toBeVisible();
    await expect(staticPage.locator('#cves')).toBeVisible();
    expect(await staticPage.locator('body').evaluate(element => element.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
