import { test, expect } from '@playwright/test';
import cves from '../src/data/cves.json' with { type: 'json' };
import site from '../src/data/site.json' with { type: 'json' };
import { readdirSync, readFileSync } from 'node:fs';

const blogDirectory = new URL('../src/content/blog/', import.meta.url);
const articles = readdirSync(blogDirectory).filter(file => file.endsWith('.md')).map(file => ({
  slug: file.replace(/\.md$/, ''),
  draft: /^draft:\s*true\s*$/m.test(readFileSync(new URL(file, blogDirectory), 'utf8')),
}));

test('research and contact remain usable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: 'Cristian Vargas' })).toBeVisible();
  await expect(page.locator(`#contact a[href="${site.email ? `mailto:${site.email}` : site.linkedin}"]`).first()).toBeVisible();
  for (const cve of cves) expect(await page.locator(`a[href="${cve.advisory_url}"]`).count()).toBeGreaterThan(0);
  await expect(page.locator('[data-research-tools]')).toBeHidden();
  await page.locator('.more > summary').click();
  await expect(page.locator('.more tbody tr').last()).toBeVisible();
  const note = page.locator('.more .research-note').last();
  await note.locator('summary').click();
  await expect(note.locator('p')).toBeVisible();
  await context.close();
});

test('game loads on demand, traps focus, and restores the portfolio on exit', async ({ page }) => {
  await page.clock.install(); // UI lifecycle checks must not race a randomly timed level-up.
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
  for (const key of ['Shift+Tab', 'Tab', ...Array(24).fill('Tab')]) {
    await page.keyboard.press(key);
    expect(await page.locator('#gate').evaluate(root => root.contains(document.activeElement))).toBe(true);
  }
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

test('production exposes approved articles, excludes drafts and preserves CSP', async ({ page }, testInfo) => {
  await page.goto('/');
  expect(await page.locator('[style],style,script:not([src])').count()).toBe(0);
  await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveAttribute('content', /script-src/);
  for (const article of articles) {
    const link = page.locator(`#writing a[href="/blog/${article.slug}/"]`);
    await expect(link).toHaveCount(article.draft ? 0 : 1);
    const response = await page.request.get(`/blog/${article.slug}/`);
    expect(response.status()).toBe(article.draft ? 404 : 200);
  }
  await page.locator('#writing').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/portfolio-writing-${testInfo.project.name}.png`, caret: 'initial' });
  await page.goto('/blog/');
  for (const article of articles.filter(article => !article.draft)) await expect(page.locator(`a[href="/blog/${article.slug}/"]`)).toHaveCount(1);
  for (const article of articles.filter(article => !article.draft)) {
    await page.goto(`/blog/${article.slug}/`);
    await expect(page.locator('.blog-head h1')).toBeVisible();
    await expect(page.locator('.draft-banner')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    expect(await page.locator('[style],style,script:not([src])').count()).toBe(0);
    for (const width of [320, testInfo.project.use.viewport.width]) {
      await page.setViewportSize({ width, height: testInfo.project.use.viewport.height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: `artifacts/blog-${article.slug}-${testInfo.project.name}.png`, caret: 'initial' });
  }
});

test('a session offers upgrades and can restart cleanly', async ({ page }) => {
  test.setTimeout(90000);
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.clock.setFixedTime(2);
  await page.goto('/');
  await page.locator('#play').click();
  await page.locator('.g-start').click();
  const moves = ['d', 's', 'a', 'w'];
  let upgrades = 0;
  for (let tick = 0; tick < 90; tick++) {
    if (await page.locator('.g-screen.g-result').isVisible()) break;
    if (await page.locator('.g-choice').isVisible()) {
      upgrades++;
      await page.keyboard.press('1');
    }
    const key = moves[Math.floor(tick / 3) % moves.length];
    await page.keyboard.down(key);
    await page.clock.runFor(900);
    await page.keyboard.up(key);
    if (upgrades > 0 && await page.locator('.g-pause').isVisible()) break;
  }
  expect(upgrades).toBeGreaterThan(0);
  await page.locator('.g-pause').click();
  await expect(page.locator('.g-screen.g-paused')).toBeVisible();
  await page.locator('.g-restart').click();
  await expect(page.locator('.g-hud')).toBeVisible();
  await expect(page.locator('.g-screen.g-result')).toBeHidden();
  await expect(page.locator('.g-level')).toContainText('1');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
