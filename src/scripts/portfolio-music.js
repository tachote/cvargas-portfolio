import { createAmbience } from './ambience.js';
import score from '../data/portfolio-music.json';
import portfolio from '../data/portfolio-ui.json';

const root = document.querySelector('[data-portfolio-music]');
if (root && (globalThis.AudioContext || globalThis.webkitAudioContext)) {
  const button = root.querySelector('.pm-toggle'), label = root.querySelector('.pm-label');
  const input = root.querySelector('input'), output = root.querySelector('output');
  const status = root.querySelector('.pm-status'), settings = root.querySelector('details');
  const copy = portfolio.music, key = 'cv-portfolio-volume-v1';
  const player = createAmbience(score, state => {
    button.setAttribute('aria-pressed', String(state.enabled));
    button.setAttribute('aria-label', state.enabled ? copy.mute : copy.play);
    root.dataset.playing = String(state.playing && state.volume > 0);
    label.textContent = !state.enabled ? copy.off : state.blocked || !state.playing ? copy.paused : state.volume === 0 ? copy.muted : copy.on;
    input.value = String(state.volume); output.textContent = `${state.volume}%`;
    input.setAttribute('aria-valuetext', `${state.volume}%`);
    status.textContent = state.failed ? copy.unavailable : '';
    root.classList.toggle('pm-error', state.failed);
  });
  try { const stored = localStorage.getItem(key); if (stored !== null) player.setVolume(Number(stored)); } catch { /* Storage is optional. */ }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await player.toggle(); } finally { button.disabled = false; }
  });
  input.addEventListener('input', () => {
    player.setVolume(Number(input.value));
    try { localStorage.setItem(key, input.value); } catch { /* The volume still works. */ }
  });
  const updateBlocked = () => { player.setBlocked(document.hidden || Boolean(document.getElementById('gate'))); };
  const observer = new MutationObserver(updateBlocked);
  observer.observe(document.body, { childList: true });
  document.addEventListener('visibilitychange', updateBlocked);
  document.addEventListener('click', event => { if (!root.contains(event.target)) settings.open = false; });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && settings.open) { settings.open = false; settings.querySelector('summary').focus(); }
  });
  addEventListener('pagehide', event => {
    if (event.persisted) player.setBlocked(true);
    else { observer.disconnect(); player.dispose(); }
  });
  addEventListener('pageshow', updateBlocked);
  updateBlocked(); root.hidden = false;
}
