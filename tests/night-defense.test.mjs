import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createRun } from '../src/scripts/night/engine.js';

const CFG = CATALOG.config;
const weapon = id => CATALOG.weapons.find(item => item.id === id);
function arena(options = {}) {
  const run = createRun({ seed: 47, ...options });
  run.enemies = []; run.pickups = []; run.props = [];
  run._spawnTimer = run._eliteTimer = run._bossTimer = run._worldTimer = 1e8;
  return run;
}
function equip(run, id, level = 1) {
  const equipped = { id, level, evolved: false, damage: 0, kills: 0, timer: 0 };
  run.weapons = [equipped];
  return equipped;
}
function spawn(run, x, y, hp = 1000, options = {}) {
  const enemy = run._spawn('xss', { x, y, ...options });
  enemy.hp = enemy.maxHp = hp;
  enemy.speed = 50; enemy.specialTimer = 1e8;
  run._hash.build(run.enemies);
  return enemy;
}
function advance(run, seconds) {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += .05) run.tick(Math.min(.05, seconds - elapsed));
}

test('both defensive archetypes have eight data-driven levels and distinct legal evolutions', () => {
  for (const [id, passive] of [['aegis', 'armor'], ['lancet', 'duration']]) {
    const item = weapon(id);
    assert.equal(item.role, 'defense');
    assert.equal(item.levels.length, 8);
    assert.equal(item.maxLevel, 8);
    assert.equal(item.evolution.passive, passive);
    assert.ok(item.signature.length > 10);
    assert.ok(item.levels.every(level => level.damage === 0 && level.speed === 0));
    assert.ok(item.levels[7].cooldown < item.levels[0].cooldown);
    const run = arena();
    const equipped = equip(run, id);
    assert.equal(run._applyReward({ type: 'evolution', id }), false);
    equipped.level = 8;
    assert.equal(run._applyReward({ type: 'evolution', id }), false);
    assert.equal(run._applyReward({ type: 'passive', id: passive }), true);
    assert.equal(run._applyReward({ type: 'evolution', id }), true);
    assert.equal(equipped.evolved, true);
  }
});

test('Sandbox Aegis absorbs real hits, respects invulnerability and recharges after a real delay', () => {
  const run = arena();
  const barrier = equip(run, 'aegis');
  const hp = run.player.hp;
  assert.equal(run._hurt(23), false);
  assert.equal(run.player.hp, hp);
  assert.equal(run.stats.damageTaken, 0);
  assert.equal(run.stats.shieldBlocks, 1);
  assert.equal(run.player.shieldCharges, 0);
  assert.equal(run.player.shieldMax, weapon('aegis').levels[0].count);
  assert.ok(run.player.invulnerable > 0);
  assert.equal(run._hurt(23), false);
  assert.equal(run.stats.shieldBlocks, 1, 'contact during the grace period consumes no extra charge');
  run.player.invulnerable = 0;
  assert.equal(run._hurt(23), true);
  assert.ok(run.player.hp < hp);
  assert.ok(run.stats.damageTaken > 0);
  assert.equal(barrier.damage, 0, 'base barrier has no hidden damage');
  const cooldown = run._weaponStats(barrier).cooldown;
  advance(run, cooldown - .1);
  assert.equal(run.player.shieldCharges, 0);
  assert.ok(run.player.shieldCooldown > 0);
  advance(run, .2);
  assert.equal(run.player.shieldCharges, 1);
  assert.equal(run.player.shieldCooldown, 0);
  assert.ok(run.effects.some(effect => effect.kind === 'shield' && !effect.blocked));
});

test('barrier capacity upgrades cannot refill consumed charges or exceed the configured cap', () => {
  const run = arena();
  const barrier = equip(run, 'aegis', 3);
  run._syncShield();
  assert.equal(run.player.shieldCharges, 2);
  for (let index = 0; index < 2; index++) { run.player.invulnerable = 0; run._hurt(10); }
  assert.equal(run.player.shieldCharges, 0);
  barrier.level = 8;
  run.modifiers.amount = 100;
  run.modifiers.area = 1000;
  run._syncShield();
  assert.equal(run.player.shieldCharges, 0);
  assert.equal(run.player.shieldMax, CFG.aegisMaxCharges);
  assert.equal(run._weaponStats(barrier).radius, CFG.aegisMaxRadius);
  for (let index = 0; index < CFG.aegisMaxCharges + 3; index++) run._fire(barrier);
  assert.equal(run.player.shieldCharges, CFG.aegisMaxCharges);
  assert.ok(run.effects.length <= CFG.maxEffects);
});

