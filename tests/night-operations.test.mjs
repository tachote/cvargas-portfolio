import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createRun } from '../src/scripts/night/engine.js';
import { OPERATIONS, freshOperations, sanitizeOperations, availableOperations, createOperationRun, recordOperation, operationUpgradeCost, purchaseOperationUpgrade, ascendOperations } from '../src/scripts/night/operations.js';

const weapon = id => CATALOG.weapons.find(item => item.id === id);
function resolve(run) {
  if (run.state === 'upgrade') {
    let index = run.choices.findIndex(choice => choice.type === 'weapon' && run.weapons.some(owned => owned.id === choice.id));
    if (index < 0) index = run.choices.findIndex(choice => choice.type === 'passive' && run.weapons.some(owned => weapon(owned.id).evolution.passive === choice.id));
    if (index < 0) index = run.choices.findIndex(choice => choice.type === 'weapon' && ['orbit', 'wand', 'rune', 'lightning'].includes(choice.id));
    run.choose(Math.max(0, index));
  } else if (run.state === 'chest') run.collectChest();
  else if (run.state === 'arcana') run.selectArcana(run.choices[0].id);
  else if (run.state === 'arsenal') { if (run.arsenalChoices?.length) run.selectWeapon?.(run.arsenalChoices[0].id); else run.skipArsenal?.(); }
  else if (run.state === 'merchant') run.leaveMerchant();
  else if (run.state === 'dead' && run.revives > 0) run.revive();
}

function play(run) {
  let steps = 0;
  while (run.state !== 'won' && (run.state !== 'dead' || run.revives > 0) && steps++ < 20000) {
    if (run.state !== 'playing') { resolve(run); continue; }
    let target = null, distance = Infinity;
    const seekingRelic = run.operation.goals.some(goal => goal.stat === 'relics' && !goal.complete);
    for (const pickup of run.pickups) {
      if (!(seekingRelic ? ['relic', 'heal'] : ['xp', 'chest', 'relic', 'heal']).includes(pickup.kind)) continue;
      const d = Math.hypot(pickup.x - run.player.x, pickup.y - run.player.y);
      if (d < distance) { distance = d; target = pickup; }
    }
    const angle = target ? Math.atan2(target.y - run.player.y, target.x - run.player.x) : run.time * .06;
    run.tick(.5, { dx: Math.cos(angle), dy: Math.sin(angle) });
  }
  assert.ok(steps < 20000, 'normal inputs converge without a paused-state loop');
  return run;
}

test('operations validate chapter order, maintain isolated setups and sanitize old or malformed state', () => {
  const progress = freshOperations();
  assert.equal(availableOperations(progress).filter(chapter => chapter.unlocked).length, 1);
  assert.equal(createOperationRun({ chapterId: OPERATIONS.chapters[1].id, progress }), null);
  assert.equal(createOperationRun({ chapterId: 'unknown', progress }), null);
  assert.deepEqual(sanitizeOperations(null), progress);
  assert.deepEqual(sanitizeOperations({ version: 9, gold: 1e9 }), progress);
  const corrupt = sanitizeOperations({ version: 1, gold: -1, rank: 999, ascensions: -1, runs: Infinity, completed: ['disclosure'], claimed: ['unknown', 'foothold', 'foothold'] });
  assert.equal(corrupt.gold, 0); assert.equal(corrupt.rank, OPERATIONS.config.maxRank);
  assert.equal(corrupt.ascensions, 0); assert.equal(corrupt.runs, 0);
  assert.deepEqual(corrupt.completed, []); assert.deepEqual(corrupt.claimed, ['foothold']);
  assert.equal(ascendOperations({ version: 1, completed: {} }), false);
  assert.equal(recordOperation({ version: 1, completed: {} }, {}).recorded, false);
  const run = createOperationRun({ chapterId: 'foothold', progress, seed: 2 });
  assert.equal(run.weaponLimit, OPERATIONS.chapters[0].weaponLimit);
  assert.equal(run.duration, OPERATIONS.chapters[0].duration);
  assert.equal(run.eggs, 0); assert.deepEqual(run.sealed, []);
  assert.equal(run.inverse, false);
  assert.deepEqual(run._meta, Object.fromEntries(CATALOG.powerUps.map(power => [power.id, 0])));
  assert.deepEqual(run.getResult(), createOperationRun({ chapterId: 'foothold', progress, seed: 2 }).getResult());
});

