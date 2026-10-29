type Mob = { id: string; product: string; label: string; sprite: string; cvss: number };
const $ = (id: string) => document.getElementById(id)!;

export function run(data: Mob[]) {
  $('title').hidden = true;
  ['c', 'hud', 'hint'].forEach((i) => ($(i).hidden = false));
  if (matchMedia('(hover: none)').matches) { $('padl').hidden = false; $('padr').hidden = false; $('hint').hidden = true; }
  const c = $('c') as HTMLCanvasElement, x = c.getContext('2d')!;
  let W = 0, H = 0, S = 1; const DPR = Math.min(devicePixelRatio || 1, 2);
  const rs = () => { W = innerWidth; H = innerHeight; c.width = W * DPR; c.height = H * DPR; x.setTransform(DPR, 0, 0, DPR, 0, 0); x.imageSmoothingEnabled = false; S = Math.max(2, Math.min(4, Math.floor(H / 180))); };
  rs(); addEventListener('resize', rs);

  const imgs: Record<string, HTMLImageElement> = {};
  for (const m of data) { const im = new Image(); im.src = `/fx/sprites/${m.sprite}.svg`; imgs[m.sprite] = im; }
  const moon = new Image(); moon.src = '/fx/moon.svg';

  const GAP = 340, LEN = 260 + data.length * GAP + 260;
  const P = { x: 60, vx: 0, face: 1, atk: 0, cd: 0, hurt: 0 };
  const mobs = data.map((m, i) => ({ ...m, x: 260 + i * GAP + GAP / 2, hp: 3, dead: 0, flash: 0, bob: Math.random() * 6 }));
  const keys: Record<string, boolean> = {};
  const pops: { t: number; m: Mob; x: number }[] = [];
  const parts: { x: number; y: number; vx: number; vy: number; l: number }[] = [];
  let gate = 0, done = false, cam = 0, lt = performance.now();

  addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); keys[k] = true; if (k === ' ' || k === 'x' || k === 'j') { attack(); e.preventDefault(); } });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  document.querySelectorAll<HTMLButtonElement>('.pad button').forEach((b) => {
    const k = b.dataset.k!;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (k === 'x') attack(); else keys[k] = true; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { keys[k] = false; }));
  });
  c.addEventListener('pointerdown', () => attack());

  function attack() {
    if (P.cd > 0 || done) return; P.atk = 0.22; P.cd = 0.32;
    const reach = 26 * S;
    for (const m of mobs) {
      if (m.dead) continue;
      const d = (m.x - P.x) * P.face;
      if (d > -6 * S && d < reach + 8 * S) {
        m.hp--; m.flash = 0.12; m.x += P.face * 6 * S;
        for (let i = 0; i < 8; i++) parts.push({ x: m.x, y: -10 * S, vx: (Math.random() - 0.5) * 220 + P.face * 120, vy: -Math.random() * 260, l: 0.6 });
        if (m.hp <= 0) { m.dead = 1; pops.push({ t: 0, m, x: m.x }); }
      }
    }
  }

  const ground = () => H * 0.72;
  function hero(px: number, gy: number) {
    const s = S, step = Math.abs(P.vx) > 1 ? Math.floor(performance.now() / 120) % 2 : 0;
    x.save(); x.translate(px, gy); x.scale(P.face, 1);
    x.fillStyle = '#7A1628'; x.fillRect(-5 * s, -20 * s, 9 * s, 12 * s);           // cape
    x.fillStyle = '#C9A227'; x.fillRect(-4 * s, -19 * s, 8 * s, 10 * s);           // body
    x.fillStyle = '#EDE6D6'; x.fillRect(-3 * s, -26 * s, 7 * s, 7 * s);            // head
    x.fillStyle = '#0E0A12'; x.fillRect(1 * s, -24 * s, 2 * s, 2 * s);             // eye
    x.fillStyle = '#3A2A44';
    x.fillRect(-3 * s, -9 * s, 3 * s, (9 - step * 2) * s); x.fillRect(1 * s, -9 * s, 3 * s, (7 + step * 2) * s); // legs
    if (P.atk > 0) {
      const k = 1 - P.atk / 0.22; x.fillStyle = '#C9A227';
      const len = Math.min(1, k * 2) * 26 * s; x.fillRect(4 * s, -16 * s, len, 2 * s);
      x.fillStyle = '#EDE6D6'; x.fillRect(4 * s + len - 2 * s, -17 * s, 3 * s, 4 * s);
    }
    x.restore();
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - lt) / 1000); lt = now;
    const dir = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    P.vx = dir * 70 * S; if (dir) P.face = dir;
    const block = mobs.find((m) => !m.dead && m.x > P.x);
    let nx = P.x + P.vx * dt;
    if (block && nx > block.x - 12 * S) nx = block.x - 12 * S;
    const allDead = mobs.every((m) => m.dead);
    const gateX = LEN - 120;
    if (!allDead && nx > gateX - 40) nx = gateX - 40;
    P.x = Math.max(20, nx);
    P.atk = Math.max(0, P.atk - dt); P.cd = Math.max(0, P.cd - dt);
    if (allDead) gate = Math.min(1, gate + dt * 0.8);
    if (allDead && P.x > gateX - 30 && gate >= 1 && !done) { done = true; sessionStorage.setItem('introSeen', '1'); setTimeout(() => (location.href = '/#cves'), 500); }
    cam += (Math.min(Math.max(0, P.x - W * 0.35), Math.max(0, LEN - W)) - cam) * 0.12;

    const gy = ground();
    x.fillStyle = '#0E0A12'; x.fillRect(0, 0, W, H);
    // sky + moon (parallax)
    for (let i = 0; i < 60; i++) { const sx = ((i * 97) % 1000) / 1000 * W * 1.5 - cam * 0.05; x.fillStyle = i % 7 ? '#3A2A44' : '#C9A227'; x.fillRect(((sx % W) + W) % W, ((i * 53) % 100) / 100 * gy * 0.7, S, S); }
    if (moon.complete) x.drawImage(moon, W * 0.75 - cam * 0.08, gy * 0.12, 18 * S, 18 * S);
    // far towers
    x.fillStyle = '#160F1C';
    for (let i = 0; i < 14; i++) { const tx = i * 180 - cam * 0.3, th = 60 + ((i * 37) % 90); x.fillRect(tx, gy - th * S * 0.6, 50, th * S * 0.6); x.fillRect(tx + 18, gy - th * S * 0.6 - 30, 14, 30); }
    x.save(); x.translate(-cam, 0);
    // corridor pillars + floor
    for (let px = 0; px < LEN; px += 160) { x.fillStyle = '#1A1220'; x.fillRect(px, gy - 90 * S, 14 * S, 90 * S); x.fillStyle = '#22182A'; x.fillRect(px - 2 * S, gy - 92 * S, 18 * S, 4 * S); }
    x.fillStyle = '#22182A'; x.fillRect(0, gy, LEN, H - gy);
    x.fillStyle = '#3A2A44'; for (let px = 0; px < LEN; px += 16 * S) x.fillRect(px, gy, 14 * S, S);
    // gate
    const gh = 70 * S, open = gate * gh;
    x.fillStyle = '#3A2A44'; x.fillRect(gateX - 8 * S, gy - gh - 10 * S, 50 * S, 10 * S); x.fillRect(gateX - 8 * S, gy - gh, 8 * S, gh); x.fillRect(gateX + 34 * S, gy - gh, 8 * S, gh);
    x.fillStyle = allDead ? '#C9A22722' : '#0E0A12'; x.fillRect(gateX, gy - gh, 34 * S, gh);
    x.fillStyle = '#9A8FA3'; for (let b = 0; b < 5; b++) x.fillRect(gateX + 3 * S + b * 7 * S, gy - gh - open, 2 * S, gh);
    x.fillStyle = '#C9A227'; x.font = `${4 * S}px Pixel, monospace`; x.textAlign = 'center';
    x.fillText(allDead ? 'ENTER ›' : `${mobs.filter((m) => !m.dead).length} LEFT`, gateX + 17 * S, gy - gh - 14 * S);
    // mobs
    for (const m of mobs) {
      if (m.dead) continue; m.flash = Math.max(0, m.flash - dt);
      const im = imgs[m.sprite], sz = 20 * S, by = Math.sin(now / 300 + m.bob) * 2 * S;
      x.globalAlpha = m.flash > 0 ? 0.4 : 1;
      if (im.complete) x.drawImage(im, m.x - sz / 2, gy - sz + by, sz, sz); else { x.fillStyle = '#B0213A'; x.fillRect(m.x - sz / 2, gy - sz, sz, sz); }
      x.globalAlpha = 1;
      x.fillStyle = '#EDE6D6'; x.font = `${3.2 * S}px JBMono, monospace`; x.fillText(m.label, m.x, gy - sz - 4 * S + by);
      x.fillStyle = '#3A2A44'; x.fillRect(m.x - 8 * S, gy - sz - 2 * S + by, 16 * S, S); x.fillStyle = '#B0213A'; x.fillRect(m.x - 8 * S, gy - sz - 2 * S + by, 16 * S * (m.hp / 3), S);
    }
    hero(P.x, gy);
    // particles
    x.fillStyle = '#B0213A';
    for (const p of parts) { p.l -= dt; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.l > 0) x.fillRect(p.x, gy + p.y, S, S); }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].l <= 0) parts.splice(i, 1);
    x.restore();
    // CVE drops (screen space, stacked)
    pops.forEach((p, i) => {
      p.t += dt; const a = Math.min(1, p.t * 4);
      const bw = Math.min(W - 24, 360), bx = 12, byy = 12 + i * (S * 15 + 8);
      x.globalAlpha = a; x.fillStyle = '#1A1220ee'; x.fillRect(bx, byy, bw, S * 15); x.strokeStyle = '#C9A227'; x.lineWidth = 1; x.strokeRect(bx + 0.5, byy + 0.5, bw - 1, S * 15 - 1);
      x.textAlign = 'left'; x.fillStyle = '#C9A227'; x.font = `${3.6 * S}px JBMono, monospace`; x.fillText(`${p.m.id} · CVSS ${p.m.cvss}`, bx + 10, byy + S * 6);
      x.fillStyle = '#EDE6D6'; x.font = `600 ${4 * S}px system-ui, sans-serif`; x.fillText(`${p.m.product} — ${p.m.label}`, bx + 10, byy + S * 12);
      x.globalAlpha = 1;
    });
    if (done) { x.fillStyle = '#0E0A12'; x.globalAlpha = 0.8; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