test('Unbroken Boundary retaliates on an actual block and credits real damage and kills', () => {
  const run = arena();
  const barrier = equip(run, 'aegis', 8);
  run._applyReward({ type: 'passive', id: 'armor' });
  assert.equal(run._applyReward({ type: 'evolution', id: 'aegis' }), true);
  const victim = spawn(run, 25, 0, 20);
  const hp = run.player.hp;
  run._hurt(50);
  assert.equal(run.player.hp, hp);
  assert.ok(victim.hp <= 0);
  assert.equal(barrier.damage, 20);
  assert.equal(barrier.kills, 1);
  assert.equal(run.stats.damage, 20);
  assert.ok(run.effects.some(effect => effect.kind === 'shield' && effect.blocked && effect.evolved));
  assert.ok(run.drainEvents().some(event => event.type === 'kill' && event.weapon === 'aegis'));
});

test('Race-Window Lance freezes the actual directional corridor and rotates independently of aim', () => {
  const run = arena();
  const lance = equip(run, 'lancet');
  const east = spawn(run, 75, 0);
  const north = spawn(run, 0, 75);
  const west = spawn(run, -75, 0);
  const diagonal = spawn(run, 86.6, 50);
  run._fire(lance);
  assert.ok(east.frozen > 0);
  assert.ok(!(north.frozen > 0));
  assert.ok(!(west.frozen > 0));
  assert.ok(!(diagonal.frozen > 0));
  assert.equal(east.hp, 1000);
  assert.equal(lance.damage, 0);
  const before = { x: east.x, y: east.y };
  run._updateEnemies(.2);
  assert.deepEqual({ x: east.x, y: east.y }, before, 'freeze prevents actual enemy movement');
  run._fire(lance);
  assert.ok(diagonal.frozen > 0, 'the next beam advances one clock sector');
  const beams = run.effects.filter(effect => effect.kind === 'timebeam');
  assert.equal(beams[0].x, run.player.x);
  assert.equal(beams[0].y, run.player.y);
  assert.equal(beams[0].angle, 0);
  assert.ok(Math.abs(beams[1].angle - Math.PI * 2 / CFG.lancetDirections) < 1e-9);
  assert.ok(beams.every(effect => effect.width > 0 && effect.length > effect.width && effect.max === CFG.lancetBeamLife));
  for (let index = 2; index < CFG.lancetDirections; index++) run._fire(lance);
  assert.equal(lance.beamStep, 0, 'the schedule wraps to a bounded clock index');
});

test('Deterministic Horizon cuts current HP once per volley and bosses resist both effects', () => {
  const run = arena();
  const lance = equip(run, 'lancet', 8);
  run._applyReward({ type: 'passive', id: 'duration' });
  assert.equal(run._applyReward({ type: 'evolution', id: 'lancet' }), true);
  const ordinary = spawn(run, 0, 0, 1000);
  const boss = spawn(run, 0, 0, 1000, { boss: true });
  ordinary.maxHp = boss.maxHp = 100000;
  run.modifiers.might = 100;
  run.modifiers.amount = 100;
  run.modifiers.area = 1000;
  run.modifiers.duration = 1000;
  run._fire(lance);
  assert.equal(ordinary.hp, 1000 * (1 - CFG.lancetMaxHealthFraction));
  assert.equal(boss.hp, 1000 * (1 - CFG.lancetMaxHealthFraction * CFG.lancetBossHealthMultiplier));
  assert.ok(boss.hp > 900, 'even a capped build cannot instantly erase a boss');
  assert.ok(boss.frozen < ordinary.frozen);
  assert.equal(ordinary.frozen, CFG.lancetMaxFreeze);
  assert.equal(run.effects.find(effect => effect.kind === 'timebeam').length, CFG.lancetMaxRange);
  assert.equal(lance.damage, run.stats.damage);
  assert.equal(run.effects.filter(effect => effect.kind === 'timebeam').length, CFG.lancetMaxBeams);
  const hp = ordinary.hp;
  run._fire(lance);
  assert.equal(ordinary.hp, hp * (1 - CFG.lancetMaxHealthFraction), 'successive cuts use remaining HP');
});

test('defensive weapons keep zero-speed Limit Break upgrades out of the draft', () => {
  const run = arena({ unlockedWeapons: ['aegis', 'lancet'], sealed: [CATALOG.characters[0].weapon] });
  equip(run, 'aegis', 8);
  run.weapons.push({ id: 'lancet', level: 8, evolved: true, damage: 0, kills: 0, timer: 0 });
  run.passives = CATALOG.passives.slice(0, CFG.passiveSlots).map(item => ({ id: item.id, level: item.maxLevel }));
  const choices = run._candidates();
  assert.ok(choices.some(choice => choice.type === 'limitbreak'));
  assert.ok(!choices.some(choice => choice.type === 'limitbreak' && choice.stat === 'speed'));
});

