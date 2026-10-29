import gameStyles from './vgate.css?url';

let stylesheetPromise;
function loadStylesheet() {
  if (!stylesheetPromise) stylesheetPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = gameStyles;
    link.dataset.gameStyles = 'true';
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => { link.remove(); stylesheetPromise = undefined; reject(new Error('The game stylesheet could not be loaded. Please try again.')); }, { once: true });
    document.head.appendChild(link);
  });
  return stylesheetPromise;
}

/** An original, opt-in survivor arena. All rendering stays on canvas or in external CSS. */
export async function openGate(CVES, ST = {}) {
  if (!CVES?.length || document.getElementById('gate') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  await loadStylesheet();
  if (document.getElementById('gate') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const controller = new AbortController();
  const signal = controller.signal;
  const previousFocus = document.activeElement;
  const root = document.createElement('div');
  root.id = 'gate';
  root.className = 'g-menu';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'g-heading');
  root.innerHTML = `
    <canvas aria-label="Vulnerability survivor arena. Move with WASD or arrows. Space to dash. Attacks are automatic."></canvas>
    <div class="g-top"><span class="g-brand">CV / THE NIGHT ARCHIVE</span><div class="g-top-actions"><button type="button" class="g-pause" hidden aria-label="Pause game">Ⅱ</button><button type="button" class="g-exit">Exit · Esc</button></div></div>
    <div class="g-hud" hidden>
      <div class="g-life"><div><span>INTEGRITY</span><b class="g-hp-label">100 / 100</b></div><progress class="g-hp" max="100" value="100" aria-label="Player health"></progress></div>
      <div class="g-clock"><b>02:00</b><span>UNTIL DAWN</span></div>
      <div class="g-score"><b>0</b><span>PATCHED</span></div>
      <div class="g-xp-row"><span class="g-level">LV. 1</span><progress class="g-xp" value="0" max="6" aria-label="Experience until next upgrade"></progress></div>
    </div>
    <div class="g-screen g-intro">
      <div class="g-intro-art" aria-hidden="true"><img src="/fx/avatar-hunter-240.webp" width="180" height="209" alt="" /><span>OFFENSIVE / DEFENSIVE</span></div>
      <div class="g-intro-copy"><p class="g-eyebrow">AN ORIGINAL SECURITY SURVIVAL GAME</p><h1 id="g-heading">PATCH<br>THE <em>NIGHT.</em></h1><p class="g-description">The vulnerabilities are awake.<br>Keep moving. Collect knowledge. Build your arsenal.</p><div class="g-run-facts"><span>2 MINUTE RUN</span><span>AUTO ATTACKS</span><span>REAL CVEs</span></div><button type="button" class="g-start g-primary">ENTER THE BREACH <span aria-hidden="true">↗</span></button><p class="g-controls"><kbd>WASD</kbd> / arrows to move · <kbd>SPACE</kbd> to dash<br>On mobile: drag anywhere to move, tap Dash.</p><p class="g-best"></p></div>
    </div>
    <div class="g-screen g-choice" hidden><p class="g-eyebrow">KNOWLEDGE IS YOUR WEAPON</p><h2 tabindex="-1">Choose your upgrade.</h2><p class="g-choice-note">The night waits while you choose. Keys 1–3 also work.</p><div class="g-upgrades"></div></div>
    <div class="g-screen g-paused" hidden><p class="g-eyebrow">TAKE A BREATH</p><h2>Sanctuary.</h2><p>The hunt is paused.</p><button type="button" class="g-resume g-primary">RESUME THE HUNT ↗</button><button type="button" class="g-restart g-secondary">Start a new run</button></div>
    <div class="g-screen g-result" hidden><p class="g-eyebrow g-result-kicker"></p><h2 tabindex="-1"></h2><p class="g-result-description"></p><div class="g-result-stats"></div><p class="g-disclosure">Game score only. The advisories below are real research from this portfolio.</p><div class="g-advisories"></div><div class="g-result-actions"><button type="button" class="g-again g-primary">HUNT AGAIN ↗</button><button type="button" class="g-back g-secondary">Back to the portfolio</button></div></div>
    <div class="g-bottom" hidden><span class="g-loadout">ARC BOLT · I</span><span class="g-desktop-help">WASD / ARROWS · SPACE TO DASH · P TO PAUSE</span><button type="button" class="g-dash">DASH <span>READY</span></button></div>
    <div class="g-announcement" role="status" aria-live="polite"></div>`;
  if (ST.attrs?.length) {
    const sc = ST.scale || 10, ul = document.createElement('ul');
    ul.className = 'g-attrs';
    ST.attrs.forEach(([label, lv]) => {
      const li = document.createElement('li'), l = document.createElement('span'), b = document.createElement('span');
      l.textContent = label; b.className = 'g-bar'; b.setAttribute('aria-label', `${lv} of ${sc}`);
      for (let i = 0; i < sc; i++) { const c = document.createElement('i'); if (i < lv) c.className = 'on'; b.append(c); }
      li.append(l, b); ul.append(li);
    });
    root.querySelector('.g-intro-art').append(ul);
  }

  const backgroundNodes = [...document.body.children].map(node => [node, node.inert]);
  backgroundNodes.forEach(([node]) => { node.inert = true; });
  document.body.appendChild(root);
  document.documentElement.classList.add('gate-open');
  const $ = selector => root.querySelector(selector);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal });
  let raf = 0, closed = false;
  function exit() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    controller.abort();
    root.remove();
    document.documentElement.classList.remove('gate-open');
    backgroundNodes.forEach(([node, inert]) => { node.inert = inert; });
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  on($('.g-exit'), 'click', exit);
  on($('.g-back'), 'click', exit);
  on(reducedMotion, 'change', event => { if (event.matches) exit(); });
  if (!ctx) { exit(); throw new Error('Canvas is unavailable in this browser.'); }

  const color = { bg: '#0E0A12', floor: '#17111D', tile: '#211829', line: '#30223A', gold: '#C9A227', cream: '#EDE6D6', muted: '#9A8FA3', red: '#B0213A', blue: '#81A4AD', green: '#91AE72' };
  const kinds = [
    { name: 'XSS', color: '#C9A227', hp: 2, speed: 63, radius: 12, shape: 0 },
    { name: 'SQLi', color: '#B66B86', hp: 4, speed: 39, radius: 16, shape: 1 },
    { name: 'SSRF', color: '#81A4AD', hp: 2, speed: 80, radius: 11, shape: 2 },
    { name: 'IDOR', color: '#91AE72', hp: 3, speed: 52, radius: 14, shape: 3 },
    { name: 'Auth bypass', color: '#D9542B', hp: 5, speed: 43, radius: 17, shape: 4 }
  ];
  const upgrades = [
    { key: 'power', icon: '01', name: 'Sharper payload', text: '+1 damage to every attack.', apply: () => { player.power++; } },
    { key: 'rate', icon: '02', name: 'Rapid disclosure', text: 'Arc bolts fire 18% faster.', apply: () => { player.rate *= .82; } },
    { key: 'multi', icon: '03', name: 'Parallel audit', text: 'Launch an additional arc bolt.', apply: () => { player.multi = Math.min(6, player.multi + 1); } },
    { key: 'orbit', icon: '04', name: 'Firewall sigil', text: 'Add an orbiting ward that damages nearby threats.', apply: () => { player.orbit++; } },
    { key: 'nova', icon: '05', name: 'Sanitizer pulse', text: 'Release a wider, stronger cleansing ring.', apply: () => { player.nova++; } },
    { key: 'speed', icon: '06', name: 'Ghost protocol', text: '+12% movement speed. Dash recharges faster.', apply: () => { player.speed *= 1.12; player.dashMax *= .88; } },
    { key: 'magnet', icon: '07', name: 'Knowledge magnet', text: '+45 collection range. Recover 20 integrity.', apply: () => { player.magnet += 45; player.hp = Math.min(player.maxHp, player.hp + 20); } },
    { key: 'health', icon: '08', name: 'Defense in depth', text: '+25 maximum integrity. Recover 35 integrity.', apply: () => { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 35); } }
  ];
  let w = 0, h = 0, dpr = 1, state = 'menu', player, enemies = [], bolts = [], gems = [], effects = [], particles = [];
  let keys = {}, stick = null, time = 0, kills = 0, level = 1, xp = 0, xpNeed = 6, shotClock = 0, spawnClock = 0, novaClock = 0, last = 0, bossSpawned = false, bossDefeated = false, choices = [], selectedCVEs = new Map(), best = 0, lastHud = 0;
  try { best = Number(localStorage.getItem('cv-night-best')) || 0; } catch { /* Storage may be disabled. */ }
  $('.g-best').textContent = best ? `PERSONAL BEST · ${best} PATCHED` : 'A short hunt. A different build every time.';
  const rand = (min, max) => min + Math.random() * (max - min);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const safeURL = url => { try { const parsed = new URL(url, location.origin); return /^https?:$/.test(parsed.protocol) ? parsed.href : null; } catch { return null; } };
  function resize() {
    w = root.clientWidth;
    h = root.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (state !== 'playing') draw();
  }
  on(window, 'resize', resize);
  resize();

  function announce(message) { $('.g-announcement').textContent = message; }
  function show(next) {
    state = next;
    root.className = `g-${next}`;
    $('.g-intro').hidden = next !== 'menu';
    $('.g-choice').hidden = next !== 'upgrade';
    $('.g-paused').hidden = next !== 'paused';
    $('.g-result').hidden = next !== 'result';
    $('.g-hud').hidden = next === 'menu';
    $('.g-bottom').hidden = next !== 'playing';
    $('.g-pause').hidden = !['playing', 'paused'].includes(next);
    $('.g-pause').textContent = next === 'paused' ? '▶' : 'Ⅱ';
    $('.g-pause').setAttribute('aria-label', next === 'paused' ? 'Resume game' : 'Pause game');
    keys = {};
    stick = null;
    if (next === 'playing') {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    } else {
      cancelAnimationFrame(raf); raf = 0; draw();
    }
  }
  function start() {
    player = { x: 0, y: 0, vx: 1, vy: 0, f: 1, hp: 100, maxHp: 100, power: 2, rate: .65, multi: 1, orbit: 0, nova: 0, speed: 185, magnet: 66, invincible: 1.5, dash: 0, dashMax: 3.2, dashing: 0 };
    enemies = []; bolts = []; gems = []; effects = []; particles = [];
    time = 0; kills = 0; level = 1; xp = 0; xpNeed = 6; shotClock = 0; spawnClock = 0; novaClock = 0; bossSpawned = false; bossDefeated = false; selectedCVEs = new Map(); lastHud = 0;
    upgrades.forEach(upgrade => { upgrade.count = 0; });
    for (let i = 0; i < 5; i++) spawn();
    show('playing');
    $('.g-pause').focus();
    announce('The hunt begins. Move to avoid threats. Your arc bolt attacks automatically.');
    hud();
  }
  on($('.g-start'), 'click', start);
  on($('.g-again'), 'click', start);
  on($('.g-restart'), 'click', start);
  function pause() {
    if (state === 'playing') { show('paused'); $('.g-resume').focus(); announce('Game paused.'); }
    else if (state === 'paused') { show('playing'); $('.g-pause').focus(); announce('Hunt resumed.'); }
  }
  on($('.g-pause'), 'click', pause);
  on($('.g-resume'), 'click', pause);
  on(document, 'visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  on(window, 'blur', () => { keys = {}; if (state === 'playing') pause(); });
  on(window, 'keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'escape') { event.preventDefault(); event.stopImmediatePropagation(); exit(); return; }
    if (key === 'tab') {
      const focusable = [...root.querySelectorAll('button, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0], lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); lastElement.focus(); }
      else if (!event.shiftKey && (document.activeElement === lastElement || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      return;
    }
    if (key === 'p' && !event.repeat) { event.preventDefault(); pause(); }
    if (state === 'upgrade' && ['1', '2', '3'].includes(key)) { event.preventDefault(); choose(Number(key) - 1); }
    if (state !== 'playing') return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) { event.preventDefault(); keys[key] = true; }
    if (key === ' ' && !event.repeat) dash();
  }, { capture: true });
  on(window, 'keyup', event => { delete keys[event.key.toLowerCase()]; });
  on(canvas, 'pointerdown', event => {
    if (state !== 'playing') return;
    canvas.setPointerCapture(event.pointerId);
    stick = { id: event.pointerId, ox: event.clientX, oy: event.clientY, x: event.clientX, y: event.clientY };
  });
  on(canvas, 'pointermove', event => { if (stick?.id === event.pointerId) { stick.x = event.clientX; stick.y = event.clientY; } });
  const releaseStick = event => { if (stick?.id === event.pointerId) stick = null; };
  on(canvas, 'pointerup', releaseStick);
  on(canvas, 'pointercancel', releaseStick);
  on(canvas, 'lostpointercapture', releaseStick);
  on($('.g-dash'), 'click', dash);
  function dash() {
    if (state !== 'playing' || player.dash > 0) return;
    player.dash = player.dashMax;
    player.dashing = .18;
    player.invincible = Math.max(player.invincible, .35);
    burst(player.x, player.y, color.gold, 14);
  }

  function spawn(boss = false) {
    const a = rand(0, Math.PI * 2);
    const radius = Math.hypot(w, h) / 2 + 40;
    const availableKinds = kinds.filter(kind => CVES.some(cve => (cve.vuln_class ?? cve.label) === kind.name));
    const poolKinds = availableKinds.length ? availableKinds : kinds;
    const kindIndex = Math.floor(rand(0, Math.min(poolKinds.length, 2 + Math.floor(time / 18))));
    const kind = poolKinds[kindIndex];
    const matching = CVES.filter(cve => (cve.vuln_class ?? cve.label) === kind.name);
    const pool = matching.length ? matching : CVES;
    const cve = pool[Math.floor(rand(0, pool.length))];
    const hp = boss ? 180 : kind.hp + Math.floor(time / 35);
    enemies.push({ x: player.x + Math.cos(a) * radius, y: player.y + Math.sin(a) * radius, hp, maxHp: hp, kind, cve, boss, r: boss ? 40 : kind.radius, sp: boss ? 41 : kind.speed + time * .12, hit: 0, seed: rand(0, 20), pulse: 0, orbitHit: 0 });
  }
  function burst(x, y, tint, count = 7) {
    for (let i = 0; i < count && particles.length < 260; i++) particles.push({ x, y, vx: rand(-105, 105), vy: rand(-105, 105), life: rand(.2, .6), max: .6, tint });
  }
  function damage(enemy, amount, nx = 0, ny = 0) {
    if (enemy.hp <= 0) return;
    enemy.hp -= amount; enemy.hit = .1;
    enemy.x += nx * (enemy.boss ? 2 : 9); enemy.y += ny * (enemy.boss ? 2 : 9);
    if (enemy.hp > 0) return;
    kills++;
    if (!selectedCVEs.has(enemy.cve.id)) effects.push({ type: 'disclosure', x: enemy.x, y: enemy.y - 35, life: 1.35, max: 1.35, text: enemy.cve.id });
    selectedCVEs.set(enemy.cve.id, enemy.cve);
    burst(enemy.x, enemy.y, enemy.kind.color, enemy.boss ? 24 : 7);
    gems.push({ x: enemy.x, y: enemy.y, value: enemy.boss ? 14 : 1, large: enemy.boss });
    if (kills % 17 === 0) gems.push({ x: enemy.x + 12, y: enemy.y, value: 0, heal: true });
    if (enemy.boss) { bossDefeated = true; announce('Critical threat contained. Hold out until dawn.'); }
  }
  function fire() {
    const living = enemies.filter(enemy => enemy.hp > 0);
    if (!living.length) return;
    living.sort((a, b) => distance(a, player) - distance(b, player));
    for (let i = 0; i < player.multi; i++) {
      const target = living[i % living.length];
      const angle = Math.atan2(target.y - player.y, target.x - player.x) + (i >= living.length ? (i % 2 ? -.09 : .09) : 0);
      bolts.push({ x: player.x, y: player.y - 9, vx: Math.cos(angle) * 480, vy: Math.sin(angle) * 480, life: 1.7, angle });
    }
  }
  function levelUp() {
    xp -= xpNeed;
    level++;
    xpNeed = Math.floor(6 + level * 2.5);
    choices = upgrades.filter(upgrade => upgrade.key !== 'multi' || player.multi < 6).map(upgrade => ({ upgrade, rank: Math.random() })).sort((a, b) => a.rank - b.rank).slice(0, 3).map(item => item.upgrade);
    $('.g-upgrades').replaceChildren();
    choices.forEach((upgrade, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'g-upgrade';
      const number = document.createElement('span'); number.className = 'g-upgrade-number'; number.textContent = `0${i + 1} / LV. ${upgrade.count + 1}`;
      const name = document.createElement('b'); name.textContent = upgrade.name;
      const description = document.createElement('span'); description.textContent = upgrade.text;
      const select = document.createElement('small'); select.textContent = 'ACQUIRE UPGRADE ↗';
      button.append(number, name, description, select);
      button.addEventListener('click', () => choose(i), { signal });
      $('.g-upgrades').appendChild(button);
    });
    show('upgrade');
    $('.g-upgrade').focus();
    announce(`Level ${level}. Choose one of three upgrades.`);
    hud();
  }
  function choose(index) {
    if (state !== 'upgrade' || !choices[index]) return;
    const upgrade = choices[index];
    upgrade.apply(); upgrade.count++;
    show('playing');
    player.invincible = Math.max(player.invincible, 1);
    $('.g-pause').focus();
    burst(player.x, player.y, color.gold, 22);
    announce(`${upgrade.name} acquired. Hunt resumed.`);
    if (xp >= xpNeed) levelUp();
    hud();
  }
  function finish(won) {
    show('result');
    if (kills > best) { best = kills; try { localStorage.setItem('cv-night-best', String(best)); } catch { /* Optional best score. */ } }
    $('.g-result-kicker').textContent = won ? 'THE ARCHIVE IS SECURE' : 'EVERY HUNT TEACHES SOMETHING';
    $('.g-screen.g-result h2').textContent = won ? 'You held the night.' : 'The breach got through.';
    $('.g-result-description').textContent = won ? (bossDefeated ? 'Dawn breaks. The critical threat is contained.' : 'Dawn breaks. Your watch is complete.') : 'Try a new build. Keep moving, collect gems and dash through danger.';
    $('.g-result-stats').replaceChildren();
    [[String(kills), 'THREATS PATCHED'], [`${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`, 'TIME SURVIVED'], [String(level), 'LEVEL REACHED'], [String(best), 'PERSONAL BEST']].forEach(([value, label]) => {
      const cell = document.createElement('div'), b = document.createElement('b'), span = document.createElement('span'); b.textContent = value; span.textContent = label; cell.append(b, span); $('.g-result-stats').append(cell);
    });
    $('.g-advisories').replaceChildren();
    [...selectedCVEs.values()].filter(cve => safeURL(cve.advisory_url)).slice(0, 3).forEach(cve => {
      const link = document.createElement('a'); link.href = safeURL(cve.advisory_url); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${cve.id} · ${cve.product} ↗`; $('.g-advisories').append(link);
    });
    if (!$('.g-advisories').children.length) $('.g-disclosure').textContent = 'Game score only. Explore the real advisories in the portfolio.';
    else $('.g-disclosure').textContent = 'Game score only. The advisories below are real research from this portfolio.';
    $('.g-again').focus();
    announce(won ? 'Run complete. You survived until dawn.' : 'Run complete. Your integrity reached zero.');
    hud();
  }
  function hud() {
    if (!player) return;
    const remaining = Math.max(0, Math.ceil(120 - time));
    $('.g-clock b').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    $('.g-hp').max = player.maxHp; $('.g-hp').value = Math.max(0, player.hp);
    $('.g-hp-label').textContent = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
    $('.g-life').classList.toggle('g-danger', player.hp < player.maxHp * .3);
    $('.g-score b').textContent = String(kills);
    $('.g-level').textContent = `LV. ${level}`;
    $('.g-xp').max = xpNeed; $('.g-xp').value = xp;
    $('.g-dash').disabled = player.dash > 0;
    $('.g-dash span').textContent = player.dash > 0 ? `${player.dash.toFixed(1)}s` : 'READY';
    const arsenal = [`ARC BOLT ×${player.multi}`];
    if (player.orbit) arsenal.push(`WARD ×${player.orbit}`);
    if (player.nova) arsenal.push(`PULSE ${player.nova}`);
    $('.g-loadout').textContent = arsenal.join(' · ');
  }

  function update(dt) {
    time += dt;
    player.invincible = Math.max(0, player.invincible - dt);
    player.dash = Math.max(0, player.dash - dt);
    player.dashing = Math.max(0, player.dashing - dt);
    let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    let dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (stick) { dx = (stick.x - stick.ox) / 48; dy = (stick.y - stick.oy) / 48; if (Math.hypot(dx, dy) < .12) dx = dy = 0; }
    const magnitude = Math.hypot(dx, dy);
    if (magnitude) { dx /= magnitude; dy /= magnitude; player.vx = dx; player.vy = dy; if (dx) player.f = dx < 0 ? -1 : 1; }
    if (player.dashing > 0) { dx = player.vx * 3.8; dy = player.vy * 3.8; }
    player.x += dx * player.speed * dt; player.y += dy * player.speed * dt;
    // World is endless, but distant threats are brought back into the encounter.
    spawnClock -= dt;
    if (spawnClock <= 0 && enemies.length < 95) {
      const count = 1 + Math.floor(time / 38);
      for (let i = 0; i < count; i++) spawn();
      spawnClock = Math.max(.25, .78 - time * .004);
    }
    if (time >= 75 && !bossSpawned) { bossSpawned = true; spawn(true); announce('Critical threat incoming. Keep moving and concentrate your fire.'); effects.push({ type: 'warning', life: 3, max: 3, text: 'CRITICAL THREAT INCOMING' }); }
    shotClock -= dt;
    if (shotClock <= 0) { fire(); shotClock = player.rate; }
    novaClock -= dt;
    if (player.nova && novaClock <= 0) {
      const radius = 125 + player.nova * 20;
      effects.push({ type: 'ring', x: player.x, y: player.y, radius, life: .5, max: .5 });
      enemies.forEach(enemy => { if (distance(enemy, player) < radius + enemy.r) { const d = distance(enemy, player) || 1; damage(enemy, player.power + player.nova, (enemy.x - player.x) / d, (enemy.y - player.y) / d); } });
      novaClock = Math.max(1.2, 3.2 - player.nova * .18);
    }
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const d = distance(enemy, player) || 1;
      if (d > Math.hypot(w, h) + 380) { const angle = rand(0, Math.PI * 2), radius = Math.hypot(w, h) / 2 + 40; enemy.x = player.x + Math.cos(angle) * radius; enemy.y = player.y + Math.sin(angle) * radius; }
      let sx = (player.x - enemy.x) / d, sy = (player.y - enemy.y) / d;
      if (enemy.kind.shape === 2 && !enemy.boss) { sx += Math.cos(time * 3 + enemy.seed) * .45; sy += Math.sin(time * 3 + enemy.seed) * .45; }
      enemy.x += sx * enemy.sp * dt; enemy.y += sy * enemy.sp * dt;
      enemy.hit = Math.max(0, enemy.hit - dt); enemy.orbitHit = Math.max(0, enemy.orbitHit - dt);
      if (d < enemy.r + 12 && player.invincible <= 0) {
        player.hp -= enemy.boss ? 23 : 12; player.invincible = .8;
        burst(player.x, player.y, color.red, 12);
        enemy.x -= sx * 30; enemy.y -= sy * 30;
        if (player.hp <= 0) { finish(false); return; }
      }
      if (player.orbit && !enemy.orbitHit) {
        for (let i = 0; i < Math.min(6, player.orbit); i++) {
          const a = time * 2.5 + i * Math.PI * 2 / Math.min(6, player.orbit), orb = { x: player.x + Math.cos(a) * 72, y: player.y + Math.sin(a) * 72 };
          if (distance(enemy, orb) < enemy.r + 13) { damage(enemy, player.power, -sx, -sy); enemy.orbitHit = .5; break; }
        }
      }
    }
    for (const bolt of bolts) {
      bolt.x += bolt.vx * dt; bolt.y += bolt.vy * dt; bolt.life -= dt;
      for (const enemy of enemies) {
        if (bolt.life <= 0) break;
        if (enemy.hp > 0 && distance(bolt, enemy) < enemy.r + 8) { damage(enemy, player.power, bolt.vx / 480, bolt.vy / 480); bolt.life = 0; burst(bolt.x, bolt.y, color.gold, 3); }
      }
    }
    for (const gem of gems) {
      const d = distance(gem, player);
      if (d < player.magnet || gem.moving) { gem.moving = true; const step = Math.min(d, dt * (330 + player.magnet)); gem.x += (player.x - gem.x) / (d || 1) * step; gem.y += (player.y - gem.y) / (d || 1) * step; }
      if (d < 15) { gem.gone = true; if (gem.heal) player.hp = Math.min(player.maxHp, player.hp + 18); else xp += gem.value; }
    }
    // Bound rendering and collision work even on long, stationary runs.
    gems = gems.filter(gem => !gem.gone && distance(gem, player) < 1800).slice(-220);
    enemies = enemies.filter(enemy => enemy.hp > 0);
    bolts = bolts.filter(bolt => bolt.life > 0);
    for (const effect of effects) effect.life -= dt;
    effects = effects.filter(effect => effect.life > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    if (time >= 120) { time = 120; finish(true); return; }
    if (xp >= xpNeed) levelUp();
    if (time - lastHud >= .1) { lastHud = time; hud(); }
  }

  function diamond(x, y, size, tint) {
    ctx.fillStyle = tint; ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath(); ctx.fill();
  }
  function floor() {
    ctx.fillStyle = color.bg; ctx.fillRect(0, 0, w, h);
    const px = player?.x || 0, py = player?.y || 0;
    const cell = 96, ox = w / 2 - px, oy = h / 2 - py;
    for (let gy = Math.floor(-oy / cell) - 1; gy < Math.ceil((h - oy) / cell) + 1; gy++) {
      for (let gx = Math.floor(-ox / cell) - 1; gx < Math.ceil((w - ox) / cell) + 1; gx++) {
        const x = Math.floor(gx * cell + ox), y = Math.floor(gy * cell + oy), seed = Math.abs(gx * 73 + gy * 37);
        ctx.fillStyle = (gx + gy) % 2 ? '#17111D' : '#1A131F'; ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        ctx.strokeStyle = '#251B2D'; ctx.lineWidth = 1; ctx.strokeRect(x + 7, y + 7, cell - 14, cell - 14);
        if (seed % 7 === 0) { ctx.fillStyle = '#30223A'; ctx.fillRect(x + 25, y + 33, 16, 3); ctx.fillRect(x + 38, y + 36, 3, 12); }
        if (gx % 4 === 0 && gy % 4 === 0) {
          const flicker = .75 + Math.sin(time * 7 + seed) * .15;
          const glow = ctx.createRadialGradient(x + 48, y + 48, 2, x + 48, y + 48, 65);
          glow.addColorStop(0, `rgba(201,162,39,${.13 * flicker})`); glow.addColorStop(1, 'rgba(201,162,39,0)'); ctx.fillStyle = glow; ctx.fillRect(x - 18, y - 18, 132, 132);
          ctx.fillStyle = '#3A2A44'; ctx.fillRect(x + 39, y + 46, 18, 12); ctx.fillStyle = '#EDE6D6'; ctx.fillRect(x + 44, y + 37, 7, 15);
          ctx.fillStyle = '#C9A227'; ctx.fillRect(x + 45, y + 30, 5, 8); ctx.fillStyle = '#F2D78A'; ctx.fillRect(x + 46, y + 32, 3, 5);
        }
      }
    }
  }
  function drawEnemy(enemy) {
    const x = Math.round(enemy.x), y = Math.round(enemy.y), size = enemy.boss ? 2.4 : 1, pulse = Math.sin(time * 5 + enemy.seed) * 2;
    ctx.save(); ctx.translate(x, y + pulse); ctx.scale(size, size);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 11, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = enemy.hit ? color.cream : enemy.kind.color;
    if (enemy.kind.shape === 0) { // angular crawling script
      ctx.fillRect(-10, -8, 20, 16); ctx.fillRect(-15, -4, 5, 5); ctx.fillRect(10, -4, 5, 5); ctx.fillRect(-13, 7, 5, 5); ctx.fillRect(8, 7, 5, 5);
    } else if (enemy.kind.shape === 1) { // database golem
      ctx.fillRect(-14, -10, 28, 20); ctx.fillRect(-10, -15, 20, 5); ctx.fillRect(-10, 10, 7, 5); ctx.fillRect(3, 10, 7, 5);
    } else if (enemy.kind.shape === 2) { // request bat
      ctx.beginPath(); ctx.moveTo(-20, -8); ctx.lineTo(-8, 5); ctx.lineTo(0, -10); ctx.lineTo(8, 5); ctx.lineTo(20, -8); ctx.lineTo(12, 12); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
    } else if (enemy.kind.shape === 3) { // broken access mask
      ctx.fillRect(-12, -13, 24, 23); ctx.fillRect(-8, 10, 16, 6); ctx.clearRect(-2, -13, 4, 5);
    } else { // gate keeper
      ctx.fillRect(-15, -9, 30, 24); ctx.fillRect(-12, -17, 5, 11); ctx.fillRect(7, -17, 5, 11); ctx.fillRect(-9, -13, 18, 4);
    }
    ctx.fillStyle = color.bg; ctx.fillRect(-7, -3, 5, 5); ctx.fillRect(3, -3, 5, 5);
    ctx.fillStyle = color.cream; ctx.fillRect(-5, -3, 2, 2); ctx.fillRect(5, -3, 2, 2);
    ctx.restore();
    if (enemy.boss || enemy.hit > 0) { ctx.fillStyle = '#30223A'; ctx.fillRect(x - enemy.r, y - enemy.r - 12, enemy.r * 2, 4); ctx.fillStyle = enemy.boss ? color.red : enemy.kind.color; ctx.fillRect(x - enemy.r, y - enemy.r - 12, enemy.r * 2 * Math.max(0, enemy.hp) / enemy.maxHp, 4); }
    if (enemy.boss) { ctx.font = '11px JBMono,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = color.cream; ctx.fillText('CRITICAL THREAT', x, y - 64); }
    else if (distance(enemy, player) < 210) { ctx.font = '9px JBMono,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = enemy.kind.color; ctx.fillText(enemy.kind.name, x, y + enemy.r + 15); }
  }
  function drawPlayer() {
    ctx.save(); ctx.translate(Math.round(player.x), Math.round(player.y)); ctx.scale(player.f, 1);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(0, 16, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (player.invincible > 0) { ctx.strokeStyle = player.dashing ? color.gold : 'rgba(201,162,39,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke(); }
    const moving = Object.keys(keys).length || stick;
    const walk = moving ? Math.sin(time * 17) * 3 : 0;
    ctx.fillStyle = '#673447'; ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(8, -6); ctx.lineTo(14, 18); ctx.lineTo(-17, 16 + walk); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#33233F'; ctx.fillRect(-9, -4, 18, 19);
    ctx.fillStyle = '#776176'; ctx.fillRect(-9, -17, 18, 13); ctx.fillRect(-5, -21, 11, 5);
    ctx.fillStyle = player.invincible > 0 && Math.floor(time * 12) % 2 ? '#F2D78A' : color.cream; ctx.fillRect(-3, -13, 12, 8);
    ctx.fillStyle = color.bg; ctx.fillRect(4, -12, 3, 3);
    ctx.fillStyle = color.gold; ctx.fillRect(-10, -17, 20, 3); ctx.fillRect(-8, 4, 17, 3);
    ctx.fillStyle = '#9A8FA3'; ctx.fillRect(-6, 13, 5, 7 + walk); ctx.fillRect(4, 13, 5, 7 - walk);
    ctx.fillStyle = color.gold; ctx.fillRect(11, -1, 3, 15); ctx.fillRect(8, 0, 9, 3);
    ctx.restore();
  }
  function draw() {
    floor();
    if (player) {
      ctx.save(); ctx.translate(w / 2 - player.x, h / 2 - player.y);
      gems.forEach(gem => {
        const tint = gem.heal ? '#D57486' : gem.large ? color.gold : color.blue;
        diamond(gem.x, gem.y + Math.sin(time * 3 + gem.x) * 2, gem.large ? 8 : 5, tint);
        ctx.fillStyle = color.cream; ctx.fillRect(gem.x - 1, gem.y - 2, 2, 2);
      });
      enemies.filter(enemy => enemy.hp > 0).sort((a, b) => a.y - b.y).forEach(drawEnemy);
      if (player.orbit) {
        ctx.strokeStyle = 'rgba(201,162,39,.12)'; ctx.beginPath(); ctx.arc(player.x, player.y, 72, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < Math.min(6, player.orbit); i++) { const a = time * 2.5 + i * Math.PI * 2 / Math.min(6, player.orbit); diamond(player.x + Math.cos(a) * 72, player.y + Math.sin(a) * 72, 10, color.gold); }
      }
      drawPlayer();
      bolts.forEach(bolt => {
        ctx.save(); ctx.translate(bolt.x, bolt.y); ctx.rotate(bolt.angle); ctx.fillStyle = '#685427'; ctx.fillRect(-22, -2, 20, 4); ctx.fillStyle = color.gold; ctx.fillRect(-8, -3, 14, 6); ctx.fillStyle = color.cream; ctx.fillRect(2, -2, 7, 4); ctx.restore();
      });
      effects.filter(effect => effect.type === 'ring').forEach(effect => { ctx.globalAlpha = effect.life / effect.max; ctx.lineWidth = 4; ctx.strokeStyle = color.gold; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * (1 - effect.life / effect.max), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; });
      effects.filter(effect => effect.type === 'disclosure').forEach(effect => { ctx.globalAlpha = Math.min(1, effect.life / .4); ctx.fillStyle = color.cream; ctx.font = '10px JBMono,monospace'; ctx.textAlign = 'center'; ctx.fillText(effect.text, effect.x, effect.y - (1 - effect.life / effect.max) * 24); ctx.globalAlpha = 1; });
      particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.tint; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); }); ctx.globalAlpha = 1;
      ctx.restore();
      effects.filter(effect => effect.type === 'warning').forEach(effect => { ctx.fillStyle = 'rgba(14,10,18,.85)'; ctx.fillRect(0, h * .27 - 24, w, 48); ctx.font = `${w < 500 ? 16 : 21}px Pixel,monospace`; ctx.textAlign = 'center'; ctx.fillStyle = color.gold; ctx.fillText(effect.text, w / 2, h * .27 + 7); });
    }
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .2, w / 2, h / 2, Math.max(w, h) * .65);
    vignette.addColorStop(0, 'rgba(14,10,18,0)'); vignette.addColorStop(1, 'rgba(14,10,18,.78)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
    if (stick && state === 'playing') {
      ctx.strokeStyle = 'rgba(237,230,214,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 42, 0, Math.PI * 2); ctx.stroke();
      const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy) || 1, size = Math.min(34, d);
      ctx.fillStyle = 'rgba(201,162,39,.5)'; ctx.beginPath(); ctx.arc(stick.ox + dx / d * size, stick.oy + dy / d * size, 15, 0, Math.PI * 2); ctx.fill();
    }
  }
  function loop(now) {
    raf = 0;
    if (closed) return;
    const dt = Math.min(.04, Math.max(0, (now - last) / 1000)); last = now;
    if (state === 'playing') update(dt);
    draw();
    if (state === 'playing') raf = requestAnimationFrame(loop);
  }
  $('.g-start').focus();
  raf = requestAnimationFrame(loop);
}
