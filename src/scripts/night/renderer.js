/**
 * Patch the Night: original pixel artwork and Canvas2D presentation.
 * Every sprite, tile and icon is authored here; there are no remote assets.
 * Simulation stays in engine.js. This module never mutates a run.
 */

const TAU = Math.PI * 2;
const INK = '#0a0810';
const IVORY = '#f0e5ce';
const GOLD = '#d5b461';
const BLOOD = '#b83b59';
const PALETTES = {
  hunter: ['#442536', '#773646', '#b85d66', '#a88969', '#e2c69e', '#d4ad57'],
  researcher: ['#243845', '#3c6270', '#6c9d9e', '#a9957f', '#e6d5b0', '#a4dbd3'],
  operator: ['#28312e', '#405648', '#7b9271', '#8c806c', '#d9c6a1', '#b8d877'],
  reverser: ['#332947', '#57456e', '#9275ad', '#9d807b', '#e4c3ae', '#cca6ee'],
  cryptanalyst: ['#463827', '#796342', '#b39b67', '#9e8171', '#e5cc9f', '#e5cf7e'],
  phantom: ['#24283f', '#444e76', '#818caf', '#7c8c9b', '#c1d9de', '#b9e9ee'],
  xss: ['#493723', '#896c35', '#c4a14b', '#e1c778', '#f2e4b1'],
  sqli: ['#38243e', '#65435f', '#99687b', '#c99aa4', '#f0c5bf'],
  ssrf: ['#1e3248', '#355779', '#6c9aad', '#9acbcc', '#d7f5e4'],
  idor: ['#273a30', '#47684a', '#7e9960', '#b8c78b', '#e6e7b1'],
  auth: ['#49302b', '#805041', '#b87d55', '#e6ab75', '#ffe0a6'],
  race: ['#3b294b', '#6a467f', '#a079af', '#d5b0cc', '#fae0e1'],
  rce: ['#412838', '#754057', '#b95b74', '#e8999e', '#ffe1ce'],
  deser: ['#223a3d', '#3e6967', '#74a191', '#add3a6', '#dfeac3'],
  prototype: ['#3c2d40', '#735366', '#ab7b8b', '#d4a9ad', '#ffe0ca'],
  reaper: ['#242538', '#44445f', '#78748e', '#b4a4b9', '#e8d8df'],
};
const STAGE = {
  cathedral: { ground: '#15131c', stone: '#1b1823', light: '#24202c', edge: '#302837', accent: '#8f784a', glow: '#f0b968' },
  library: { ground: '#15151a', stone: '#1c1d23', light: '#27272c', edge: '#333139', accent: '#638884', glow: '#8dd6c4' },
  foundry: { ground: '#191416', stone: '#231c1c', light: '#302524', edge: '#42302a', accent: '#a16440', glow: '#f2a15f' },
  void: { ground: '#10121d', stone: '#171b2a', light: '#20263b', edge: '#30324c', accent: '#8c76ac', glow: '#c4a9ee' },
  spire: { ground: '#121823', stone: '#1a2330', light: '#263443', edge: '#3a4755', accent: '#9b916f', glow: '#bbdfeb' },
};
const INVERSE_STAGE = {
  cathedral: { ...STAGE.cathedral, ground: '#151622', accent: '#8c829e', glow: '#d1c0ef', tint: '#687ba2' },
  library: { ...STAGE.library, ground: '#1a1320', accent: '#a28078', glow: '#efbfaf', tint: '#986780' },
  foundry: { ...STAGE.foundry, ground: '#101a21', accent: '#648d9b', glow: '#a6e7e5', tint: '#538da2' },
  void: { ...STAGE.void, ground: '#1c151c', accent: '#a68d65', glow: '#ecd7a1', tint: '#aa775b' },
  spire: { ...STAGE.spire, ground: '#201622', accent: '#b495a2', glow: '#ebcfde', tint: '#9a6d90' },
};
const WEAPON_COLORS = {
  whip: '#e5bb64', knife: '#d3e1e4', wand: '#a2d9eb', orbit: '#d9ba79', pool: '#80cbaa',
  rune: '#b8a3e6', lightning: '#c4e9fc', axe: '#e0b4b5', cross: '#b6e3cb', pentagram: '#d99bd5',
  fireball: '#f8b66e', birds: '#d4d6ff', scythe: '#c8a2e0', bolt: '#f7a28e',
  aegis: '#acd8cf', lancet: '#afdce8',
};
const THREAT_CLASS = { xss: 'XSS', sqli: 'SQLi', ssrf: 'SSRF', idor: 'IDOR', auth: 'AUTH', race: 'TOCTOU', rce: 'RCE', deser: 'DESER', prototype: 'PROTO', reaper: 'RING 0' };

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const fract = value => value - Math.floor(value);
const hash = (x, y, seed = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123);
const px = (context, color, x, y, w = 1, h = 1) => { context.fillStyle = color; context.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function mapTargets(run) {
  const targets = (run.pickups || []).filter(item => ['relic', 'coffin', 'merchant'].includes(item.kind));
  if (run.objective && run.objective.state !== 'rescued' && !targets.some(item => item.kind === 'coffin')) targets.push({ ...run.objective, kind: 'coffin' });
  for (const item of run.stageItems || []) if (!item.collected && item.state !== 'collected') targets.push({ ...item, kind: 'stageitem' });
  if (!run.arsenalCollected) targets.push(...(run.pickups || []).filter(item => item.kind === 'arsenal'));
  targets.push(...(run.pickups || []).filter(item => item.kind === 'chest'));
  return targets;
}

function surface(width, height) {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

function inversePlate(source, tint) {
  const canvas = surface(source.width, source.height), c = canvas.getContext('2d');
  c.translate(source.width, 0); c.scale(-1, 1); c.drawImage(source, 0, 0);
  c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .19; c.fillStyle = tint; c.fillRect(0, 0, source.width, source.height);
  return canvas;
}

function poly(context, color, points) {
  context.fillStyle = color; context.beginPath();
  points.forEach(([x, y], index) => { if (index) context.lineTo(x, y); else context.moveTo(x, y); });
  context.closePath(); context.fill();
}

function line(context, color, points, width = 1) {
  context.strokeStyle = color; context.lineWidth = width; context.lineJoin = 'miter'; context.lineCap = 'square';
  context.beginPath(); points.forEach(([x, y], index) => { if (index) context.lineTo(x, y); else context.moveTo(x, y); }); context.stroke();
}

function circle(context, color, x, y, radius, width = 1) {
  context.strokeStyle = color; context.lineWidth = width; context.beginPath(); context.arc(x, y, Math.max(.1, radius), 0, TAU); context.stroke();
}

function pixelDisc(context, color, x, y, radius) {
  context.fillStyle = color;
  for (let row = -Math.ceil(radius); row <= Math.ceil(radius); row++) {
    const span = Math.floor(Math.sqrt(Math.max(0, radius * radius - row * row)));
    context.fillRect(Math.round(x - span), Math.round(y + row), span * 2 + 1, 1);
  }
}

function pixelRing(context, color, x, y, radius, innerRadius = 0) {
  if (innerRadius <= 0) { pixelDisc(context, color, x, y, radius); return; }
  context.fillStyle = color;
  for (let row = -Math.ceil(radius); row <= Math.ceil(radius); row++) {
    const outside = Math.floor(Math.sqrt(Math.max(0, radius * radius - row * row)));
    const inside = Math.abs(row) < innerRadius ? Math.ceil(Math.sqrt(innerRadius * innerRadius - row * row)) : 0;
    if (!inside) context.fillRect(Math.round(x - outside), Math.round(y + row), outside * 2 + 1, 1);
    else {
      context.fillRect(Math.round(x - outside), Math.round(y + row), Math.max(0, outside - inside + 1), 1);
      context.fillRect(Math.round(x + inside), Math.round(y + row), Math.max(0, outside - inside + 1), 1);
    }
  }
}

function star(context, color, x, y, size = 3) {
  px(context, color, x, y - size, 1, size * 2 + 1); px(context, color, x - size, y, size * 2 + 1, 1);
  if (size > 3) { px(context, color, x - 1, y - 1, 3, 3); }
}

function diamond(context, color, x, y, radius) {
  poly(context, color, [[x, y - radius], [x + radius, y], [x, y + radius], [x - radius, y]]);
}

/** A 40 × 48 character sheet, with four independently drawn walk frames. */
function characterSprite(id, frame = 0) {
  const canvas = surface(40, 48), c = canvas.getContext('2d');
  const p = PALETTES[id] || PALETTES.hunter;
  const step = [0, 2, 0, -2][frame % 4], bob = frame % 2;
  // Silhouette and the scalloped outside of the travelling coat.
  poly(c, INK, [[12, 17], [27, 16], [32, 27], [35, 41 + bob], [26, 40], [21, 43], [14, 40], [5, 42], [9, 27]]);
  poly(c, p[0], [[12, 18], [26, 17], [30, 27], [33, 39], [26, 37], [21, 41], [16, 38], [8, 40], [11, 27]]);
  poly(c, p[1], [[14, 19], [23, 18], [24, 29], [29, 38], [23, 36], [20, 38], [14, 34], [10, 38]]);
  line(c, p[2], [[12, 22], [11, 31], [9, 37]]); line(c, p[2], [[24, 23], [26, 32], [30, 36]]);
  // Boots and split coat: leg articulation gives motion without blurry scaling.
  px(c, INK, 14, 33, 6, 12 + step); px(c, INK, 22, 33, 6, 12 - step);
  px(c, '#41414e', 15, 33, 4, 10 + step); px(c, '#60616b', 22, 33, 4, 10 - step);
  px(c, '#85808a', 16, 35, 1, 6 + step); px(c, '#a49690', 23, 34, 1, 6 - step);
  px(c, '#18141f', 12, 43 + step, 8, 3); px(c, '#191720', 22, 43 - step, 8, 3);
  px(c, p[5], 13, 43 + step, 5, 1); px(c, p[5], 24, 43 - step, 4, 1);
  // Fitted vest, asymmetric shoulder armor and crossed leather straps.
  px(c, INK, 14, 18, 13, 17); px(c, '#30303e', 15, 19, 10, 14);
  px(c, p[2], 15, 20, 3, 12); px(c, p[0], 19, 21, 4, 12);
  line(c, p[3], [[15, 20], [24, 31]], 2); px(c, '#423326', 14, 30, 13, 4); px(c, p[5], 20, 30, 3, 3); px(c, INK, 21, 31);
  px(c, p[1], 10, 20 + bob, 5, 8); px(c, p[2], 11, 20 + bob, 4, 3); px(c, '#b7a89b', 11, 21 + bob, 2, 1);
  px(c, p[1], 27, 21 - bob, 4, 9); px(c, p[4], 29, 28 - bob, 3, 4);
  px(c, p[4], 10, 27 + bob, 4, 5); px(c, p[3], 10, 31 + bob, 4, 2);
  // Hair, face and a very small readable eye.
  px(c, INK, 14, 6 + bob, 14, 14); px(c, '#30232b', 15, 6 + bob, 12, 12);
  px(c, p[3], 18, 10 + bob, 9, 9); px(c, p[4], 20, 10 + bob, 7, 7); px(c, p[3], 23, 16 + bob, 4, 3);
  px(c, INK, 24, 12 + bob, 3, 2); px(c, IVORY, 25, 12 + bob);
  px(c, p[0], 15, 8 + bob, 6, 9); px(c, p[1], 16, 7 + bob, 3, 6);
  if (id === 'hunter') {
    // Broad, torn-brim hat; coiled silver payload lash.
    poly(c, INK, [[14, 6 + bob], [17, 1 + bob], [25, 2 + bob], [29, 9 + bob], [33, 12 + bob], [9, 12 + bob], [7, 10 + bob]]);
    poly(c, p[1], [[15, 6 + bob], [18, 2 + bob], [24, 3 + bob], [27, 9 + bob], [11, 10 + bob]]);
    px(c, p[5], 15, 8 + bob, 13, 2); px(c, '#d7b18b', 17, 9 + bob, 9, 1);
    line(c, '#806a55', [[31, 29], [34, 32], [35, 36], [33, 40], [29, 40], [27, 37], [29, 34], [33, 35]]);
    px(c, p[5], 30, 26, 2, 7); px(c, IVORY, 29, 26, 4, 1);
  } else if (id === 'researcher') {
    // Spectacles, scholar's hood, gilded open grimoire.
    poly(c, p[1], [[12, 14], [12, 6], [17, 2], [24, 3], [29, 9], [28, 16], [26, 8], [19, 7], [16, 14]]);
    px(c, p[2], 13, 6, 2, 7); px(c, p[5], 22, 11 + bob, 3, 3); px(c, p[5], 26, 11 + bob, 3, 3); px(c, INK, 23, 12 + bob); px(c, INK, 27, 12 + bob);
    poly(c, '#795645', [[27, 23], [33, 21], [38, 23], [36, 34], [31, 32], [27, 34]]);
    poly(c, '#d1bd94', [[28, 23], [32, 23], [32, 31], [28, 32]]); poly(c, '#f0ddba', [[33, 23], [37, 24], [35, 32], [33, 31]]);
    line(c, '#8e805e', [[29, 25], [31, 25]]); line(c, '#8e805e', [[34, 26], [36, 26]]);
  } else if (id === 'operator') {
    // Hood, segmented respirator and a hooked throwing blade.
    poly(c, p[0], [[12, 17], [12, 7], [16, 2], [24, 2], [29, 7], [30, 17], [25, 16], [26, 8], [17, 8], [16, 17]]);
    line(c, p[2], [[13, 15], [14, 7], [18, 3], [23, 3]]); px(c, '#313f36', 20, 14, 9, 5); px(c, p[5], 21, 14, 7, 1); px(c, '#8c9e89', 23, 16, 2, 2);
    poly(c, '#c4d2cd', [[33, 19], [35, 28], [34, 32], [31, 29], [31, 25]]); px(c, '#6b8680', 31, 29, 4, 5); px(c, p[5], 30, 29, 6, 1);
    px(c, '#a0a895', 16, 26, 6, 2); px(c, INK, 17, 26, 1, 2);
  } else if (id === 'reverser') {
    // Silver half mask and two-pronged resonant staff.
    px(c, '#9189a6', 21, 9 + bob, 7, 8); px(c, '#d5ccdb', 23, 9 + bob, 5, 5); px(c, INK, 24, 12 + bob, 4, 2);
    px(c, p[0], 15, 5, 11, 4); px(c, p[2], 17, 3, 8, 3); px(c, p[5], 17, 5, 1, 3);
    px(c, '#80607d', 33, 11, 2, 32); px(c, p[5], 34, 13, 1, 28);
    line(c, '#b6a6cf', [[31, 10], [29, 6], [31, 2], [33, 3], [32, 7], [34, 10], [37, 6], [36, 2]], 2);
    pixelDisc(c, '#b28be0', 34, 7, 2); px(c, IVORY, 34, 6);
  } else if (id === 'cryptanalyst') {
    // Brass astrolabe, turban and runic stole.
    poly(c, p[1], [[12, 11], [13, 5], [18, 2], [26, 3], [29, 8], [28, 11]]);
    line(c, p[5], [[14, 6], [20, 9], [28, 6]], 2); px(c, '#f4e1a5', 18, 3, 7, 1); px(c, p[2], 12, 10, 17, 2);
    px(c, p[5], 16, 19, 3, 13); px(c, p[5], 24, 20, 2, 10); px(c, INK, 17, 22); px(c, INK, 17, 26); px(c, INK, 25, 25);
    circle(c, '#dec78c', 33, 24, 5); circle(c, '#9b7c43', 33, 24, 3); line(c, '#efe1ad', [[29, 27], [37, 21]]); px(c, '#faf0c9', 33, 23, 1, 3);
  } else {
    // Wraith veil, porcelain mask, spectral cape ribbons.
    poly(c, p[0], [[11, 18], [12, 6], [19, 1], [27, 4], [30, 15], [27, 21], [24, 8], [18, 8], [16, 18]]);
    line(c, p[2], [[13, 13], [14, 7], [19, 3], [25, 5]]); px(c, p[4], 21, 9, 7, 9); px(c, INK, 23, 12, 2, 2); px(c, INK, 27, 12); px(c, p[2], 24, 16, 3, 1);
    poly(c, p[2], [[8, 30], [7, 40], [3, 45], [7, 44], [12, 35]]); poly(c, p[1], [[29, 29], [34, 39], [39, 42], [35, 43], [30, 38]]);
    line(c, p[5], [[33, 22], [31, 27], [33, 32]]); star(c, '#e3fdff', 33, 22, 2);
  }
  return canvas;
}

/** Monsters use hand-shaped silhouettes, not recolored placeholder geometry. */
function enemySprite(id, frame = 0, variant = '') {
  const canvas = surface(56, 56), c = canvas.getContext('2d');
  const p = PALETTES[id] || PALETTES.xss;
  const foot = [0, 2, 0, -2][frame % 4], bob = frame % 2;
  const eye = variant === 'boss' ? '#fff3d5' : '#fff1bb';
  c.translate(4, 3);
  if (id === 'xss') {
    // Script imp: bracket horns, jagged ears, sneer, forked payload tail.
    line(c, INK, [[32, 30], [41, 30], [44, 24], [41, 20], [44, 16]], 4);
    line(c, p[1], [[32, 30], [41, 30], [44, 24], [41, 20], [44, 16]], 2); poly(c, p[3], [[41, 16], [45, 12], [46, 19]]);
    poly(c, INK, [[15, 18], [10, 10], [12, 2], [18, 3], [16, 9], [20, 13], [28, 12], [33, 6], [32, 2], [38, 3], [39, 12], [34, 19], [37, 27], [33, 36], [15, 36], [11, 27]]);
    poly(c, p[1], [[16, 18], [12, 10], [13, 4], [16, 4], [14, 10], [20, 16], [28, 15], [35, 8], [34, 4], [37, 5], [37, 11], [31, 20], [34, 28], [30, 34], [17, 33], [14, 26]]);
    poly(c, p[2], [[18, 17], [29, 17], [32, 25], [28, 30], [18, 30], [15, 25]]);
    poly(c, p[0], [[15, 21], [6, 17], [10, 25], [17, 27]]); poly(c, p[2], [[31, 21], [41, 17], [37, 25], [31, 26]]);
    px(c, p[0], 17, 32, 6, 9 + foot); px(c, p[1], 27, 32, 6, 9 - foot); px(c, p[3], 14, 40 + foot, 9, 2); px(c, p[3], 27, 40 - foot, 9, 2);
    px(c, INK, 17, 20, 6, 4); px(c, INK, 27, 19, 6, 4); px(c, eye, 19, 21, 3, 2); px(c, eye, 28, 20, 3, 2);
    line(c, p[0], [[19, 27], [24, 29], [30, 26]], 2); px(c, '#f4e1b7', 21, 27, 2, 3); px(c, '#f4e1b7', 28, 26, 2, 3); px(c, p[3], 24, 17, 3, 2);
    poly(c, INK, [[12, 28], [7, 31], [6, 37], [10, 38], [12, 33], [16, 34]]); px(c, p[2], 8, 32, 3, 4); px(c, p[4], 7, 35, 4, 1);
  } else if (id === 'sqli') {
    // Massive database golem: cylindrical plates, glowing query fissures.
    px(c, INK, 10, 10, 29, 28); px(c, p[0], 11, 10, 27, 25); px(c, p[1], 13, 9, 24, 27);
    for (let row = 0; row < 3; row++) {
      const y = 10 + row * 9;
      poly(c, p[2], [[12, y], [18, y - 2], [32, y - 2], [38, y], [36, y + 4], [17, y + 4], [12, y + 2]]);
      px(c, p[0], 12, y + 5, 26, 2); px(c, p[3], 16, y, 16, 1); px(c, p[1], 35, y + 2, 3, 3);
    }
    poly(c, INK, [[9, 18], [3, 20], [1, 30], [5, 36], [12, 33], [14, 24]]); poly(c, p[1], [[8, 20], [5, 22], [4, 30], [7, 33], [11, 31], [12, 24]]);
    poly(c, INK, [[38, 17], [44, 19], [47, 29], [43, 35], [37, 32], [35, 24]]); poly(c, p[2], [[39, 20], [43, 21], [45, 29], [42, 32], [38, 30]]);
    px(c, p[0], 15, 34, 9, 10 + foot); px(c, p[1], 28, 34, 9, 10 - foot); px(c, p[3], 15, 42 + foot, 9, 2); px(c, p[3], 28, 42 - foot, 10, 2);
    px(c, INK, 17, 13, 7, 5); px(c, INK, 27, 13, 7, 5); px(c, eye, 19, 15, 4, 2); px(c, eye, 28, 15, 4, 2);
    line(c, p[4], [[24, 23], [22, 26], [25, 28], [23, 32]]); px(c, p[3], 5, 24, 3, 2); px(c, p[4], 41, 27, 2, 3);
    px(c, '#283529', 16, 5, 17, 4); px(c, p[2], 17, 4, 14, 2); px(c, '#819672', 18, 5, 2, 1); px(c, '#c3d2a7', 28, 5, 2, 1);
  } else if (id === 'ssrf') {
    // Request bat: ragged web wings, long ears, jewel abdomen.
    const wing = frame % 2 ? -5 : 3;
    poly(c, INK, [[20, 21], [10, 10 + wing], [0, 9 + wing], [3, 20], [0, 30], [9, 25], [12, 33], [20, 29]]);
    poly(c, p[1], [[20, 23], [10, 13 + wing], [2, 11 + wing], [6, 21], [3, 27], [10, 23], [13, 29], [21, 27]]);
    line(c, p[3], [[19, 23], [10, 16 + wing], [3, 13 + wing]]); line(c, p[2], [[16, 24], [11, 20], [8, 24]]);
    poly(c, INK, [[28, 21], [38, 10 + wing], [48, 9 + wing], [45, 20], [48, 30], [39, 25], [36, 33], [28, 29]]);
    poly(c, p[1], [[28, 23], [38, 13 + wing], [46, 11 + wing], [42, 21], [45, 27], [38, 23], [35, 29], [27, 27]]);
    line(c, p[3], [[29, 23], [38, 16 + wing], [45, 13 + wing]]); line(c, p[2], [[32, 24], [37, 20], [40, 24]]);
    poly(c, INK, [[18, 18], [17, 7], [23, 13], [27, 13], [33, 7], [31, 21], [32, 30], [25, 39], [18, 31]]);
    poly(c, p[2], [[20, 19], [19, 11], [23, 16], [27, 16], [31, 11], [29, 22], [30, 30], [25, 36], [20, 30]]);
    px(c, p[0], 20, 20, 5, 3); px(c, p[0], 26, 20, 5, 3); px(c, eye, 21, 21, 3, 1); px(c, eye, 27, 21, 3, 1);
    px(c, IVORY, 23, 25, 1, 3); px(c, IVORY, 27, 25, 1, 3); diamond(c, p[4], 25, 31, 3); px(c, '#eefbff', 24, 29);
  } else if (id === 'idor') {
    // Masked key thief: a stolen identity suspended in a moss-green cloak.
    poly(c, INK, [[14, 13], [16, 6], [24, 2], [33, 7], [35, 17], [32, 24], [39, 42], [30, 40], [23, 44], [15, 39], [7, 42], [12, 25]]);
    poly(c, p[0], [[16, 13], [18, 7], [24, 4], [31, 8], [33, 17], [29, 25], [36, 40], [28, 38], [23, 42], [16, 36], [10, 39], [15, 24]]);
    poly(c, p[1], [[17, 18], [24, 16], [30, 20], [28, 29], [32, 36], [24, 37], [17, 32], [14, 36]]);
    poly(c, '#ddd5bb', [[19, 10 + bob], [29, 10 + bob], [31, 17 + bob], [27, 24 + bob], [22, 23 + bob], [18, 17 + bob]]);
    px(c, '#f6ecd5', 20, 11 + bob, 6, 6); px(c, '#928c78', 27, 12 + bob, 2, 8); px(c, INK, 20, 15 + bob, 4, 2); px(c, INK, 27, 15 + bob, 3, 2); px(c, p[1], 23, 20 + bob, 4, 1);
    line(c, p[2], [[16, 22], [13, 32], [12, 36]]); line(c, p[2], [[30, 25], [32, 32], [34, 37]]);
    circle(c, '#c5a35c', 38, 26, 4, 2); px(c, '#dcca86', 37, 30, 2, 11); px(c, '#dcca86', 38, 36, 5, 2); px(c, '#e7d59b', 38, 40, 4, 2); px(c, p[3], 30, 28, 6, 3);
  } else if (id === 'auth') {
    // Credential sentinel: server-rack armor, lock helm, portcullis shield.
    poly(c, INK, [[12, 15], [15, 8], [15, 2], [20, 5], [28, 5], [33, 1], [34, 10], [37, 17], [34, 35], [13, 35]]);
    poly(c, p[1], [[15, 15], [17, 9], [17, 5], [20, 8], [28, 8], [32, 5], [32, 11], [34, 17], [32, 33], [15, 33]]);
    px(c, p[3], 18, 9, 13, 2); px(c, p[0], 17, 13, 16, 8); px(c, '#dfbf81', 19, 15, 12, 2); px(c, '#fff2bf', 21, 15, 3, 1); px(c, INK, 25, 15, 3, 3);
    poly(c, p[2], [[15, 21], [32, 21], [30, 34], [17, 34]]); px(c, p[3], 18, 22, 11, 2); px(c, p[0], 20, 25, 8, 8);
    for (let i = 0; i < 3; i++) { px(c, '#a28066', 21, 26 + i * 2, 6, 1); px(c, '#ffd799', 27, 26 + i * 2); }
    px(c, INK, 15, 34, 9, 10 + foot); px(c, INK, 27, 34, 9, 10 - foot); px(c, p[1], 16, 35, 6, 8 + foot); px(c, p[2], 28, 35, 6, 8 - foot); px(c, p[3], 14, 42 + foot, 9, 2); px(c, p[3], 28, 42 - foot, 9, 2);
    poly(c, INK, [[1, 20], [13, 17], [17, 23], [15, 37], [8, 44], [1, 37]]); poly(c, p[1], [[3, 21], [12, 20], [15, 24], [13, 36], [8, 41], [3, 36]]);
    line(c, p[3], [[4, 23], [8, 22], [12, 23], [11, 35], [8, 38], [5, 35]]); px(c, p[0], 6, 26, 5, 7); px(c, '#e5c98a', 8, 27, 1, 5);
    px(c, '#575159', 40, 13, 2, 29); px(c, p[3], 38, 21, 6, 3); poly(c, '#dad8d4', [[39, 14], [39, 4], [42, 1], [44, 5], [42, 14]]);
  } else if (id === 'race') {
    // Two desynchronized wraiths; scythes never quite agree on the same tick.
    for (let twin = 0; twin < 2; twin++) {
      const x = twin * 13, y = twin ? bob * 3 + 3 : -bob;
      poly(c, INK, [[9 + x, 12 + y], [15 + x, 5 + y], [23 + x, 10 + y], [22 + x, 25 + y], [28 + x, 39 + y], [20 + x, 36 + y], [15 + x, 42 + y], [8 + x, 38 + y], [10 + x, 27 + y]]);
      poly(c, twin ? p[1] : p[0], [[11 + x, 13 + y], [16 + x, 8 + y], [21 + x, 12 + y], [20 + x, 26 + y], [25 + x, 37 + y], [18 + x, 34 + y], [15 + x, 38 + y], [10 + x, 36 + y], [13 + x, 26 + y]]);
      px(c, p[3], 13 + x, 13 + y, 7, 6); px(c, INK, 14 + x, 15 + y, 2, 2); px(c, INK, 18 + x, 15 + y, 2, 2);
      line(c, p[2], [[12 + x, 22 + y], [15 + x, 28 + y], [13 + x, 33 + y]]);
    }
    line(c, '#7b6b80', [[7, 14], [3, 43]], 2); poly(c, '#c9c4d4', [[7, 13], [16, 8], [24, 10], [17, 10], [10, 16]]);
    line(c, '#a08da5', [[39, 16], [43, 44]], 2); poly(c, '#e0d2db', [[39, 15], [30, 10], [23, 12], [30, 12], [37, 18]]);
  } else if (id === 'rce') {
    // An eldritch terminal shell: ribbed carapace and many typing hands.
    for (let i = 0; i < 4; i++) {
      const y = 19 + i * 5, wobble = (i + frame) % 2 ? 2 : -2;
      line(c, INK, [[15, y], [6, y - 3], [2, y + wobble], [4, y + 4]], 4); line(c, p[1], [[15, y], [6, y - 3], [2, y + wobble], [4, y + 4]], 2);
      line(c, INK, [[33, y], [41, y - 3], [46, y + wobble], [43, y + 4]], 4); line(c, p[2], [[33, y], [41, y - 3], [46, y + wobble], [43, y + 4]], 2);
    }
    poly(c, INK, [[13, 12], [19, 5], [30, 5], [36, 13], [35, 34], [30, 42], [19, 42], [12, 35]]);
    poly(c, p[1], [[15, 13], [20, 7], [29, 7], [34, 14], [33, 33], [29, 40], [20, 40], [14, 34]]);
    for (let row = 0; row < 4; row++) { line(c, p[2], [[15, 19 + row * 5], [20, 17 + row * 5], [30, 17 + row * 5], [34, 19 + row * 5]], 2); }
    px(c, INK, 17, 11, 15, 13); px(c, '#182621', 18, 12, 13, 10); line(c, '#a9eeaa', [[20, 14], [23, 16], [20, 18]], 1); px(c, '#d9ffd1', 25, 19, 4, 1);
    poly(c, p[0], [[19, 29], [29, 29], [31, 35], [28, 39], [21, 38], [18, 34]]); px(c, '#e0b5aa', 20, 30, 2, 4); px(c, '#e0b5aa', 25, 30, 2, 3); px(c, '#e0b5aa', 28, 34, 2, 3);
    line(c, p[3], [[17, 10], [18, 6], [24, 4], [29, 6]]); px(c, p[4], 21, 7, 2, 1);
  } else if (id === 'deser') {
    // Serialized reliquary cracked open around a tentacled green horror.
    for (let i = 0; i < 5; i++) {
      const x = 9 + i * 7, sway = Math.sin(frame * Math.PI / 2 + i) * 3;
      line(c, INK, [[24, 24], [x, 34], [x + sway, 43], [x - 4, 46]], 5);
      line(c, i % 2 ? p[1] : p[2], [[24, 25], [x, 34], [x + sway, 42], [x - 4, 45]], 3);
      px(c, p[3], x - 1, 36, 1, 2); px(c, p[3], x + sway - 1, 41, 1, 2);
    }
    poly(c, INK, [[11, 11], [24, 4], [37, 10], [38, 28], [24, 35], [10, 28]]);
    poly(c, '#60524a', [[12, 12], [24, 6], [36, 11], [36, 27], [24, 33], [12, 27]]);
    poly(c, '#9b8462', [[13, 12], [24, 7], [34, 12], [24, 18]]); poly(c, '#4a403f', [[13, 14], [23, 19], [23, 31], [13, 26]]); poly(c, '#76644d', [[25, 19], [35, 13], [35, 26], [25, 31]]);
    line(c, '#bea574', [[13, 15], [21, 19], [21, 28]]); line(c, '#bea574', [[27, 20], [33, 17], [33, 24]]);
    poly(c, p[0], [[15, 9], [17, 5], [24, 2], [31, 5], [34, 11], [30, 20], [23, 22], [17, 19]]);
    poly(c, p[2], [[18, 10], [19, 6], [24, 4], [29, 6], [31, 11], [28, 18], [23, 20], [19, 17]]);
    pixelDisc(c, '#e3d9ad', 24, 11, 4); pixelDisc(c, p[0], 25, 11, 2); px(c, '#f8f6df', 23, 9, 2, 2);
    line(c, p[3], [[19, 15], [22, 17], [28, 15]]);
  } else if (id === 'prototype') {
    // A mimic chest whose inheritance has grown teeth, eyes and legs.
    const open = frame % 2 ? 2 : 0;
    for (let i = 0; i < 4; i++) { const x = 9 + i * 9; line(c, INK, [[x, 31], [x - 3 + foot, 39], [x + 2, 43]], 5); line(c, p[1], [[x, 31], [x - 3 + foot, 39], [x + 2, 43]], 3); px(c, p[3], x, 41, 4, 1); }
    poly(c, INK, [[5, 19], [10, 10 - open], [38, 10 - open], [44, 19], [43, 35], [5, 35]]);
    px(c, p[1], 7, 21, 35, 12); px(c, '#514030', 9, 23, 31, 9); px(c, '#80603f', 12, 24, 25, 7);
    poly(c, p[2], [[7, 18 - open], [12, 12 - open], [36, 12 - open], [42, 18 - open]]);
    px(c, '#b2a078', 11, 12 - open, 4, 7); px(c, '#b2a078', 34, 12 - open, 4, 7); px(c, '#c3ac73', 8, 29, 4, 4); px(c, '#c3ac73', 36, 29, 4, 4);
    px(c, '#100e16', 8, 19 - open, 33, 7 + open); for (let i = 0; i < 7; i++) { poly(c, '#e8d6b3', [[10 + i * 4, 19 - open], [13 + i * 4, 19 - open], [11 + i * 4, 25 - open]]); }
    for (let i = 0; i < 6; i++) { poly(c, '#b8ab97', [[12 + i * 4, 26], [15 + i * 4, 26], [14 + i * 4, 23]]); }
    line(c, '#bc687b', [[23, 24], [24, 30], [29, 32], [31, 30]], 3); px(c, '#e69a9e', 24, 26, 1, 4);
    pixelDisc(c, p[0], 18, 13 - open, 3); pixelDisc(c, p[0], 30, 13 - open, 3); px(c, eye, 17, 12 - open, 2, 2); px(c, eye, 29, 12 - open, 2, 2);
  } else {
    // The final reaper: skeletal porcelain, a torn constellation cloak.
    poly(c, INK, [[15, 13], [17, 5], [25, 1], [34, 6], [36, 16], [32, 26], [39, 46], [30, 42], [24, 48], [18, 42], [9, 46], [14, 26]]);
    poly(c, p[0], [[17, 13], [19, 6], [25, 3], [32, 7], [34, 16], [30, 27], [36, 43], [29, 39], [24, 45], [19, 39], [12, 42], [17, 26]]);
    line(c, p[2], [[18, 15], [20, 8], [25, 5], [30, 8]]); poly(c, p[1], [[17, 24], [23, 27], [26, 26], [31, 24], [29, 33], [33, 40], [25, 38], [20, 39], [16, 37]]);
    poly(c, '#dfd7cb', [[20, 10 + bob], [29, 10 + bob], [31, 15 + bob], [28, 22 + bob], [22, 22 + bob], [19, 16 + bob]]);
    px(c, '#9e95a3', 28, 12 + bob, 2, 7); px(c, INK, 20, 14 + bob, 4, 3); px(c, INK, 26, 14 + bob, 4, 3); px(c, eye, 22, 15 + bob); px(c, eye, 27, 15 + bob); px(c, INK, 24, 18 + bob, 2, 2);
    for (let i = 0; i < 3; i++) px(c, INK, 22 + i * 2, 21 + bob, 1, 2);
    line(c, '#aaa1b2', [[34, 20], [43, 25], [43, 43]], 2); px(c, '#e6d9ce', 35, 26, 6, 2);
    line(c, '#8e7b6c', [[42, 5], [43, 46]], 2); poly(c, '#b8b9d1', [[42, 6], [36, 3], [24, 4], [14, 10], [8, 19], [17, 11], [28, 7], [38, 8], [43, 11]]); line(c, '#f0e6e1', [[41, 6], [34, 4], [25, 5], [17, 9]]);
    px(c, p[3], 17, 32); px(c, p[3], 28, 35); px(c, p[3], 22, 30); px(c, p[3], 31, 39);
  }
  if (variant === 'elite' || variant === 'boss') {
    // A separate readable silhouette for high priority threats.
    const y = id === 'ssrf' ? 4 : 0;
    poly(c, INK, [[14, y + 7], [12, y], [19, y + 3], [24, y - 2], [29, y + 3], [36, y], [33, y + 8]]);
    poly(c, variant === 'boss' ? '#d5b06a' : '#a8c9be', [[16, y + 6], [15, y + 2], [20, y + 5], [24, y + 1], [28, y + 5], [33, y + 2], [31, y + 6]]);
    px(c, variant === 'boss' ? '#f8e1aa' : '#e6ffff', 23, y + 3, 2, 2);
  }
  return canvas;
}

/** The privileged process wears a vaulted wing-cloak; only twelve phase frames exist. */
function finalBossSprite(frame = 0, phase = 0) {
  const canvas = surface(96, 100), c = canvas.getContext('2d');
  const spread = [0, 3, 1, -2][frame % 4], p = phase > 1 ? ['#3c263b', '#70405b', '#c38599', '#f1c0ba'] : ['#27283d', '#494563', '#93839d', '#e7d4c2'];
  // Uneven leaded wings resemble ruined chapel windows, not a creature hitbox.
  for (const side of [-1, 1]) {
    c.save(); c.translate(48, 40); c.scale(side, 1);
    poly(c, INK, [[-2, 0], [9, -10], [21, -21-spread], [39, -32-spread], [44, -29-spread], [42, -12], [35, -3], [38, 11], [29, 9], [26, 25], [17, 19], [10, 34], [3, 20]]);
    poly(c, p[0], [[0, 1], [10, -8], [22, -18-spread], [41, -29-spread], [38, -12], [32, -4], [34, 7], [26, 5], [23, 20], [16, 15], [9, 28], [5, 16]]);
    line(c, p[1], [[3, 6], [14, -6], [28, -17-spread], [41, -29-spread]], 2);
    line(c, p[2], [[5, 10], [15, 0], [30, -7], [38, -13]], .8);
    for (let n = 0; n < 3; n++) {
      const x = 12+n*8, y = -1-n*6;
      line(c, p[1], [[x, y-7], [x+3, y+6], [x-2, y+14]], 1);
      diamond(c, n === phase ? p[3] : p[2], x+1, y+2, 1.4);
    }
    c.restore();
  }
  circle(c, '#7b685e', 48, 20, 14, .8); circle(c, '#574451', 48, 20, 18, .6);
  for (let n = 0; n < 7; n++) {
    const a = -Math.PI + n*Math.PI/6;
    line(c, p[2], [[48+Math.cos(a)*20,20+Math.sin(a)*20],[48+Math.cos(a)*24,20+Math.sin(a)*24]], 1);
  }
  // The original skeletal scholar stays central and clearly separate from the wings.
  c.drawImage(enemySprite('reaper', frame, 'boss'), 20, 13, 56, 70);
  for (let n = 0; n < 5; n++) {
    const x = 36+n*6, y = 76 + (n%2)*6 + (frame%2);
    poly(c, p[0], [[x-3,65],[x+4,66],[x+2,y],[x-2,y+7],[x-4,y-1]]);
    line(c, p[2], [[x,68],[x,y-1]], .6);
  }
  if (phase > 0) {
    diamond(c, '#d9b27d', 48, 48, 6); diamond(c, '#513849', 48, 48, 3); px(c, '#f8ead0', 47, 46, 2, 3);
    line(c, '#bfa191', [[35,35],[28,46],[33,57]], .8); line(c, '#bfa191', [[61,35],[68,46],[63,57]], .8);
  }
  return canvas;
}

/** A floor acquisition has its own pedestal, cage and readable passive emblem. */
function passivePedestal(passiveId, open = false) {
  const canvas = surface(52, 64), c = canvas.getContext('2d');
  const edge = open ? '#91bca2' : '#9a80af', bright = open ? '#d6e9bc' : '#d7bedf';
  poly(c, INK, [[7,47],[15,40],[38,40],[46,47],[43,57],[10,57]]);
  poly(c, '#3b2c3d', [[8,47],[16,42],[37,42],[45,47],[37,51],[16,51]]);
  px(c, '#5c4555', 13, 51, 28, 5); px(c, '#8e715c', 13, 51, 28, 1); px(c, '#1c1421', 17, 53, 19, 2);
  line(c, edge, [[10,46],[16,41],[37,41],[43,46]], 1);
  c.drawImage(itemIcon(passiveId), 15, 18, 23, 23);
  if (!open) {
    line(c, '#201926', [[13,42],[13,18],[18,9],[26,4],[34,9],[39,18],[39,42]], 4);
    line(c, edge, [[13,42],[13,18],[18,9],[26,4],[34,9],[39,18],[39,42]], 1);
    line(c, '#745d87', [[20,10],[20,41]], .8); line(c, '#745d87', [[32,10],[32,41]], .8);
    line(c, edge, [[15,17],[37,17]], .7);
    px(c, '#211524', 23, 27, 7, 9); px(c, bright, 25, 28, 3, 4); px(c, '#594265', 26, 29);
  } else {
    for (const side of [-1, 1]) {
      line(c, edge, [[26+side*13,42],[26+side*19,23],[26+side*15,11]], 1);
      diamond(c, bright, 26+side*15, 11, 1.5);
    }
    star(c, bright, 26, 10, 3);
  }
  return canvas;
}

/** A tall weapon reliquary, distinct from a random treasure chest. */
function arsenalVault(collected = false) {
  const canvas = surface(58, 72), c = canvas.getContext('2d');
  poly(c, INK, [[8,57],[11,18],[19,7],[29,2],[39,7],[47,18],[50,57],[43,66],[15,66]]);
  poly(c, '#302432', [[12,56],[14,19],[21,10],[29,6],[37,10],[44,19],[46,56],[40,61],[18,61]]);
  poly(c, '#13101c', [[18,53],[18,23],[23,16],[29,12],[35,16],[40,23],[40,53]]);
  line(c, collected ? '#6f5c45' : '#b39554', [[12,55],[14,19],[21,10],[29,6],[37,10],[44,19],[46,55]], 1);
  px(c, '#47333a', 12, 59, 35, 5); px(c, '#997746', 15, 59, 29, 1); px(c, '#1c1520', 19, 62, 21, 2);
  for (const side of [-1, 1]) {
    const x = 29+side*(collected ? 16 : 10);
    line(c, collected ? '#6f5c45' : GOLD, [[x,50],[x,24],[x-side*4,20]], 1);
    diamond(c, '#97784f', x, 52, 2);
  }
  if (collected) {
    line(c, '#4c4155', [[23,38],[29,32],[35,38],[29,44],[23,38]], .8);
    px(c, '#716350', 26, 53, 7, 1);
  } else {
    // Crossed silver primitives sit inside brackets, below the gilded seal.
    line(c, '#d4d9cd', [[23,25],[35,44]], 2); line(c, '#91a5a5', [[35,25],[23,44]], 2);
    line(c, GOLD, [[21,41],[27,45]], 1); line(c, GOLD, [[31,45],[37,41]], 1);
    line(c, '#bda872', [[22,28],[20,28],[20,38],[22,38]], 1); line(c, '#bda872', [[36,28],[38,28],[38,38],[36,38]], 1);
    px(c, '#211622', 24, 30, 11, 12); px(c, GOLD, 25, 31, 9, 10);
    circle(c, '#f0d997', 29.5, 31, 3, 1); px(c, '#42313c', 29, 34, 2, 4); px(c, '#f4e4ae', 26, 32, 2, 1);
    diamond(c, GOLD, 29, 12, 2); px(c, '#f4e4ae', 29, 11);
  }
  return canvas;
}

function shieldChargeSprite(evolved = false) {
  const canvas = surface(14, 18), c = canvas.getContext('2d');
  poly(c, '#171c2a', [[7,1],[12,4],[11,12],[7,17],[3,12],[2,4]]);
  line(c, evolved ? '#dfc98d' : '#9bc9c4', [[7,2],[11,5],[10,12],[7,15],[4,12],[3,5],[7,2]], 1);
  line(c, '#d5eee0', [[7,5],[7,11]], 1); line(c, '#82b2b7', [[5,8],[9,8]], 1);
  if (evolved) { px(c, '#f4e6b1', 1, 6, 1, 4); px(c, '#f4e6b1', 12, 6, 1, 4); }
  return canvas;
}

/** Thin icy tracery leaves the creature, its health bar and warnings visible. */
function frozenWardSprite(frame = 0) {
  const canvas = surface(64, 64), c = canvas.getContext('2d');
  for (const side of [-1, 1]) {
    line(c, '#79a8c0', [[32+side*14,10],[32+side*24,23],[32+side*21,44],[32+side*12,54]], 1);
    line(c, '#c0e1e7', [[32+side*24,23],[32+side*18,19],[32+side*21,44]], .8);
    line(c, '#91bbcf', [[32+side*12,54],[32+side*16,41],[32+side*21,44]], .8);
    diamond(c, frame ? '#d9f3ed' : '#91bbcf', 32+side*22, 29+side*4, 1.5);
  }
  line(c, '#b9dbe3', [[25,8],[39,8],[27,20],[37,20],[25,8]], .8);
  px(c, '#dcf1e8', 31, 13, 2, 4);
  line(c, '#5f879f', [[23,53],[32,57],[41,53]], .8);
  return canvas;
}

function timeBeamSprite(evolved = false) {
  const canvas = surface(128, 32), c = canvas.getContext('2d');
  c.globalAlpha = .1; poly(c, '#93d5e3', [[0,16],[7,4],[123,4],[128,16],[123,28],[7,28]]); c.globalAlpha = 1;
  line(c, '#679eb8', [[0,16],[8,3],[123,3],[128,16],[123,29],[8,29],[0,16]], 1);
  line(c, '#dbf2e9', [[0,16],[126,16]], 1); line(c, '#91c5d7', [[5,13],[120,13]], .6); line(c, '#91c5d7', [[5,19],[120,19]], .6);
  for (let n = 0; n < 6; n++) {
    const x = 12+n*20;
    line(c, evolved ? '#d4c28c' : '#a6c5d3', [[x-2,6],[x,9],[x+2,6]], 1);
    line(c, evolved ? '#d4c28c' : '#a6c5d3', [[x-2,26],[x,23],[x+2,26]], 1);
  }
  if (evolved) { line(c, '#d4c28c', [[8,0],[120,0]], .7); line(c, '#d4c28c', [[8,31],[120,31]], .7); }
  return canvas;
}

function shieldWardSprite(evolved = false) {
  const canvas = surface(96, 96), c = canvas.getContext('2d');
  const color = evolved ? '#d9c48f' : '#a7d1ce';
  for (let n = 0; n < 6; n++) {
    const a = n*TAU/6;
    c.strokeStyle = color; c.lineWidth = 1; c.beginPath(); c.arc(48, 48, 43, a+.12, a+TAU/6-.12); c.stroke();
    diamond(c, color, 48+Math.cos(a)*43, 48+Math.sin(a)*43, 2);
    line(c, '#769caa', [[48+Math.cos(a-.07)*36,48+Math.sin(a-.07)*36],[48+Math.cos(a)*39,48+Math.sin(a)*39],[48+Math.cos(a+.07)*36,48+Math.sin(a+.07)*36]], .8);
  }
  if (evolved) circle(c, '#9da98d', 48, 48, 34, .6);
  return canvas;
}

function floorTile(stageId, variant = 0) {
  const canvas = surface(64, 64), c = canvas.getContext('2d'), p = STAGE[stageId] || STAGE.cathedral;
  px(c, p.ground, 0, 0, 64, 64);
  if (stageId === 'cathedral') {
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
      const x = col * 32, y = row * 32;
      px(c, p.stone, x + 1, y + 1, 31, 31); px(c, p.light, x + 2, y + 2, 29, 1); px(c, '#100f17', x + 1, y + 31, 31, 1); px(c, '#211b29', x + 31, y + 2, 1, 29);
      for (let n = 0; n < 12; n++) { const sx = 3 + Math.floor(hash(n, row + col * 2, variant) * 26), sy = 4 + Math.floor(hash(n, col + row * 4, variant + 3) * 25); px(c, n % 3 ? '#211d29' : '#17141f', x + sx, y + sy, n % 4 ? 1 : 3, 1); }
    }
    if (variant % 3 === 0) { line(c, '#302631', [[4, 51], [13, 46], [16, 38], [22, 37], [27, 29]]); line(c, '#27212d', [[14, 45], [19, 47], [23, 47]]); }
    if (variant === 1 || variant === 6) { diamond(c, '#292433', 32, 32, 19); diamond(c, p.stone, 32, 32, 16); diamond(c, '#322b3b', 32, 32, 8); diamond(c, p.stone, 32, 32, 5); px(c, '#433647', 31, 31, 2, 2); }
  } else if (stageId === 'library') {
    for (let row = 0; row < 4; row++) {
      const y = row * 16, offset = row % 2 ? 16 : 0;
      for (let col = -1; col < 3; col++) { const x = col * 32 + offset; px(c, row % 2 ? '#202126' : '#1d1e24', x + 1, y + 1, 31, 15); px(c, '#2a292d', x + 2, y + 1, 29, 1); px(c, '#16171e', x + 2, y + 14, 29, 1); line(c, '#26262a', [[x + 4, y + 5], [x + 15, y + 4], [x + 26, y + 5]]); }
    }
    if (variant % 3 === 0) { px(c, '#3f3934', 12, 18, 7, 9); px(c, '#71614a', 13, 17, 7, 9); line(c, '#4e493c', [[14, 20], [18, 20]]); px(c, '#595646', 26, 39, 5, 2); }
    if (variant === 5) { line(c, '#334447', [[0, 30], [64, 30]]); line(c, '#4a5b57', [[0, 32], [64, 32]]); px(c, '#ac9670', 31, 30, 2, 3); }
  } else if (stageId === 'foundry') {
    px(c, '#251e1e', 2, 2, 60, 60); px(c, '#382a27', 3, 3, 58, 1); px(c, '#130f13', 3, 61, 58, 1);
    for (let i = 0; i < 4; i++) { const x = i % 2 ? 58 : 5, y = i < 2 ? 5 : 58; pixelDisc(c, '#131116', x, y, 2); px(c, '#504038', x - 1, y - 1, 2, 1); }
    if (variant % 3 === 0) { px(c, '#171519', 12, 11, 40, 43); for (let i = 0; i < 7; i++) { px(c, '#3b302b', 14, 14 + i * 6, 37, 2); px(c, '#5c4030', 14, 14 + i * 6, 37, 1); } for (let i = 0; i < 5; i++) px(c, '#251d1d', 15 + i * 8, 13, 2, 39); }
    else { for (let i = 0; i < 6; i++) { const x = 8 + Math.floor(hash(i, variant) * 45), y = 8 + Math.floor(hash(variant, i + 2) * 45); px(c, '#2e2522', x, y, 4, 1); } }
    if (variant === 4) { line(c, '#5a3b27', [[0, 28], [26, 28], [34, 36], [64, 36]], 3); line(c, '#9a6038', [[0, 27], [26, 27], [34, 35], [64, 35]]); }
  } else if (stageId === 'spire') {
    // Silver-blue control-plane slabs, inset brass channels and cloud geometry.
    for (let row = 0; row < 2; row++) {
      px(c, p.stone, 1, row*32+1, 62, 30); px(c, p.light, 2, row*32+2, 60, 1);
      line(c, '#283947', [[5,row*32+9],[19,row*32+9],[25,row*32+16],[47,row*32+16],[56,row*32+25]], .7);
      px(c, '#45515b', 55, row*32+24, 2, 2);
    }
    if (variant%3 === 0) { circle(c, '#344452', 32, 32, 13, .8); diamond(c, '#5c625a', 32, 32, 6); diamond(c, p.stone, 32, 32, 4); }
    if (variant === 5) { line(c, '#7d775a', [[0,30],[64,30]], 1); line(c, '#394c5b', [[0,33],[64,33]], 1); }
  } else {
    // Mosaic fragments drift over a field of deep-blue stars.
    for (let i = 0; i < 25; i++) { const x = Math.floor(hash(i, variant) * 64), y = Math.floor(hash(variant, i + 11) * 64); px(c, i % 5 ? '#27283e' : '#51435f', x, y); }
    if (variant % 3 !== 0) {
      poly(c, '#131725', [[5, 12], [20, 3], [48, 8], [60, 27], [54, 54], [28, 61], [8, 47]]);
      poly(c, '#1b2030', [[7, 13], [21, 5], [47, 10], [57, 27], [52, 52], [28, 58], [10, 46]]);
      line(c, '#2e2e46', [[7, 13], [21, 5], [47, 10], [57, 27]]); line(c, '#111321', [[10, 45], [28, 58], [52, 52], [57, 28]]);
      line(c, '#282a3f', [[13, 28], [30, 19], [48, 27], [43, 45], [26, 48], [13, 28]]);
      if (variant === 1 || variant === 7) { circle(c, '#39354e', 31, 32, 10); line(c, '#5c4b72', [[24, 32], [31, 25], [38, 32], [31, 39], [31, 25]]); }
    }
  }
  return canvas;
}

function candle(c, x, y, accent = '#edb65c', frame = 0) {
  px(c, '#372a30', x - 4, y + 10, 9, 3); px(c, '#766344', x - 2, y + 8, 5, 2); px(c, '#bdad88', x - 1, y - 1, 3, 10); px(c, '#e4d8b7', x - 1, y, 1, 7);
  poly(c, accent, [[x - 2, y - 3], [x + (frame % 2), y - 9], [x + 3, y - 3], [x + 1, y - 1]]); px(c, '#fff1c0', x, y - 5, 1, 3);
}

function arch(c, x, y, width, height, p, filled = true) {
  const mid = x + width / 2;
  poly(c, '#0c0b14', [[x, y + height], [x, y + width * .45], [x + 3, y + width * .25], [mid, y], [x + width - 3, y + width * .25], [x + width, y + width * .45], [x + width, y + height]]);
  line(c, p.edge, [[x, y + height], [x, y + width * .45], [x + 3, y + width * .25], [mid, y], [x + width - 3, y + width * .25], [x + width, y + width * .45], [x + width, y + height]], 3);
  if (filled) {
    const glass = ['#573349', '#795450', '#34545a', '#65527a'];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) { const gx = x + 5 + col * ((width - 8) / 3), gy = y + width * .45 + row * ((height - width * .45 - 3) / 5); px(c, glass[(row + col) % 4], gx, gy, Math.floor((width - 12) / 3), Math.floor((height - width * .45 - 7) / 5)); }
    line(c, '#8e735c', [[mid, y + 7], [mid, y + height - 2]]); line(c, '#8e735c', [[x + 3, y + height * .58], [x + width - 3, y + height * .58]]);
  }
}

