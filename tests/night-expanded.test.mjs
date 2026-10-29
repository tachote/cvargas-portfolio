import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createRun } from '../src/scripts/night/engine.js';
const CFG = CATALOG.config;

function isolated(options = {}) {
  const run = createRun({ seed: 212, ...options });
  run.enemies = []; run.pickups = []; run.props = [];
  run._spawnTimer = run._eliteTimer = run._bossTimer = run._worldTimer = run._stageTimer = 1e8;
  return run;
}
function maxBuild(run) {
  run.weapons = CATALOG.weapons.slice(0, run.weaponLimit).map(item => ({ id: item.id, level: item.maxLevel, evolved: false, damage: 0, kills: 0, timer: 0 }));
  run.passives = CATALOG.passives.slice(0, CFG.passiveSlots).map(item => ({ id: item.id, level: item.maxLevel }));
  run._recalculate();
}

test('weapon limits and persistent seals affect every real acquisition route without deleting starters', () => {
  const run = isolated({ weaponLimit: 1, sealed: ['whip', 'wand', 'knife', 'invalid', 'wand'] });
  assert.equal(run.weaponLimit, 1);
  assert.deepEqual(run.sealed, ['whip', 'wand', 'knife']);
  assert.equal(run.weapons[0].id, 'whip');
  assert.ok(run._candidates().some(choice => choice.type === 'weapon' && choice.id === 'whip'));
  assert.ok(!run._candidates().some(choice => choice.type === 'weapon' && choice.id !== 'whip'));
  assert.equal(run._applyReward({ type: 'weapon', id: 'axe' }), false);
  const sealed = isolated({ sealed: ['wand'] });
  assert.ok(!sealed._candidates().some(choice => choice.id === 'wand'));
  assert.equal(sealed._applyReward({ type: 'weapon', id: 'wand' }), false);
  sealed.gold = 1000; sealed._openMerchant();
  const offer = sealed.merchantOffers.find(offer => offer.type === 'weapon');
  assert.equal(sealed.buyMerchant(offer.id), true);
  assert.ok(sealed.choices.every(choice => choice.id !== 'wand'));
  assert.equal(isolated({ weaponLimit: 99 }).weaponLimit, CFG.weaponSlots);
  assert.equal(isolated({ weaponLimit: -9 }).weaponLimit, 1);
});

test('arcana and Limit Break switches disable effects and their actual reward pools', () => {
  const run = isolated({ arcanaEnabled: false, arcanaId: 'blood', limitBreak: false });
  assert.equal(run.arcanaLimit, 0); assert.deepEqual(run.arcana, []);
  run.time = CFG.arcanaTimes.quick[0]; run.tick(.01);
  assert.notEqual(run.state, 'arcana');
  run.state = 'arcana'; assert.equal(run.selectArcana('blood'), false); run.state = 'playing';
  run.gold = 1000; run._openMerchant();
  assert.ok(run.merchantOffers.every(offer => offer.type !== 'arcana'));
  run.state = 'playing'; maxBuild(run);
  assert.deepEqual(new Set(run._candidates().map(choice => choice.type)), new Set(['gold', 'heal']));
  assert.equal(run._applyReward({ type: 'limitbreak', id: run.weapons[0].id, stat: 'damage' }), false);
  const normal = isolated(); maxBuild(normal);
  assert.ok(normal._candidates().some(choice => choice.type === 'limitbreak'));
});

test('Inverse changes enemy health, speed, wave pressure, earned bounty and XP growth', () => {
  const normal = isolated(), inverse = isolated({ inverse: true });
  const a = normal._spawn('sqli'), b = inverse._spawn('sqli');
  assert.equal(b.hp, a.hp * CFG.inverseEnemyHp);
  assert.equal(b.speed, a.speed * CFG.inverseEnemySpeed);
  normal._spawnTimer = inverse._spawnTimer = 0;
  normal._wave(.01); inverse._wave(.01);
  assert.ok(inverse._spawnTimer < normal._spawnTimer);
  normal._collect({ kind: 'xp', value: 10 }); inverse._collect({ kind: 'xp', value: 10 });
  assert.equal(inverse.xp, normal.xp * CFG.inverseGrowth);
  normal._collect({ kind: 'gold', value: 5 }); inverse._collect({ kind: 'gold', value: 5 });
  assert.equal(inverse.gold, normal.gold * CFG.inverseGold);
  assert.equal(inverse.getResult().inverse, true);
});