test('Inverse merchant sells a real revival and one seeded extra arcana slot with one shared cap', () => {
  function prepare() {
    const run = arena({ inverse: true, mode: 'standard' });
    run.arcana = CATALOG.arcana.slice(0, CFG.arcanaSlots).map(item => item.id);
    run.gold = 2000;
    run._openMerchant();
    return run;
  }
  const run = prepare();
  const revival = run.merchantOffers.find(item => item.id === 'inverse-checkpoint');
  const slot = run.merchantOffers.find(item => item.type === 'arcana-slot');
  assert.ok(revival && slot);
  const gold = run.gold, revives = run.revives;
  assert.equal(run.buyMerchant(revival.id), true);
  assert.equal(run.revives, revives + revival.value);
  assert.equal(run.gold, gold - revival.cost);
  assert.equal(run.buyMerchant(slot.id), true);
  assert.equal(run.gold, gold - revival.cost - slot.cost);
  assert.equal(run.state, 'arcana');
  assert.equal(run.arcanaLimit, CFG.arcanaSlots + 1);
  assert.equal(run.extraArcanaSlots, 1);
  assert.equal(run.choices.length, CFG.arcanaDraftSize);
  assert.equal(new Set(run.choices.map(item => item.id)).size, CFG.arcanaDraftSize);
  assert.ok(run.choices.every(item => !run.arcana.includes(item.id)));
  const second = prepare();
  second.buyMerchant(revival.id); second.buyMerchant(slot.id);
  assert.deepEqual(run.choices, second.choices, 'the merchant uses the normal seeded arcana draft');
  assert.equal(run.selectArcana(run.arcana[0]), false);
  assert.equal(run.selectArcana(run.choices[0].id), true);
  assert.equal(run.arcana.length, run.arcanaLimit);
  assert.equal(run._openArcana(), false, 'timed drafts respect the same new cap');
  const result = run.getResult();
  assert.equal(result.arcanaLimit, run.arcanaLimit);
  assert.equal(result.extraArcanaSlots, 1);
  run._openMerchant();
  const currency = run.gold, purchases = run.merchantCyclePurchases;
  assert.equal(run.buyMerchant(slot.id), false);
  assert.equal(run.gold, currency);
  assert.equal(run.merchantCyclePurchases, purchases);
  run.state = 'playing'; run._merchantVisited = false;
  run._openMerchant();
  assert.ok(!run.merchantOffers.some(item => item.type === 'arcana-slot'), 'restocking cannot sell a second capacity bonus');
});

test('Inverse arcana purchase rejects unavailable, unaffordable or stale offers without charging', () => {
  for (const options of [{}, { inverse: true, arcanaEnabled: false }, { inverse: true, mode: 'endless' }]) {
    const run = arena(options);
    run.gold = 1000; run._openMerchant();
    assert.ok(!run.merchantOffers.some(item => item.type === 'arcana-slot'));
    if (!options.inverse) assert.ok(!run.merchantOffers.some(item => item.inverseOnly));
  }
  for (const invalidate of [
    run => { run.gold = 0; },
    run => { run.extraArcanaSlots = CFG.inverseArcanaBonus; },
    run => { run.merchantCyclePurchases = CFG.merchantPurchaseLimit; },
    run => { run.arcana = CATALOG.arcana.slice(0, CFG.arcanaSlots + 2).map(item => item.id); },
    run => { run.arcana = CATALOG.arcana.map(item => item.id); },
  ]) {
    const run = arena({ inverse: true });
    run.gold = 1000; run._openMerchant();
    const slot = run.merchantOffers.find(item => item.type === 'arcana-slot');
    invalidate(run); run._refreshMerchantOffers();
    const gold = run.gold, purchases = run.merchantCyclePurchases;
    assert.equal(slot.disabled, true);
    assert.equal(run.buyMerchant(slot.id), false);
    assert.equal(run.gold, gold);
    assert.equal(run.merchantCyclePurchases, purchases);
    assert.equal(slot.purchased, false);
  }
});

test('vertical corridors clamp both x boundaries and build sidewalls without constraining travel in y', () => {
  const run = arena();
  run.stage = { ...run.stage, geometry: { kind: 'corridor', axis: 'x', halfWidth: 90 } };
  run.player.x = 400; run.player.y = -1400;
  run._collide(run.player);
  assert.equal(run.player.x, 90 - run.player.r);
  assert.equal(run.player.y, -1400);
  run.player.x = -400;
  run._collide(run.player);
  assert.equal(run.player.x, -90 + run.player.r);
  const enemy = { x: -1000, y: 3000, r: 7 };
  run._collide(enemy);
  assert.equal(enemy.x, -83);
  assert.equal(enemy.y, 3000);
  run._ensureWorld();
  assert.equal(run.obstacles.length, 2);
  assert.ok(run.obstacles.every(wall => wall.kind === 'librarywall' && wall.y === run.player.y && wall.width === CFG.geometryWallThickness && wall.height === run.viewport.height * CFG.geometryWallViewportMultiplier));
  assert.ok(run.obstacles.some(wall => wall.x < -90));
  assert.ok(run.obstacles.some(wall => wall.x > 90));
  run.stage = { ...run.stage, geometry: { kind: 'corridor', halfHeight: 80 } };
  run.player.x = 1000; run.player.y = -1000;
  run._collide(run.player);
  assert.equal(run.player.x, 1000, 'the original horizontal corridor remains unchanged');
  assert.equal(run.player.y, -80 + run.player.r);
});
