import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createRun } from '../src/scripts/night/engine.js';

const CFG = CATALOG.config;
const definition = (type, id) => CATALOG[type === 'weapon' ? 'weapons' : 'passives'].find(item => item.id === id);
function offer(run, type, id) {
  const item = definition(type, id);
  const equipped = run[type === 'weapon' ? 'weapons' : 'passives'].find(value => value.id === id);
  run.state = 'upgrade';
  run.choices = [{ type, id, name: item.name, description: item.description, color: item.color, icon: item.icon, level: (equipped?.level || 0) + 1 }];
  return run.choose(0);
}
function arena(options = {}) {
  const run = createRun({ seed: 17, ...options });
  run.enemies = [];
  run.pickups = [];
  run.props = [];
  run._spawnTimer = run._eliteTimer = run._bossTimer = run._worldTimer = 1e8;
  return run;
}
function advance(run, seconds, input = {}) {
  for (let elapsed = 0; elapsed < seconds - 1e-8 && run.state === 'playing'; elapsed += 0.1) run.tick(Math.min(0.1, seconds - elapsed), input);
}
function spawn(run, kind = 'xss', x = 30, y = 0, hp = 1000, options = {}) {
  const enemy = run._spawn(kind, { x, y, ...options });
  enemy.hp = enemy.maxHp = hp;
  enemy.speed = 0;
  enemy.specialTimer = 1e8;
  return enemy;
}
function take(run, kind, value = 1) {
  run.pickups.push({ kind, x: run.player.x, y: run.player.y, value, r: CFG.pickupRadius });
  run.tick(0.01);
}
function resolve(run) {
  if (run.state === 'upgrade') {
    let index = run.choices.findIndex(choice => choice.type === 'weapon' && run.weapons.some(weapon => weapon.id === choice.id));
    if (index < 0) index = run.choices.findIndex(choice => choice.type === 'passive' && run.weapons.some(weapon => definition('weapon', weapon.id).evolution.passive === choice.id));
    run.choose(Math.max(0, index));
  } else if (run.state === 'chest') run.collectChest();
  else if (run.state === 'merchant') run.leaveMerchant();
  else if (run.state === 'arsenal') run.skipArsenal();
  else if (run.state === 'arcana') run.selectArcana(run.choices.find(choice => choice.id === 'critical')?.id || run.choices[0].id);
  else if (run.state === 'dead' && run.revives) run.revive();
}
function play(run, until = run.duration) {
  let iterations = 0;
  while (run.time < until && run.state !== 'won' && (run.state !== 'dead' || run.revives) && iterations++ < 50000) {
    if (run.state !== 'playing') { resolve(run); continue; }
    let target = null, distance = Infinity;
    for (const pickup of run.pickups) {
      if (!['xp', 'chest', 'relic', 'heal'].includes(pickup.kind)) continue;
      const d = Math.hypot(pickup.x - run.player.x, pickup.y - run.player.y);
      if (d < distance) { distance = d; target = pickup; }
    }
    const angle = target ? Math.atan2(target.y - run.player.y, target.x - run.player.x) : run.time * 0.06;
    run.tick(Math.min(0.5, until - run.time), { dx: Math.cos(angle), dy: Math.sin(angle) });
  }
  assert.ok(iterations < 50000, 'simulation converges without a paused-state loop');
  return run;
}

test('catalog is complete, internally consistent and has machine-readable unlocks', () => {
  for (const key of ['characters', 'stages', 'weapons', 'passives', 'enemies', 'arcana', 'powerUps']) {
    const ids = new Set();
    for (const item of CATALOG[key]) {
      for (const field of ['id', 'name', 'description', 'color', 'icon']) assert.equal(typeof item[field], 'string', `${key}.${item.id}.${field}`);
      assert.ok(!ids.has(item.id)); ids.add(item.id);
    }
  }
  assert.equal(CATALOG.weapons.length, 14);
  assert.equal(CATALOG.passives.length, 12);
  assert.equal(CATALOG.stages.length, 5);
  assert.equal(CATALOG.characters.length, 6);
  assert.equal(CATALOG.arcana.length, 6);
  for (const item of CATALOG.weapons) {
    assert.equal(item.levels.length, 8);
    assert.ok(CATALOG.passives.some(passive => passive.id === item.evolution.passive));
    if (item.role !== 'defense') assert.ok(item.levels[7].damage > item.levels[0].damage);
    else assert.equal(item.levels[0].damage, 0);
  }
  assert.equal(CATALOG.characters.filter(item => item.unlocked).length, 3);
  for (const item of CATALOG.characters.filter(item => !item.unlocked)) {
    assert.ok(['kills', 'runs', 'wins', 'evolutions', 'relics'].includes(item.unlockRequirement.stat));
    assert.ok(item.unlockRequirement.value > 0);
  }
  for (const power of CATALOG.powerUps) for (const key of ['maxLevel', 'baseCost', 'costScale', 'perLevel']) assert.ok(Number.isFinite(power[key]));
});

test('same seed and public actions give the same complete result; seeds change the run', () => {
  const first = play(createRun({ seed: 2, arcanaId: 'blood' }));
  const second = play(createRun({ seed: 2, arcanaId: 'blood' }));
  assert.deepEqual(first.getResult(), second.getResult());
  assert.equal(first.state, 'won');
  assert.ok(first.time >= 600 - CFG.finalBossLead && first.time <= 600);
  assert.ok(first.kills > 500);
  assert.ok(first.level > 30);
  assert.ok(first.stats.evolutions > 0);
  assert.ok(first.stats.chests > 0);
  assert.ok(first.stats.bosses >= 5);
  assert.ok(first.stats.props > 0);
  assert.ok(first.stats.relics > 0);
  const different = play(createRun({ seed: 78, arcanaId: 'blood' }), 90);
  const short = play(createRun({ seed: 77, arcanaId: 'blood' }), 90);
  assert.notDeepEqual(short.getResult(), different.getResult());
});

