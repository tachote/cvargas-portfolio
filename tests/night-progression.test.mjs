import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createRun } from '../src/scripts/night/engine.js';
import { freshSave, loadSave, persistSave, purchase, purchaseAugment, toggleSeal, refundPowerUps, recordRun, weaponUnlockStatus, unlockedWeapons, stageUnlockStatus, SAVE_KEY } from '../src/scripts/night/save.js';

const memory = initial => {
  const values = new Map(initial ? [[SAVE_KEY, JSON.stringify(initial)]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('operator augments charge exactly once and affect only the selected operator after reload', () => {
  const save = freshSave(CATALOG), storage = memory();
  const [selected, other] = CATALOG.characters.filter(character => character.unlocked);
  save.gold = CATALOG.config.eggCost * 3;
  const initialGold = save.gold, before = createRun({ characterId: selected.id });
  const unaffectedBefore = createRun({ characterId: other.id });
  const statsBefore = structuredClone(save.stats);
  assert.equal(purchaseAugment(save, selected.id, CATALOG), true);
  assert.equal(save.gold, initialGold - CATALOG.config.eggCost);
  assert.equal(save.eggs[selected.id], 1);
  assert.equal(save.eggs[other.id], 0);
  assert.deepEqual(save.stats, statsBefore);
  assert.deepEqual(save.powerUps, {});
  assert.equal(persistSave(save, storage), true);
  const reloaded = loadSave(CATALOG, storage);
  const augmented = createRun({ characterId: selected.id, eggs: reloaded.eggs[selected.id] });
  const clean = createRun({ characterId: selected.id, eggs: 0 });
  const unaffected = createRun({ characterId: other.id, eggs: reloaded.eggs[other.id] });
  assert.ok(augmented.modifiers.might > before.modifiers.might);
  assert.deepEqual(clean.modifiers, before.modifiers);
  assert.deepEqual(unaffected.modifiers, unaffectedBefore.modifiers);
  augmented.passives.push({ id: 'armor', level: 1 }); augmented._recalculate();
  assert.ok(augmented.modifiers.might > before.modifiers.might, 'later recalculation retains installed increments');
});

test('invalid, locked, unaffordable and capped augment purchases cannot spend or grant anything', () => {
  const save = freshSave(CATALOG), selected = save.unlocked[0];
  save.gold = CATALOG.config.eggCost * 2;
  for (const id of ['unknown', ...CATALOG.characters.filter(character => !character.unlocked).map(character => character.id)]) {
    const before = structuredClone(save);
    assert.equal(purchaseAugment(save, id, CATALOG), false);
    assert.deepEqual(save, before);
  }
  save.gold = CATALOG.config.eggCost - 1;
  const poor = structuredClone(save);
  assert.equal(purchaseAugment(save, selected, CATALOG), false);
  assert.deepEqual(save, poor);
  save.gold = CATALOG.config.eggCost * 2; save.eggs[selected] = CATALOG.config.maxEggs;
  const capped = structuredClone(save);
  assert.equal(purchaseAugment(save, selected, CATALOG), false);
  assert.deepEqual(save, capped);
});

test('power-up refunds preserve operator augments and never refund their installation cost', () => {
  const save = freshSave(CATALOG);
  save.gold = 10000;
  assert.equal(purchaseAugment(save, save.unlocked[0], CATALOG), true);
  const afterAugment = save.gold;
  assert.equal(purchase(save, CATALOG.powerUps[0].id, CATALOG), true);
  const powerSpent = afterAugment - save.gold;
  assert.equal(refundPowerUps(save, CATALOG), powerSpent);
  assert.equal(save.gold, 10000 - CATALOG.config.eggCost);
  assert.equal(save.eggs[save.unlocked[0]], 1);
  assert.equal(refundPowerUps(save, CATALOG), 0);
  assert.equal(save.gold, 10000 - CATALOG.config.eggCost);
});

test('seals require discovery, obey their budget, survive reload and filter actual choices while preserving starters', () => {
  const save = freshSave(CATALOG), storage = memory();
  const starter = CATALOG.characters.find(character => character.id === save.unlocked[0]).weapon;
  const choices = [starter, ...CATALOG.weapons.map(weapon => weapon.id).filter(id => id !== starter)];
  assert.equal(toggleSeal(save, choices[0], CATALOG), false, 'undiscovered equipment cannot be sealed');
  assert.equal(toggleSeal(save, 'unknown', CATALOG), false);
  save.collection.weapons = choices;
  for (const id of choices.slice(0, CATALOG.config.sealLimit)) assert.equal(toggleSeal(save, id, CATALOG), true);
  assert.equal(save.sealed.length, CATALOG.config.sealLimit);
  assert.equal(toggleSeal(save, choices[CATALOG.config.sealLimit], CATALOG), false);
  persistSave(save, storage);
  const loaded = loadSave(CATALOG, storage), run = createRun({ characterId: save.unlocked[0], sealed: loaded.sealed });
  assert.equal(run.weapons[0].id, starter);
  const candidates = run._candidates().filter(choice => choice.type === 'weapon');
  assert.ok(candidates.some(choice => choice.id === starter && choice.owned));
  for (const id of loaded.sealed.filter(id => id !== starter)) assert.equal(candidates.some(choice => choice.id === id), false);
  assert.equal(toggleSeal(loaded, choices[1], CATALOG), true);
  assert.equal(toggleSeal(loaded, choices[CATALOG.config.sealLimit], CATALOG), true);
  assert.equal(loaded.sealed.length, CATALOG.config.sealLimit);
});

test('new progression fields sanitize malformed data without losing existing version-two progress', () => {
  const known = CATALOG.characters.map(character => character.id), weaponIds = CATALOG.weapons.map(weapon => weapon.id);
  const old = { version: 2, gold: 4321, stats: { runs: 7, kills: 3000, standardWins: 2 }, powerUps: { might: 2 },
    unlocked: known, stageWins: { cathedral: 2 }, collection: { weapons: weaponIds, evolutions: [weaponIds[0]], enemies: ['xss'], stages: ['cathedral'] }, achievements: ['first-blood'] };
  const migrated = loadSave(CATALOG, memory(old));
  assert.equal(migrated.gold, old.gold); assert.equal(migrated.stats.runs, 7); assert.equal(migrated.stats.kills, 3000);
  assert.equal(migrated.stats.standardWins, 2); assert.equal(migrated.powerUps.might, 2);
  assert.deepEqual(migrated.collection, old.collection); assert.deepEqual(migrated.achievements, old.achievements);
  assert.deepEqual(migrated.sealed, []); assert.ok(Object.values(migrated.eggs).every(value => value === 0));
  const malformed = loadSave(CATALOG, memory({ ...old,
    eggs: { [known[0]]: -1, [known[1]]: CATALOG.config.maxEggs * 99, [known[2]]: '9', unknown: 200 },
    sealed: [weaponIds[0], weaponIds[0], 'unknown', ...weaponIds.slice(1)], settings: { musicVolume: 99, audio: 'yes' } }));
  assert.equal(malformed.eggs[known[0]], 0); assert.equal(malformed.eggs[known[1]], CATALOG.config.maxEggs);
  assert.equal(malformed.eggs[known[2]], 0); assert.equal(malformed.eggs.unknown, undefined);
  assert.equal(malformed.sealed.length, CATALOG.config.sealLimit);
  assert.equal(new Set(malformed.sealed).size, malformed.sealed.length);
  assert.ok(malformed.sealed.every(id => weaponIds.includes(id)));
  assert.equal(malformed.settings.musicVolume, 1); assert.equal(malformed.settings.audio, false);
  assert.equal(malformed.gold, old.gold); assert.equal(malformed.stats.kills, old.stats.kills);
});

test('actual result statistics for inverse, cycles, floor items and fever survive banking and reload', () => {
  const save = freshSave(CATALOG), storage = memory();
  recordRun(save, { inverse: true, won: true, mode: 'standard', stageId: 'cathedral', gold: 120, time: 1800,
    stats: { cycles: 2, goldFevers: 3, feverGold: 90, stageItems: 2 } }, CATALOG);
  assert.equal(save.stats.inverseWins, 1); assert.equal(save.stats.cycles, 2);
  assert.equal(save.stats.goldFevers, 3); assert.equal(save.stats.feverGold, 90); assert.equal(save.stats.stageItems, 2);
  assert.equal(save.gold, 120);
  persistSave(save, storage);
  const loaded = loadSave(CATALOG, storage);
  assert.equal(loaded.gold, 120); assert.equal(loaded.stats.inverseWins, 1);
  assert.equal(loaded.stats.cycles, 2); assert.equal(loaded.stats.feverGold, 90);
});

test('weapon progression crosses the exact threshold and preserves discoveries and earned operator starters', () => {
  const save = freshSave(CATALOG), storage = memory();
  const starters = [...new Set(CATALOG.characters.filter(character => character.unlocked).map(character => character.weapon))];
  assert.deepEqual(unlockedWeapons(save, CATALOG).sort(), starters.sort());
  const firstRun = createRun({ unlockedWeapons: unlockedWeapons(save, CATALOG) });
  assert.equal(firstRun._candidates().some(choice => choice.type === 'weapon' && choice.id === 'pool'), false);
  save.stats.kills = 24;
  const before = weaponUnlockStatus(save, CATALOG).find(item => item.id === 'pool');
  assert.equal(before.unlocked, false); assert.equal(before.progress, 24); assert.equal(before.target, 25);
  recordRun(save, { gold: 0, kills: 1, time: 10, won: false }, CATALOG);
  const atThreshold = weaponUnlockStatus(save, CATALOG).find(item => item.id === 'pool');
  assert.equal(atThreshold.unlocked, true); assert.equal(atThreshold.progress, 25);
  const snapshot = structuredClone(save), available = unlockedWeapons(save, CATALOG);
  assert.equal(available.filter(id => id === 'pool').length, 1);
  assert.deepEqual(unlockedWeapons(save, CATALOG), available);
  assert.deepEqual(save, snapshot, 'reading unlock status cannot award progress or duplicate currency');
  const unlockedRun = createRun({ unlockedWeapons: available });
  assert.equal(unlockedRun._candidates().some(choice => choice.type === 'weapon' && choice.id === 'pool'), true);
  save.collection.weapons.push('fireball');
  const earnedOperator = CATALOG.characters.find(character => !character.unlocked && character.weapon === 'orbit');
  assert.ok(earnedOperator); save.unlocked.push(earnedOperator.id);
  assert.equal(save.stats.evolutions, 0); assert.equal(save.stats.kills, 25);
  persistSave(save, storage);
  const reloaded = loadSave(CATALOG, storage), preserved = unlockedWeapons(reloaded, CATALOG);
  assert.ok(preserved.includes('pool')); assert.ok(preserved.includes('fireball'));
  assert.ok(preserved.includes(earnedOperator.weapon));
  assert.equal(new Set(preserved).size, preserved.length);
  assert.equal(reloaded.gold, save.gold); assert.equal(reloaded.stats.kills, save.stats.kills);
});


test('the cloud spire unlocks through ordinary victory and preserves earned stage access', () => {
  const save = freshSave(CATALOG);
  const get = () => stageUnlockStatus(save, CATALOG).find(stage => stage.id === 'spire');
  assert.equal(get().unlocked, false);
  assert.equal(stageUnlockStatus(save, CATALOG).filter(stage => stage.unlocked).length, CATALOG.stages.length - 1);
  save.operations.completed.push('foothold'); save.gold += 75;
  assert.equal(get().unlocked, false, 'operation bounty cannot count as an ordinary stage victory');
  recordRun(save, { won: false, stageId: 'cathedral', gold: 0, kills: 1 }, CATALOG);
  assert.equal(get().unlocked, false);
  recordRun(save, { won: true, stageId: 'cathedral', gold: 0, time: 600 }, CATALOG);
  assert.equal(get().unlocked, true);
  assert.equal(get().progress, get().target);
  save.stats.wins = 0; save.collection.stages.push('spire');
  const loaded = loadSave(CATALOG, memory(save));
  assert.equal(stageUnlockStatus(loaded, CATALOG).find(stage => stage.id === 'spire').unlocked, true);
  const run = createRun({ stageId: 'spire' });
  assert.equal(run.stage.id, 'spire');
  assert.equal(run.stage.geometry.axis, 'x');
  assert.ok(run.stage.items.every(item => Math.abs(item.x) < run.stage.geometry.halfWidth));
});
