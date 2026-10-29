import { CATALOG, createRun } from './engine.js';
import OPERATIONS from '../../data/night-operations.json' with { type: 'json' };
export { OPERATIONS };

const CFG = OPERATIONS.config;
const integer = (value, max = CFG.maxGold) => Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
const chapterIds = new Set(OPERATIONS.chapters.map(chapter => chapter.id));
const validProgress = progress => progress?.version === CFG.version && Array.isArray(progress.completed) && Array.isArray(progress.claimed)
  && Number.isFinite(progress.gold) && progress.gold >= 0 && Number.isInteger(progress.runs) && progress.runs >= 0 && progress.runs <= CFG.maxRuns
  && Number.isInteger(progress.rank) && progress.rank >= 0 && progress.rank <= CFG.maxRank
  && Number.isInteger(progress.ascensions) && progress.ascensions >= 0 && progress.ascensions <= CFG.maxAscensions;

export function freshOperations() {
  return { version: CFG.version, chapter: 0, completed: [], claimed: [], gold: 0, rank: 0, ascensions: 0, runs: 0 };
}

export function sanitizeOperations(raw) {
  const progress = freshOperations();
  if (!raw || raw.version !== CFG.version || typeof raw !== 'object') return progress;
  for (const field of ['gold', 'rank', 'ascensions', 'runs']) progress[field] = integer(raw[field], field === 'rank' ? CFG.maxRank : field === 'ascensions' ? CFG.maxAscensions : field === 'runs' ? CFG.maxRuns : CFG.maxGold);
  const completed = new Set(Array.isArray(raw.completed) ? raw.completed : []);
  for (const chapter of OPERATIONS.chapters) {
    if (!completed.has(chapter.id)) break;
    progress.completed.push(chapter.id);
  }
  progress.chapter = Math.min(progress.completed.length, OPERATIONS.chapters.length - 1);
  if (Array.isArray(raw.claimed)) progress.claimed = [...new Set(raw.claimed.filter(id => chapterIds.has(id)))];
  return progress;
}

export function availableOperations(raw) {
  const progress = sanitizeOperations(raw);
  return OPERATIONS.chapters.map((chapter, index) => ({ ...chapter, unlocked: index <= progress.completed.length, completed: progress.completed.includes(chapter.id), claimed: progress.claimed.includes(chapter.id) }));
}

export function operationUpgradeCost(raw) {
  const rank = integer(raw?.rank, CFG.maxRank);
  return Math.ceil(CFG.upgradeBaseCost * CFG.upgradeCostScale ** rank);
}

export function purchaseOperationUpgrade(progress) {
  if (!validProgress(progress) || progress.rank >= CFG.maxRank) return false;
  const cost = operationUpgradeCost(progress);
  if (progress.gold < cost) return false;
  progress.gold -= cost; progress.rank++;
  return true;
}

export function ascendOperations(progress) {
  if (!validProgress(progress) || !OPERATIONS.chapters.every(chapter => progress.completed.includes(chapter.id)) || progress.ascensions >= CFG.maxAscensions) return false;
  progress.ascensions++; progress.chapter = 0; progress.completed = []; progress.gold = 0; progress.rank = 0;
  return true;
}

export function createOperationRun({ chapterId, progress: raw, seed = 1 } = {}) {
  const progress = sanitizeOperations(raw);
  const chapter = availableOperations(progress).find(record => record.id === chapterId);
  if (!chapter?.unlocked || progress.runs >= CFG.maxRuns) return null;
  const powers = {};
  for (const id of CFG.rankPowers.slice(0, progress.rank)) powers[id] = (powers[id] || 0) + 1;
  powers[CFG.ascensionPower] = (powers[CFG.ascensionPower] || 0) + progress.ascensions;
  for (const item of CATALOG.powerUps) powers[item.id] = Math.min(item.maxLevel, powers[item.id] || 0);
  return decorateOperation(createRun({ characterId: chapter.characterId, stageId: chapter.stageId, mode: 'quick', weaponLimit: chapter.weaponLimit, arcanaId: chapter.arcanaId, meta: powers, eggs: 0, sealed: [], inverse: false, finalBossRequired: false, seed }), chapter, progress);
}