test('an actual 30-minute run wins using normal movement, pickups and upgrades, with bounded work', () => {
  const meta = Object.fromEntries(CATALOG.powerUps.map(item => [item.id, item.maxLevel]));
  const run = play(createRun({ seed: 77, mode: 'standard', characterId: 'operator', arcanaId: 'blood', meta }));
  assert.equal(run.state, 'won');
  assert.ok(run.time >= 1800 - CFG.finalBossLead && run.time <= 1800);
  assert.ok(run.kills > 3000);
  assert.ok(run.stats.evolutions >= 2);
  assert.ok(run.stats.bosses >= 15);
  assert.ok(run.stats.damageTaken > 0 || run.stats.shieldBlocks > 0, 'the build survives real incoming hits through health or shield charges');
  assert.ok(run.stats.maxEnemies <= CFG.maxEnemies);
  assert.ok(run.stats.maxProjectiles <= CFG.maxProjectiles);
  assert.ok(run.stats.maxPickups <= CFG.maxPickups);
  assert.ok(run.effects.length <= CFG.maxEffects);
  assert.ok(run.props.length <= CFG.maxProps);
  assert.ok(run._propCells.size <= CFG.propCellCap);
  assert.ok(run._hazards.length <= CFG.maxHazards);
  assert.ok(run.weapons.filter(weapon => definition('weapon', weapon.id).role !== 'defense').every(weapon => weapon.damage > 0));
  assert.equal(run.getResult().wins, 1);
  assert.equal(run.getResult().runs, 1);
  assert.equal(run.getResult().goldEarned, run.gold);
});

test('offensive weapons inflict real damage through twelve different combat patterns', () => {
  const signatures = new Set();
  const offensive = CATALOG.weapons.filter(weapon => weapon.role !== 'defense');
  for (const weapon of offensive) {
    const run = arena();
    run.weapons = [{ id: weapon.id, level: 1, evolved: false, damage: 0, kills: 0, timer: 0 }];
    for (let index = 0; index < 16; index++) {
      const angle = index / 16 * Math.PI * 2;
      spawn(run, 'xss', Math.cos(angle) * (index % 2 ? 44 : 64), Math.sin(angle) * (index % 2 ? 44 : 64));
    }
    run._hash.build(run.enemies);
    run.tick(0.05);
    signatures.add(JSON.stringify({ shot: [...new Set(run.projectiles.map(item => item.kind))], effect: [...new Set(run.effects.map(item => item.kind))], zone: run._zones.map(item => item.kind) }));
    advance(run, 2.8);
    assert.ok(run.weapons[0].damage > 0, `${weapon.id} hits an actual target`);
    assert.equal(run.stats.damage, run.weapons[0].damage);
  }
  assert.equal(signatures.size, offensive.length, 'every offensive weapon has a distinct projectile, effect or zone signature');
});

test('knife direction, wand homing, runes bounce, axes fall and crosses return', () => {
  for (const [id, check] of [
    ['knife', run => { assert.ok(run.projectiles[0].vx > 0); assert.equal(run.projectiles[0].vy, 0); }],
    ['wand', run => { assert.ok(run.projectiles[0].homing); assert.ok(run.projectiles[0].vy < 0); }],
    ['rune', run => assert.ok(run.projectiles[0].bouncing)],
    ['axe', run => assert.ok(run.projectiles[0].gravity > 0)],
    ['cross', run => { advance(run, 1); assert.ok(run.projectiles.some(item => item.returning)); }],
  ]) {
    const run = arena();
    run.weapons = [{ id, level: 1, evolved: false, damage: 0, kills: 0, timer: 0 }];
    spawn(run, 'sqli', id === 'knife' ? -100 : 100, -100);
    run.tick(0.05, id === 'knife' ? { dx: 1 } : {});
    check(run);
  }
});

test('all twelve passives affect the relevant player or combat stats', () => {
  const base = arena({ characterId: 'operator' });
  const s = base._weaponStats(base.weapons[0]);
  for (const passive of CATALOG.passives) {
    const run = arena({ characterId: 'operator' });
    for (let level = 0; level < passive.maxLevel; level++) assert.equal(offer(run, 'passive', passive.id), true);
    assert.equal(run.passives[0].level, 5);
    const actual = run._weaponStats(run.weapons[0]);
    switch (passive.id) {
      case 'might': assert.ok(actual.damage > s.damage); break;
      case 'cooldown': assert.ok(actual.cooldown < s.cooldown); break;
      case 'area': assert.ok(actual.radius > s.radius); break;
      case 'duration': assert.ok(actual.duration > s.duration); break;
      case 'amount': assert.equal(actual.count, s.count + 2); break;
      case 'speed': assert.ok(actual.speed > s.speed); assert.ok(run.player.speed > base.player.speed); break;
      case 'magnet': assert.ok(run.player.magnet > base.player.magnet); break;
      case 'armor': assert.equal(run.player.armor, base.player.armor + 5); break;
      case 'health': assert.equal(run.player.maxHp, base.player.maxHp * 2); break;
      case 'growth': take(run, 'xp', 1); assert.equal(run.xp, 1.5); break;
      case 'luck': assert.ok(run.modifiers.luck > base.modifiers.luck); break;
      case 'curse': assert.ok(run._spawn('xss').maxHp > base._spawn('xss').maxHp); assert.ok(run.modifiers.curse > base.modifiers.curse); break;
    }
  }
});

test('weapon/passive slots and level caps hold, including invalid reward rejection', () => {
  const run = arena();
  for (const item of CATALOG.weapons.filter(item => item.id !== 'whip').slice(0, 5)) assert.equal(offer(run, 'weapon', item.id), true);
  assert.equal(run.weapons.length, 6);
  assert.equal(offer(run, 'weapon', 'lightning'), false);
  run.state = 'playing';
  for (const item of CATALOG.passives.slice(0, 6)) assert.equal(offer(run, 'passive', item.id), true);
  assert.equal(run.passives.length, 6);
  assert.equal(offer(run, 'passive', 'magnet'), false);
  for (let level = 1; level < 8; level++) assert.equal(offer(run, 'weapon', 'whip'), true);
  assert.equal(offer(run, 'weapon', 'whip'), false);
  assert.equal(run.weapons[0].level, 8);
  assert.ok(!run._candidates().some(choice => choice.id === 'whip'));
});