/** Illustrated scenery in 160 × 160 chunks. These are decorative, never collision. */
function landmark(stageId, variant = 0) {
  const canvas = surface(160, 160), c = canvas.getContext('2d'), p = STAGE[stageId] || STAGE.cathedral;
  if (stageId === 'cathedral') {
    if (variant % 3 === 0) {
      // Broken cathedral apse, tracery window, twin candelabra.
      poly(c, '#0d0c13', [[22, 128], [22, 40], [34, 40], [34, 25], [44, 25], [44, 14], [80, 0], [116, 14], [116, 25], [126, 25], [126, 40], [138, 40], [138, 128]]);
      for (let row = 0; row < 10; row++) for (let col = 0; col < 6; col++) { const x = 23 + col * 19, y = 35 + row * 9; px(c, row % 2 ? '#27212d' : '#231e29', x + (row % 2 ? -8 : 0), y, 18, 8); px(c, '#332a37', x + (row % 2 ? -8 : 0), y, 18, 1); }
      arch(c, 52, 14, 56, 92, p); circle(c, '#94755b', 80, 48, 12, 2); diamond(c, '#d9aa71', 80, 48, 7); px(c, '#f7d8a1', 79, 43, 2, 10);
      for (const x of [31, 118]) { px(c, '#17141e', x, 37, 11, 91); px(c, '#3b3040', x, 37, 2, 88); px(c, '#2f2735', x + 4, 39, 3, 85); px(c, '#4a3b4a', x - 3, 34, 17, 4); px(c, '#463747', x - 3, 123, 17, 5); }
      px(c, '#38303d', 18, 128, 124, 6); px(c, '#4a3c48', 22, 128, 116, 2); px(c, '#27222d', 14, 135, 132, 5);
      for (const x of [39, 120]) { candle(c, x, 126); candle(c, x - 6, 133); candle(c, x + 6, 133); }
    } else if (variant % 3 === 1) {
      // A weathered hunter monument over a sarcophagus.
      px(c, '#17131b', 37, 102, 86, 33); px(c, '#4b3c46', 34, 99, 92, 8); px(c, '#78604e', 38, 99, 84, 2); px(c, '#302630', 41, 109, 78, 20);
      for (const x of [46, 68, 90, 112]) { px(c, '#53404a', x, 111, 2, 15); px(c, '#15131c', x + 3, 112, 15, 12); }
      poly(c, '#27232d', [[65, 92], [67, 44], [72, 31], [84, 25], [96, 33], [102, 49], [97, 65], [105, 93]]);
      poly(c, '#514450', [[68, 91], [70, 45], [76, 34], [84, 30], [93, 35], [97, 48], [94, 65], [100, 91]]);
      line(c, '#7c6b71', [[75, 47], [79, 41], [90, 42], [93, 48]]); px(c, '#a09391', 80, 40, 10, 13); px(c, '#372c38', 82, 44, 3, 2); px(c, '#372c38', 88, 44, 2, 2);
      line(c, '#28222e', [[78, 58], [83, 73], [80, 91]], 2); line(c, '#a88d66', [[106, 39], [106, 96]], 2); px(c, '#b99d70', 99, 51, 14, 2); diamond(c, '#b9ad90', 106, 37, 5);
      candle(c, 48, 119); candle(c, 113, 118);
    } else {
      // Ritual floor seal and broken columns.
      circle(c, '#312633', 80, 89, 43, 2); circle(c, '#564235', 80, 89, 38); circle(c, '#292332', 80, 89, 30);
      for (let n = 0; n < 8; n++) { const a = n * TAU / 8; diamond(c, '#5e4b3f', 80 + Math.cos(a) * 36, 89 + Math.sin(a) * 36, 2); }
      for (const x of [25, 122]) { px(c, '#1a161f', x, 46, 14, 78); px(c, '#3b303b', x + 1, 47, 4, 75); px(c, '#51404c', x - 5, 120, 24, 7); px(c, '#51404c', x - 3, 42, 20, 5); line(c, '#827064', [[x + 2, 47], [x + 2, 117]]); candle(c, x + 7, 40); }
      poly(c, '#4a3947', [[67, 86], [80, 67], [93, 86], [80, 112]]); poly(c, '#17131d', [[72, 86], [80, 75], [88, 86], [80, 104]]); px(c, '#90724c', 79, 80, 2, 16);
    }
  } else if (stageId === 'library') {
    if (variant % 3 !== 2) {
      // Towering carved shelves: separately colored spines, gold page edges.
      px(c, '#101016', 15, 13, 130, 116); px(c, '#3d302c', 18, 16, 124, 110); px(c, '#5c4939', 13, 12, 134, 5); px(c, '#8b6d48', 17, 12, 126, 1);
      for (let shelf = 0; shelf < 4; shelf++) {
        const y = 24 + shelf * 25; px(c, '#15151b', 24, y, 112, 20);
        let x = 26;
        while (x < 133) { const n = hash(x, shelf, variant), width = 3 + Math.floor(n * 5), height = 12 + Math.floor(hash(x, variant) * 7); const colors = ['#5d3c45', '#44605e', '#65513e', '#4b4861', '#6e6651']; px(c, colors[Math.floor(n * colors.length)], x, y + 19 - height, width, height); px(c, '#a68d65', x, y + 21 - height, width, 1); px(c, '#b39d76', x + 1, y + 16, Math.max(1, width - 2), 1); px(c, '#24202a', x + width - 1, y + 20 - height, 1, height); x += width + 1; }
        px(c, '#513f33', 20, y + 20, 120, 4); px(c, '#8e704b', 21, y + 20, 118, 1);
      }
      for (const x of [18, 137]) { px(c, '#5b4537', x, 18, 5, 110); px(c, '#8e704c', x, 18, 1, 110); }
      px(c, '#241f23', 13, 128, 135, 5); px(c, '#5b4838', 14, 128, 133, 1);
      if (variant % 3 === 1) { line(c, '#726045', [[105, 42], [84, 139]], 3); line(c, '#726045', [[115, 42], [95, 139]], 3); for (let i = 0; i < 7; i++) { const y = 48 + i * 13; line(c, '#a28255', [[104 - i * 3, y], [113 - i * 3, y]], 2); } }
    } else {
      // Reading desk, astrolabe and an open annotated research codex.
      circle(c, '#2c3938', 80, 88, 42); circle(c, '#43534c', 80, 88, 39); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; line(c, '#647062', [[80 + Math.cos(a) * 34, 88 + Math.sin(a) * 34], [80 + Math.cos(a) * 38, 88 + Math.sin(a) * 38]]); }
      px(c, '#2c2424', 36, 67, 88, 49); px(c, '#5e4733', 32, 63, 96, 9); px(c, '#8f6c43', 34, 63, 92, 2); px(c, '#403127', 40, 72, 5, 47); px(c, '#403127', 114, 72, 5, 47);
      poly(c, '#977b51', [[59, 57], [78, 54], [81, 60], [84, 54], [105, 58], [102, 72], [81, 69], [60, 72]]);
      poly(c, '#d2bd92', [[61, 57], [78, 56], [80, 60], [80, 68], [62, 70]]); poly(c, '#e4d3aa', [[83, 60], [85, 56], [103, 59], [101, 70], [83, 68]]);
      for (let i = 0; i < 4; i++) { px(c, '#8a8062', 65, 60 + i * 2, 10 + i % 2 * 3, 1); px(c, '#a49772', 87, 60 + i * 2, 11 - i % 2 * 3, 1); }
      candle(c, 45, 60, '#a8e5ca'); circle(c, '#947b51', 116, 49, 10); circle(c, '#c7ab6e', 116, 49, 7); line(c, '#ceb778', [[109, 56], [123, 42]]); px(c, '#8a704c', 115, 56, 2, 8);
    }
  } else if (stageId === 'foundry') {
    if (variant % 3 === 0) {
      // Furnace cathedral: carved pressure vessel with a molten core.
      px(c, '#171115', 32, 29, 95, 104); px(c, '#4d342b', 35, 31, 89, 98); px(c, '#674335', 38, 32, 84, 3);
      px(c, '#30282a', 48, 8, 64, 26); px(c, '#5b4335', 50, 8, 60, 3); for (let n = 0; n < 5; n++) px(c, '#201a1e', 55 + n * 11, 12, 6, 17);
      arch(c, 51, 44, 56, 69, p, false); poly(c, '#632d29', [[54, 109], [54, 72], [79, 48], [104, 72], [104, 110]]);
      for (let n = 0; n < 8; n++) { const x = 57 + n * 6; poly(c, n % 2 ? '#d88c43' : '#a64f32', [[x, 109], [x, 90], [x + 3, 66 + n % 3 * 7], [x + 6, 91], [x + 6, 109]]); }
      for (let n = 0; n < 6; n++) px(c, '#382a27', 57 + n * 9, 73, 3, 39);
      for (const x of [39, 114]) { px(c, '#30272a', x, 40, 7, 83); px(c, '#7e4e35', x, 40, 2, 80); for (let n = 0; n < 6; n++) px(c, '#b0814c', x + 2, 43 + n * 13, 2, 2); }
      px(c, '#594032', 27, 128, 105, 8); px(c, '#8e6340', 29, 128, 102, 2); px(c, '#261c20', 22, 137, 115, 4);
    } else if (variant % 3 === 1) {
      // Rack of haunted processing cores and copper coolant pipes.
      px(c, '#0c0d13', 32, 17, 77, 117); px(c, '#454044', 35, 19, 71, 112); px(c, '#777064', 35, 19, 71, 2);
      for (let n = 0; n < 6; n++) { const y = 25 + n * 17; px(c, '#161920', 40, y, 61, 14); px(c, '#363039', 42, y + 2, 48, 9); for (let l = 0; l < 6; l++) px(c, '#19171e', 44 + l * 7, y + 3, 3, 7); px(c, n % 2 ? '#d79a4c' : '#8bb78d', 94, y + 4, 2, 2); px(c, '#654a39', 94, y + 8, 2, 2); }
      line(c, '#211b20', [[23, 138], [23, 43], [34, 43]], 8); line(c, '#79563c', [[23, 138], [23, 43], [34, 43]], 5); line(c, '#ad8051', [[22, 137], [22, 43], [33, 43]]);
      line(c, '#211b20', [[108, 87], [127, 87], [127, 137]], 8); line(c, '#79563c', [[108, 87], [127, 87], [127, 137]], 5); circle(c, '#b08a57', 127, 103, 8, 2); line(c, '#b08a57', [[121, 97], [133, 109]]); line(c, '#b08a57', [[121, 109], [133, 97]]);
    } else {
      circle(c, '#1f1920', 80, 83, 46, 5); circle(c, '#694734', 80, 83, 40, 3); circle(c, '#8d603d', 80, 83, 29, 2); circle(c, '#1e1920', 80, 83, 23, 6);
      for (let n = 0; n < 12; n++) { const a = n * TAU / 12; line(c, '#513c30', [[80 + Math.cos(a) * 25, 83 + Math.sin(a) * 25], [80 + Math.cos(a) * 39, 83 + Math.sin(a) * 39]], 3); }
      for (const [x, y] of [[37, 35], [116, 126], [36, 128]]) { px(c, '#30272a', x, y, 12, 7); px(c, '#8d6440', x + 1, y, 10, 2); }
    }
  } else if (stageId === 'spire') {
    if (variant%3 === 0) {
      // A cathedral control-plane tower: silver fins, IAM keys and suspended nodes.
      poly(c, '#0d131d', [[43,133],[47,45],[62,45],[62,20],[80,2],[98,20],[98,45],[113,45],[117,133]]);
      poly(c, '#334552', [[47,130],[51,48],[66,48],[66,22],[80,8],[94,22],[94,48],[109,48],[113,130]]);
      poly(c, '#516571', [[51,48],[66,48],[66,22],[80,8],[80,125],[47,130]]);
      line(c, '#a6b7b6', [[52,49],[67,49],[67,23],[80,11],[93,23],[93,49],[108,49]], 1);
      arch(c, 71, 35, 18, 55, {edge:'#a0aba5'}, false); px(c, '#b5dce3', 79, 48, 2, 35);
      for (const x of [56,99]) { px(c, '#1d2c3b', x, 61, 6, 59); px(c, '#799297', x, 62, 1, 55); for (let n = 0; n < 4; n++) px(c, '#bba56d', x+2, 67+n*13, 2, 3); }
      diamond(c, '#b99e68', 80, 103, 9); diamond(c, '#223442', 80, 103, 6); circle(c, '#d5cca6', 80, 101, 2); px(c, '#d5cca6', 79, 103, 2, 5);
      for (const side of [-1,1]) {
        line(c, '#5b727d', [[80+side*31,78],[80+side*51,66],[80+side*51,42]], 1);
        diamond(c, '#607f8c', 80+side*51, 39, 7); diamond(c, '#b6d4d8', 80+side*51, 38, 3);
      }
      px(c, '#34434d', 39, 132, 82, 6); px(c, '#a39775', 43, 132, 74, 1);
    } else if (variant%3 === 1) {
      // An orbital trust dial frames three suspended encrypted workloads.
      circle(c, '#263b4b', 80, 78, 49, 2); circle(c, '#697f87', 80, 78, 42, 1); circle(c, '#485e6b', 80, 78, 32, .8);
      for (let n = 0; n < 12; n++) { const a = n*TAU/12; line(c, n%3 ? '#72868b' : '#b6a379', [[80+Math.cos(a)*44,78+Math.sin(a)*44],[80+Math.cos(a)*49,78+Math.sin(a)*49]], 1); }
      for (const [x,y] of [[50,74],[80,55],[110,74]]) {
        line(c, '#7f969c', [[x,y-29],[x,y-6]], 1);
        poly(c, '#151f2d', [[x-10,y],[x,y-8],[x+10,y],[x+9,y+23],[x,y+30],[x-9,y+23]]);
        line(c, '#afbfba', [[x-9,y],[x,y-7],[x+9,y],[x+8,y+23],[x,y+28],[x-8,y+23],[x-9,y]], 1);
        px(c, '#667f8c', x-5, y+6, 10, 12); px(c, '#d2c49b', x-2, y+9, 4, 6); px(c, '#304653', x, y+11, 1, 3);
      }
      line(c, '#9ca58c', [[53,125],[80,136],[107,125]], 1); diamond(c, '#bdaf82', 80, 136, 3);
    } else {
      // A brass metadata altar and its small, unconnected cloud reliquary.
      poly(c, '#1b2936', [[29,112],[45,92],[115,92],[131,112],[119,131],[41,131]]);
      poly(c, '#4c616b', [[31,110],[47,94],[113,94],[129,110],[111,118],[49,118]]);
      line(c, '#a9b7ac', [[33,110],[49,96],[111,96],[127,110]], 1);
      px(c, '#243442', 45, 118, 70, 14); px(c, '#9e8f67', 49, 119, 62, 1);
      for (const x of [52,73,94]) { px(c, '#172332', x, 122, 14, 6); px(c, '#a4c9ce', x+2, 124, 4, 1); px(c, '#697f87', x+8, 124, 3, 1); }
      line(c, '#6d818b', [[80,93],[80,65]], 1);
      for (const [x,y,r] of [[65,57,10],[80,48,14],[94,58,10]]) { pixelDisc(c, '#2b414e', x, y, r); circle(c, '#a2b8ba', x, y, r, .8); }
      px(c, '#2b414e', 59, 58, 43, 11); line(c, '#a2b8ba', [[57,64],[101,64]], .8);
      diamond(c, '#d7c18a', 80, 61, 5); px(c, '#f0dfad', 79, 59, 2, 4);
      for (const side of [-1,1]) { line(c, '#5d7a87', [[80+side*27,75],[80+side*39,62]], 1); diamond(c, '#c1d9d5', 80+side*39, 62, 2); }
    }
  } else {
    // A floating archive spire, surrounded by broken celestial geometry.
    circle(c, '#2d2940', 80, 81, 51); circle(c, '#4e3f61', 80, 81, 44); circle(c, '#272338', 80, 81, 41);
    for (let n = 0; n < 12; n++) { const a = n * TAU / 12; diamond(c, n % 3 ? '#715483' : '#a78cbc', 80 + Math.cos(a) * 47, 81 + Math.sin(a) * 47, n % 3 ? 2 : 3); }
    poly(c, '#100f1b', [[49, 104], [58, 66], [65, 66], [65, 30], [80, 10], [96, 31], [96, 66], [104, 66], [111, 104], [97, 122], [80, 145], [63, 122]]);
    poly(c, '#343048', [[52, 103], [61, 69], [69, 69], [69, 32], [80, 16], [92, 33], [92, 69], [101, 69], [108, 103], [94, 119], [80, 139], [66, 119]]);
    poly(c, '#4e435f', [[69, 32], [80, 16], [80, 109], [52, 103], [61, 69], [69, 69]]); poly(c, '#201f35', [[81, 109], [107, 103], [94, 118], [80, 139]]);
    line(c, '#877295', [[70, 34], [80, 20], [80, 104], [55, 102]]); line(c, '#685575', [[81, 110], [81, 135]]);
    arch(c, 73, 43, 15, 45, { edge: '#8d739d' }, false); px(c, '#cdb4eb', 79, 56, 2, 26); diamond(c, '#c4a7e2', 80, 95, 7); diamond(c, '#e8dcf7', 80, 95, 3);
    for (const [x, y] of [[24, 56], [133, 42], [129, 126], [25, 126]]) { diamond(c, '#52425f', x, y, 6); diamond(c, '#9074a7', x, y - 2, 3); px(c, '#d5b8ef', x, y - 3); }
  }
  return canvas;
}

