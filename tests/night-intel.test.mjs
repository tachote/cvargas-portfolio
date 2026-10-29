import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createRun } from '../src/scripts/night/engine.js';
import { createIntel } from '../src/scripts/night/intel.js';

test('operator chatter is driven by actual threat events, bounded and reset between runs', () => {
  const run = createRun({ seed: 1 }), intel = createIntel(CATALOG);
  intel.reset(run);
  run.kills = 1;
  intel.event({ type: 'kill', kind: 'xss' }, run);
  const first = intel.snapshot(run);
  assert.equal(first.threat.tag, 'XSS');
  assert.ok(first.entries.some(entry => entry.text.includes('DOM sink')));
  const repeated = JSON.stringify(first.entries);
  for (let i = 0; i < 100; i++) intel.event({ type: 'kill', kind: 'xss' }, run);
  assert.equal(JSON.stringify(intel.snapshot(run).entries), repeated, 'a swarm cannot spam the same line every hit');
  for (const enemy of CATALOG.enemies) { run.time += CATALOG.intel.perClassLogInterval; intel.event({ type: 'kill', kind: enemy.id }, run); }
  assert.ok(intel.snapshot(run).entries.length <= CATALOG.intel.maxFeed);
  intel.reset(run);
  assert.equal(intel.snapshot(run).entries.some(entry => entry.text.includes('DOM sink')), false);
});

test('nearest vulnerability focus respects boss pinning and does not modify the simulation', () => {
  const run = createRun({ seed: 2 }), intel = createIntel(CATALOG);
  run.enemies = [{ kind: 'sqli', hp: 20, x: 10, y: 0 }, { kind: 'ssrf', hp: 20, x: 80, y: 0 }];
  intel.reset(run);
  assert.equal(intel.snapshot(run).threat.tag, 'SQLi');
  intel.event({ type: 'boss', kind: 'rce' }, run);
  const before = JSON.stringify(run.getResult());
  assert.equal(intel.snapshot(run).threat.tag, 'RCE');
  assert.equal(JSON.stringify(run.getResult()), before);
  run.time += CATALOG.intel.focusHold + 1;
  assert.equal(intel.snapshot(run).threat.tag, 'SQLi');
});

test('kill milestones are emitted once and never claim a milestone before its count', () => {
  const run = createRun({ seed: 3 }), intel = createIntel(CATALOG);
  intel.reset(run);
  const milestone = CATALOG.intel.milestones[0];
  run.kills = milestone.kills - 1;
  intel.event({ type: 'kill', kind: 'xss' }, run);
  assert.equal(intel.snapshot(run).entries.some(e => e.text === milestone.text), false);
  run.kills++;
  intel.event({ type: 'kill', kind: 'xss' }, run);
  const earned = intel.snapshot(run).entries;
  assert.equal(earned.filter(e => e.text === milestone.text).length, 1);
  intel.event({ type: 'kill', kind: 'xss' }, run);
  assert.deepEqual(intel.snapshot(run).entries, earned);
});

test('debrief counts and research links follow encountered classes without inventing advisories', () => {
  const run = createRun({ seed: 4 }), intel = createIntel(CATALOG);
  run.stats.killsByKind = { xss: 5, sqli: 2, unknown: 100 };
  const report = intel.report(run);
  assert.deepEqual(report.map(r => [r.tag, r.count]), [['XSS', 5], ['SQLi', 2]]);
  const advisories = [{ id: 'existing-auth', vuln_class: 'Auth bypass' }, { id: 'existing-xss', vuln_class: 'XSS' }, { id: 'existing-sql', vuln_class: 'SQLi' }];
  const original = JSON.stringify(advisories);
  assert.deepEqual(intel.research(advisories, run).map(c => c.id), ['existing-xss', 'existing-sql']);
  assert.equal(JSON.stringify(advisories), original);
  for (const row of report) assert.match(row.reference, /^https:\/\/cwe\.mitre\.org\/data\/definitions\/\d+\.html$/);
  run.stats.killsByKind = {};
  assert.ok(intel.research(advisories, run).every(c => advisories.includes(c)));
});