test('evolution requires level eight, the compatible passive, and a late chest; rewards apply on collect', () => {
  for (const [level, passive, time, expected] of [[7, 'might', 130, false], [8, 'armor', 130, false], [8, 'might', 119, false], [8, 'might', 130, true]]) {
    const run = arena();
    run.weapons[0].level = level;
    offer(run, 'passive', passive);
    run.time = time;
    take(run, 'chest');
    assert.equal(run.state, 'chest');
    assert.equal(run.weapons[0].evolved, false);
    assert.equal(run.chestRewards.some(reward => reward.type === 'evolution'), expected);
    const before = run.time;
    assert.equal(run.tick(1), false);
    assert.equal(run.time, before);
    assert.equal(run.collectChest(), true);
    assert.equal(run.weapons[0].evolved, expected);
    assert.equal(run.stats.chests, 1);
    assert.equal(run.collectChest(), false);
    if (expected) assert.ok(run.drainEvents().some(event => event.type === 'evolution'));
  }
});

test('all compatible evolutions change weapon output and are individually reachable', () => {
  for (const item of CATALOG.weapons) {
    const run = arena();
    run.weapons = [{ id: item.id, level: 8, evolved: false, damage: 0, kills: 0, timer: 0 }];
    offer(run, 'passive', item.evolution.passive);
    const before = run._weaponStats(run.weapons[0]);
    run.time = CFG.chestEvolutionMinimum.quick;
    take(run, 'chest');
    assert.ok(run.chestRewards.some(reward => reward.id === item.id && reward.type === 'evolution'));
    run.collectChest();
    assert.equal(run.weapons[0].evolved, true);
    const after = run._weaponStats(run.weapons[0]);
    if (item.role !== 'defense') assert.ok(after.damage > before.damage);
    assert.ok(after.cooldown < before.cooldown);
    assert.ok(after.count > before.count);
  }
});

test('burst experience queues all levels and choice/chest/arcana/death states freeze time', () => {
  const run = arena();
  take(run, 'xp', 300);
  assert.equal(run.state, 'upgrade');
  const time = run.time;
  assert.ok(run.xp > run.xpNeed);
  let upgrades = 0;
  while (run.state === 'upgrade') { assert.equal(run.tick(1), false); assert.equal(run.time, time); run.choose(0); upgrades++; }
  assert.ok(upgrades > 5);
  assert.ok(run.xp < run.xpNeed);
  for (const state of ['upgrade', 'chest', 'arcana', 'dead', 'won']) {
    run.state = state;
    assert.equal(run.tick(0.1), false);
    assert.equal(run.time, time);
  }
});

test('reroll, skip and banish consume only their resources and banished items stay absent', () => {
  const run = arena();
  take(run, 'xp', 5);
  const rerolls = run.rerolls;
  assert.equal(run.reroll(), true);
  assert.equal(run.rerolls, rerolls - 1);
  const banned = run.choices[0];
  assert.equal(run.banish(0), true);
  assert.equal(run.banishes, CFG.banishes - 1);
  run.xp = run.xpNeed;
  run.tick(0.01);
  assert.ok(!run._candidates().some(choice => choice.type === banned.type && choice.id === banned.id));
  assert.equal(run.skip(), true);
  assert.equal(run.skips, CFG.skips - 1);
  assert.equal(run.reroll(), false);
  assert.equal(run.skip(), false);
  assert.equal(run.banish(0), false);
  assert.equal(run.choose(-1), false);
  assert.equal(run.choose(0.5), false);
  assert.equal(run.selectArcana('unknown'), false);
});

test('contact armor, invulnerability, death, revival and revival blast have actual effects', () => {
  const run = arena({ characterId: 'operator', meta: { armor: 3 } });
  run.weapons = [];
  const enemy = spawn(run, 'sqli', 0, 0);
  enemy.damage = 20;
  const hp = run.player.hp;
  run.tick(0.01);
  assert.equal(run.player.hp, hp - 17);
  run.tick(0.05);
  assert.equal(run.player.hp, hp - 17, 'invulnerability prevents repeat frame damage');
  run.player.invulnerable = 0;
  run.player.hp = 1;
  run.tick(0.01);
  assert.equal(run.state, 'dead');
  assert.equal(run.revive(), true);
  assert.equal(run.state, 'playing');
  assert.equal(run.revives, 0);
  assert.equal(run.player.hp, run.player.maxHp * CFG.reviveHp);
  assert.ok(enemy.hp < enemy.maxHp);
  assert.ok(run.player.invulnerable > 0);
  run.state = 'dead';
  assert.equal(run.revive(), false);
});

test('all enemy behaviors, elites and multi-phase bosses produce mechanics and loot', () => {
  const run = arena();
  run.weapons = [];
  const knight = spawn(run, 'auth', 70, 0);
  knight.speed = 20; knight.specialTimer = 0;
  run.tick(0.05);
  assert.ok(knight.windup > 0);
  assert.ok(run.effects.some(effect => effect.kind === 'warning'));
  advance(run, 0.8);
  assert.ok(knight.chargeTime > 0);
  const mimic = spawn(run, 'idor', -80, 0);
  mimic.hp = mimic.maxHp * 0.4;
  const caster = spawn(run, 'rce', 140, 0); caster.specialTimer = 0;
  const summoner = spawn(run, 'deser', -140, 0); summoner.specialTimer = 0;
  const poison = spawn(run, 'prototype', 0, 140); poison.specialTimer = 0;
  const wraith = spawn(run, 'ssrf', 200, 0); wraith.specialTimer = 0;
  const race = spawn(run, 'race', 0, -140); race.speed = 40;
  run.tick(0.05);
  assert.ok(mimic.split);
  assert.ok(run.enemies.filter(enemy => enemy.kind === 'idor').length >= 3);
  assert.ok(run.projectiles.some(item => item.enemy));
  assert.ok(run.enemies.some(item => item.summoned));
  assert.ok(run._hazards.length > 0);
  assert.ok(Math.hypot(wraith.x, wraith.y) < 100);
  assert.notEqual(race.x, 0);
  const boss = spawn(run, 'reaper', 100, 100, 1000, { boss: true });
  boss.hp = 250;
  boss.attackTimer = 0;
  run.tick(0.05);
  assert.equal(boss.phase, 2);
  assert.ok(run.projectiles.filter(item => item.enemy).length >= CFG.bossBoltCount);
  run._hash.build(run.enemies);
  run._damage(boss, 10000, null, { critical: false });
  assert.ok(run.pickups.some(item => item.kind === 'chest'));
  assert.equal(run.stats.bosses, 1);
  const elite = spawn(run, 'sqli', 100, -100, 10, { elite: true });
  run._damage(elite, 10000, null);
  assert.equal(run.stats.elites, 1);
  assert.ok(run.pickups.some(item => item.kind === 'gold'));
});