function propSprite(kind, frame = 0) {
  const canvas = surface(32, 40), c = canvas.getContext('2d');
  if (/book|desk|scroll/.test(kind)) {
    px(c, '#1b1620', 4, 17, 24, 16); px(c, '#654b3b', 5, 17, 22, 14); px(c, '#a58051', 6, 18, 20, 2); px(c, '#3e3030', 7, 21, 18, 8);
    px(c, '#90795a', 8, 12, 16, 6); px(c, '#e0cb9f', 9, 12, 14, 4); px(c, '#9c895f', 15, 12, 1, 4); line(c, '#998969', [[10, 13], [13, 13]]); line(c, '#998969', [[17, 14], [21, 14]]);
    px(c, '#33272b', 6, 31, 3, 6); px(c, '#33272b', 23, 31, 3, 6);
  } else if (/barrel|crate|cache|server/.test(kind)) {
    poly(c, INK, [[8, 9], [23, 9], [27, 14], [27, 31], [23, 35], [8, 35], [4, 30], [4, 14]]);
    px(c, '#725140', 7, 12, 18, 20); px(c, '#926746', 9, 11, 3, 23); px(c, '#563f37', 15, 12, 2, 21); px(c, '#b18557', 21, 12, 2, 20);
    px(c, '#4b4851', 5, 14, 21, 3); px(c, '#4b4851', 5, 28, 21, 3); px(c, '#92908b', 7, 14, 17, 1); px(c, '#92908b', 7, 28, 17, 1); px(c, '#c4b279', 14, 20, 3, 3);
  } else if (/crystal|obelisk|relic/.test(kind)) {
    px(c, '#292333', 7, 32, 18, 4); px(c, '#63506b', 9, 30, 14, 3); poly(c, '#5c4b7c', [[16, 3], [23, 14], [20, 28], [16, 32], [10, 25], [9, 13]]); poly(c, '#b29fcd', [[16, 3], [16, 27], [10, 24], [10, 13]]); poly(c, '#81709f', [[17, 7], [22, 14], [19, 26], [17, 29]]); px(c, '#e7d7f4', 14, 9, 1, 10);
  } else if (/urn|vase/.test(kind)) {
    poly(c, '#15101a', [[10, 9], [22, 9], [21, 15], [26, 23], [23, 32], [19, 35], [12, 34], [7, 27], [8, 21], [11, 15]]); poly(c, '#69616b', [[11, 10], [21, 10], [19, 16], [24, 24], [21, 31], [17, 33], [12, 31], [9, 26], [10, 22], [13, 16]]); line(c, '#a3989d', [[12, 20], [11, 26], [14, 30]]); px(c, '#c4aa76', 11, 11, 10, 2); px(c, '#a88a5e', 10, 24, 13, 2); px(c, '#b7a592', 13, 32, 7, 2);
  } else {
    // The classic breakable is a three-pronged bronze candelabrum.
    px(c, '#211a22', 8, 33, 17, 4); px(c, '#6c563c', 10, 31, 13, 3); px(c, '#ae8750', 14, 20, 4, 13); px(c, '#e1bd78', 15, 20, 1, 11);
    line(c, '#9d774b', [[6, 19], [8, 25], [24, 25], [26, 19]], 2); candle(c, 7, 15, '#eda758', frame); candle(c, 16, 10, '#f3bb62', frame + 1); candle(c, 25, 15, '#eaa35b', frame);
  }
  return canvas;
}

