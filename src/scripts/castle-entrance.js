import entrance from '../data/portfolio-entrance.json';

const panel = document.getElementById('castle-entrance');
if (panel) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const replayButtons = [...document.querySelectorAll('[data-entrance-replay]')];
  let active = null, holdTimer = 0, fadeTimer = 0, seenHere = false;

  function clearTimers() {
    clearTimeout(holdTimer); clearTimeout(fadeTimer);
    holdTimer = fadeTimer = 0;
  }

  function finish(immediate = true) {
    clearTimers();
    if (panel.hidden) { active?.abort(); active = null; return; }
    if (immediate) {
      active?.abort(); active = null;
      panel.hidden = true;
      panel.classList.remove('is-leaving');
      return;
    }
    panel.classList.add('is-leaving');
    fadeTimer = setTimeout(() => finish(), Math.min(entrance.fadeMs, 600));
  }

  function wasSeen() {
    if (seenHere) return true;
    try { return sessionStorage.getItem(entrance.sessionKey) === 'seen'; }
    catch { return false; }
  }

  function show(manual = false) {
    if (motion.matches || document.hidden || document.getElementById('gate')) return;
    if (!manual && (location.hash || scrollY > 0 || wasSeen())) return;
    finish();
    seenHere = true;
    try { sessionStorage.setItem(entrance.sessionKey, 'seen'); } catch { /* Private browsing remains readable. */ }
    const startScroll = scrollY;
    panel.hidden = false;
    panel.classList.remove('is-leaving');
    active = new AbortController();
    const { signal } = active;
    const dismiss = event => { if (event.isTrusted) finish(); };
    document.addEventListener('pointerdown', dismiss, { capture: true, signal });
    document.addEventListener('wheel', dismiss, { passive: true, capture: true, signal });
    document.addEventListener('keydown', event => {
      if (document.getElementById('gate')) { finish(); return; }
      if (['Escape', 'Enter', ' '].includes(event.key)) { event.preventDefault(); finish(); }
      else if (event.key === 'Tab') finish();
    }, { capture: true, signal });
    addEventListener('scroll', () => { if (scrollY !== startScroll) finish(); }, { passive: true, signal });
    for (const image of panel.querySelectorAll('img')) {
      if (image.complete && !image.naturalWidth) { finish(); return; }
      image.addEventListener('error', () => finish(), { once: true, signal });
    }
    holdTimer = setTimeout(() => finish(false), Math.min(entrance.durationMs, 1800));
  }

  function syncReplay() {
    for (const button of replayButtons) button.hidden = motion.matches;
    if (motion.matches) finish();
  }

  for (const button of panel.querySelectorAll('[data-entrance-skip]')) button.addEventListener('click', () => finish());
  for (const button of replayButtons) button.addEventListener('click', () => show(true));
  motion.addEventListener('change', syncReplay);
  addEventListener('hashchange', () => finish());
  addEventListener('pagehide', () => finish());
  addEventListener('pageshow', event => { if (event.persisted) { finish(); syncReplay(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  syncReplay();
  show();
}