test('breakable props drop real pickups; heal, magnet, bomb, freeze and relic all work', () => {
  const run = arena();
  run.weapons = [];
  const prop = { id: 900, kind: run.stageId, x: 0, y: 0, hp: CFG.propHp };
  run.props.push(prop);
  run._damageProp(prop, 100);
  assert.equal(run.stats.props, 1);
  assert.ok(run.pickups.length > 0);
  run.pickups = [];
  run.player.hp = 40;
  take(run, 'heal', 20);
  assert.equal(run.player.hp, 60);
  run.pickups.push({ kind: 'xp', x: 100, y: 0, value: 1, r: CFG.pickupRadius });
  take(run, 'magnet');
  assert.ok(run.pickups.some(item => item.kind === 'xp' && item.attracted));
  const enemy = spawn(run, 'xss', 50, 0, 1000);
  take(run, 'freeze');
  assert.ok(enemy.frozen > 0);
  const before = enemy.hp;
  take(run, 'bomb');
  assert.ok(enemy.hp < before);
  const magnetBefore = run.player.magnet;
  take(run, 'relic');
  assert.equal(run.stats.relics, 1);
  assert.ok(run.player.magnet > magnetBefore);
  assert.ok(run.gold >= CFG.relicGold);
});

test('characters, persistent powerups, hyper, hurry, endless and timed arcana differ meaningfully', () => {
  const hunter = createRun({ characterId: 'hunter' });
  const researcher = createRun({ characterId: 'researcher' });
  const operator = createRun({ characterId: 'operator' });
  assert.ok(hunter.modifiers.might > researcher.modifiers.might);
  assert.ok(researcher.modifiers.growth > hunter.modifiers.growth);
  assert.ok(researcher.player.magnet > hunter.player.magnet);
  assert.ok(operator.player.speed > hunter.player.speed);
  assert.equal(operator.revives, 1);
  assert.equal(createRun({ characterId: 'reverser' }).modifiers.amount, 1);
  assert.ok(createRun({ characterId: 'cryptanalyst' }).modifiers.cooldown < hunter.modifiers.cooldown);
  assert.equal(createRun({ characterId: 'phantom' }).player.armor, 2);
  const meta = createRun({ meta: { might: 500, armor: -5, revival: '1', amount: 1 } });
  assert.equal(meta._meta.might, CATALOG.powerUps.find(item => item.id === 'might').maxLevel);
  assert.equal(meta._meta.armor, 0);
  assert.equal(meta.revives, 1);
  assert.equal(meta.modifiers.amount, 1);
  const hyper = arena({ hyper: true }), hurry = arena({ hurry: true });
  assert.ok(hyper.player.speed > hunter.player.speed);
  hurry.tick(0.1);
  assert.ok(Math.abs(hurry.time - 0.2) < 1e-8);
  const endless = arena({ mode: 'endless' });
  endless.time = 1801;
  endless.tick(0.1);
  assert.equal(endless.state, 'playing');
  assert.equal(endless.cycle, 1);
  assert.ok(endless.cycleTime > 1 && endless.cycleTime < 2);
  assert.equal(endless.duration, Infinity);
  assert.equal(endless.getResult().duration, null);
  const arcana = arena();
  arcana.time = CFG.arcanaTimes.quick[0];
  arcana.tick(0.01);
  assert.equal(arcana.state, 'arcana');
  const drafted = arcana.arcanaChoices[0].id;
  assert.equal(arcana.selectArcana(drafted), true);
  assert.equal(arcana.state, 'playing');
  arcana.state = 'arcana';
  assert.equal(arcana.selectArcana(drafted), false);
});

test('critical, blood, volatile, frost, ricochet and greed arcana affect combat or rewards', () => {
  const blood = arena({ arcanaId: 'blood' });
  blood.player.hp = 50;
  const victim = spawn(blood, 'xss', 25, 0, 1);
  blood._damage(victim, 100, blood.weapons[0]);
  assert.equal(blood.player.hp, 50 + CFG.bloodArcanaHeal);
  const greed = arena({ arcanaId: 'greed' });
  greed.player.hp = 50;
  take(greed, 'gold', 10);
  assert.equal(greed.player.hp, 51);
  take(greed, 'chest');
  assert.ok(greed.chestRewards.length >= 2);
  const ricochet = arena({ arcanaId: 'ricochet', characterId: 'operator' });
  ricochet.tick(0.01);
  assert.equal(ricochet.projectiles[0].bounces, CFG.ricochetArcanaBounces);
  const volatile = arena({ arcanaId: 'volatile', characterId: 'operator' });
  spawn(volatile, 'xss', 35, 0);
  spawn(volatile, 'xss', 35, 17);
  advance(volatile, 0.2);
  assert.ok(volatile.effects.some(effect => effect.kind === 'blast'));
  const frost = arena({ arcanaId: 'frost' });
  const iceTarget = spawn(frost, 'sqli', 40, 0, 10000);
  let frozen = false;
  for (let index = 0; index < 100; index++) { frost._damage(iceTarget, 1, frost.weapons[0]); if (iceTarget.frozen > 0) frozen = true; }
  assert.equal(frozen, true);
  const critical = arena({ arcanaId: 'critical' });
  const regular = arena();
  const first = spawn(critical, 'xss', 40, 0, 100000), second = spawn(regular, 'xss', 40, 0, 100000);
  for (let index = 0; index < 200; index++) { critical._damage(first, 10, critical.weapons[0]); regular._damage(second, 10, regular.weapons[0]); }
  assert.ok(critical.stats.damage > regular.stats.damage);
});

