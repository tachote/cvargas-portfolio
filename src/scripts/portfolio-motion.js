import MOTION from '../data/portfolio-motion.json';

// Every section is readable before enhancement. Motion changes decoration only.
const hero = document.querySelector('.hero-atmosphere');
const avatar = document.querySelector('.hero .avatar');
const sections = [...document.querySelectorAll('.home main > section')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const tiltClasses = ['tilt-left', 'tilt-right', 'tilt-up', 'tilt-down'];
let active = false, controller, observer, frame = 0, pointer;

function resetTilt() {
  pointer = undefined;
  avatar?.classList.remove(...tiltClasses);
}

function paint() {
  frame = 0;
  if (!active || reduce.matches || document.hidden) return;
  if (hero) {
    const withinHero = hero.getBoundingClientRect().bottom > 0;
    hero.classList.toggle('motion-near', withinHero && scrollY > innerHeight * MOTION.nearScrollRatio && scrollY <= innerHeight * MOTION.farScrollRatio);
    hero.classList.toggle('motion-far', withinHero && scrollY > innerHeight * MOTION.farScrollRatio);
  }
  if (!avatar || !pointer || !fine.matches) return;
  const rect = avatar.getBoundingClientRect();
  const x = (pointer.x - rect.left) / Math.max(1, rect.width);
  const y = (pointer.y - rect.top) / Math.max(1, rect.height);
  avatar.classList.toggle('tilt-left', x < MOTION.tiltLowerThreshold);
  avatar.classList.toggle('tilt-right', x > MOTION.tiltUpperThreshold);
  avatar.classList.toggle('tilt-up', y < MOTION.tiltLowerThreshold);
  avatar.classList.toggle('tilt-down', y > MOTION.tiltUpperThreshold);
}

function schedule() {
  if (!frame && active && !document.hidden) frame = requestAnimationFrame(paint);
}

function stop() {
  active = false;
  controller?.abort();
  observer?.disconnect();
  cancelAnimationFrame(frame);
  frame = 0;
  resetTilt();
  hero?.classList.remove('motion-near', 'motion-far');
}

function start() {
  if (active || reduce.matches) return;
  active = true;
  controller = new AbortController();
  const { signal } = controller;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-inview');
        observer.unobserve(entry.target);
      }
    }, { threshold: MOTION.intersectionThreshold, rootMargin: MOTION.intersectionMargin });
    sections.forEach(section => observer.observe(section));
  }
  addEventListener('scroll', schedule, { passive: true, signal });
  addEventListener('resize', schedule, { passive: true, signal });
  avatar?.addEventListener('pointermove', event => {
    if (!fine.matches) return;
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  }, { passive: true, signal });
  avatar?.addEventListener('pointerleave', resetTilt, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; resetTilt(); }
    else schedule();
  }, { signal });
  schedule();
}

reduce.addEventListener('change', () => { stop(); start(); });
fine.addEventListener('change', resetTilt);
addEventListener('pagehide', stop);
addEventListener('pageshow', start);
start();