function wallTile() {
  const canvas = surface(64, 64), c = canvas.getContext('2d');
  px(c, '#0b0e16', 0, 0, 64, 64);
  for (let row = 0; row < 8; row++) for (let column = -1; column < 5; column++) {
    const x = column * 16 + (row % 2 ? 8 : 0), y = row * 8;
    px(c, row % 3 ? '#31343c' : '#373941', x + 1, y + 1, 15, 7); px(c, '#545359', x + 1, y + 1, 15, 1); px(c, '#20232d', x + 15, y + 2, 1, 6);
    if ((row + column) % 5 === 0) line(c, '#232530', [[x + 5, y + 1], [x + 6, y + 4], [x + 10, y + 6]]);
  }
  // The carved vertical ribs, unlike decorative shelves, form a solid barrier.
  px(c, '#151620', 0, 0, 9, 64); px(c, '#6e625a', 2, 0, 2, 64); px(c, '#363340', 6, 0, 2, 64);
  px(c, '#191b25', 58, 0, 6, 64); px(c, '#777064', 60, 0, 1, 64);
  for (let n = 0; n < 4; n++) { px(c, '#857258', 3, n * 16 + 2, 4, 2); px(c, '#14141e', 4, n * 16 + 4, 2, 5); }
  return canvas;
}

function pillarSprite() {
  const canvas = surface(64, 80), c = canvas.getContext('2d');
  // A substantial copper payload engine on a visibly solid beveled plinth.
  poly(c, INK, [[4, 23], [13, 12], [50, 12], [60, 23], [60, 69], [53, 77], [10, 77], [3, 69]]);
  poly(c, '#69503d', [[5, 23], [14, 14], [49, 14], [58, 23], [50, 31], [13, 31]]);
  poly(c, '#a17c51', [[14, 15], [49, 15], [54, 21], [47, 27], [16, 27], [9, 22]]);
  poly(c, '#302831', [[6, 25], [14, 32], [50, 32], [57, 25], [57, 67], [51, 73], [12, 73], [6, 67]]);
  px(c, '#644b3d', 9, 32, 46, 35); px(c, '#997044', 10, 32, 4, 34); px(c, '#322831', 49, 32, 5, 35);
  px(c, '#1d2028', 17, 36, 29, 24); px(c, '#485452', 19, 38, 24, 19); px(c, '#18242b', 21, 40, 20, 15);
  for (let n = 0; n < 3; n++) { px(c, '#7eaaa0', 23, 42 + n * 4, 8 + (n % 2) * 7, 1); px(c, '#b6d0aa', 23, 42 + n * 4, 3, 1); }
  px(c, '#d8aa62', 35, 49, 3, 3); px(c, '#403034', 17, 62, 29, 3); px(c, '#bd8d4b', 18, 62, 27, 1);
  for (const x of [12, 50]) for (const y of [35, 64]) { px(c, '#18141d', x, y, 3, 3); px(c, '#d1a16a', x, y, 2, 1); }
  px(c, '#70503c', 6, 70, 51, 5); px(c, '#c58f52', 8, 70, 47, 1); px(c, '#30242b', 10, 76, 43, 2);
  px(c, '#3a3438', 21, 15, 22, 10); for (let n = 0; n < 4; n++) { px(c, '#191b23', 23 + n * 5, 16, 3, 7); px(c, '#876744', 23 + n * 5, 16, 3, 1); }
  return canvas;
}