test('world generation and entity/event storage stay bounded under forced saturation', () => {
  const run = arena();
  for (let index = 0; index < CFG.maxEnemies + 100; index++) run._spawn('xss');
  assert.equal(run.enemies.length, CFG.maxEnemies);
  assert.ok(run._spawn('reaper', { boss: true }));
  assert.equal(run.enemies.length, CFG.maxEnemies);
  for (let index = 0; index < CFG.maxProjectiles + 100; index++) run._projectile({ kind: 'knife', x: 0, y: 0, vx: 1, vy: 0, r: 3, life: 1 });
  assert.equal(run.projectiles.length, CFG.maxProjectiles);
  for (let index = 0; index < CFG.maxPickups + 100; index++) run._pickup('xp', index * 100, 0, 1);
  assert.equal(run.pickups.length, CFG.maxPickups);
  assert.equal(run.pickups.reduce((sum, item) => sum + item.value, 0), CFG.maxPickups + 100, 'XP survives saturation through merging');
  for (let index = 0; index < 200; index++) { run.player.x = index * 100; run._ensureWorld(); run._emit('level', 'bounded'); }
  assert.ok(run.props.length <= CFG.maxProps);
  assert.ok(run._propCells.size <= CFG.propCellCap);
  assert.ok(run.notices.length <= CFG.maxNotices);
  assert.ok(run.drainEvents().length <= CFG.maxEvents);
  assert.deepEqual(run.drainEvents(), []);
});


test('four stages have distinct timed gameplay and accurate telegraphed floor collision', () => {
  const bell = arena({ stageId: 'cathedral' });
  bell.weapons = [];
  bell._stageTimer = 0;
  bell.tick(0.01);
  assert.equal(bell.enemies.length, bell.stage.mechanic.count);
  assert.ok(bell.drainEvents().some(event => event.type === 'stage' && event.id === 'bell'));
  const library = arena({ stageId: 'library' });
  library.weapons = [];
  library._stageTimer = 0;
  library.tick(0.01);
  assert.equal(library._hazards.length, 2);
  assert.ok(library._hazards.every(hazard => hazard.shape === 'line'));
  assert.equal(library.player.hp, library.player.maxHp);
  advance(library, library.stage.mechanic.delay + 0.2);
  assert.equal(library.player.hp, library.player.maxHp, 'the corridor between the firewall lanes is safe');
  library.player.y = library.stage.mechanic.laneOffset;
  library.tick(0.1);
  assert.ok(library.player.hp < library.player.maxHp, 'a horizontal index lane damages the player');
  const foundry = arena({ stageId: 'foundry' });
  foundry.weapons = [];
  foundry._stageTimer = 0;
  foundry.tick(0.01);
  assert.equal(foundry._hazards.length, 3);
  foundry.player.x = foundry._hazards[0].x; foundry.player.y = foundry._hazards[0].y;
  assert.equal(foundry.player.hp, foundry.player.maxHp, 'vents allow a real escape warning');
  advance(foundry, foundry.stage.mechanic.delay + 0.2);
  assert.ok(foundry.player.hp < foundry.player.maxHp, 'the erupted crucible is dangerous');
  const voidRun = arena({ stageId: 'void' });
  voidRun.weapons = [];
  voidRun._stageTimer = 0;
  voidRun.tick(0.01);
  const fault = voidRun._hazards[0];
  const originalDistance = Math.hypot(fault.x - voidRun.player.x, fault.y - voidRun.player.y);
  advance(voidRun, voidRun.stage.mechanic.delay + 0.3);
  assert.ok(Math.hypot(fault.x - voidRun.player.x, fault.y - voidRun.player.y) < originalDistance, 'kernel gravity pulls the player toward its core');
  voidRun.player.x = fault.x; voidRun.player.y = fault.y;
  voidRun.tick(0.1);
  assert.ok(voidRun.player.hp < voidRun.player.maxHp, 'only the core deals contact damage');
});

test('boss ring telegraphs accurately identify a safe center and a damaging outer ring', () => {
  const run = arena();
  run.weapons = [];
  run._hazards.push({ x: 0, y: 0, radius: 50, innerRadius: 30, shape: 'ring', life: 3, delay: 0, damage: 12, hitTimer: 0, color: '#cba1d5' });
  run.tick(0.1);
  assert.equal(run.player.hp, run.player.maxHp);
  run.player.x = 42;
  run.tick(0.1);
  assert.ok(run.player.hp < run.player.maxHp);
  const hp = run.player.hp;
  run.player.invulnerable = 0; run.player.x = 70;
  run.tick(0.1);
  assert.equal(run.player.hp, hp, 'outside the visible ring is safe');
});

test('timed wave progression increases density and changes the enemy mix', () => {
  const early = arena(), late = arena();
  early.weapons = late.weapons = [];
  late.time = CFG.bossEvery * 12;
  early._spawnTimer = late._spawnTimer = 0;
  for (let index = 0; index < 50; index++) { early._wave(0.15); late._wave(0.15); }
  assert.ok(late.enemies.length > early.enemies.length);
  assert.ok(new Set(late.enemies.map(enemy => enemy.kind)).size > new Set(early.enemies.map(enemy => enemy.kind)).size);
  const earlyHp = early._spawn('xss').maxHp, lateHp = late._spawn('xss').maxHp;
  assert.ok(lateHp > earlyHp);
});

test('triple and five-item treasure caches roll and apply each reward, without extra eligibility', () => {
  for (const [roll, count] of [[0.1, 3], [0.01, 5]]) {
    const run = arena();
    run._random = () => roll;
    take(run, 'chest');
    assert.equal(run.chestRewards.length, count);
    const gold = run.chestRewards.filter(reward => reward.type === 'gold').reduce((sum, reward) => sum + reward.value, 0);
    const weaponRewards = run.chestRewards.filter(reward => reward.type === 'weapon').length;
    const oldLevel = run.weapons[0].level;
    run.collectChest();
    assert.equal(run.gold, gold);
    assert.equal(run.weapons[0].level, oldLevel + weaponRewards);
  }
});

