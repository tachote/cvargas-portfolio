import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createRun } from '../src/scripts/night/engine.js';
import { ACHIEVEMENTS, achievementProgress, awardAchievements, freshSave, loadSave, persistSave, powerUpCost, purchase, refundPowerUps, recordRun, SAVE_KEY } from '../src/scripts/night/save.js';

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
test('fresh save has exactly the declared starting characters and no purchased power', () => {
  const save = freshSave(CATALOG);
  assert.deepEqual(save.unlocked, CATALOG.characters.filter(c => c.unlocked).map(c => c.id));
  assert.equal(save.gold, 0); assert.deepEqual(save.powerUps, {});
});
test('corrupt, outdated, denied and partially malformed saves remain playable', () => {
  const storage = memory();
  for (const value of ['{', 'null', '[]', '{"version":1,"gold":9999}']) {
    storage.setItem(SAVE_KEY, value); assert.deepEqual(loadSave(CATALOG, storage), freshSave(CATALOG));
  }
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSave(CATALOG, denied), freshSave(CATALOG));
  assert.equal(persistSave(freshSave(CATALOG), denied), false);
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, gold: -9, stats: { kills: 'oops' }, powerUps: { might: 9000, unknown: 50 }, unlocked: ['unknown', 'hunter'], settings: { audio: 'true', quality: 'anything' } }));
  const save = loadSave(CATALOG, storage);
  assert.equal(save.gold, 0); assert.equal(save.stats.kills, 0);
  assert.equal(save.powerUps.might, CATALOG.powerUps.find(p => p.id === 'might').maxLevel);
  assert.equal(save.powerUps.unknown, undefined); assert.equal(save.unlocked.includes('unknown'), false);
  assert.deepEqual(save.settings, freshSave(CATALOG).settings);
});
test('shop charges the displayed price, enforces limits and affects the next real run', () => {
  const save = freshSave(CATALOG); save.gold = 10000;
  const item = CATALOG.powerUps.find(p => p.id === 'might');
  const before = createRun({ meta: save.powerUps }).modifiers.might;
  const price = powerUpCost(item, 0);
  assert.equal(purchase(save, item.id, CATALOG), true);
  assert.equal(save.gold, 10000 - price);
  assert.ok(createRun({ meta: save.powerUps }).modifiers.might > before);
  while ((save.powerUps[item.id] || 0) < item.maxLevel) assert.equal(purchase(save, item.id, CATALOG), true);
  assert.equal(purchase(save, item.id, CATALOG), false);
  assert.equal(purchase(save, 'unknown', CATALOG), false);
  save.gold = 0; assert.equal(purchase(save, 'armor', CATALOG), false);
});
test('end results bank currency and unlock operators from actual progression', () => {
  const save = freshSave(CATALOG), storage = memory();
  const unlocked = recordRun(save, { won: true, kills: 1500, gold: 200, evolutions: 1, relics: 1, time: 600 }, CATALOG);
  assert.equal(save.gold, 200); assert.equal(save.stats.runs, 1); assert.equal(save.stats.wins, 1);
  assert.equal(save.stats.bestKills, 1500); assert.equal(save.stats.bestTime, 600);
  assert.equal(save.unlocked.length, CATALOG.characters.length);
  assert.equal(unlocked.length, CATALOG.characters.filter(c => !c.unlocked).length);
  persistSave(save, storage); assert.deepEqual(loadSave(CATALOG, storage), { ...save, powerUps: Object.fromEntries(CATALOG.powerUps.map(p => [p.id, 0])) });
});
test('refund returns exactly the paid prices without duplicating gold or losing progression', () => {
  const save = freshSave(CATALOG); save.gold = 5000; save.stats.runs = 3;
  purchase(save, 'might', CATALOG); purchase(save, 'might', CATALOG); purchase(save, 'armor', CATALOG);
  const spent = 5000 - save.gold;
  assert.equal(refundPowerUps(save, CATALOG), spent); assert.equal(save.gold, 5000);
  assert.equal(save.stats.runs, 3); assert.equal(Object.values(save.powerUps).some(Boolean), false);
  assert.equal(refundPowerUps(save, CATALOG), 0); assert.equal(save.gold, 5000);
});
test('rescue, union, merchant and stage progress survive reload, with one-time achievement bounty', () => {
  const save = freshSave(CATALOG), storage = memory();
  recordRun(save, { won: true, stageId: 'cathedral', kills: 1500, gold: 300, evolutions: 2, relics: 1, time: 600, level: 55,
    stats: { rescues: 1, unions: 1, merchantPurchases: 1, bosses: 10, killsByKind: { xss: 1500 } },
    weapons: [{ id: 'whip', evolved: true }, { id: 'birds', evolved: true, union: true, provenance: [{ id: 'cross', damage: 100, kills: 5 }] }] }, CATALOG);
  assert.equal(save.stats.rescues, 1); assert.equal(save.stats.unions, 1); assert.equal(save.stats.merchantPurchases, 1);
  assert.equal(save.stageWins.cathedral, 1); assert.equal(save.stats.maxLevel, 55);
  assert.deepEqual(save.collection.enemies, ['xss']); assert.deepEqual(save.collection.evolutions, ['whip', 'birds']);
  assert.ok(save.collection.weapons.includes('cross'), 'an absorbed union weapon remains discovered');
  const before = save.gold, earned = awardAchievements(save);
  assert.ok(earned.some(a => a.id === 'rescue')); assert.ok(earned.some(a => a.id === 'union')); assert.ok(earned.some(a => a.id === 'merchant'));
  assert.equal(save.gold, before + earned.reduce((sum, a) => sum + a.gold, 0));
  assert.deepEqual(awardAchievements(save), []);
  persistSave(save, storage);
  const reloaded = loadSave(CATALOG, storage);
  assert.equal(reloaded.stats.rescues, 1); assert.deepEqual(reloaded.collection, save.collection);
  assert.equal(reloaded.gold, save.gold); assert.deepEqual(awardAchievements(reloaded), []);
  assert.equal(achievementProgress(reloaded, ACHIEVEMENTS.find(a => a.id === 'cathedral-clear')), 1);
});
test('classic victory earns Full Audit even when the final boss falls before the time limit', () => {
  const save = freshSave(CATALOG);
  recordRun(save, { mode: 'standard', stageId: 'cathedral', won: true, time: 1775, gold: 0 }, CATALOG);
  assert.equal(save.stats.standardWins, 1);
  assert.ok(awardAchievements(save).some(a => a.id === 'full-audit'));
});