function decorateOperation(run, chapter, progress) {
  run.duration = chapter.duration;
  run.operation = { id: chapter.id, title: chapter.name, objectiveText: chapter.objectiveText, progress: 0, target: chapter.goals.length === 1 ? chapter.goals[0].target : chapter.goals.length, complete: false, goals: [], serial: progress.runs + 1, ascension: progress.ascensions };
  const events = [], originalDrain = run.drainEvents.bind(run), originalResult = run.getResult.bind(run);
  let finished = false;
  const value = stat => integer(stat === 'level' || stat === 'kills' || stat === 'time' ? run[stat] : run.stats[stat]);
  function evaluate() {
    if (finished) return;
    const goals = chapter.goals.map(goal => ({ ...goal, current: Math.min(goal.target, value(goal.stat)), complete: value(goal.stat) >= goal.target }));
    run.operation.goals = goals;
    run.operation.progress = goals.length === 1 ? goals[0].current : goals.filter(goal => goal.complete).length;
    const fulfilled = goals.every(goal => goal.complete);
    if (fulfilled && run.state !== 'dead') {
      finished = true; run.operation.complete = true; run.state = 'won';
      events.push({ type: 'win', text: OPERATIONS.ui.chapterComplete, operationId: chapter.id });
    } else if (run.time >= chapter.duration) {
      finished = true; run.state = 'dead'; run.revives = 0;
      events.push({ type: 'death', text: OPERATIONS.ui.chapterFailed, operationId: chapter.id });
    } else if (run.state === 'won') run.state = 'playing';
  }
  for (const method of ['tick', 'choose', 'collectChest', 'revive', 'selectArcana', 'skip', 'banish', 'leaveMerchant', 'buyMerchant', 'selectWeapon', 'skipArsenal', 'rerollArcana', 'skipArcana']) {
    if (typeof run[method] !== 'function') continue;
    const original = run[method].bind(run);
    run[method] = (...args) => { const result = original(...args); if (result !== false) evaluate(); return result; };
  }
  run.drainEvents = () => [...originalDrain().filter(event => event.type !== 'win'), ...events.splice(0)];
  run.getResult = () => ({ ...originalResult(), operationId: chapter.id, operationCompleted: run.operation.complete, operationSerial: run.operation.serial, operationAscension: run.operation.ascension });
  evaluate();
  return run;
}

export function recordOperation(progress, result) {
  const rejected = { recorded: false, firstClear: false, mainBounty: 0, chapterId: result?.operationId || null, completedCampaign: false };
  if (!validProgress(progress) || !result || result.operationSerial !== progress.runs + 1 || result.operationAscension !== progress.ascensions) return rejected;
  const chapter = availableOperations(progress).find(record => record.id === result.operationId);
  if (!chapter?.unlocked || progress.runs >= CFG.maxRuns) return rejected;
  progress.runs++;
  const complete = result.won === true && result.operationCompleted === true;
  const firstClear = complete && !progress.completed.includes(chapter.id);
  progress.gold = integer(progress.gold + integer(result.gold) + (firstClear ? chapter.operationGold : 0));
  let mainBounty = 0;
  if (complete) {
    if (!progress.completed.includes(chapter.id)) progress.completed.push(chapter.id);
    if (!progress.claimed.includes(chapter.id)) { progress.claimed.push(chapter.id); mainBounty = chapter.mainBounty; }
    progress.chapter = Math.min(progress.completed.length, OPERATIONS.chapters.length - 1);
  }
  return { recorded: true, firstClear, mainBounty, chapterId: chapter.id, completedCampaign: OPERATIONS.chapters.every(item => progress.completed.includes(item.id)) };
}