test('XP thresholds escalate and real upgrade descriptions show their exact change', () => {
  const run = arena();
  const thresholds = [];
  for (let index = 0; index < 20; index++) {
    thresholds.push(run.xpNeed);
    run.xp = run.xpNeed;
    run.tick(0.01);
    run.choose(0);
  }
  assert.ok(thresholds.every((value, index) => index === 0 || value > thresholds[index - 1]));
  const fresh = arena();
  assert.match(fresh._candidates().find(choice => choice.id === 'whip').description, /damage \d+ → \d+/);
  assert.match(fresh._candidates().find(choice => choice.id === 'cooldown').description, /0% → \+7% reduction/);
});

test('evolved whip steals health, evolved pools follow, and Full Disclosure keeps and vacuums XP', () => {
  const whip = arena();
  whip.weapons[0].level = 8;
  whip.weapons[0].evolved = true;
  whip.player.hp = 40;
  spawn(whip, 'sqli', 35, 0);
  whip.tick(0.05);
  assert.ok(whip.player.hp > 40);
  assert.ok(whip.enemies[0].bleed > 0);
  const pool = arena();
  pool.weapons = [{ id: 'pool', level: 8, evolved: true, damage: 0, kills: 0, timer: 0 }];
  spawn(pool, 'sqli', 60, 0);
  pool.tick(0.05);
  const zone = pool._zones[0], previousX = zone.x, previousRadius = zone.radius;
  advance(pool, 0.4);
  assert.ok(zone.x < previousX);
  assert.ok(zone.radius > previousRadius);
  const purge = arena();
  purge.weapons = [{ id: 'pentagram', level: 8, evolved: true, damage: 0, kills: 0, timer: 0 }];
  spawn(purge, 'xss', 100, 0, 5);
  purge.tick(0.05);
  assert.equal(purge.kills, 1);
  assert.ok(purge.pickups.some(item => item.kind === 'xp' && item.attracted));
});

test('Limit Break adds permanent per-weapon scaling after the build is maxed, with precise banishment', () => {
  const run = arena();
  run.weapons = CATALOG.weapons.slice(0, 6).map(item => ({ id: item.id, level: 8, evolved: false, damage: 0, kills: 0, timer: 0 }));
  run.passives = CATALOG.passives.slice(0, 6).map(item => ({ id: item.id, level: 5 }));
  run._recalculate();
  const choice = run._candidates().find(item => item.type === 'limitbreak' && item.id === 'whip' && item.stat === 'damage');
  assert.ok(choice);
  const previous = run._weaponStats(run.weapons[0]).damage;
  run.state = 'upgrade'; run.choices = [choice];
  assert.equal(run.choose(0), true);
  assert.equal(run.weapons[0].level, 8);
  assert.equal(run.weapons[0].limitBreakLevel, 1);
  assert.ok(run._weaponStats(run.weapons[0]).damage > previous);
  assert.equal(run.getResult().weapons[0].limitBreakLevel, 1);
  run.state = 'upgrade'; run.choices = [choice];
  assert.equal(run.banish(0), true);
  assert.ok(!run._candidates().some(item => item.type === 'limitbreak' && item.id === 'whip' && item.stat === 'damage'));
  assert.ok(run._candidates().some(item => item.type === 'limitbreak' && item.id === 'whip' && item.stat === 'area'));
});


test('Supply Chain Collapse requires two maxed source weapons, passive and late cache; consumes a real slot', () => {
  for (const [crossLevel, passive, time, eligible] of [[7, 'speed', 130, false], [8, 'armor', 130, false], [8, 'speed', 119, false], [8, 'speed', 130, true]]) {
    const run = arena();
    run.weapons = ['birds', 'cross', 'whip', 'knife', 'orbit', 'pool'].map(id => ({ id, level: id === 'cross' ? crossLevel : 8, evolved: false, damage: id === 'birds' ? 100 : id === 'cross' ? 200 : 0, kills: id === 'birds' ? 4 : id === 'cross' ? 5 : 0, timer: 0 }));
    offer(run, 'passive', passive);
    run.time = time;
    take(run, 'chest');
    assert.equal(run.chestRewards.some(reward => reward.type === 'union'), eligible);
    run.collectChest();
    if (!eligible) { assert.equal(run.stats.unions, 0); continue; }
    const union = run.weapons.find(weapon => weapon.id === 'birds');
    assert.equal(union.union.name, 'Supply Chain Collapse');
    assert.equal(union.union.with, 'cross');
    assert.equal(run.weapons.length, 5);
    assert.ok(!run.weapons.some(weapon => weapon.id === 'cross'));
    assert.ok(union.damage >= 300 && union.kills >= 9, 'absorbed weapon statistics survive');
    assert.equal(union.provenance.length, 2);
    assert.equal(run.stats.unions, 1);
    assert.equal(run.getResult().weapons.find(weapon => weapon.id === 'birds').union, true);
    assert.equal(offer(run, 'weapon', 'lightning'), true, 'the consumed slot really supports a new weapon');
    run.projectiles = []; run.effects = []; run._zones = []; union.timer = 0;
    run.tick(0.05);
    assert.ok(run.projectiles.some(shot => shot.kind === 'cross' && shot.weapon === union));
    assert.ok(run._zones.some(zone => zone.kind === 'birds' && zone.weapon === union));
  }
});

test('library walls bound a true endless corridor, while foundry pillars collide and remain escapable', () => {
  const library = arena({ stageId: 'library' });
  library.weapons = [];
  library.player.y = library.stage.geometry.halfHeight - library.player.r - 1;
  library.tick(0.5, { dy: 1, dx: 1 });
  assert.ok(library.player.y <= library.stage.geometry.halfHeight - library.player.r);
  assert.ok(library.player.x > 0, 'tangential motion along a wall remains possible');
  library.player.x = 100000;
  library._ensureWorld();
  assert.equal(library.obstacles.length, 2);
  assert.equal(library.obstacles[0].x, library.player.x);
  const foundry = arena({ stageId: 'foundry' });
  foundry.weapons = [];
  assert.ok(foundry.obstacles.length > 0);
  const pillar = foundry.obstacles[0];
  foundry.player.x = pillar.x; foundry.player.y = pillar.y;
  foundry.tick(0.01);
  const inside = entity => Math.abs(entity.x - pillar.x) < pillar.width / 2 && Math.abs(entity.y - pillar.y) < pillar.height / 2;
  assert.equal(inside(foundry.player), false, 'an actor spawned inside geometry is pushed clear');
  const enemy = spawn(foundry, 'xss', pillar.x, pillar.y);
  foundry.tick(0.01);
  assert.equal(inside(enemy), false);
  for (const landmark of [foundry.stage.relic, foundry.stage.objective, foundry.stage.merchant]) assert.ok(foundry.obstacles.every(obstacle => Math.hypot(obstacle.x - landmark.x, obstacle.y - landmark.y) >= CFG.geometryLandmarkClearance));
});