function pickupSprite(kind, value = 1, frame = 0) {
  const canvas = surface(kind === 'merchant' ? 36 : kind === 'coffin' ? 32 : 24, kind === 'merchant' || kind === 'coffin' ? 48 : 28), c = canvas.getContext('2d');
  if (kind === 'coffin') {
    // A sealed operator sarcophagus; crossed keys identify the rescue objective.
    poly(c, INK, [[8, 2], [24, 2], [30, 14], [25, 43], [21, 47], [10, 47], [5, 42], [2, 14]]);
    poly(c, '#67536a', [[9, 4], [23, 4], [28, 14], [23, 42], [20, 45], [11, 45], [7, 41], [4, 14]]);
    poly(c, '#34303f', [[10, 7], [21, 7], [25, 15], [21, 40], [18, 42], [13, 42], [10, 39], [7, 15]]);
    line(c, '#b7a286', [[9, 7], [6, 15], [9, 39], [13, 43], [19, 43], [22, 40], [26, 15], [22, 6], [10, 6]]);
    poly(c, '#63526c', [[13, 12], [19, 12], [22, 18], [21, 30], [16, 36], [11, 30], [10, 18]]);
    px(c, '#ccbea2', 12, 15, 8, 7); px(c, '#242031', 13, 18, 2, 2); px(c, '#242031', 18, 18, 2, 2); px(c, '#cab99c', 14, 22, 4, 2);
    line(c, '#d7c28b', [[10, 29], [21, 36]], 2); line(c, '#d7c28b', [[21, 29], [10, 36]], 2); circle(c, '#e4cea0', 10, 28, 2); circle(c, '#e4cea0', 22, 28, 2);
    px(c, '#e4c99a', 5, 14, 3, 2); px(c, '#e4c99a', 24, 14, 3, 2); px(c, '#ab8b69', 10, 40, 3, 2); px(c, '#ab8b69', 20, 40, 3, 2);
    line(c, frame % 2 ? '#a2d6cf' : '#73a8a9', [[16, 5], [16, 9]], 1); star(c, '#d8efd9', 16, 8, 2);
    return canvas;
  }
  if (kind === 'merchant') {
    // A friendly itinerant exploit broker, burdened with rare brass curios.
    poly(c, INK, [[11, 14], [12, 6], [18, 1], [24, 5], [27, 15], [25, 26], [29, 43], [24, 47], [9, 47], [6, 43], [9, 26]]);
    poly(c, '#334947', [[13, 14], [14, 7], [18, 3], [23, 7], [25, 15], [23, 26], [27, 42], [23, 45], [10, 45], [8, 42], [12, 25]]);
    poly(c, '#4e6b5c', [[12, 23], [18, 26], [23, 22], [23, 32], [25, 42], [19, 40], [17, 44], [12, 41], [10, 42]]);
    poly(c, '#0f1720', [[14, 11], [18, 7], [22, 11], [24, 17], [20, 22], [15, 20], [12, 17]]);
    px(c, '#bbc6b0', 15, 14, 7, 5); px(c, '#e7e5c6', 15, 14, 2, 2); px(c, '#e7e5c6', 20, 14, 2, 2); px(c, '#564c41', 16, 18, 5, 2); px(c, '#b6b7a1', 16, 20, 5, 3);
    line(c, '#95a285', [[14, 9], [18, 5], [22, 8]]); px(c, '#b5a06c', 12, 26, 14, 2); px(c, '#e4cc8c', 18, 25, 3, 3);
    px(c, '#6a4d3b', 2, 20, 8, 21); px(c, '#9c7348', 3, 21, 7, 3); px(c, '#ccb77c', 5, 24, 2, 13); px(c, '#4a3831', 2, 29, 9, 2); px(c, '#a98852', 3, 41, 8, 2);
    px(c, '#d8c9a8', 25, 26, 4, 4); px(c, '#aa8a56', 30, 12, 2, 34); line(c, '#d3b975', [[31, 13], [34, 13], [34, 19]], 1); px(c, '#826b48', 31, 19, 5, 9); px(c, '#d5bb77', 32, 21, 3, 5); px(c, '#fff0bd', 33, 22, 1, 3);
    px(c, '#312a30', 10, 44, 6, 3); px(c, '#312a30', 19, 44, 7, 3); star(c, '#e1d4a0', 4, 16, 2);
    return canvas;
  }
  if (kind === 'xp') {
    const colors = value >= 15 ? ['#55304a', '#b75174', '#f1a8b4'] : value >= 4 ? ['#344a32', '#7ca16c', '#d3e6af'] : ['#2d4559', '#6babc4', '#c7eef1'];
    poly(c, INK, [[12, 3], [18, 11], [13, 21], [6, 12]]); poly(c, colors[0], [[12, 4], [17, 11], [13, 20], [7, 12]]); poly(c, colors[1], [[12, 5], [12, 17], [8, 11]]); poly(c, colors[2], [[12, 5], [16, 11], [12, 11]]); px(c, '#f1fffc', 11, 7, 1, 3); px(c, colors[1], 13, 13, 2, 3);
  } else if (kind === 'chest') {
    poly(c, INK, [[3, 11], [6, 5], [19, 5], [22, 11], [22, 23], [3, 23]]); px(c, '#67412e', 4, 11, 17, 11); poly(c, '#a77742', [[4, 10], [7, 6], [18, 6], [21, 10]]); px(c, '#d5ac61', 5, 11, 15, 2); px(c, '#c9a361', 6, 7, 2, 15); px(c, '#c9a361', 17, 7, 2, 15); px(c, '#3e2a26', 9, 14, 7, 7); px(c, '#f1d08a', 11, 13, 3, 5); px(c, '#5b3c31', 12, 14, 1, 2); px(c, '#dfb975', 4, 21, 17, 1); star(c, '#f8dda0', frame % 2 ? 20 : 6, frame % 2 ? 5 : 3, 2);
  } else if (kind === 'gold') {
    pixelDisc(c, '#584129', 12, 14, 7); pixelDisc(c, '#b38a44', 12, 13, 6); pixelDisc(c, '#e4c779', 12, 12, 5); circle(c, '#a77a3a', 12, 12, 3); px(c, '#fff0b5', 9, 8, 3, 1); px(c, '#ac8541', 12, 9, 1, 6);
  } else if (kind === 'heal') {
    px(c, '#b5a28d', 10, 4, 5, 4); px(c, '#766352', 9, 4, 7, 2); poly(c, '#2e2739', [[9, 8], [16, 8], [16, 11], [20, 15], [18, 23], [7, 23], [5, 15], [9, 11]]); poly(c, '#a9425c', [[7, 16], [18, 16], [17, 21], [8, 21]]); px(c, '#f09eac', 8, 16, 1, 4); px(c, '#e7cebf', 9, 10, 2, 4); px(c, '#f5b6a3', 11, 18, 4, 1); px(c, '#f5b6a3', 12, 17, 2, 3);
  } else if (kind === 'magnet') {
    line(c, INK, [[6, 7], [6, 18], [10, 22], [16, 22], [20, 18], [20, 7]], 7); line(c, '#ae4d67', [[6, 7], [6, 17], [10, 21], [16, 21], [20, 17], [20, 7]], 4); px(c, '#d9e1dd', 4, 6, 4, 5); px(c, '#d9e1dd', 18, 6, 4, 5); px(c, '#ecb2be', 5, 13, 1, 4);
  } else if (kind === 'bomb') {
    pixelDisc(c, INK, 12, 16, 8); pixelDisc(c, '#48414b', 12, 16, 6); pixelDisc(c, '#2d2935', 13, 17, 5); px(c, '#9c9394', 8, 12, 3, 2); px(c, '#9a8156', 11, 6, 3, 4); line(c, '#c9a36b', [[12, 6], [15, 3], [18, 5]]); star(c, '#ffd597', 19, 4, 2);
  } else if (kind === 'freeze') {
    diamond(c, '#273f5d', 12, 14, 10); diamond(c, '#7cbdca', 12, 13, 8); diamond(c, '#bfeaf0', 12, 12, 5); line(c, '#effcfa', [[12, 7], [12, 18]]); line(c, '#effcfa', [[7, 10], [17, 16]]); line(c, '#effcfa', [[7, 16], [17, 10]]);
  } else {
    px(c, '#54465c', 6, 22, 13, 3); px(c, '#a88b5b', 8, 20, 9, 3); diamond(c, '#a08bbd', 12, 11, 8); diamond(c, '#e0cbef', 12, 10, 5); diamond(c, '#fff1d5', 12, 9, 2); px(c, '#d4b573', 11, 17, 2, 5); star(c, '#ddc5ef', 4, 7, 2); star(c, '#ddc5ef', 20, 15, 2);
  }
  return canvas;
}

/** Weapon and passive icons share an engraved midnight inventory tile. */
function itemIcon(id) {
  const canvas = surface(40, 40), c = canvas.getContext('2d'), color = WEAPON_COLORS[id] || GOLD;
  if (id === 'whip') {
    line(c, '#3c2928', [[10, 31], [15, 22], [25, 22], [32, 17], [28, 10], [20, 10], [17, 15], [21, 18], [27, 16]], 4); line(c, '#d0a366', [[10, 31], [15, 22], [25, 22], [32, 17], [28, 10], [20, 10], [17, 15], [21, 18], [27, 16]], 2); line(c, '#e6d2a2', [[8, 35], [13, 26]], 4); px(c, '#7c4c32', 10, 29, 3, 2);
  } else if (id === 'knife' || id === 'speed') {
    poly(c, '#d5e4e2', [[13, 28], [26, 9], [32, 5], [29, 17], [19, 29]]); poly(c, '#748d91', [[18, 27], [29, 11], [25, 21]]); line(c, '#d9ba75', [[10, 24], [21, 31]], 3); line(c, '#754f40', [[8, 35], [14, 27]], 4); px(c, '#cfaf7f', 7, 34, 3, 2);
  } else if (id === 'wand') {
    line(c, '#554c64', [[10, 34], [26, 13]], 4); line(c, '#bca984', [[10, 34], [26, 13]], 2); circle(c, '#bba375', 28, 10, 6, 2); diamond(c, '#83c7dd', 28, 10, 4); px(c, '#eaffff', 27, 8, 2, 2); star(c, '#8ab5c7', 17, 9, 2);
  } else if (id === 'orbit' || id === 'armor') {
    poly(c, '#c1a56e', [[20, 5], [32, 11], [30, 26], [20, 35], [10, 26], [8, 11]]); poly(c, '#3d3542', [[20, 8], [29, 13], [27, 25], [20, 31], [13, 25], [11, 13]]); line(c, '#bfae8c', [[20, 11], [20, 28]], 2); line(c, '#a6947d', [[14, 17], [26, 17]], 2); px(c, '#e8d4a2', 19, 15, 3, 4);
  } else if (id === 'pool') {
    px(c, '#d1b89b', 17, 5, 7, 4); px(c, '#6f574b', 16, 5, 9, 2); poly(c, '#5b827a', [[16, 10], [25, 10], [25, 16], [32, 23], [29, 34], [12, 34], [9, 23], [16, 16]]); poly(c, '#72b49c', [[12, 24], [29, 24], [27, 31], [14, 31]]); px(c, '#c1ead1', 14, 24, 2, 5); px(c, '#ecffe1', 16, 13, 2, 7); circle(c, '#8ad2b2', 9, 15, 2); circle(c, '#a6e4c7', 30, 9, 2);
  } else if (id === 'rune' || id === 'duration') {
    poly(c, '#51475f', [[10, 8], [29, 6], [33, 32], [12, 35], [7, 28]]); poly(c, '#9883ab', [[12, 10], [27, 9], [30, 30], [14, 32], [10, 27]]); line(c, '#edd5fa', [[17, 13], [24, 13], [18, 19], [25, 19], [18, 27]], 2); line(c, '#715f82', [[13, 12], [14, 27]]);
  } else if (id === 'lightning' || id === 'cooldown') {
    poly(c, '#7fa6c4', [[21, 4], [9, 23], [19, 22], [15, 37], [32, 16], [22, 17], [30, 4]]); poly(c, '#d7f1f4', [[23, 6], [14, 21], [23, 20], [20, 29], [28, 18], [20, 20], [27, 6]]); star(c, '#a1c5e0', 10, 9, 2); star(c, '#a1c5e0', 32, 30, 2);
  } else if (id === 'axe' || id === 'might') {
    line(c, '#644839', [[9, 35], [27, 9]], 4); line(c, '#c39b72', [[9, 35], [27, 9]], 2); poly(c, '#d0b8bf', [[22, 9], [18, 5], [10, 10], [11, 18], [17, 22], [23, 15], [29, 19], [35, 15], [34, 7], [28, 6]]); poly(c, '#867a91', [[15, 11], [12, 16], [17, 20], [22, 15], [29, 18], [33, 14], [31, 12], [26, 15], [23, 11]]); px(c, '#fff1de', 12, 10, 3, 1);
  } else if (id === 'cross' || id === 'health') {
    poly(c, '#659980', [[17, 6], [25, 6], [25, 16], [35, 16], [35, 24], [25, 24], [25, 34], [17, 34], [17, 24], [7, 24], [7, 16], [17, 16]]); px(c, '#ccdec2', 19, 8, 3, 24); px(c, '#ccdec2', 9, 18, 24, 3); diamond(c, '#f3e6bd', 20, 20, 5); diamond(c, '#aa9b61', 20, 20, 2);
  } else if (id === 'pentagram' || id === 'curse') {
    circle(c, '#9d729d', 20, 20, 15); const points = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; points.push([20 + Math.cos(a) * 12, 20 + Math.sin(a) * 12]); } line(c, '#ddabd1', points, 2); star(c, '#f0cdeb', 20, 20, 2);
  } else if (id === 'fireball') {
    poly(c, '#9e403c', [[7, 7], [18, 10], [27, 13], [34, 22], [31, 30], [23, 34], [14, 29], [9, 19], [13, 21], [9, 11], [18, 18]]); poly(c, '#e48c50', [[15, 13], [25, 16], [31, 23], [28, 29], [22, 31], [16, 26], [15, 21], [20, 24]]); pixelDisc(c, '#ffe0a0', 24, 24, 5); px(c, '#fff8d7', 24, 23, 2, 3);
  } else if (id === 'birds') {
    poly(c, '#8587b0', [[20, 21], [11, 8], [3, 6], [7, 18], [16, 27], [20, 34], [25, 27], [34, 17], [37, 6], [28, 10]]); poly(c, '#ced2e4', [[20, 22], [10, 11], [7, 9], [12, 20], [18, 26], [20, 31], [23, 25], [31, 17], [33, 10], [26, 14]]); diamond(c, '#efddac', 20, 20, 4); px(c, INK, 20, 19, 2, 1);
  } else if (id === 'aegis') {
    poly(c, '#19202d', [[20,3],[33,10],[31,26],[20,37],[9,26],[7,10]]);
    poly(c, '#a7c8bc', [[20,5],[31,11],[29,25],[20,34],[11,25],[9,11]]);
    poly(c, '#304754', [[20,8],[28,13],[26,24],[20,30],[14,24],[12,13]]);
    line(c, '#dcdfb4', [[20,10],[20,28]], 1); diamond(c, '#91d5d0', 20, 18, 5); diamond(c, '#e1eee0', 20, 18, 2);
    line(c, '#d1b67c', [[10,15],[6,15],[6,25],[10,25]], 1); line(c, '#d1b67c', [[30,15],[34,15],[34,25],[30,25]], 1);
    star(c, '#b8dcd2', 7, 7, 2); px(c, '#f0e9c1', 19, 5, 3, 2);
  } else if (id === 'lancet') {
    circle(c, '#6a7990', 20, 20, 14, 1); circle(c, '#a5cbd4', 20, 20, 11, 1);
    for (let n = 0; n < 8; n++) { const a = n*TAU/8; line(c, '#b2c9cf', [[20+Math.cos(a)*12,20+Math.sin(a)*12],[20+Math.cos(a)*14,20+Math.sin(a)*14]], 1); }
    line(c, '#574b62', [[10,34],[27,9]], 4); line(c, '#d3c396', [[10,34],[27,9]], 2);
    poly(c, '#648ba9', [[25,12],[25,5],[34,2],[33,12],[29,17]]); poly(c, '#d0f0ee', [[26,11],[27,6],[32,4],[30,12],[28,14]]);
    line(c, '#f0dfac', [[20,20],[12,17]], 1); diamond(c, '#e0eacb', 20, 20, 2); px(c, '#ded6a5', 7, 33, 5, 2);
  } else if (id === 'magnet') {
    line(c, '#af566b', [[10, 8], [10, 26], [15, 32], [25, 32], [31, 26], [31, 8]], 6); px(c, '#d8e0d6', 7, 7, 6, 7); px(c, '#d8e0d6', 28, 7, 6, 7); line(c, '#f2b7bb', [[9, 16], [9, 25], [15, 30]]);
  } else if (id === 'growth') {
    line(c, '#9ab48a', [[19, 34], [20, 10]], 2); poly(c, '#789b6c', [[20, 20], [10, 18], [8, 10], [16, 12]]); poly(c, '#b3d092', [[21, 27], [30, 23], [33, 15], [25, 18]]); diamond(c, '#d1bc7b', 20, 9, 4); px(c, '#765645', 12, 34, 17, 3);
  } else if (id === 'luck') {
    for (const [x, y] of [[15, 14], [25, 14], [15, 24], [25, 24]]) pixelDisc(c, '#8fa978', x, y, 6); line(c, '#cfdf9f', [[20, 18], [20, 33], [24, 36]], 2); diamond(c, '#bfd38f', 20, 19, 5); px(c, '#e5f1bd', 12, 12, 2, 2);
  } else if (id === 'amount') {
    for (let i = 0; i < 3; i++) { diamond(c, '#71648c', 11 + i * 9, 12 + i * 6, 7); diamond(c, '#c0accf', 11 + i * 9, 11 + i * 6, 5); px(c, '#f2e0f1', 10 + i * 9, 8 + i * 6, 1, 3); }
  } else if (id === 'area') {
    circle(c, '#8d83ab', 20, 20, 13); circle(c, '#cdbbde', 20, 20, 8); diamond(c, '#edd6ef', 20, 20, 4); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; star(c, '#a998c0', 20 + Math.cos(a) * 16, 20 + Math.sin(a) * 16, 2); }
  } else {
    // Unknown arcana and shop upgrades become an engraved brass research seal.
    const seed = [...String(id)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    circle(c, '#8d754f', 20, 20, 14, 2); circle(c, '#5a4b43', 20, 20, 11); const n = 3 + seed % 4, points = []; for (let i = 0; i <= n; i++) { const a = i * TAU / n - Math.PI / 2; points.push([20 + Math.cos(a) * 9, 20 + Math.sin(a) * 9]); } line(c, color, points, 2); star(c, '#f2ddb3', 20, 20, 3); px(c, '#c4a776', 19, 4, 3, 2);
  }
  return canvas;
}

const portraitCache = new Map();

/** Paint a crisp, original codex plate without touching CSS or loading assets. */
export function paintPortrait(canvas, kind, id) {
  const c = canvas?.getContext('2d');
  if (!c) return;
  const w = canvas.width || 96, h = canvas.height || 96;
  c.clearRect(0, 0, w, h); c.imageSmoothingEnabled = false;
  c.fillStyle = '#120e18'; c.fillRect(0, 0, w, h);
  const key = `${kind}:${id}`;
  let art = portraitCache.get(key);
  if (!art) {
    if (kind === 'character') art = characterSprite(id, 0);
    else if (kind === 'enemy') art = enemySprite(id, 0, id === 'reaper' ? 'boss' : '');
    else if (kind === 'stage') art = landmark(id, 0);
    else if (kind === 'pickup' || id === 'coffin' || id === 'merchant') art = pickupSprite(id);
    else art = itemIcon(id);
    if (portraitCache.size < 120) portraitCache.set(key, art);
  }
  const p = STAGE[id] || STAGE.cathedral;
  const glow = c.createRadialGradient(w * .5, h * .42, 0, w * .5, h * .5, w * .62);
  glow.addColorStop(0, kind === 'stage' ? `${p.accent}38` : '#7c5d5b38'); glow.addColorStop(1, '#120e1800'); c.fillStyle = glow; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#473747'; c.lineWidth = 1; c.strokeRect(3.5, 3.5, w - 7, h - 7);
  for (const [x, y, dx, dy] of [[5, 5, 1, 1], [w - 6, 5, -1, 1], [5, h - 6, 1, -1], [w - 6, h - 6, -1, -1]]) { line(c, '#af8b56', [[x, y + dy * 8], [x, y], [x + dx * 8, y]]); px(c, '#e3c98b', x, y); }
  if (kind === 'character' || kind === 'enemy') {
    c.save(); c.translate(w / 2, h * .62); c.scale(w * .35, h * .09); c.fillStyle = '#08070cb3'; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
  }
  const scale = kind === 'stage' ? Math.min(w / 165, h / 157) : Math.floor(Math.min((w - 14) / art.width, (h - 14) / art.height) * 2) / 2 || 1;
  const dw = art.width * scale, dh = art.height * scale;
  c.drawImage(art, Math.round((w - dw) / 2), Math.round((h - dh) / 2 + (kind === 'character' ? 2 : 0)), dw, dh);
}

