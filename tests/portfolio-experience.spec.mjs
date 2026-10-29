import { test, expect } from '@playwright/test';
import cves from '../src/data/cves.json' with { type: 'json' };
import grimoire from '../src/data/grimoire.json' with { type: 'json' };

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const messages = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.locator('[style],style,script:not([src]),[onclick],[oninput]').count()).toBe(0);
});

test('research search reaches collapsed disclosures and restores their native presentation', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox');
  const rows = page.locator('[data-research-row]');
  await expect(rows).toHaveCount(cves.length);
  await expect(search).toBeVisible();
  await expect(page.locator('.more')).not.toHaveAttribute('open', '');
  await search.fill('DOMPurify');
  await expect(search).toBeFocused();
  await expect(rows.filter({ visible: true })).toHaveCount(1);
  await expect(rows.filter({ visible: true })).toContainText('CVE-2026-0540');
  const detail = rows.filter({ visible: true }).locator('.research-note');
  await detail.locator('summary').click();
  await expect(detail.locator('p')).toBeVisible();
  await expect(detail.locator('p')).toHaveText(cves.find(cve => cve.id === 'CVE-2026-0540').detail);
  await expect(page.locator('.more')).toHaveAttribute('open', '');
  await expect(page.locator('.research-status')).toContainText('1');
  await search.fill('unlikely-disclosure-<script>alert(1)</script>');
  await expect(rows.filter({ visible: true })).toHaveCount(0);
  await expect(page.locator('.research-empty')).toBeVisible();
  await page.locator('.research-clear').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.research-empty')).toBeHidden();
  await expect(page.locator('.more')).not.toHaveAttribute('open', '');
  await page.locator('.more > summary').click();
  await expect(rows.filter({ visible: true })).toHaveCount(cves.length);
  await search.fill('ghost');
  await expect(rows.filter({ visible: true })).toHaveCount(1);
  await page.locator('.research-reset').click();
  await expect(page.locator('.more')).toHaveAttribute('open', '');
  await expect(rows.filter({ visible: true })).toHaveCount(cves.length);
});

test('class filters and search combine using actual disclosure records', async ({ page }) => {
  await page.goto('/#cves');
  const rows = page.locator('[data-research-row]');
  for (const label of [...new Set(cves.map(cve => cve.vuln_class))]) {
    const button = page.locator('[data-filter]').filter({ hasText: label }).first();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(rows.filter({ visible: true })).toHaveCount(cves.filter(cve => cve.vuln_class === label).length);
  }
  await page.locator('[data-filter="SSRF"]').click();
  await page.getByRole('searchbox').fill('Ghost');
  await expect(rows.filter({ visible: true })).toHaveCount(1);
  await expect(rows.filter({ visible: true })).toContainText('CVE-2025-9862');
  await page.getByRole('searchbox').fill('NestJS');
  await expect(page.locator('.research-empty')).toBeVisible();
  await page.locator('.research-reset').click();
  await expect(page.locator('[data-filter=""]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('chapter navigation, original art and narrow layouts remain usable', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const chapters = page.locator('.chapter-link');
  await expect(chapters).toHaveCount(7);
  for (const image of ['.hero-vault', '.specimen-art', '.save-seal']) {
    await page.locator(image).scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator(image).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.locator('.chapter-link[href="#cves"]')).toHaveAttribute('aria-current', 'location');
  await page.screenshot({ path: `artifacts/portfolio-hero-${testInfo.project.name}.png`, caret: 'initial' });
  await page.screenshot({ path: `artifacts/portfolio-full-${testInfo.project.name}.png`, fullPage: true, caret: 'initial' });
  await page.locator('.chapter-link[href="#skills"]').click();
  await expect(page.locator('#skills')).toBeInViewport();
  await expect(page.locator('.chapter-link[href="#skills"]')).toHaveAttribute('aria-current', 'location');
  await page.screenshot({ path: `artifacts/portfolio-skills-${testInfo.project.name}.png`, caret: 'initial' });
  for (const width of [320, 390, 600, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(testInfo.project.use.viewport);
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/portfolio-contact-${testInfo.project.name}.png`, caret: 'initial' });
});

test('writing and talks are independent, language credential is removed and requested skills render', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#writing h2')).toHaveText('Writing · Grimoire');
  await expect(page.locator('#talks h2')).toHaveText('Talks · Transmissions');
  const talks = grimoire.filter(item => item.kind === 'talk' && !item.draft && !item.hidden);
  for (const talk of talks) {
    await expect(page.locator(`#talks a[href="${talk.url}"]`)).toBeVisible();
    await expect(page.locator(`#writing a[href="${talk.url}"]`)).toHaveCount(0);
  }
  await expect(page.locator('body')).not.toContainText(/English · C2|EF SET/);
  await expect(page.locator('a[href*="efset.org"]')).toHaveCount(0);
  for (const [label, level] of [['AI', 9], ['Cloud', 7]]) {
    const skill = page.locator('#skills .attrs li').filter({ has: page.locator('.al', { hasText: new RegExp(`^${label}$`) }) });
    await expect(skill.locator('.an')).toHaveText(`${level}/10`);
    await expect(skill.locator('.ab .on')).toHaveCount(level);
  }
});