test('authored stage schedules spawn rings, two-sided rush lines and elites once at scaled clock times', () => {
  for (const pattern of ['ring', 'rush-lines', 'elites']) {
    const run = arena();
    run.weapons = [];
    const index = run.stage.events.findIndex(event => event.pattern === pattern), event = run.stage.events[index];
    run._eventIndex = index;
    run.time = event.time / CFG.authoredEventQuickScale - 0.01;
    run.tick(0.02);
    assert.equal(run.enemies.length, event.count);
    assert.ok(run.drainEvents().some(entry => entry.authored && entry.pattern === pattern));
    const before = run.enemies.length;
    run.tick(0.02);
    assert.equal(run.enemies.length, before, 'a schedule entry cannot fire twice');
    if (pattern === 'ring') assert.ok(run.enemies.every(enemy => Math.abs(Math.hypot(enemy.x, enemy.y) - event.radius) < 3));
    if (pattern === 'rush-lines') assert.ok(run.enemies.some(enemy => enemy.x > 0) && run.enemies.some(enemy => enemy.x < 0));
    if (pattern === 'elites') assert.ok(run.enemies.some(enemy => enemy.elite));
  }
});

test('sealed rescue objective requires actual guardian kills, rewards once and cannot be farmed', () => {
  const run = arena();
  run.weapons = [];
  run.player.x = run.objective.x; run.player.y = run.objective.y;
  run._pickup('coffin', run.objective.x, run.objective.y, 1);
  run.tick(0.01);
  assert.equal(run.objective.spawned, run.objective.guardCount);
  assert.equal(run.objective.state, 'sealed');
  assert.equal(run.stats.rescues, 0);
  const guards = run.enemies.filter(enemy => enemy.guard);
  assert.equal(guards.length, run.objective.guardCount);
  for (const guard of guards) run._damage(guard, 100000, null);
  assert.equal(run.objective.state, 'open');
  assert.equal(run.objective.guardsKilled, run.objective.guardCount);
  run.tick(0.01);
  assert.equal(run.objective.state, 'rescued');
  assert.equal(run.stats.rescues, 1);
  assert.ok(run.gold >= CFG.objectiveGold);
  const rescues = run.stats.rescues;
  while (run.state === 'upgrade') run.choose(0);
  take(run, 'coffin');
  assert.equal(run.stats.rescues, rescues);
  assert.ok(run.stats.killsByKind[run.objective.guardKind] >= run.objective.guardCount);
});

test('merchant spends current-run gold, applies real effects, caps purchases and requires departure to re-enter', () => {
  const run = arena();
  run.weapons = [];
  run.player.x = run.stage.merchant.x; run.player.y = run.stage.merchant.y;
  run.gold = 500; run.player.hp = 20;
  take(run, 'merchant');
  assert.equal(run.state, 'merchant');
  const beforeTime = run.time;
  assert.equal(run.tick(1), false);
  assert.equal(run.time, beforeTime);
  const heal = run.merchantOffers.find(offer => offer.type === 'heal');
  assert.equal(run.buyMerchant(heal.id), true);
  assert.equal(run.gold, 500 - heal.cost);
  assert.equal(run.player.hp, 20 + heal.value);
  assert.equal(run.buyMerchant(heal.id), false);
  const might = run.merchantOffers.find(offer => offer.type === 'stat'), oldMight = run.modifiers.might;
  assert.equal(run.buyMerchant(might.id), true);
  assert.ok(run.modifiers.might > oldMight);
  const revival = run.merchantOffers.find(offer => offer.type === 'revive');
  assert.equal(run.buyMerchant(revival.id), true);
  assert.equal(run.revives, 1);
  assert.equal(run.stats.merchantPurchases, 3);
  assert.equal(run.buyMerchant('grimoire'), false, 'purchase cap is enforced');
  assert.equal(run.leaveMerchant(), true);
  advance(run, 1.2);
  assert.equal(run.state, 'playing');
  assert.ok(!run.pickups.some(pickup => pickup.kind === 'merchant'), 'standing on the merchant does not reopen it');
  run.player.x += CFG.merchantReturnDistance + 2;
  run.tick(0.01);
  assert.ok(run.pickups.some(pickup => pickup.kind === 'merchant'));
  run.player.x = run.stage.merchant.x;
  run.tick(0.01);
  assert.equal(run.state, 'merchant');
  assert.equal(run.merchantOffers.filter(offer => offer.purchased).length, 3);
  assert.equal(run.buyMerchant('unknown'), false);
});

test('merchant weapon choices and arcana offers affect the actual build rather than cosmetic metadata', () => {
  const weapon = arena();
  weapon.gold = 500;
  take(weapon, 'merchant');
  assert.equal(weapon.buyMerchant('arsenal'), true);
  assert.equal(weapon.state, 'upgrade');
  assert.ok(weapon.choices.every(choice => choice.type === 'weapon'));
  const choice = weapon.choices[0];
  assert.equal(weapon.choose(0), true);
  assert.ok(weapon.weapons.some(item => item.id === choice.id && item.level >= choice.level));
  const arcana = arena();
  arcana.gold = 500;
  take(arcana, 'merchant');
  const offer = arcana.merchantOffers.find(item => item.type === 'arcana');
  assert.equal(arcana.buyMerchant(offer.id), true);
  assert.ok(arcana.arcana.includes(offer.arcanaId));
  assert.equal(arcana.stats.merchantPurchases, 1);
});