export function createRenderer(canvas, catalog = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas2D is unavailable.');
  const cache = new Map();
  const definition = Object.fromEntries((catalog.enemies || []).map(enemy => [enemy.id, enemy]));
  const passiveDefinition = Object.fromEntries((catalog.passives || []).map(passive => [passive.id, passive]));
  let width = 640, height = 400, pixelRatio = 1, backingScale = 2, alive = true;
  let cameraX = 0, cameraY = 0, drawTime = 0, currentStage = 'cathedral', currentInverse = false, currentCycle = 0, quality = 'high', nearbyLabelBudget = 0;
  let vignette, lastPlayer = null, trail = [], previousTime = -1;
  const get = (key, factory) => { if (!cache.has(key)) cache.set(key, factory()); return cache.get(key); };
  const visible = (x, y, margin = 40) => Math.abs(x - cameraX) < width / 2 + margin && Math.abs(y - cameraY) < height / 2 + margin;

  function resize(cssWidth, cssHeight, dpr = 1) {
    pixelRatio = clamp(Number(dpr) || 1, 1, 2);
    // Two CSS pixels per world pixel keeps creatures readable on phones.
    const worldScale = 2;
    width = Math.max(120, Math.ceil(cssWidth / worldScale)); height = Math.max(160, Math.ceil(cssHeight / worldScale));
    canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio)); canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));
    backingScale = pixelRatio * worldScale;
    ctx.setTransform(backingScale, 0, 0, backingScale, 0, 0); ctx.imageSmoothingEnabled = false;
    vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .18, width / 2, height / 2, Math.max(width, height) * .64);
    vignette.addColorStop(0, '#09070d00'); vignette.addColorStop(.55, '#09070d12'); vignette.addColorStop(1, '#09070dba');
    return { width, height };
  }

  function ground(stageId) {
    const p = (currentInverse ? INVERSE_STAGE : STAGE)[stageId] || STAGE.cathedral, left = cameraX - width / 2, top = cameraY - height / 2;
    ctx.fillStyle = p.ground; ctx.fillRect(left - 8, top - 8, width + 16, height + 16);
    const minX = Math.floor((left - 8) / 64), maxX = Math.ceil((left + width + 8) / 64);
    const minY = Math.floor((top - 8) / 64), maxY = Math.ceil((top + height + 8) / 64);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const variant = Math.floor(hash(x, y, 2) * 8);
      ctx.drawImage(get(`tile:${stageId}:${currentInverse}:${variant}`, () => {
        const art = floorTile(stageId, variant); return currentInverse ? inversePlate(art, p.tint) : art;
      }), x * 64, y * 64);
    }
    const graffiti = (catalog.stages || []).find(stage => stage.id === stageId)?.graffiti || [];
    if (graffiti.length) for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if ((Math.abs(x * 3 + y * 5) % 17) !== 0) continue;
      const text = graffiti[Math.abs(x + y * 7) % graffiti.length];
      const stamp = get(`graffiti:${stageId}:${text}`, () => {
        const plate = surface(112, 12), ink = plate.getContext('2d');
        ink.font = '5px JBMono, monospace'; ink.fillStyle = '#a18a69'; ink.fillText(text, 2, 8); return plate;
      });
      ctx.globalAlpha = .32; ctx.drawImage(stamp, x * 64 + 8, y * 64 + 35); ctx.globalAlpha = 1;
    }
    // Floor inlays connect the otherwise endless room into an authored place.
    if (stageId === 'cathedral') {
      const aisle = 384;
      for (let n = Math.floor(left / aisle); n <= Math.ceil((left + width) / aisle); n++) {
        const x = n * aisle;
        px(ctx, '#32232d', x - 21, top - 8, 42, height + 16); px(ctx, '#49332f', x - 20, top - 8, 1, height + 16); px(ctx, '#49332f', x + 19, top - 8, 1, height + 16); px(ctx, '#472c32', x - 17, top - 8, 34, height + 16);
        for (let y = Math.floor(top / 40) * 40; y < top + height + 10; y += 40) { diamond(ctx, '#614033', x, y, 7); diamond(ctx, '#3e2630', x, y, 4); }
      }
    } else if (stageId === 'library') {
      for (let n = Math.floor(top / 384); n <= Math.ceil((top + height) / 384); n++) { const y = n * 384; px(ctx, '#263c3c', left - 8, y - 14, width + 16, 28); px(ctx, '#6a6b50', left - 8, y - 15, width + 16, 1); px(ctx, '#6a6b50', left - 8, y + 14, width + 16, 1); for (let x = Math.floor(left / 32) * 32; x < left + width + 10; x += 32) diamond(ctx, '#3c5150', x, y, 5); }
    } else if (stageId === 'foundry') {
      for (let n = Math.floor(left / 320); n <= Math.ceil((left + width) / 320); n++) {
        const x = n * 320; px(ctx, '#0f1016', x - 8, top - 8, 16, height + 16); px(ctx, '#4b3328', x - 7, top - 8, 2, height + 16); px(ctx, '#61412d', x + 5, top - 8, 2, height + 16);
        for (let y = Math.floor(top / 16) * 16; y < top + height + 16; y += 16) { px(ctx, '#6f3d2c', x - 4, y, 8, 3); px(ctx, '#c2783c', x - 3, y, 6, 1); }
      }
    }
    const spacing = stageId === 'library' ? 320 : 448;
    const minLandX = Math.floor((left - 180) / spacing), maxLandX = Math.ceil((left + width + 180) / spacing);
    const minLandY = Math.floor((top - 180) / spacing), maxLandY = Math.ceil((top + height + 180) / spacing);
    for (let y = minLandY; y <= maxLandY; y++) for (let x = minLandX; x <= maxLandX; x++) {
      const seed = hash(x, y, 11), lx = x * spacing + (stageId === 'library' ? 90 : 130), ly = y * spacing + 80;
      if (!visible(lx, ly, 170) || seed < .14) continue;
      const variant = Math.floor(seed * 9) % 3;
      ctx.globalAlpha = stageId === 'void' ? .82 : .8;
      ctx.drawImage(get(`land:${stageId}:${currentInverse}:${variant}`, () => {
        const art = landmark(stageId, variant); return currentInverse ? inversePlate(art, p.tint) : art;
      }), Math.floor(lx - 80), Math.floor(ly - 130)); ctx.globalAlpha = 1;
      if (quality === 'high') {
        const glow = get(`landglow:${stageId}:${currentInverse}`, () => {
          const art = surface(160, 160), c = art.getContext('2d'), gradient = c.createRadialGradient(80, 80, 3, 80, 80, 80);
          gradient.addColorStop(0, `${p.glow}12`); gradient.addColorStop(1, `${p.glow}00`); c.fillStyle = gradient; c.fillRect(0, 0, 160, 160); return art;
        });
        ctx.drawImage(glow, lx - 80, ly - 132);
      }
      if (currentCycle > 0) {
        ctx.globalAlpha = .3;
        const count = Math.min(6, currentCycle);
        for (let n = 0; n < count; n++) { const a = n * TAU / 6 - Math.PI / 2; diamond(ctx, p.glow, lx + Math.cos(a)*48, ly-44+Math.sin(a)*48, 2); }
        ctx.globalAlpha = 1;
      }
    }
    // Seeded ash and drifting dust use no particle allocations.
    const count = quality === 'high' ? 36 : 12;
    for (let n = 0; n < count; n++) {
      const x = left + fract(hash(n, 2) + drawTime * (.002 + n % 3 * .001)) * width;
      const y = top + fract(hash(n, 8) - drawTime * (stageId === 'foundry' ? .02 : .006)) * height;
      ctx.globalAlpha = .12 + (Math.sin(drawTime * 1.7 + n) + 1) * .12; px(ctx, p.glow, x, y, n % 9 ? 1 : 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function shadow(x, y, rx, ry, opacity = .4) {
    if (quality === 'low') return;
    const art = get('shadow', () => {
      const result = surface(48, 16), c = result.getContext('2d');
      c.fillStyle = '#050409'; c.beginPath(); c.ellipse(24, 8, 23, 7, 0, 0, TAU); c.fill(); return result;
    });
    ctx.globalAlpha = opacity; ctx.drawImage(art, Math.round(x - rx), Math.round(y - ry), rx * 2, ry * 2); ctx.globalAlpha = 1;
  }

  function drawProp(prop) {
    if (prop.hp <= 0 || !visible(prop.x, prop.y, 35)) return;
    shadow(prop.x, prop.y + 5, 9, 3);
    const kind = ({ cathedral: 'candle', library: 'book', foundry: 'barrel', void: 'crystal', spire: 'crystal' })[prop.kind] || prop.kind || 'candle';
    const art = get(`prop:${kind}:${Math.floor(drawTime * 5) % 2}`, () => propSprite(kind, Math.floor(drawTime * 5) % 2));
    ctx.drawImage(art, Math.round(prop.x - 12), Math.round(prop.y - 24), 24, 30);
    if (/candle|torch|brazier/.test(kind) && quality === 'high') ctx.drawImage(get('candleglow', () => {
      const art = surface(54, 54), c = art.getContext('2d'), glow = c.createRadialGradient(27, 27, 0, 27, 27, 27);
      glow.addColorStop(0, '#e3a35b1b'); glow.addColorStop(1, '#e3a35b00'); c.fillStyle = glow; c.fillRect(0, 0, 54, 54); return art;
    }), prop.x - 27, prop.y - 43);
  }

  function drawWall(obstacle) {
    const w = obstacle.width || 1, h = obstacle.height || 1;
    const x = obstacle.x - w / 2, y = obstacle.y - h / 2;
    if (!visible(obstacle.x, obstacle.y, Math.max(w, h) / 2 + 20)) return;
    const left = Math.max(x, cameraX - width / 2 - 8), right = Math.min(x + w, cameraX + width / 2 + 8);
    const top = Math.max(y, cameraY - height / 2 - 8), bottom = Math.min(y + h, cameraY + height / 2 + 8);
    if (left >= right || top >= bottom) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const art = get('librarywall', wallTile);
    for (let gy = Math.floor(top / 64) * 64; gy < bottom; gy += 64) for (let gx = Math.floor(left / 64) * 64; gx < right; gx += 64) ctx.drawImage(art, gx, gy);
    if (h > w) {
      // Corridor sidewalls follow the actual collision rectangle on the y axis.
      px(ctx, '#879b9d', x, y, 2, h); px(ctx, '#4b606c', x+2, y, 3, h);
      px(ctx, '#080e17', x+w-7, y, 7, h); px(ctx, '#748b90', x+w-7, y, 2, h); px(ctx, '#b8b58f', x+w-7, y, 1, h);
      const mid = x+w/2;
      for (let gy = Math.floor(top/96)*96+48; gy < bottom; gy += 96) {
        const ornamentWidth = Math.min(24,w-12);
        if (ornamentWidth > 5) { arch(ctx, mid-ornamentWidth/2, gy-26, ornamentWidth, 49, {edge:'#6d818a'}, false); diamond(ctx, '#b8ac7d', mid, gy, 4); px(ctx, '#d4e3d5', mid, gy-2, 1, 5); }
      }
      ctx.restore(); return;
    }
    px(ctx, '#998264', x, y, w, 2); px(ctx, '#5b4e49', x, y + 2, w, 3);
    px(ctx, '#0a0b13', x, y + h - 7, w, 7); px(ctx, '#8b7352', x, y + h - 7, w, 2); px(ctx, '#d0ad6b', x, y + h - 7, w, 1);
    for (let gx = Math.floor(left / 96) * 96 + 48; gx < right; gx += 96) {
      if (h > 30) { arch(ctx, gx - 12, y + 9, 24, Math.min(44, h - 21), { edge: '#6f635e' }, false); diamond(ctx, '#a18a63', gx, y + Math.min(30, h / 2), 4); px(ctx, '#d6c393', gx, y + Math.min(29, h / 2), 1, 3); }
    }
    ctx.restore();
  }

  function drawPillar(obstacle) {
    const w = obstacle.width || 32, h = obstacle.height || 32;
    if (!visible(obstacle.x, obstacle.y, Math.max(w, h) + 40)) return;
    shadow(obstacle.x + 3, obstacle.y + h / 2, w * .65, 7, .6);
    const art = get('foundrypillar', pillarSprite);
    // Its base occupies the collision rectangle; the tower projects above it.
    ctx.drawImage(art, Math.round(obstacle.x - w / 2 - 3), Math.round(obstacle.y - h / 2 - 25), w + 6, h + 28);
  }

  function drawPickup(item) {
    if (item.kind === 'stageitem' || item.kind === 'arsenal') return; // Authored acquisitions have distinct scenery below.
    if (!visible(item.x, item.y, item.kind === 'merchant' || item.kind === 'coffin' ? 60 : 25)) return;
    const kind = item.kind || 'xp', isXP = kind === 'xp', objective = kind === 'coffin' || kind === 'merchant';
    const size = isXP ? ((item.value || 1) >= 15 ? 17 : 13) : objective ? 28 : kind === 'chest' ? 25 : 19;
    const bounce = isXP || objective ? 0 : Math.sin(drawTime * 3 + item.x * .05) * 1.2;
    if (kind === 'chest' || kind === 'relic' || kind === 'coffin') {
      ctx.globalAlpha = .09 + Math.sin(drawTime * 4) * .025;
      poly(ctx, kind === 'chest' ? GOLD : '#b39acb', [[item.x - 10, item.y + 6], [item.x - 20, item.y - 48], [item.x + 20, item.y - 48], [item.x + 10, item.y + 6]]); ctx.globalAlpha = 1;
      circle(ctx, kind === 'chest' ? '#927442' : '#7b639a', item.x, item.y + 4, 13 + Math.sin(drawTime * 3), .7);
    }
    const variant = isXP ? ((item.value || 1) >= 15 ? 15 : (item.value || 1) >= 4 ? 4 : 1) : 1;
    const frame = Math.floor(drawTime * 3) % 2;
    const art = get(`pickup:${kind}:${variant}:${frame}`, () => pickupSprite(kind, variant, frame));
    const tall = size * art.height / art.width;
    if (objective) shadow(item.x, item.y + 4, 12, 4);
    ctx.drawImage(art, Math.round(item.x - size / 2), Math.round(item.y - (objective ? tall - 6 : size * .7) + bounce), size, tall);
    if (objective) {
      ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.strokeStyle = '#0c0912'; ctx.lineWidth = 2; ctx.strokeText(kind === 'merchant' ? 'BROKER' : 'RESCUE', item.x, item.y - tall - 1);
      ctx.fillStyle = kind === 'merchant' ? '#a5d2b1' : '#e2cb9b'; ctx.fillText(kind === 'merchant' ? 'BROKER' : 'RESCUE', item.x, item.y - tall - 1);
    }
  }

  function drawObjective(run) {
    const objective = run.objective;
    if (!objective || objective.state === 'rescued' || !visible(objective.x, objective.y, 65)) return;
    if (!(run.pickups || []).some(item => item.kind === 'coffin')) drawPickup({ ...objective, kind: 'coffin' });
    const sealed = objective.state === 'sealed', count = objective.guardCount || 4, killed = objective.guardsKilled || 0;
    circle(ctx, sealed ? '#72617d' : '#9fbc93', objective.x, objective.y + 3, 25, .8);
    for (let n = 0; n < count; n++) { const a = n * TAU / count + Math.PI / 4; diamond(ctx, n < killed ? '#dbc68f' : '#80658e', objective.x + Math.cos(a) * 25, objective.y + 3 + Math.sin(a) * 25, n < killed ? 2 : 2.5); }
    ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = sealed ? '#c6b6d1' : '#c8dfa4'; ctx.strokeStyle = '#0b0812'; ctx.lineWidth = 2;
    const label = sealed ? `${Math.max(0, count - killed)} GUARDIANS` : 'BREAK THE SEAL';
    ctx.strokeText(label, objective.x, objective.y + 37); ctx.fillText(label, objective.x, objective.y + 37);
  }

  function drawStageItems(run) {
    for (const item of run.stageItems || []) {
      if (!visible(item.x, item.y, 80)) continue;
      const collected = item.collected || item.state === 'collected';
      const open = item.state === 'open', tint = open ? '#b3d4a6' : '#baa0cf';
      if (collected) {
        ctx.globalAlpha = .3; circle(ctx, '#80745f', item.x, item.y+4, 16, .7);
        diamond(ctx, '#80745f', item.x, item.y+4, 3); ctx.globalAlpha = 1; continue;
      }
      shadow(item.x, item.y+5, 19, 5, .5);
      ctx.globalAlpha = open ? .7 : .4;
      circle(ctx, tint, item.x, item.y+5, 23, .6); circle(ctx, tint, item.x, item.y+5, 19, .5);
      for (let n = 0; n < 4; n++) { const a = n*Math.PI/2+drawTime*.13; diamond(ctx, tint, item.x+Math.cos(a)*23, item.y+5+Math.sin(a)*23, 1.4); }
      ctx.globalAlpha = 1;
      ctx.drawImage(get(`stageitem:${item.passiveId}:${open}`, () => passivePedestal(item.passiveId, open)), item.x-26, item.y-48);
      if (open && quality === 'high') {
        ctx.globalAlpha = .13;
        poly(ctx, tint, [[item.x-6,item.y-9],[item.x-16,item.y-55],[item.x+16,item.y-55],[item.x+6,item.y-9]]);
        ctx.globalAlpha = 1;
      }
      const name = passiveDefinition[item.passiveId]?.name;
      if (name) {
        ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#09070e';
        ctx.strokeText(name.toUpperCase(), item.x, item.y+23); ctx.fillStyle = tint; ctx.fillText(name.toUpperCase(), item.x, item.y+23);
      }
    }
  }

  function drawArsenal(run) {
    const vault = run.stage?.arsenal || (catalog.stages || []).find(stage => stage.id === currentStage)?.arsenal;
    if (!vault || !visible(vault.x, vault.y, 85)) return;
    const collected = run.arsenalCollected === true;
    shadow(vault.x, vault.y+5, 22, 6, .5);
    ctx.globalAlpha = collected ? .35 : .7;
    circle(ctx, collected ? '#74664e' : GOLD, vault.x, vault.y+5, 26, .7);
    for (let n = 0; n < 4; n++) { const a = n*Math.PI/2; diamond(ctx, collected ? '#74664e' : '#dbc38b', vault.x+Math.cos(a)*26, vault.y+5+Math.sin(a)*26, 2); }
    ctx.globalAlpha = collected ? .6 : 1;
    ctx.drawImage(get(`arsenal:${collected}`, () => arsenalVault(collected)), vault.x-29, vault.y-56);
    ctx.globalAlpha = 1;
    if (!collected && vault.name) {
      ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#09070e';
      ctx.strokeText(vault.name.toUpperCase(), vault.x, vault.y+24); ctx.fillStyle = '#e1c98e'; ctx.fillText(vault.name.toUpperCase(), vault.x, vault.y+24);
    }
  }

  function drawEnemy(enemy) {
    if (enemy.hp <= 0 || !visible(enemy.x, enemy.y, (enemy.r || 8) * 4)) return;
    const kind = typeof enemy.kind === 'string' ? enemy.kind : enemy.kind?.id || 'xss';
    const radius = enemy.r || (enemy.boss ? 23 : 8), isBoss = !!enemy.boss;
    const variant = isBoss ? 'boss' : enemy.elite ? 'elite' : '';
    const frame = Math.floor(drawTime * (kind === 'ssrf' ? 9 : 6) + (typeof enemy.id === 'number' ? enemy.id * .23 : enemy.x * .04)) % 4;
    const final = enemy.final === true, phase = clamp(Math.floor(enemy.phase || 0), 0, 2);
    const art = final ? get(`final:${phase}:${frame}`, () => finalBossSprite(frame, phase)) : get(`enemy:${kind}:${variant}:${frame}`, () => enemySprite(kind, frame, variant));
    const size = radius * (final ? 5.1 : kind === 'ssrf' ? 4.1 : 3.45), x = Math.round(enemy.x), y = Math.round(enemy.y), lift = kind === 'ssrf' ? -4 + Math.sin(drawTime * 7 + enemy.x) * 2 : 0;
    shadow(x, y + radius * .65, radius * 1.25, radius * .38, isBoss ? .55 : .35);
    if (enemy.windup > 0 && enemy.chargeAngle != null) {
      const angle = enemy.chargeAngle;
      const reach = (enemy.speed || 22) * (catalog.config?.authChargeMultiplier || 3.2) * (catalog.config?.authChargeTime || .6);
      const tx = x + Math.cos(angle) * reach, ty = y + Math.sin(angle) * reach;
      ctx.globalAlpha = .65; line(ctx, '#e59994', [[x, y + 3], [tx, ty + 3]], 1);
      line(ctx, '#f2b4a2', [[tx + Math.cos(angle + 2.5) * 7, ty + 3 + Math.sin(angle + 2.5) * 7], [tx, ty + 3], [tx + Math.cos(angle - 2.5) * 7, ty + 3 + Math.sin(angle - 2.5) * 7]], 1.2); ctx.globalAlpha = 1;
    }
    if (enemy.elite || isBoss) {
      circle(ctx, isBoss ? '#a54b67' : '#858f74', x, y + radius * .65, radius * 1.45, 1);
      if (isBoss) {
        const a = drawTime * .5;
        for (let n = 0; n < 6; n++) { const angle = a + n * TAU / 6; diamond(ctx, '#ab5268', x + Math.cos(angle) * radius * 1.5, y + radius * .65 + Math.sin(angle) * radius * .45, 1.5); }
        const wardRadius = radius * (final ? 2.15 : 1.75);
        ctx.save(); ctx.translate(x, y-radius*.3); ctx.rotate(-drawTime*.18);
        ctx.globalAlpha = .5; ctx.strokeStyle = phase > 1 ? '#dbaf8e' : '#b97e9e'; ctx.lineWidth = .7;
        for (let n = 0; n <= phase; n++) { const start = n*TAU/3+.1; ctx.beginPath(); ctx.arc(0, 0, wardRadius+n*3, start, start+TAU/3-.35); ctx.stroke(); }
        ctx.restore();
        if ((enemy.age || 0) < 2.2) {
          const arrival = clamp(1-(enemy.age || 0)/2.2, 0, 1), reach = radius*(2+arrival*2.5);
          ctx.globalAlpha = arrival*.55;
          circle(ctx, '#dbaea2', x, y+3, reach, .8);
          for (let n = 0; n < 4; n++) { const a = Math.PI/4+n*Math.PI/2; star(ctx, '#e9c4a5', x+Math.cos(a)*reach, y+3+Math.sin(a)*reach, 2); }
          ctx.globalAlpha = 1;
        }
      }
    }
    if (enemy.hit > 0) ctx.globalAlpha = .58 + Math.sin(drawTime * 90) * .2;
    ctx.drawImage(art, Math.round(x - size / 2), Math.round(y - size * .64 + lift), size, size);
    ctx.globalAlpha = 1;
    if (enemy.frozen > 0) {
      const frostSize = radius*3.2, frostFrame = quality === 'high' ? Math.floor(drawTime*3)%2 : 0;
      ctx.globalAlpha = .85;
      ctx.drawImage(get(`frost:${frostFrame}`, () => frozenWardSprite(frostFrame)), x-frostSize/2, y-frostSize*.65, frostSize, frostSize);
      ctx.globalAlpha = 1;
    }
    if (enemy.hit > 0 && quality === 'high') { star(ctx, '#f3dbc3', x + radius * .4, y - radius * .5, 3); }
    if (isBoss || enemy.elite || (enemy.hit > 0 && (enemy.maxHp || 1) > 20)) {
      const barWidth = isBoss ? Math.max(40, radius * 2.5) : radius * 2.1, barY = Math.round(y - size * .64 - 5);
      px(ctx, '#09070e', x - barWidth / 2 - 1, barY - 1, barWidth + 2, 4); px(ctx, '#412736', x - barWidth / 2, barY, barWidth, 2); px(ctx, isBoss ? '#c85a6a' : '#ba9b64', x - barWidth / 2, barY, barWidth * clamp(enemy.hp / (enemy.maxHp || enemy.hp), 0, 1), 2);
      if (isBoss || enemy.elite) {
        const label = definition[kind]?.threat?.tag || THREAT_CLASS[kind] || kind.toUpperCase(), badgeWidth = label.length * 3.4 + 7;
        px(ctx, '#100c17', x - badgeWidth / 2, barY - 10, badgeWidth, 7);
        line(ctx, isBoss ? '#aa5c6d' : '#9b8255', [[x - badgeWidth / 2, barY - 3], [x + badgeWidth / 2, barY - 3]], .6);
        ctx.font = '5.5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = isBoss ? '#f1bac0' : '#e9cc92'; ctx.fillText(label, x, barY - 5);
      }
      if (isBoss) {
        const name = definition[kind]?.name || kind.toUpperCase(); ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8c7bc'; ctx.fillText(`${name.toUpperCase()} · PHASE ${(enemy.phase || 0) + 1}`, x, barY - 13);
      }
    }
    if (!isBoss && !enemy.elite && nearbyLabelBudget > 0 && Math.hypot(enemy.x - cameraX, enemy.y - cameraY) < (catalog.intel?.labelRange || 0)) {
      nearbyLabelBudget--;
      const label = definition[kind]?.threat?.tag || THREAT_CLASS[kind] || kind.toUpperCase();
      ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.strokeStyle = '#0b0811'; ctx.lineWidth = 2;
      ctx.strokeText(label, x, y + radius + 9); ctx.fillStyle = '#bfa68b'; ctx.fillText(label, x, y + radius + 9);
    }
  }

  function drawPlayer(player, characterId, moving = false, run) {
    const x = Math.round(player.x), y = Math.round(player.y), face = Number(player.face) || 0;
    const facing = Math.cos(face) < 0 ? -1 : 1, frame = moving ? Math.floor(drawTime * 9) % 4 : Math.floor(drawTime * 1.8) % 2 * 2;
    const art = get(`char:${characterId}:${frame}`, () => characterSprite(characterId, frame));
    const size = 26, tall = size * 48 / 40;
    shadow(x, y + 7, 10, 3.5, .55);
    if ((run?.stats?.evolutions || 0) > 0) {
      const tint = PALETTES[characterId]?.[5] || GOLD;
      ctx.globalAlpha = quality === 'low' ? .28 : .4;
      for (const side of [-1, 1]) {
        const lift = Math.sin(drawTime*2)*2;
        line(ctx, tint, [[x+side*4,y-9],[x+side*13,y-15-lift],[x+side*24,y-22-lift],[x+side*19,y-7],[x+side*11,y]], .8);
        if (quality === 'high') {
          line(ctx, tint, [[x+side*7,y-7],[x+side*21,y-15-lift],[x+side*15,y-3]], .6);
          diamond(ctx, tint, x+side*22, y-19-lift, 1.5);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (player.invulnerable > 0) {
      ctx.globalAlpha = .5 + Math.sin(drawTime * 16) * .15; circle(ctx, player.dashTime > 0 ? '#e6c57c' : '#b5c9bd', x, y - 4, 16, .8); ctx.globalAlpha = 1;
      for (let n = 0; n < 4; n++) { const angle = drawTime * 2 + n * TAU / 4; diamond(ctx, '#e1ce9a', x + Math.cos(angle) * 16, y - 4 + Math.sin(angle) * 16, 1.5); }
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(facing, 1);
    if (player.invulnerable > 0 && Math.floor(drawTime * 13) % 3 === 0) ctx.globalAlpha = .55;
    ctx.drawImage(art, -size / 2, -tall + 9, size, tall); ctx.restore();
    // Small gold feet marker stays readable under late-game effects.
    line(ctx, '#d8be7d', [[x - 3, y + 12], [x, y + 14], [x + 3, y + 12]], .8);
    const shieldMax = Math.max(0, Math.floor(Number(player.shieldMax) || 0));
    if (shieldMax > 0) {
      const charges = clamp(Math.floor(Number(player.shieldCharges) || 0), 0, shieldMax);
      const evolved = run?.weapons?.some(weapon => weapon.id === 'aegis' && weapon.evolved) === true;
      const chargeArt = get(`shieldcharge:${evolved}`, () => shieldChargeSprite(evolved));
      // A bounded ring of small wards shows real available charges, including empty slots.
      const shown = Math.min(12, shieldMax);
      for (let n = 0; n < shown; n++) {
        const a = shown === 1 ? -Math.PI/2 : -Math.PI*.86+n*Math.PI*.72/(shown-1);
        ctx.globalAlpha = n < charges ? .95 : .2;
        ctx.drawImage(chargeArt, x+Math.cos(a)*25-3.5, y-13+Math.sin(a)*25-4.5, 7, 9);
      }
      ctx.globalAlpha = 1;
      if (shieldMax > shown) { ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#c4ddd5'; ctx.fillText(`${charges}/${shieldMax}`, x, y-45); }
    }
  }

  function projectile(projectile) {
    const x = projectile.x, y = projectile.y, radius = projectile.r || 4;
    if (!visible(x, y, radius + 30)) return;
    const kind = projectile.kind || 'wand', color = projectile.color || WEAPON_COLORS[kind] || GOLD;
    const angle = projectile.angle ?? Math.atan2(projectile.vy || 0, projectile.vx || 1);
    const union = projectile.union || projectile.weapon?.union;
    const evolved = projectile.evolved || projectile.weapon?.evolved || union;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(angle);
    if (evolved && !projectile.enemy) {
      ctx.globalAlpha = .24;
      poly(ctx, kind === 'knife' ? '#d3869b' : kind === 'fireball' ? '#a1d8df' : '#e7d7b1', [[-radius * 6, -1], [-radius, -radius * 1.5], [radius, 0], [-radius, radius * 1.5]]);
      ctx.globalAlpha = 1;
      for (let n = 0; n < 3; n++) { const d = 4 + n * 5; px(ctx, n % 2 ? '#f4ddac' : color, -d, (n % 2 ? -1 : 1) * (radius + 1), 1, 1); }
    }
    if (projectile.enemy) {
      // Warm outlined hostile ammunition never resembles blue knowledge gems.
      ctx.globalAlpha = .4; line(ctx, '#b74e66', [[-radius * 4, 0], [0, 0]], radius * 1.4); ctx.globalAlpha = 1;
      diamond(ctx, '#3b182e', 0, 0, radius + 1.5); diamond(ctx, '#dd7488', 0, 0, radius); diamond(ctx, '#ffe0c8', 1, 0, radius * .4);
    } else if (kind === 'knife') {
      px(ctx, '#496772', -14, -1, 11, 2); poly(ctx, '#829ba2', [[-4, -2], [5, -2], [10, 0], [5, 2], [-4, 2]]); px(ctx, '#eff8f0', -2, -1, 8, 1); px(ctx, '#aa8757', -5, -3, 2, 6); px(ctx, '#614336', -9, -1, 4, 2);
      if (evolved) { line(ctx, '#e79ca6', [[-6, -4], [2, -4], [7, 0]], .8); line(ctx, '#f0c2c5', [[-6, 4], [2, 4], [7, 0]], .8); }
    } else if (kind === 'wand' || kind === 'bolt') {
      ctx.globalAlpha = .32; poly(ctx, color, [[-20, 0], [-3, -3], [6, 0], [-3, 3]]); ctx.globalAlpha = 1;
      px(ctx, '#426375', -11, -1, 8, 2); diamond(ctx, color, 0, 0, radius + 1); px(ctx, '#f5ffff', -1, -1, 4, 2); star(ctx, color, -4, 0, 3);
      if (evolved) { circle(ctx, '#d6edf2', 0, 0, radius + 3, .8); star(ctx, '#f0f9f2', 1, 0, radius + 2); }
    } else if (kind === 'fireball') {
      const flick = Math.floor(drawTime * 17) % 3;
      poly(ctx, '#9a3e45', [[-radius * 4, -radius], [-radius * 1.7, -radius * 1.1], [-radius * 3, 1], [-radius * 1.2, radius], [0, radius * 1.1], [radius, 0], [0, -radius]]);
      pixelDisc(ctx, '#d47a4b', 0, 0, radius + 1); pixelDisc(ctx, '#f7c571', 1, 0, radius * .7); pixelDisc(ctx, '#fff0b6', 2, -1, radius * .35); px(ctx, '#ffc775', -radius * 2 - flick, -radius + 1, 2, 1);
      if (evolved) { circle(ctx, '#a4dce2', 0, 0, radius + 3, .8); pixelDisc(ctx, '#b4e0e7', 2, -1, radius * .6); px(ctx, '#fffefa', 2, -2, 2, 2); }
    } else if (kind === 'axe' || kind === 'scythe') {
      ctx.rotate(drawTime * 10); line(ctx, '#b29072', [[-radius, radius * 1.8], [radius * .7, -radius * 1.6]], 2);
      if (kind === 'scythe') { poly(ctx, '#e6d9ec', [[radius, -radius * 1.3], [-radius, -radius * 2], [-radius * 2.5, -radius], [-radius * 3, radius], [-radius * 1.5, -.5 * radius], [radius, -.8 * radius]]); }
      else { poly(ctx, '#cdb1bc', [[0, -radius], [-radius, -radius * 1.8], [-radius * 2, -radius], [-radius * 1.6, radius * .5], [-radius * .2, radius], [radius * .4, -radius * .3], [radius * 1.7, radius * .3], [radius * 2.1, -radius * .9], [radius, -radius * 1.5]]); line(ctx, '#fff0e4', [[-radius * 2, -radius], [-radius * 1.6, radius * .5], [-radius * .2, radius]]); }
    } else if (kind === 'cross') {
      ctx.rotate(drawTime * 7); px(ctx, '#467761', -radius * .5, -radius * 2, radius, radius * 4); px(ctx, '#467761', -radius * 2, -radius * .5, radius * 4, radius); px(ctx, '#c7e5bd', -1, -radius * 2, 2, radius * 4); px(ctx, '#c7e5bd', -radius * 2, -1, radius * 4, 2); diamond(ctx, '#f9e4a9', 0, 0, radius * .7);
      if (evolved) { circle(ctx, '#f1deb1', 0, 0, radius * 2.25, .6); for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2; star(ctx, '#e1e7c3', Math.cos(a) * radius * 2, Math.sin(a) * radius * 2, 2); } }
      if (union) {
        for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2; ctx.save(); ctx.rotate(a); poly(ctx, '#bfb1d9', [[radius * 1.6, -2], [radius * 3.5, -radius], [radius * 2.5, 1], [radius * 3, 3], [radius * 1.6, 2]]); ctx.restore(); }
      }
    } else if (kind === 'birds') {
      const flap = Math.floor(drawTime * 13) % 2 ? -radius * 1.7 : radius;
      poly(ctx, '#9e9ec4', [[0, 0], [-radius * 1.6, flap], [-radius * 2.8, flap - radius], [-radius, -radius * .4], [radius, -radius * .4], [radius * 2.8, flap - radius], [radius * 1.6, flap]]); line(ctx, '#f1e7ee', [[-radius * 2.3, flap - radius * .5], [0, -1], [radius * 2.3, flap - radius * .5]]); diamond(ctx, '#e5d6ab', 0, 0, 2.5);
    } else if (kind === 'orbit') {
      ctx.rotate(-angle + drawTime * 3); circle(ctx, '#a28a55', 0, 0, radius + 1); diamond(ctx, '#d5bf83', 0, 0, radius); diamond(ctx, '#55463c', 0, 0, radius * .62); star(ctx, '#ffe6b4', 0, 0, radius * .8);
      if (evolved) { circle(ctx, '#d9d2a4', 0, 0, radius + 3); px(ctx, '#f7e5b7', -2, -2, 4, 4); px(ctx, '#4b3c43', -2, -1); px(ctx, '#4b3c43', 1, -1); }
    } else if (kind === 'rune') {
      ctx.rotate(drawTime * 1.4); circle(ctx, '#aa8ed0', 0, 0, radius + 1); line(ctx, '#e5cafa', [[0, -radius], [radius, radius * .5], [-radius, radius * .5], [0, -radius]]); px(ctx, '#fff1e6', -1, -1, 2, 2);
      if (evolved) { circle(ctx, '#f6decb', 0, 0, radius + 4); line(ctx, '#c6b1ec', [[0, radius], [radius, -radius * .5], [-radius, -radius * .5], [0, radius]]); }
    } else { star(ctx, color, 0, 0, radius + 2); diamond(ctx, '#fff0dc', 0, 0, radius * .6); }
    ctx.restore();
  }

  function lightning(effect, alpha) {
    const endX = effect.targetX ?? effect.x, endY = effect.targetY ?? effect.y;
    const startX = effect.targetX == null ? effect.x - 8 : effect.x, startY = effect.targetY == null ? effect.y - height * .65 : effect.y;
    const points = [[startX, startY]];
    for (let n = 1; n < 8; n++) { const t = n / 8; points.push([startX + (endX - startX) * t + (hash(n, Math.floor(drawTime * 24), 7) - .5) * 17, startY + (endY - startY) * t]); }
    points.push([endX, endY]); ctx.globalAlpha = alpha * .3; line(ctx, '#7aa6d5', points, 7); ctx.globalAlpha = alpha; line(ctx, '#bbdced', points, 2.7); line(ctx, '#f6ffed', points, 1); star(ctx, '#f1ffff', endX, endY, 7);
  }

  function effect(effect, foreground) {
    const kind = effect.kind || effect.type || 'impact';
    const behind = ['pool', 'rune', 'birds', 'warning', 'telegraph', 'freeze', 'shield', 'timebeam'].includes(kind);
    if (foreground === behind) return;
    if (!visible(effect.x || 0, effect.y || 0, (effect.shape === 'line' ? (effect.length || 0) / 2 : effect.radius || 0) + 90) && kind !== 'lightning') return;
    const max = effect.max || effect.maxLife || 1, life = clamp((effect.life ?? max) / max, 0, 1), age = 1 - life;
    const x = effect.x || 0, y = effect.y || 0, radius = effect.radius || effect.r || 18;
    const color = effect.color || WEAPON_COLORS[effect.weapon || kind] || GOLD;
    ctx.save(); ctx.globalAlpha = Math.min(1, life * 3);
    if (kind === 'warning' || kind === 'telegraph') {
      const pulse = .14 + Math.sin(drawTime * 15) * .06;
      const inner = effect.shape === 'ring' ? effect.innerRadius || radius * .6 : 0;
      if (effect.shape === 'line') {
        const length = effect.length || radius * 8;
        ctx.translate(x, y); ctx.rotate(effect.angle || 0); ctx.globalAlpha = pulse; px(ctx, '#d34461', -length / 2, -radius, length, radius * 2);
        ctx.globalAlpha = .7; line(ctx, '#e58e92', [[-length / 2, -radius], [length / 2, -radius]], .8); line(ctx, '#e58e92', [[-length / 2, radius], [length / 2, radius]], .8);
        for (let n = -length / 2; n < length / 2; n += 20) line(ctx, '#a85069', [[n, radius - 1], [n + radius * 2 - 2, -radius + 1]], .7);
        ctx.restore(); return;
      }
      else {
        ctx.globalAlpha = pulse; pixelRing(ctx, '#d34461', x, y, Math.min(radius, 260), inner); ctx.globalAlpha = .65;
        circle(ctx, '#df6d7a', x, y, radius, .8);
        if (inner) circle(ctx, '#efb4a0', x, y, inner, .8);
        else circle(ctx, '#9c3e58', x, y, Math.max(2, radius * (.65 + Math.sin(drawTime * 7) * .08)), .7);
        for (let n = 0; n < 8; n++) { const a = drawTime * .7 + n * TAU / 8; line(ctx, '#ffc0b0', [[x + Math.cos(a) * (radius - 4), y + Math.sin(a) * (radius - 4)], [x + Math.cos(a) * radius, y + Math.sin(a) * radius]], 2); }
      }
      if (!inner) diamond(ctx, '#ffb8a6', x, y, 2);
    } else if (kind === 'timebeam') {
      const length = Math.max(0, Number(effect.length) || 0), beamWidth = Math.max(1, Number(effect.width) || 1);
      ctx.translate(x, y); ctx.rotate(effect.angle || 0);
      ctx.globalAlpha = Math.min(.85, life*2);
      ctx.drawImage(get(`timebeam:${effect.evolved === true}`, () => timeBeamSprite(effect.evolved === true)), 0, -beamWidth/2, length, beamWidth);
      if (quality === 'high' && length > 0) {
        const dialRadius = Math.min(7,beamWidth*.42), dialX = Math.max(dialRadius,length-dialRadius);
        circle(ctx, effect.evolved ? '#d6c791' : '#c2e5e8', dialX, 0, dialRadius, .7);
        line(ctx, '#e0efdf', [[dialX-dialRadius*.6,0],[dialX,0],[dialX,-dialRadius*.7]], .8);
      }
    } else if (kind === 'shield') {
      const r = Math.max(1, radius), evolved = effect.evolved === true;
      ctx.globalAlpha = life*(effect.blocked ? .85 : .5);
      ctx.drawImage(get(`shieldward:${evolved}`, () => shieldWardSprite(evolved)), x-r, y-r, r*2, r*2);
      if (effect.blocked) {
        ctx.globalAlpha = life*.85;
        const count = quality === 'high' ? 6 : 3;
        for (let n = 0; n < count; n++) { const a = n*TAU/count; line(ctx, evolved ? '#e9d99f' : '#c3e8e0', [[x+Math.cos(a)*r*.75,y+Math.sin(a)*r*.75],[x+Math.cos(a)*r*(.85+age*.25),y+Math.sin(a)*r*(.85+age*.25)]], .8); }
      }
    } else if (kind === 'pool') {
      const hostile = effect.enemy === true;
      const inner = hostile && effect.shape === 'ring' ? effect.innerRadius || radius * .6 : 0;
      if (effect.shape === 'line') {
        const length = effect.length || radius * 8;
        ctx.translate(x, y); ctx.rotate(effect.angle || 0); ctx.globalAlpha = .3 * Math.min(1, life * 5); px(ctx, hostile ? '#b63e5d' : '#659c87', -length / 2, -radius, length, radius * 2);
        ctx.globalAlpha = .85 * Math.min(1, life * 5); line(ctx, hostile ? '#f09c9c' : '#b2e2b6', [[-length / 2, -radius], [length / 2, -radius]], 1.2); line(ctx, hostile ? '#f09c9c' : '#b2e2b6', [[-length / 2, radius], [length / 2, radius]], 1.2);
        for (let n = -length / 2; n < length / 2; n += 18) { const yOffset = Math.sin(n + drawTime * 7) * radius * .6; diamond(ctx, hostile ? '#ffc0aa' : '#b2e2b6', n, yOffset, 1.2); }
        ctx.restore(); return;
      }
      ctx.globalAlpha = (hostile ? .3 : .22) * Math.min(1, life * 5); pixelRing(ctx, hostile ? '#ad3656' : '#4e947e', x, y, Math.min(radius, 240), inner); ctx.globalAlpha = .6 * Math.min(1, life * 5);
      const seed = Math.floor(x + y);
      for (let n = 0; n < (quality === 'high' ? 12 : 5); n++) { const a = hash(n, seed) * TAU + drawTime * .1, d = inner ? inner + 5 + hash(seed, n) * Math.max(0, radius - inner - 10) : Math.sqrt(hash(seed, n)) * radius * .85; const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d; circle(ctx, hostile ? '#e29b9c' : '#8bc6a5', bx, by, 1 + fract(drawTime * .7 + n * .37) * 3, .7); }
      circle(ctx, hostile ? '#e08791' : '#427b66', x, y, radius, hostile ? 1.5 : 1); circle(ctx, hostile ? '#a74664' : '#79b49a', x, y, inner || radius * .88, .6);
      if (hostile) { for (let n = 0; n < 8; n++) { const a = n * TAU / 8; diamond(ctx, '#f6b09e', x + Math.cos(a) * radius, y + Math.sin(a) * radius, 1.5); } }
    } else if (kind === 'birds') {
      // Friendly recon bombardment: a lilac reticle, black ravens and falling shards.
      ctx.globalAlpha = life * .45; circle(ctx, '#9b9fcc', x, y, radius, .8); circle(ctx, '#777ba7', x, y, radius * .7, .6);
      line(ctx, '#b8bddc', [[x - radius - 3, y], [x - radius + 3, y]]); line(ctx, '#b8bddc', [[x + radius - 3, y], [x + radius + 3, y]]);
      ctx.globalAlpha = Math.min(1, life * 2);
      for (let n = 0; n < 3; n++) {
        const angle = n * TAU / 3 + drawTime, d = radius * .5, bx = x + Math.cos(angle) * d, by = y + Math.sin(angle) * d;
        const fall = fract(age * 3 + n * .31); line(ctx, '#aaaed5', [[bx - 2, by - 18 + fall * 16], [bx, by - 10 + fall * 16]], 1); diamond(ctx, '#e3d7e8', bx, by - 9 + fall * 16, 1.5);
      }
      const flap = Math.sin(drawTime * 18) * 3, birdY = y - radius - 8;
      poly(ctx, '#8283ad', [[x, birdY], [x - 4, birdY - 3 + flap], [x - 9, birdY - 5 + flap], [x - 6, birdY + 1], [x - 1, birdY + 3], [x + 1, birdY + 3], [x + 6, birdY + 1], [x + 9, birdY - 5 + flap], [x + 4, birdY - 3 + flap]]); px(ctx, '#e9e0ed', x, birdY, 1, 2);
      if (effect.union) {
        circle(ctx, '#d9bf80', x, y, radius * 1.14, 1); line(ctx, '#d9d9b0', [[x - radius * .65, y], [x + radius * .65, y]], 1.5); line(ctx, '#d9d9b0', [[x, y - radius * .65], [x, y + radius * .65]], 1.5);
        diamond(ctx, '#e7d39d', x, y, 4); diamond(ctx, '#807796', x, y, 2);
        for (let n = 0; n < 4; n++) { const a = drawTime * 2 + n * Math.PI / 2; star(ctx, '#e6d9b0', x + Math.cos(a) * radius, y + Math.sin(a) * radius, 2); }
      }
    } else if (kind === 'rune') {
      ctx.globalAlpha = .25 + Math.sin(drawTime * 4) * .08; circle(ctx, '#ac87cb', x, y, radius, 2); circle(ctx, '#766096', x, y, radius * .8);
      const points = []; for (let n = 0; n < 7; n++) { const a = -Math.PI / 2 + n * TAU / 3; points.push([x + Math.cos(a) * radius * .85, y + Math.sin(a) * radius * .85]); } line(ctx, '#c3a1d5', points, 1);
      ctx.globalAlpha = .6; for (let n = 0; n < 6; n++) { const a = n * TAU / 6 + drawTime * .15; diamond(ctx, '#d2b2e4', x + Math.cos(a) * radius, y + Math.sin(a) * radius, 2); }
    } else if (kind === 'slash' || kind === 'whip') {
      const angle = effect.angle || 0, spread = effect.spread || 1.8, r = radius * (.65 + age * .35);
      ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = life * .25;
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -spread / 2, spread / 2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = Math.min(1, life * 2); ctx.lineWidth = 3; ctx.strokeStyle = effect.evolved ? '#ad425f' : '#a87349'; ctx.beginPath(); ctx.arc(0, 0, r * .92, -spread / 2, spread / 2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = effect.evolved ? '#f0a6b2' : '#f1d7a0'; ctx.beginPath(); ctx.arc(0, 0, r, -spread / 2, spread / 2); ctx.stroke();
      if (effect.evolved) { ctx.lineWidth = .7; ctx.strokeStyle = '#f5ddc0'; ctx.beginPath(); ctx.arc(0, 0, r * .8, -spread / 2, spread / 2); ctx.stroke(); }
      for (let n = 0; n < 5; n++) { const a = -spread / 2 + n * spread / 4; diamond(ctx, '#f8e9c3', Math.cos(a) * r, Math.sin(a) * r, 1.3); }
    } else if (kind === 'lightning') lightning(effect, Math.min(1, life * 3));
    else if (kind === 'pentagram') {
      const r = radius * (.7 + age * .3); ctx.globalAlpha = life * .65; circle(ctx, '#b677ba', x, y, r, 2); circle(ctx, '#e3b4d4', x, y, r * .89);
      const points = []; for (let n = 0; n <= 5; n++) { const a = -Math.PI / 2 + n * 4 * Math.PI / 5 + age * .2; points.push([x + Math.cos(a) * r * .83, y + Math.sin(a) * r * .83]); } line(ctx, '#d3b0d9', points, 2);
      if (effect.evolved) { circle(ctx, '#f2d8a3', x, y, r * 1.07, 1.5); circle(ctx, '#e7c89d', x, y, r * .69); star(ctx, '#f6dfb9', x, y, 9); }
      for (let n = 0; n < 14; n++) { const a = n * TAU / 14 + age; diamond(ctx, '#ffdbef', x + Math.cos(a) * r * .96, y + Math.sin(a) * r * .96, 2); }
    } else if (kind === 'text' || kind === 'damage' || kind === 'disclosure') {
      const text = String(effect.text ?? effect.value ?? '');
      ctx.font = `${effect.critical ? 8 : 6}px Pixel, JBMono, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const yText = y - age * 16 - 12; ctx.strokeStyle = '#09070e'; ctx.lineWidth = 2; ctx.strokeText(text, x, yText); ctx.fillStyle = effect.color || (effect.critical ? '#ffe0a0' : '#f1e3c9'); ctx.fillText(text, x, yText);
    } else if (kind === 'freeze') {
      const r = radius * (.7 + age * .3); ctx.globalAlpha = life * .3; circle(ctx, '#b4e6e9', x, y, r, 2);
      for (let n = 0; n < 12; n++) { const a = n * TAU / 12; const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r; line(ctx, '#9ccbd7', [[x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8], [bx, by]]); star(ctx, '#d2eef0', bx, by, 3); }
    } else if (kind === 'blast' || kind === 'bomb' || kind === 'evolution' || kind === 'heal' || kind === 'pickup') {
      const r = radius * (.35 + age * .75), tint = kind === 'heal' ? '#8ed5ab' : kind === 'evolution' ? '#ead49b' : color;
      ctx.globalAlpha = life * .15; pixelDisc(ctx, tint, x, y, Math.min(r, 250)); ctx.globalAlpha = life * .9; circle(ctx, tint, x, y, r, 1.5); circle(ctx, tint, x, y, r * .78, .6);
      for (let n = 0; n < (quality === 'high' ? 12 : 6); n++) { const a = n * TAU / 12 + .1; const d = r * (1 + hash(n, x) * .5); star(ctx, tint, x + Math.cos(a) * d, y + Math.sin(a) * d, life * 2.5 + .5); }
      if (kind === 'evolution') { line(ctx, '#f4dfab', [[x, y - height], [x, y + 5]], life * 4); }
    } else {
      // Directional impact chips maintain readability when the screen fills.
      const count = quality === 'high' ? 7 : 3;
      for (let n = 0; n < count; n++) { const a = hash(n, x + y) * TAU, d = age * (8 + hash(n, y) * 12); px(ctx, n % 3 ? color : '#fff0d0', x + Math.cos(a) * d, y + Math.sin(a) * d, n % 3 ? 1 : 2, 1); }
    }
    ctx.restore();
  }

  function miniMap(run, expanded) {
    const mapWidth = expanded ? Math.min(128, width - 24) : width < 250 ? 47 : 63, mapHeight = expanded ? mapWidth : mapWidth * .78;
    const x = width - mapWidth - 8, y = expanded ? height / 2 - mapHeight / 2 : 67;
    ctx.save(); ctx.fillStyle = '#0c0a13df'; ctx.fillRect(x, y, mapWidth, mapHeight); ctx.strokeStyle = '#66503d'; ctx.lineWidth = .7; ctx.strokeRect(x + .5, y + .5, mapWidth - 1, mapHeight - 1);
    const scale = expanded ? .09 : .045, mx = x + mapWidth / 2, my = y + mapHeight / 2;
    ctx.beginPath(); ctx.rect(x + 2, y + 2, mapWidth - 4, mapHeight - 4); ctx.clip();
    ctx.globalAlpha = .4;
    for (let n = -3; n <= 3; n++) { line(ctx, '#433746', [[mx + n * 16 - ((run.player.x * scale) % 16), y], [mx + n * 16 - ((run.player.x * scale) % 16), y + mapHeight]], .5); line(ctx, '#433746', [[x, my + n * 16 - ((run.player.y * scale) % 16)], [x + mapWidth, my + n * 16 - ((run.player.y * scale) % 16)]], .5); }
    ctx.globalAlpha = .9;
    for (const obstacle of run.obstacles || []) {
      const ox = mx + (obstacle.x - run.player.x - obstacle.width / 2) * scale, oy = my + (obstacle.y - run.player.y - obstacle.height / 2) * scale;
      px(ctx, '#777366', ox, oy, Math.max(1, obstacle.width * scale), Math.max(1, obstacle.height * scale));
    }
    for (const enemy of (run.enemies || [])) {
      const ex = mx + (enemy.x - run.player.x) * scale, ey = my + (enemy.y - run.player.y) * scale;
      if (enemy.hp <= 0 || ex < x + 2 || ex > x + mapWidth - 2 || ey < y + 2 || ey > y + mapHeight - 2) continue;
      if (enemy.boss) diamond(ctx, '#ed9c9e', ex, ey, 2.5); else px(ctx, enemy.elite ? '#ddbd79' : '#a7566b', ex, ey, 1, 1);
    }
    for (const item of mapTargets(run)) {
      const ix = mx + (item.x - run.player.x) * scale, iy = my + (item.y - run.player.y) * scale;
      if (item.kind === 'merchant') { circle(ctx, '#a4d6b3', ix, iy, 2); px(ctx, '#a4d6b3', ix, iy); }
      else if (item.kind === 'coffin') { px(ctx, '#dac8a6', ix - 1, iy - 2, 3, 5); px(ctx, '#6c597e', ix, iy - 1, 1, 3); }
      else if (item.kind === 'stageitem') { diamond(ctx, item.state === 'open' ? '#b6dba7' : '#b59dc9', ix, iy, 2.5); px(ctx, '#16111e', ix, iy-1, 1, 3); if (item.state === 'open') px(ctx, '#edf1c7', ix-1, iy, 3, 1); }
      else if (item.kind === 'arsenal') { px(ctx, '#e1c98e', ix-2, iy-3, 5, 6); px(ctx, '#332537', ix-1, iy-2, 3, 4); px(ctx, '#e1c98e', ix, iy-1, 1, 2); }
      else diamond(ctx, item.kind === 'chest' ? '#dec387' : '#c9b0e0', ix, iy, 2);
    }
    diamond(ctx, '#f6e5b3', mx, my, 2); ctx.restore();
    if (expanded) { ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#d3b57b'; ctx.fillText('THE BREACH · LIVE TELEMETRY', x + mapWidth / 2, y - 5); }
  }

  function compass(run) {
    // Treasure/relic bearing and urgent boss bearing work outside minimap range.
    const targets = [...mapTargets(run).slice(0, 7), ...(run.enemies || []).filter(enemy => enemy.boss && enemy.hp > 0).slice(0, 2)];
    for (const target of targets) {
      const dx = target.x - run.player.x, dy = target.y - run.player.y;
      if (Math.abs(dx) < width / 2 - 22 && Math.abs(dy) < height / 2 - 40) continue;
      const a = Math.atan2(dy, dx), maxX = width / 2 - 15, maxY = height / 2 - 54;
      const d = Math.min(maxX / Math.max(.001, Math.abs(Math.cos(a))), maxY / Math.max(.001, Math.abs(Math.sin(a))));
      const x = width / 2 + Math.cos(a) * d, y = height / 2 + Math.sin(a) * d;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); const color = target.boss ? '#d07e8b' : target.kind === 'merchant' ? '#a8d2ac' : target.kind === 'chest' || target.kind === 'coffin' || target.kind === 'arsenal' ? '#e2c285' : '#bca2dd'; poly(ctx, '#15101d', [[8, 0], [-4, -6], [-2, 0], [-4, 6]]); poly(ctx, color, [[5, 0], [-3, -3], [-1, 0], [-3, 3]]); ctx.restore();
      if (target.kind === 'arsenal') {
        const gx = x-Math.cos(a)*10, gy = y-Math.sin(a)*10;
        line(ctx, '#e1c98e', [[gx-2,gy+3],[gx+2,gy-3]], 1); line(ctx, '#e1c98e', [[gx-3,gy+1],[gx,gy+3]], 1);
      }
      if (target.kind === 'merchant' || target.kind === 'coffin' || target.kind === 'stageitem') { ctx.font = '5px JBMono, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = target.kind === 'merchant' ? '#a8d2ac' : target.kind === 'stageitem' ? target.state === 'open' ? '#b6dba7' : '#b59dc9' : '#e2c285'; ctx.fillText(target.kind === 'merchant' ? '$' : target.kind === 'stageitem' ? '◇' : '+', x - Math.cos(a) * 9, y - Math.sin(a) * 9 + 2); }
    }
  }

  function atmosphereFrame(run) {
    const fever = run.goldFever?.active === true, overtime = run.overtime === true;
    const tint = overtime ? '#d18b9d' : fever ? '#dfbd6e' : currentInverse ? '#b4b3dc' : '#957748';
    ctx.save(); ctx.lineWidth = fever || overtime ? 1 : .5; ctx.strokeStyle = fever || overtime ? `${tint}b0` : `${tint}60`;
    for (const [x,y,sx,sy] of [[5,5,1,1],[width-5,5,-1,1],[5,height-5,1,-1],[width-5,height-5,-1,-1]]) {
      line(ctx, ctx.strokeStyle, [[x,y+sy*17],[x,y],[x+sx*17,y]], fever ? 1 : .6);
      if (fever || currentInverse || overtime) diamond(ctx, tint, x+sx*3, y+sy*3, 1.3);
    }
    if (fever) {
      // Only the outer edge glitters: the combat field and all hostile warnings stay clear.
      const count = quality === 'high' ? 12 : 4;
      ctx.globalAlpha = .45;
      for (let n = 0; n < count; n++) {
        const t = fract(drawTime*.035+n/count), side = n%2;
        const x = side ? width-8-(n%3)*2 : 8+(n%3)*2, y = 18+t*(height-36);
        star(ctx, n%3 ? '#b99b5a' : '#f1d994', x, y, n%3 ? 1.2 : 2);
      }
    }
    ctx.restore();
  }

  function draw(run, options = {}) {
    if (!alive || !run?.player) return;
    quality = options.quality || 'high'; drawTime = Number(run.time) || 0; currentStage = run.stageId || 'cathedral'; currentInverse = run.inverse === true; currentCycle = Math.max(0, Math.floor(run.cycle || 0));
    const player = run.player;
    if (drawTime < previousTime) { trail = []; lastPlayer = null; } previousTime = drawTime;
    const moved = lastPlayer && Math.hypot(player.x - lastPlayer.x, player.y - lastPlayer.y) > .1;
    if (player.dashTime > 0 && (!trail.length || drawTime - trail[trail.length - 1].time > .025)) trail.push({ x: player.x, y: player.y, time: drawTime });
    trail = trail.filter(point => drawTime - point.time < .22).slice(-8);
    lastPlayer = { x: player.x, y: player.y };
    cameraX = player.x; cameraY = player.y;
    let shakeX = 0, shakeY = 0;
    if (quality === 'high' && player.invulnerable > .45 && player.dashTime <= 0) { const power = Math.min(1.5, player.invulnerable * 1.4); shakeX = Math.sin(drawTime * 103) * power; shakeY = Math.cos(drawTime * 89) * power; }
    ctx.setTransform(backingScale, 0, 0, backingScale, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.translate(Math.round(width / 2 - cameraX + shakeX), Math.round(height / 2 - cameraY + shakeY));
    ground(currentStage);
    nearbyLabelBudget = (quality === 'low' ? catalog.intel?.lowNearbyLabels : catalog.intel?.maxNearbyLabels) || 0;
    for (const item of run.obstacles || []) if (item.kind === 'librarywall') drawWall(item);
    let damageLabels = 0, impactChips = 0;
    const effects = (run.effects || []).slice(-180).filter(item => {
      if (quality === 'low' && item.kind === 'impact') { impactChips++; return impactChips <= 24; }
      if (item.kind !== 'text' && item.kind !== 'damage') return true;
      damageLabels++; return damageLabels <= (quality === 'low' ? 12 : 30);
    });
    effects.forEach(item => effect(item, false));
    drawObjective(run);
    drawStageItems(run);
    drawArsenal(run);
    for (const item of (run.pickups || [])) drawPickup(item);
    if (trail.length && quality !== 'low') {
      for (const point of trail) { ctx.globalAlpha = (1 - (drawTime - point.time) / .22) * .25; diamond(ctx, '#ba9874', point.x, point.y - 4, 8); } ctx.globalAlpha = 1;
    }
    // Shared depth order lets the hunter walk through a crowd without floating.
    const depth = (run.enemies || []).filter(enemy => enemy.hp > 0 && visible(enemy.x, enemy.y, 100)).map(entity => ({ y: entity.y, type: 0, entity }));
    for (const entity of run.props || []) if (entity.hp > 0 && visible(entity.x, entity.y, 35)) depth.push({ y: entity.y, type: 1, entity });
    for (const entity of run.obstacles || []) if (entity.kind === 'foundrypillar' && visible(entity.x, entity.y, Math.max(entity.width, entity.height) + 35)) depth.push({ y: entity.y + entity.height / 2, type: 3, entity });
    depth.push({ y: player.y, type: 2, entity: player }); depth.sort((a, b) => a.y - b.y);
    for (const item of depth) { if (item.type === 0) drawEnemy(item.entity); else if (item.type === 1) drawProp(item.entity); else if (item.type === 3) drawPillar(item.entity); else drawPlayer(player, run.characterId || 'hunter', !!moved, run); }
    for (const item of (run.projectiles || []).slice(-420)) projectile(item);
    effects.forEach(item => effect(item, true));
    ctx.restore();
    ctx.fillStyle = vignette || '#00000000'; ctx.fillRect(0, 0, width, height);
    // A thin inset around the arena ties it to the blackened-gold UI.
    ctx.strokeStyle = '#735a383b'; ctx.lineWidth = .5; ctx.strokeRect(3.5, 3.5, width - 7, height - 7);
    atmosphereFrame(run);
    if (options.showMap) miniMap(run, false);
    compass(run);
    const pointer = options.pointer;
    if (pointer && (pointer.ox != null || pointer.startX != null)) {
      const ox = (pointer.ox ?? pointer.startX) / 2, oy = (pointer.oy ?? pointer.startY) / 2;
      const pxNow = (pointer.x ?? pointer.ox ?? pointer.startX) / 2, pyNow = (pointer.y ?? pointer.oy ?? pointer.startY) / 2;
      const dx = pxNow - ox, dy = pyNow - oy, distance = Math.hypot(dx, dy) || 1, d = Math.min(distance, 17);
      ctx.globalAlpha = .45; circle(ctx, '#d1c29c', ox, oy, 22, .7); circle(ctx, '#d1c29c', ox + dx / distance * d, oy + dy / distance * d, 7, 1); ctx.globalAlpha = 1;
    }
  }

  function drawMenu({ stageId = 'cathedral', characterId = 'hunter', inverse = false } = {}) {
    if (!alive) return;
    quality = 'high'; drawTime = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
    currentStage = stageId; currentInverse = inverse === true; currentCycle = 0; cameraX = 128; cameraY = 60;
    ctx.setTransform(backingScale, 0, 0, backingScale, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.translate(Math.round(width / 2 - cameraX), Math.round(height / 2 - cameraY)); ground(stageId);
    const art = get(`menu:${stageId}:${currentInverse}`, () => {
      const plate = landmark(stageId, 0); return currentInverse ? inversePlate(plate, INVERSE_STAGE[stageId]?.tint || '#687ba2') : plate;
    });
    ctx.globalAlpha = .9; ctx.drawImage(art, cameraX + width * .18 - 112, cameraY - 190, 224, 224); ctx.globalAlpha = 1;
    const heroX = cameraX + width * .18, heroY = cameraY + 60;
    circle(ctx, '#81653f', heroX, heroY + 10, 40, .8); circle(ctx, '#473348', heroX, heroY + 10, 47, .8);
    for (let n = 0; n < 8; n++) { const a = drawTime * .12 + n * TAU / 8; diamond(ctx, '#b29263', heroX + Math.cos(a) * 43, heroY + 10 + Math.sin(a) * 43, 2); }
    shadow(heroX, heroY + 9, 23, 6, .6);
    const charArt = get(`char:${characterId}:0`, () => characterSprite(characterId, 0)); ctx.drawImage(charArt, heroX - 30, heroY - 60, 60, 72);
    ctx.restore();
    const shade = ctx.createLinearGradient(0, 0, width, 0); shade.addColorStop(0, '#09070ded'); shade.addColorStop(.4, '#0e0a12b5'); shade.addColorStop(.82, '#0e0a1250'); shade.addColorStop(1, '#09070d91'); ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = vignette || '#00000000'; ctx.fillRect(0, 0, width, height);
  }

  function dispose() {
    alive = false; cache.clear(); portraitCache.clear(); trail = []; lastPlayer = null; vignette = null;
    // No listeners, image requests, RAFs or context-wide globals to retain.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  resize(canvas.clientWidth || 1280, canvas.clientHeight || 800, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
  return { resize, draw, drawMenu, dispose };
}
