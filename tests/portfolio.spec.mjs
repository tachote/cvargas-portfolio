import { test, expect } from '@playwright/test';
import cves from '../src/data/cves.json' with { type: 'json' };

test('research and contact remain usable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: 'Cristian Vargas' })).toBeVisible();
  await expect(page.locator('a[href="mailto:hello@cvargas.com"]').first()).toBeVisible();
  for (const cve of cves) expect(await page.locator(`a[href="${cve.advisory_url}"]`).count()).toBeGreaterThan(0);
  await page.locator('.more summary').click();
  await expect(page.locator('.more tbody tr').last()).toBeVisible();
  await context.close();
});

test('game loads on demand, traps focus, and restores the portfolio on exit', async ({ page }) => {
  const errors = [], resources = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => resources.push(request.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(resources.some(url => /\/vgate\..*\.(js|css)/.test(url))).toBe(false);
  await page.locator('#play').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.g-start')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.g-exit')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.g-start')).toBeFocused();
  await page.locator('.g-start').click();
  await expect(page.locator('.g-hud')).toBeVisible();
  await page.locator('.g-pause').click();
  await expect(page.locator('.g-screen.g-paused')).toBeVisible();
  await page.locator('.g-resume').click();
  await expect(page.locator('.g-screen.g-paused')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#play')).toBeFocused();
  expect(await page.locator('.home').evaluate(el => el.inert)).toBe(false);
  expect(await page.locator('html').evaluate(el => el.classList.contains('gate-open'))).toBe(false);
  expect(errors).toEqual([]);
});

test('reduced motion prevents game loading and changing the preference closes it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#play');
  await expect(page.locator('#play')).toBeHidden();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#play').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('research anchors, legacy game entry and narrow layouts work', async ({ page }) => {
  await page.goto('/#skills');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#skills')).toBeInViewport();
  for (const width of [320, 390, 600, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/play/');
  await expect(page).toHaveURL(/\/#play$/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('production excludes drafts and emits no inline styles or scripts', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('[style],style,script:not([src])').count()).toBe(0);
  await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveAttribute('content', /script-src/);
  for (const path of ['http-verb-tampering-nestjs', 'cwee-or-oswe', 'windsurf-cursor-secure-code-review']) {
    expect(await page.locator(`a[href*="/blog/${path}"]`).count()).toBe(0);
    const response = await page.request.get(`/blog/${path}/`);
    expect(response.status()).toBe(404);
  }
});

test('a full hunt reaches results, offers upgrades, and supports replay', async ({ page }) => {
  test.setTimeout(90000);
  await page.clock.install();
  await page.goto('/');
  await page.locator('#play').click();
  await page.locator('.g-start').click();
  const moves = ['d', 's', 'a', 'w'];
  let upgrades = 0;
  for (let tick = 0; tick < 160; tick++) {
    if (await page.locator('.g-screen.g-result').isVisible()) break;
    if (await page.locator('.g-choice').isVisible()) {
      upgrades++;
      await page.locator('.g-upgrade').first().click();
    }
    const key = moves[Math.floor(tick / 3) % moves.length];
    await page.keyboard.down(key);
    await page.clock.runFor(900);
    await page.keyboard.up(key);
    // Space activates the focused replay button on the result screen, so only dash during play.
    if (await page.locator('#gate').getAttribute('class') === 'g-playing') await page.keyboard.press('Space');
  }
  await expect(page.locator('.g-screen.g-result')).toBeVisible();
  await expect(page.locator('.g-screen.g-result h2')).toHaveText(/You held the night\.|The breach got through\./);
  expect(upgrades).toBeGreaterThan(0);
  await page.locator('.g-again').click();
  await expect(page.locator('.g-hud')).toBeVisible();
  await expect(page.locator('.g-screen.g-result')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
