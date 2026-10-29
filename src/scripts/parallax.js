// Hero parallax (sky, moon, castle, fog). Bundled module: no inline handlers, CSSOM transforms only (CSP-safe).
export function initParallax() {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const layers = [...document.querySelectorAll('.sky i')];
  if (!layers.length) return;
  // scroll factor and pointer drift (px) per layer, in DOM order: sky, moon, castle, fog
  const factor = { l1: 0.1, moon: 0.14, l2: 0.25, l3: 0.4 };
  const drift = { l1: 0, moon: 3, l2: 8, l3: 14 };
  let tx = 0, cx = 0, raf = 0, active = false;
  const draw = () => {
    raf = 0;
    if (!active) return;
    cx += (tx - cx) * 0.08;
    const y = Math.min(scrollY, 900);
    for (const l of layers) l.style.transform = `translate3d(${(cx * drift[l.className]).toFixed(2)}px, ${(y * factor[l.className]).toFixed(1)}px, 0)`;
    if (Math.abs(tx - cx) > 0.001) queue();
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const onMove = (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; queue(); };
  const fine = matchMedia('(pointer: fine)').matches;
  const start = () => {
    if (active) return;
    active = true;
    addEventListener('scroll', queue, { passive: true });
    if (fine) addEventListener('pointermove', onMove, { passive: true });
    queue();
  };
  const stop = () => {
    active = false;
    removeEventListener('scroll', queue);
    removeEventListener('pointermove', onMove);
    for (const l of layers) l.style.transform = '';
  };
  if (!motion.matches) start();
  motion.addEventListener('change', () => (motion.matches ? stop() : start()));
}