test('Curse affects enemy health, speed, spawn frequency and average quantity', () => {
  const normal = isolated(), cursed = isolated();
  cursed.passives.push({ id: 'curse', level: 1 }); cursed._recalculate();
  const ratio = cursed.modifiers.curse / normal.modifiers.curse;
  const a = normal._spawn('xss'), b = cursed._spawn('xss');
  assert.ok(Math.abs(b.hp / a.hp - ratio) < 1e-9);
  assert.ok(Math.abs(b.speed / a.speed - ratio) < 1e-9);
  normal.enemies = []; cursed.enemies = [];
  for (let index = 0; index < 20; index++) {
    normal._spawnTimer = cursed._spawnTimer = 0;
    normal._wave(.01); cursed._wave(.01);
  }
  assert.ok(cursed._spawnTimer < normal._spawnTimer);
  assert.ok(Math.abs(cursed.enemies.length / normal.enemies.length - ratio) <= 1 / normal.enemies.length);
});

test('individual artifacts apply bounded permanent increments without touching global powers', () => {
  const normal = isolated(), one = isolated({ eggs: 1 }), cycle = isolated({ eggs: CFG.eggStats.length });
  assert.ok(one.modifiers.might > normal.modifiers.might);
  for (const bonus of CFG.eggStats) {
    if (bonus.amount > 0) assert.ok(cycle.modifiers[bonus.stat] > normal.modifiers[bonus.stat], bonus.stat);
    else assert.ok(cycle.modifiers[bonus.stat] < normal.modifiers[bonus.stat], bonus.stat);
  }
  assert.equal(isolated({ eggs: 1e20 }).eggs, CFG.maxEggs);
  assert.equal(isolated({ eggs: -50 }).eggs, 0);
  assert.equal(normal.getResult().eggs, 0);
  assert.deepEqual(one._meta, normal._meta);
});

test('gold pickups trigger a timed bounty frenzy, extend it, drop actual coins and end cleanly', () => {
  const run = isolated();
  run._collect({ kind: 'gold', value: CFG.goldFeverThreshold - 1 });
  assert.equal(run.goldFever.active, false);
  run._collect({ kind: 'gold', value: 1 });
  assert.equal(run.goldFever.active, true); assert.equal(run.stats.goldFevers, 1);
  const first = run.goldFever.remaining;
  run._updateGoldFever(2);
  run._collect({ kind: 'gold', value: 10 });
  assert.ok(run.goldFever.remaining > first - 2);
  assert.ok(run.stats.feverGold > 0);
  assert.equal(run.goldFever.totalGold, run.stats.feverGold);
  const before = run.pickups.filter(item => item.kind === 'gold').length;
  for (let index = 0; index < CFG.goldFeverDropEvery; index++) {
    const enemy = run._spawn('xss', { x: 50 + index * 30, y: 50 });
    run._kill(enemy, run.weapons[0]);
  }
  assert.ok(run.pickups.filter(item => item.kind === 'gold').length > before);
  const pausedAt = run.goldFever.remaining; run.state = 'upgrade'; run.tick(2);
  assert.equal(run.goldFever.remaining, pausedAt);
  run.state = 'playing'; run._updateGoldFever(CFG.goldFeverMaxDuration + 1);
  assert.equal(run.goldFever.active, false); assert.equal(run.goldFever.remaining, 0);
  assert.equal(run.stats.goldFevers, 1);
  const expired = isolated(); expired._collect({ kind: 'gold', value: CFG.goldFeverThreshold - 1 });
  expired._updateGoldFever(CFG.goldFeverChainWindow + 1); expired._collect({ kind: 'gold', value: 1 });
  assert.equal(expired.goldFever.active, false);
});

test('floor artifacts require guardian kills and alone can exceed the passive slot limit', () => {
  const run = createRun({ seed: 41 });
  maxBuild(run); run.enemies = []; run.props = [];
  const item = run.stageItems.find(item => !run.passives.some(passive => passive.id === item.passiveId));
  assert.ok(item);
  run.player.x = item.x; run.player.y = item.y;
  run._collectPickups(.01);
  assert.equal(item.state, 'sealed');
  assert.equal(run.passives.length, CFG.passiveSlots);
  run._updateStageItems();
  const guardian = run.enemies.find(enemy => enemy.stageItemId === item.id);
  assert.ok(guardian?.elite); assert.ok(item.guardId);
  run._kill(guardian, run.weapons[0]);
  assert.equal(item.state, 'open');
  run._collectPickups(.01);
  assert.equal(item.state, 'collected'); assert.equal(run.stats.stageItems, 1);
  assert.equal(run.passives.length, CFG.passiveSlots + 1);
  const equipped = run.passives.find(passive => passive.id === item.passiveId);
  assert.equal(equipped.fromFloor, true);
  assert.ok(run._candidates().some(choice => choice.type === 'passive' && choice.id === equipped.id));
  const absent = CATALOG.passives.find(passive => !run.passives.some(item => item.id === passive.id));
  assert.equal(run._applyReward({ type: 'passive', id: absent.id }), false);
  run._collect({ kind: 'stageitem', itemId: item.id });
  assert.equal(run.stats.stageItems, 1);
});

