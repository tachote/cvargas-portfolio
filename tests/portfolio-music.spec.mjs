import { test, expect } from '@playwright/test';

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const messages = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.__musicProbe = { contexts: [], starts: 0, masters: [], compressors: [] };
    window.AudioContext = class extends Original {
      constructor(...args) { super(...args); window.__musicProbe.contexts.push(this); this.__firstGain = true; }
      createGain() { const node = super.createGain(); if (this.__firstGain) { window.__musicProbe.masters.push(node); this.__firstGain = false; } return node; }
      createOscillator() { const node = super.createOscillator(), start = node.start.bind(node); node.start = (...args) => { window.__musicProbe.starts++; return start(...args); }; return node; }
      createDynamicsCompressor() { const node = super.createDynamicsCompressor(); window.__musicProbe.compressors.push(node); return node; }
    };
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.locator('[style],style,script:not([src]),[onclick]').count()).toBe(0);
});

test('music requires opt-in, produces audio, mutes and remembers only volume', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('.pm-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__musicProbe.contexts.length)).toBe(0);
  await page.locator('.pm-settings > summary').click();
  const volume = page.getByRole('slider', { name: 'Volume' });
  await volume.fill('36');
  expect(await page.evaluate(() => window.__musicProbe.contexts.length)).toBe(0);
  await toggle.click();
  await expect(page.locator('[data-portfolio-music]')).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => page.evaluate(() => window.__musicProbe.starts)).toBeGreaterThan(0);
  await page.evaluate(() => {
    const probe = window.__musicProbe, analyser = probe.contexts[0].createAnalyser();
    analyser.fftSize = 2048; probe.compressors[0].connect(analyser); probe.analyser = analyser;
  });
  await expect.poll(() => page.evaluate(() => {
    const samples = new Float32Array(2048); window.__musicProbe.analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  })).toBeGreaterThan(.0001);
  await volume.fill('0');
  await expect(page.locator('.pm-label')).toHaveText('MUTED');
  await expect.poll(() => page.evaluate(() => window.__musicProbe.masters[0].gain.value)).toBeLessThan(.001);
  await volume.fill('36');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('suspended');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__musicProbe.contexts.length)).toBe(0);
  await page.locator('.pm-settings > summary').click();
  await expect(volume).toHaveValue('36');
});

test('ambience pauses for the game, hidden tabs and cached-page transitions', async ({ page }) => {
  await page.goto('/');
  await page.locator('.pm-toggle').click();
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('running');
  await page.locator('#play').click();
  await expect(page.locator('#gate')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('suspended');
  await page.locator('.g-audio').click();
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts.length)).toBe(2);
  expect(await page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('suspended');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[1].state)).toBe('closed');
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('running');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('suspended');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('running');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('suspended');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(() => page.evaluate(() => window.__musicProbe.contexts[0].state)).toBe('running');
  await page.locator('.pm-toggle').click();
});

test('music controls work on articles, with reduced motion and unavailable storage', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage denied', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Storage denied', 'SecurityError'); };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blog/http-verb-tampering-nestjs/');
  await page.locator('.pm-toggle').click();
  await expect(page.locator('[data-portfolio-music]')).toHaveAttribute('data-playing', 'true');
  await page.locator('.pm-settings > summary').click();
  await page.getByRole('slider', { name: 'Volume' }).fill('20');
  await expect(page.locator('.pm-panel output')).toHaveText('20%');
  expect(await page.locator('.pm-bars i').first().evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  for (const width of [320, testInfo.project.use.viewport.width]) {
    await page.setViewportSize({ width, height: testInfo.project.use.viewport.height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const panel = await page.locator('.pm-panel').boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
  }
  await page.screenshot({ path: `artifacts/portfolio-music-${testInfo.project.name}.png`, caret: 'initial' });
  await page.getByRole('slider', { name: 'Volume' }).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.pm-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('.pm-settings > summary')).toBeFocused();
  await page.locator('.pm-toggle').click();
});