test('operation ranks spend their own budget and change actual next-run stats only', () => {
  const progress = freshOperations();
  const before = createOperationRun({ chapterId: 'foothold', progress }).modifiers.might;
  assert.equal(purchaseOperationUpgrade(progress), false);
  progress.gold = operationUpgradeCost(progress);
  assert.equal(purchaseOperationUpgrade(progress), true);
  assert.equal(progress.gold, 0); assert.equal(progress.rank, 1);
  assert.ok(createOperationRun({ chapterId: 'foothold', progress }).modifiers.might > before);
  const mainRun = createRun({ characterId: 'hunter' });
  assert.equal(mainRun.modifiers.might, before);
  assert.equal(purchaseOperationUpgrade({ ...progress, rank: -1, gold: 999999 }), false);
  assert.equal(purchaseOperationUpgrade({ ...progress, rank: OPERATIONS.config.maxRank, gold: 999999 }), false);
});

test('failed or extracted operations cannot clear chapters, and repeated results cannot bank twice', () => {
  const progress = freshOperations(), run = createOperationRun({ chapterId: 'foothold', progress, seed: 4 });
  run.time = run.duration - .01; run.enemies = []; run.pickups = [];
  run.tick(.02);
  assert.equal(run.state, 'dead'); assert.equal(run.revives, 0);
  assert.equal(run.operation.complete, false);
  const outcome = recordOperation(progress, { ...run.getResult(), gold: 17 });
  assert.equal(outcome.recorded, true); assert.equal(outcome.firstClear, false); assert.equal(outcome.mainBounty, 0);
  assert.equal(progress.gold, 17); assert.deepEqual(progress.completed, []);
  assert.equal(recordOperation(progress, run.getResult()).recorded, false);
  const extracted = createOperationRun({ chapterId: 'foothold', progress, seed: 4 });
  assert.equal(recordOperation(progress, { ...extracted.getResult(), won: false }).mainBounty, 0);
  assert.deepEqual(progress.completed, []);
  assert.equal(recordOperation(progress, { ...extracted.getResult(), operationSerial: progress.runs + 1, operationId: 'disclosure', won: true, operationCompleted: true }).recorded, false);
});

test('the complete three-chapter operation is reachable with ordinary movement, loot and choices', t => {
  const main = { gold: 900, powerUps: { might: 2 }, eggs: { hunter: 4 }, collection: { weapons: ['whip'] }, operations: freshOperations() };
  const initialMain = structuredClone(main), completionTimes = [];
  for (const chapter of OPERATIONS.chapters) {
    while (purchaseOperationUpgrade(main.operations)) { /* Spend only legitimately earned operation currency. */ }
    const run = play(createOperationRun({ chapterId: chapter.id, progress: main.operations, seed: 2 }));
    assert.equal(run.state, 'won', `${chapter.id}: state=${run.state}, time=${run.time}, hp=${run.player.hp}, progress=${run.operation.progress}/${run.operation.target}`);
    assert.equal(run.operation.complete, true);
    assert.ok(run.time <= chapter.duration);
    assert.ok(run.stats.maxEnemies <= CATALOG.config.maxEnemies);
    assert.ok(run.stats.maxProjectiles <= CATALOG.config.maxProjectiles);
    assert.ok(run.stats.maxPickups <= CATALOG.config.maxPickups);
    assert.ok(run.stats.damage > 0);
    const result = run.getResult(), outcome = recordOperation(main.operations, result);
    assert.equal(outcome.firstClear, true); assert.equal(outcome.mainBounty, chapter.mainBounty);
    assert.equal(recordOperation(main.operations, result).recorded, false);
    main.operations = sanitizeOperations(JSON.parse(JSON.stringify(main.operations)));
    completionTimes.push(run.time);
  }
  assert.equal(main.operations.completed.length, OPERATIONS.chapters.length);
  assert.deepEqual({ ...main, operations: initialMain.operations }, initialMain, 'operation mechanics leave ordinary gold, powers, augments and collections untouched');
  assert.ok(completionTimes.every(time => time > 0));
  t.diagnostic(`Completed operation chapters in ${completionTimes.map(time => time.toFixed(1)).join(', ')} simulated seconds using ordinary inputs.`);
  const completed = structuredClone(main.operations), claimed = [...completed.claimed], runs = completed.runs;
  assert.equal(ascendOperations(completed), true);
  assert.equal(completed.ascensions, 1); assert.equal(completed.gold, 0); assert.equal(completed.rank, 0);
  assert.deepEqual(completed.completed, []); assert.deepEqual(completed.claimed, claimed); assert.equal(completed.runs, runs);
  assert.equal(ascendOperations(completed), false);
  assert.ok(createOperationRun({ chapterId: 'foothold', progress: completed }).modifiers.might > createOperationRun({ chapterId: 'foothold', progress: freshOperations() }).modifiers.might);
  const replay = play(createOperationRun({ chapterId: 'foothold', progress: completed, seed: 2 }));
  assert.equal(replay.state, 'won');
  assert.equal(recordOperation(completed, replay.getResult()).mainBounty, 0, 'ascension cannot farm a previous portfolio first-clear bounty');
});