test('floor guardians and artifact pickups survive saturated entity and pickup budgets', () => {
  const run = createRun({ seed: 41 });
  const item = run.stageItems[0]; run.player.x = item.x; run.player.y = item.y;
  while (run.enemies.length < CFG.maxEnemies) run._spawn('xss');
  run._updateStageItems();
  const guardian = run.enemies.find(enemy => enemy.stageItemId === item.id);
  assert.ok(guardian);
  assert.ok(run._spawn('reaper', { boss: true }));
  assert.ok(run.enemies.includes(guardian));
  run._updateEnemies(.01);
  assert.ok(run.enemies.includes(guardian));
  while (run.pickups.length < CFG.maxPickups) run.pickups.push({ kind: 'xp', x: 900, y: 900, value: 1 });
  for (let index = 0; index < 20; index++) run._pickup('gold', index * 30, 0, 1);
  assert.ok(run.pickups.some(pickup => pickup.itemId === item.id));
});

test('Endless cycles restart wave mixes, broker stock and arcana timing with cumulative pressure', () => {
  const run = isolated({ mode: 'endless' });
  run.gold = 10000; run._openMerchant();
  const offer = run.merchantOffers.find(item => item.type === 'stat');
  assert.equal(run.buyMerchant(offer.id), true);
  run.leaveMerchant();
  const historical = run.stats.merchantPurchases;
  run.time = CFG.endlessCycleDuration + .01; run._syncCycle();
  assert.equal(run.cycle, 1); assert.ok(run.cycleTime < 1); assert.equal(run.stats.cycles, 1);
  assert.equal(run.stats.merchantPurchases, historical); assert.equal(run.merchantCyclePurchases, 0);
  assert.equal(run._bossIndex, 0); assert.equal(run._arcanaIndex, 0);
  assert.ok(run.pickups.some(item => item.kind === 'merchant'));
  run._openMerchant(); assert.equal(run.merchantOffers.find(item => item.id === offer.id).purchased, false);
  run.leaveMerchant();
  run.enemies = []; run._wave(.01);
  assert.ok(run.enemies.every(enemy => run.stage.enemyPool.slice(0, 2).includes(enemy.kind)));
  const early = isolated({ mode: 'endless' }); early.time = run.time;
  assert.ok(run._spawn('xss').hp > early._spawn('xss').hp);
  assert.ok(run._spawn('xss').speed > early._spawn('xss').speed);
  run.arcana = ['critical', 'blood', 'volatile'];
  run.time = CFG.endlessCycleDuration + CFG.arcanaTimes.endless[0]; run.tick(.01);
  assert.equal(run.state, 'arcana');
  assert.equal(run.arcanaLimit, CFG.endlessArcanaSlots);
  assert.equal(run.selectArcana('frost'), true);
  assert.equal(run.arcana.length, 4);
  assert.equal(run.duration, Infinity);
});

test('Final Confrontation requires the living final boss to fall after the deadline', () => {
  const run = isolated({ finalBossRequired: true, arcanaEnabled: false });
  run.time = run.duration - .01; run.tick(.02);
  assert.equal(run.state, 'playing'); assert.equal(run.overtime, true);
  assert.ok(run.time > run.duration);
  const boss = run.enemies.find(enemy => enemy.final);
  assert.ok(boss); run._kill(boss, run.weapons[0]);
  assert.equal(run.state, 'won');
  assert.equal(run.getResult().finalBossRequired, true);
  const standard = isolated({ arcanaEnabled: false });
  standard.time = standard.duration - .01; standard.tick(.02);
  assert.equal(standard.state, 'won');
  assert.equal(isolated({ mode: 'endless', finalBossRequired: true }).finalBossRequired, false);
});