test('final boss kill ends the run and the rescue-plus-relic secret condition is real', () => {
  const run = arena();
  run.relicCollected = true; run.objective.state = 'rescued';
  const final = spawn(run, 'reaper', 100, 0, 1, { boss: true, final: true });
  run._damage(final, 100, run.weapons[0]);
  assert.equal(run.state, 'won');
  assert.equal(run.stats.secretObjectives, 1);
  assert.ok(run.gold >= CFG.secretObjectiveGold);
  assert.equal(run.getResult().stats.killsByKind.reaper, 1);
  const result = run.getResult();
  result.stats.killsByKind.reaper = 999;
  assert.equal(run.stats.killsByKind.reaper, 1, 'plain results do not expose mutable run internals');
});


test('weapon hits create bounded physical knockback, bosses resist, and damage-over-time does not push', () => {
  const run = arena();
  const regular = spawn(run, 'sqli', 40, 0, 1000);
  const boss = spawn(run, 'sqli', 40, 60, 1000, { boss: true });
  const initialBoss = { x: boss.x, y: boss.y };
  run._damage(regular, 10, run.weapons[0], { critical: false, knockbackAngle: 0 });
  run._damage(boss, 10, run.weapons[0], { critical: false, knockbackAngle: 0 });
  const displacement = regular.x - 40;
  assert.ok(displacement > 0 && displacement <= CFG.enemyKnockback * definition('weapon', 'whip').knockback + 1e-8);
  assert.ok(boss.x - initialBoss.x > 0 && boss.x - initialBoss.x < displacement);
  const beforeDot = regular.x;
  run._damage(regular, 1, run.weapons[0], { overTime: true });
  assert.equal(regular.x, beforeDot);
  const foundry = arena({ stageId: 'foundry' });
  const pillar = foundry.obstacles[0];
  const victim = spawn(foundry, 'xss', pillar.x - pillar.width / 2 - 7.1, pillar.y, 1000);
  foundry._damage(victim, 1, foundry.weapons[0], { critical: false, knockbackAngle: 0 });
  assert.ok(victim.x <= pillar.x - pillar.width / 2 - victim.r + 1e-8, 'knockback cannot push a victim through solid geometry');
});

test('merchant bonuses survive later recalculation and a full-health patch cannot waste bounty', () => {
  const run = arena();
  run.gold = 500;
  take(run, 'merchant');
  const heal = run.merchantOffers.find(offer => offer.type === 'heal');
  assert.equal(heal.disabled, true);
  assert.equal(run.buyMerchant(heal.id), false);
  assert.equal(run.gold, 500);
  assert.equal(run.buyMerchant('rootkit'), true);
  const might = run.modifiers.might;
  run.leaveMerchant();
  offer(run, 'passive', 'armor');
  assert.equal(run.modifiers.might, might);
});

test('all six starter loops reach a real level choice across eight seeds with ordinary movement', () => {
  for (const character of CATALOG.characters) for (let seed = 1; seed <= 8; seed++) {
    const run = createRun({ characterId: character.id, seed, arcanaId: 'blood' });
    let firstLevel = null;
    while (run.time < 45 && run.state !== 'dead') {
      if (run.state === 'upgrade') {
        firstLevel ??= run.time;
        let choice = run.choices.findIndex(item => item.type === 'weapon' && run.weapons.some(weapon => weapon.id === item.id));
        run.choose(Math.max(0, choice)); continue;
      }
      if (run.state === 'chest') { run.collectChest(); continue; }
      if (run.state === 'merchant') { run.leaveMerchant(); continue; }
      if (run.state === 'arsenal') { run.skipArsenal(); continue; }
      let target = null, distance = Infinity;
      for (const pickup of run.pickups) {
        if (pickup.kind !== 'xp') continue;
        const d = Math.hypot(pickup.x - run.player.x, pickup.y - run.player.y);
        if (d < distance) { distance = d; target = pickup; }
      }
      const angle = target ? Math.atan2(target.y - run.player.y, target.x - run.player.x) : run.time * 0.06;
      run.tick(0.1, { dx: Math.cos(angle), dy: Math.sin(angle) });
    }
    assert.ok(firstLevel !== null && firstLevel <= CFG.earlyLoopDeadline, `${character.id}, seed ${seed}: first choice at ${firstLevel}s`);
    assert.ok(run.kills > 0, `${character.id}, seed ${seed}: actual combat`);
  }
});


test('dense combat cannot evict readable enemy telegraphs from the bounded effect budget', () => {
  const run = arena();
  run._effect('warning', 40, 0, 30, 2, { enemy: true });
  for (let index = 0; index < CFG.maxEffects * 3; index++) run._effect('impact', index, 0, 4);
  assert.equal(run.effects.length, CFG.maxEffects);
  assert.ok(run.effects.some(effect => effect.kind === 'warning'));
});

test('merchant revisits disable obsolete arcana offers and never charge for them', () => {
  const run = arena(); run.gold = 1000;
  take(run, 'merchant');
  const offer = run.merchantOffers.find(item => item.type === 'arcana');
  run.leaveMerchant(); run.arcana.push(offer.arcanaId);
  run._openMerchant();
  assert.equal(offer.disabled, true); assert.equal(offer.disabledReason, 'ARCANA UNAVAILABLE');
  const before = run.gold;
  assert.equal(run.buyMerchant(offer.id), false); assert.equal(run.gold, before);
});

test('boss spawning cannot evict rescue wardens and leave an objective permanently sealed', () => {
  const run = arena(); run.weapons = [];
  run.player.x = run.objective.x; run.player.y = run.objective.y;
  run.tick(0.01);
  const guards = run.enemies.filter(enemy => enemy.guard);
  assert.equal(guards.length, run.objective.guardCount);
  while (run.enemies.length < CFG.maxEnemies) run._spawn('xss');
  assert.ok(run._spawn('reaper', { boss: true }));
  assert.equal(run.enemies.filter(enemy => enemy.guard).length, guards.length);
  for (const guard of guards) run._damage(guard, 100000, null);
  assert.equal(run.objective.state, 'open');
});
