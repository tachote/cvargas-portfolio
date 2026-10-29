import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createRun } from '../src/scripts/night/engine.js';
const CFG = CATALOG.config;

function isolated(options = {}) {
  const run = createRun({ seed: 137, ...options });
  run.enemies = []; run.pickups = []; run.props = [];
  run._spawnTimer = run._eliteTimer = run._bossTimer = run._worldTimer = run._stageTimer = 1e8;
  return run;
}
function unionFixture(id) {
  const definition = CATALOG.unions.find(union => union.id === id), run = isolated({ weaponLimit: 2 });
  run.weapons = definition.weapons.map((weaponId, index) => ({ id: weaponId, level: CFG.weaponMaxLevel, damage: 40 + index * 20, kills: index + 1, timer: 0, evolved: false }));
  run.passives = [{ id: definition.passive, level: 1 }]; run._recalculate();
  run.time = CFG.chestEvolutionMinimum.quick;
  assert.equal(run._openChest(), true);
  assert.equal(run.chestRewards[0].id, id);
  assert.equal(run.collectChest(), true);
  return { run, definition, retained: run.weapons[0] };
}

test('the authored vault is reached by normal movement and offers a real legal new weapon', () => {
  const run = createRun({ seed: 3, characterId: 'researcher', weaponLimit: 2, unlockedWeapons: ['wand', 'orbit', 'knife'], sealed: ['knife'], arcanaEnabled: false });
  const vault = run.stage.arsenal;
  for (let steps = 0; steps < 150 && run.state !== 'arsenal'; steps++) {
    if (run.state === 'upgrade') { run.choose(Math.max(0, run.choices.findIndex(choice => choice.type === 'passive'))); continue; }
    assert.equal(run.state, 'playing');
    run.tick(.05, { dx: vault.x - run.player.x, dy: vault.y - run.player.y });
  }
  assert.equal(run.state, 'arsenal');
  assert.deepEqual(run.arsenalChoices.map(choice => choice.id), ['orbit']);
  const time = run.time;
  assert.equal(run.tick(1, { dx: 1 }), false); assert.equal(run.time, time);
  assert.equal(run.selectWeapon('knife'), false);
  assert.equal(run.selectWeapon('orbit'), true);
  assert.ok(run.weapons.some(weapon => weapon.id === 'orbit' && weapon.level === 1));
  assert.equal(run.selectWeapon('orbit'), false);
  assert.equal(run.stats.arsenals, 1);
});

test('vault selection and bounty fallback preserve queued levels and cannot be claimed twice', () => {
  const run = isolated();
  assert.equal(run._openArsenal(), true);
  run.xp = run.xpNeed;
  assert.equal(run.selectWeapon(run.arsenalChoices[0].id), true);
  assert.equal(run.state, 'upgrade'); assert.equal(run.level, 2);
  assert.equal(run._openArsenal(), false);
  for (const options of [{ weaponLimit: 1 }, { unlockedWeapons: ['whip'] }]) {
    const full = isolated(options);
    assert.equal(full._openArsenal(), true);
    assert.equal(full.state, 'playing'); assert.equal(full.gold, CFG.arsenalFallbackGold);
    assert.equal(full._openArsenal(), false); assert.equal(full.gold, CFG.arsenalFallbackGold);
  }
  const skipped = isolated(); skipped._openArsenal(); skipped.xp = skipped.xpNeed;
  const skips = skipped.skips;
  assert.equal(skipped.skipArsenal(), true);
  assert.equal(skipped.gold, CFG.arsenalFallbackGold); assert.equal(skipped.skips, skips);
  assert.equal(skipped.state, 'upgrade'); assert.equal(skipped.skipArsenal(), false);
});

test('vault landmarks survive the pickup budget and destructive screen purges', () => {
  const run = isolated();
  run.pickups = Array.from({ length: CFG.maxPickups }, (_, id) => ({ id, kind: 'xp', x: id * 20, y: 0, value: 1 }));
  const vault = run._pickup('arsenal', 0, 0, 1);
  assert.ok(vault); assert.equal(run.pickups.length, CFG.maxPickups);
  run._random = () => 1;
  run._fire({ id: 'pentagram', level: 1, evolved: false, damage: 0, kills: 0 });
  assert.ok(run.pickups.includes(vault));
});