test('a purchased-power-up Endless run crosses its first real 30-minute cycle through ordinary play', () => {
  const meta = Object.fromEntries(CATALOG.powerUps.map(item => [item.id, item.maxLevel]));
  const run = createRun({ seed: 77, mode: 'endless', characterId: 'operator', arcanaId: 'blood', meta });
  const until = CFG.endlessCycleDuration + 12;
  let iterations = 0;
  while (run.time < until && (run.state !== 'dead' || run.revives) && iterations++ < 60000) {
    if (run.state === 'upgrade') {
      let choice = run.choices.findIndex(item => item.type === 'weapon' && run.weapons.some(weapon => weapon.id === item.id));
      if (choice < 0) choice = run.choices.findIndex(item => item.type === 'passive' && run.weapons.some(weapon => CATALOG.weapons.find(def => def.id === weapon.id).evolution.passive === item.id));
      run.choose(Math.max(0, choice)); continue;
    }
    if (run.state === 'chest') { run.collectChest(); continue; }
    if (run.state === 'arcana') { run.selectArcana(run.choices.find(choice => choice.id === 'critical')?.id || run.choices[0].id); continue; }
    if (run.state === 'merchant') { run.leaveMerchant(); continue; }
    if (run.state === 'arsenal') { run.skipArsenal(); continue; }
    if (run.state === 'dead') { run.revive(); continue; }
    let target, best = Infinity;
    for (const pickup of run.pickups) if (['xp', 'chest', 'relic', 'heal'].includes(pickup.kind)) {
      const distance = (pickup.x - run.player.x) ** 2 + (pickup.y - run.player.y) ** 2;
      if (distance < best) { target = pickup; best = distance; }
    }
    const angle = target ? Math.atan2(target.y - run.player.y, target.x - run.player.x) : run.time * .06;
    run.tick(Math.min(.5, until - run.time), { dx: Math.cos(angle), dy: Math.sin(angle) });
  }
  assert.ok(iterations < 60000);
  assert.equal(run.cycle, 1);
  assert.equal(run.stats.cycles, 1);
  assert.ok(run.time >= until);
  assert.ok(run.stats.bosses >= 15);
  assert.ok(run.stats.maxEnemies <= CFG.maxEnemies);
  assert.ok(run.stats.maxProjectiles <= CFG.maxProjectiles);
  assert.ok(run.stats.maxPickups <= CFG.maxPickups);
  assert.notEqual(run.state, 'won');
});

test('Kill Switch can erase existing combat loot, while protected landmarks and evolved evidence survive', () => {
  for (const evolved of [false, true]) {
    const run = isolated();
    const weapon = { id: 'pentagram', level: evolved ? 8 : 1, evolved, damage: 0, kills: 0, timer: 0 };
    run.weapons = [weapon]; run._random = () => .9999;
    const protectedDrops = CFG.purgeProtectedKinds.map((kind, index) => run._pickup(kind, 30 + index * 20, 0, 1));
    const loot = ['xp', 'gold', 'chest', 'heal'].map((kind, index) => run._pickup(kind, -30 - index * 20, 0, 1));
    const distant = run._pickup('xp', 1000, 0, 10);
    const boss = run._spawn('xss', { x: 100, y: 100, boss: true }); boss.hp = 1;
    run._hash.build(run.enemies); run._fire(weapon);
    for (const item of protectedDrops) assert.ok(run.pickups.includes(item), item.kind);
    assert.ok(run.pickups.includes(distant));
    assert.equal(boss.hp <= 0, true);
    if (evolved) {
      for (const item of loot) assert.ok(run.pickups.includes(item), item.kind);
      assert.ok(run.pickups.filter(item => item.kind === 'xp').every(item => item.attracted));
      assert.ok(run.pickups.some(item => item.kind === 'chest'));
    } else {
      for (const item of loot) assert.ok(!run.pickups.includes(item), item.kind);
      assert.ok(!run.pickups.some(item => item.kind === 'chest'));
    }
  }
  const lucky = isolated();
  const gem = lucky._pickup('xp', 30, 0, 1);
  lucky._random = () => 0;
  lucky._fire({ id: 'pentagram', level: 1, evolved: false, damage: 0, kills: 0 });
  assert.ok(lucky.pickups.includes(gem), 'a successful preservation roll retains existing evidence');
});

test('the authored final-minute formation is not skipped when Endless rolls its clock over', () => {
  const run = isolated({ mode: 'endless' });
  run._eventIndex = run.stage.events.length - 1;
  run.time = CFG.endlessCycleDuration + .01;
  run._syncCycle();
  const events = run.drainEvents();
  assert.ok(events.some(event => event.authored && event.time === CFG.endlessCycleDuration));
  assert.ok(events.some(event => event.type === 'cycle' && event.cycle === 1));
  assert.equal(run._eventIndex, 0);
});