test('an explicit unlock list governs random, directed, merchant and raw reward acquisitions', () => {
  const run = isolated({ unlockedWeapons: ['knife', 'knife', 'unknown'], sealed: [] });
  assert.deepEqual(run.unlockedWeapons, ['whip', 'knife']);
  assert.ok(run._candidates().filter(choice => choice.type === 'weapon').every(choice => ['whip', 'knife'].includes(choice.id)));
  assert.equal(run._applyReward({ type: 'weapon', id: 'wand' }), false);
  assert.equal(run._applyReward({ type: 'weapon', id: 'unknown' }), false);
  run._openArsenal(); assert.deepEqual(run.arsenalChoices.map(choice => choice.id), ['knife']); run.skipArsenal();
  run.gold = 500; run._openMerchant();
  const offer = run.merchantOffers.find(offer => offer.type === 'weapon');
  assert.equal(run.buyMerchant(offer.id), true);
  assert.ok(run.choices.every(choice => ['whip', 'knife'].includes(choice.id)));
  const baseline = isolated();
  assert.equal(baseline.unlockedWeapons.length, CATALOG.weapons.length);
});

test('timed arcana packs are seeded, bounded, legal and enforce their displayed choices', () => {
  const a = isolated({ seed: 49, arcanaId: 'blood' }), b = isolated({ seed: 49, arcanaId: 'blood' });
  for (const run of [a, b]) { run.time = CFG.arcanaTimes.quick[0]; run.tick(.01); assert.equal(run.state, 'arcana'); }
  assert.deepEqual(a.arcanaChoices, b.arcanaChoices);
  assert.equal(a.arcanaChoices.length, CFG.arcanaDraftSize);
  assert.equal(new Set(a.arcanaChoices.map(choice => choice.id)).size, CFG.arcanaDraftSize);
  assert.ok(a.arcanaChoices.every(choice => choice.id !== 'blood'));
  const absent = CATALOG.arcana.find(item => !a.arcanaChoices.some(choice => choice.id === item.id));
  assert.equal(a.selectArcana(absent.id), false);
  const selected = a.arcanaChoices[0].id;
  assert.equal(a.selectArcana(selected), true); assert.ok(a.arcana.includes(selected));
  assert.equal(a.selectArcana(selected), false); assert.equal(a.state, 'playing');
});

test('arcana reroll and skip consume their own resources, respect capacity and retain pending XP', () => {
  const run = isolated({ seed: 88 }); run._openArcana();
  const before = { rerolls: run.rerolls, skips: run.skips, banishes: run.banishes };
  assert.equal(run.rerollArcana(), true);
  assert.equal(run.rerolls, before.rerolls - 1); assert.equal(run.skips, before.skips); assert.equal(run.banishes, before.banishes);
  run.xp = run.xpNeed;
  assert.equal(run.skipArcana(), true); assert.equal(run.skips, before.skips - 1);
  assert.equal(run.state, 'upgrade'); assert.equal(run.level, 2); assert.equal(run.arcana.length, 0);
  assert.equal(run.rerollArcana(), false); assert.equal(run.skipArcana(), false);
  const exhausted = isolated({ mode: 'endless' }); exhausted.arcana = CATALOG.arcana.map(item => item.id);
  assert.equal(exhausted._openArcana(), false); assert.equal(exhausted.state, 'playing');
  const disabled = isolated({ arcanaEnabled: false }); assert.equal(disabled._openArcana(), false);
});

for (const id of ['allocator-sovereign', 'crash-to-shell']) test(`${id} is a genuine two-pattern union with a consumed source and retained damage credit`, () => {
  const { run, definition, retained } = unionFixture(id);
  assert.equal(run.weapons.length, 1); assert.equal(run.stats.unions, 1);
  assert.equal(retained.unionId, id); assert.equal(retained.damage, 100); assert.equal(retained.kills, 3);
  assert.deepEqual(retained.provenance.map(source => source.id), definition.weapons);
  assert.equal(run._applyReward({ type: 'weapon', id: definition.weapons[1] }), false);
  assert.ok(run._candidates().some(choice => choice.type === 'weapon' && !choice.owned));
  const target = run._spawn('sqli', { x: 220, y: 0 }); target.hp = target.maxHp = 100000; target.speed = 0;
  run._hash.build(run.enemies);
  run._updateWeapons(.01);
  const companion = run.projectiles.find(shot => shot.kind === definition.fusion.weapon);
  assert.ok(companion); assert.equal(companion.weapon, retained);
  if (retained.id === 'orbit') {
    assert.ok(run.projectiles.some(shot => shot.kind === 'orbit'));
    run._fire(retained); assert.ok(run.projectiles.includes(companion), 'refreshing the orbit must preserve its bouncing companion shots');
  } else assert.ok(run.effects.some(effect => effect.kind === 'lightning'));
  run.projectiles = [];
  const before = retained.damage;
  run._fireFusion(retained, definition.fusion);
  for (let step = 0; step < 50; step++) { run.time += .05; run._updateProjectiles(.05); }
  assert.ok(retained.damage > before, 'companion projectiles deal actual retained-weapon damage');
  assert.equal(run.getResult().weapons[0].unionName, definition.name);
  assert.ok(run.projectiles.length <= CFG.maxProjectiles);
});
