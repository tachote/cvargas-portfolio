import ACHIEVEMENTS from '../../data/night-achievements.json' with { type: 'json' };
import INTERFACE from '../../data/night-interface.json' with { type: 'json' };
import PROGRESSION from '../../data/night-progression.json' with { type: 'json' };
import { freshOperations, sanitizeOperations } from './operations.js';
export { ACHIEVEMENTS };
const KEY = 'cv-night-save-v2';
const integer = (value, max = 1_000_000_000) => Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
const statNames = ['runs', 'wins', 'standardWins', 'kills', 'goldEarned', 'evolutions', 'relics', 'bestKills', 'bestTime', 'rescues', 'unions', 'merchantPurchases', 'bosses', 'maxLevel', 'inverseWins', 'cycles', 'goldFevers', 'feverGold', 'stageItems'];
export const SAVE_KEY = KEY;

export function freshSave(catalog) {
  return { version: 2, gold: 0, stats: Object.fromEntries(statNames.map(key => [key, 0])), powerUps: {},
    unlocked: catalog.characters.filter(c => c.unlocked).map(c => c.id), achievements: [], eggs: Object.fromEntries(catalog.characters.map(c => [c.id, 0])), sealed: [], operations: freshOperations(), stageWins: Object.fromEntries(catalog.stages.map(s => [s.id, 0])), collection: { weapons: [], evolutions: [], enemies: [], stages: [] }, settings: { audio: false, quality: 'high', musicVolume: INTERFACE.defaultMusicVolume, effectsVolume: INTERFACE.defaultEffectsVolume } };
}

export function loadSave(catalog, storage) {
  const save = freshSave(catalog);
  try {
    const raw = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY));
    if (!raw || raw.version !== 2 || typeof raw !== 'object') return save;
    save.gold = integer(raw.gold);
    for (const key of statNames) save.stats[key] = integer(raw.stats?.[key]);
    for (const item of catalog.powerUps) save.powerUps[item.id] = integer(raw.powerUps?.[item.id], item.maxLevel);
    const ids = new Set(catalog.characters.map(c => c.id));
    if (Array.isArray(raw.unlocked)) save.unlocked = [...new Set([...save.unlocked, ...raw.unlocked.filter(id => ids.has(id))])];
    save.achievements = Array.isArray(raw.achievements) ? [...new Set(raw.achievements.filter(id => ACHIEVEMENTS.some(a => a.id === id)))] : [];
    for (const stage of catalog.stages) save.stageWins[stage.id] = integer(raw.stageWins?.[stage.id]);
    for (const [key, records] of [['weapons', catalog.weapons], ['evolutions', catalog.weapons], ['enemies', catalog.enemies], ['stages', catalog.stages]]) {
      if (Array.isArray(raw.collection?.[key])) save.collection[key] = [...new Set(raw.collection[key].filter(id => records.some(r => r.id === id)))];
    }
    save.settings.audio = raw.settings?.audio === true;
    save.settings.quality = raw.settings?.quality === 'low' ? 'low' : 'high';
    if (Number.isFinite(raw.settings?.musicVolume)) save.settings.musicVolume = Math.max(0, Math.min(1, raw.settings.musicVolume));
    if (Number.isFinite(raw.settings?.effectsVolume)) save.settings.effectsVolume = Math.max(0, Math.min(1, raw.settings.effectsVolume));
    for (const character of catalog.characters) save.eggs[character.id] = integer(raw.eggs?.[character.id], catalog.config.maxEggs);
    if (Array.isArray(raw.sealed)) save.sealed = [...new Set(raw.sealed.filter(id => catalog.weapons.some(w => w.id === id) && save.collection.weapons.includes(id)))].slice(0, catalog.config.sealLimit);
    save.operations = sanitizeOperations(raw.operations);
  } catch { /* Private browsing, corrupt saves and denied storage remain playable. */ }
  applyUnlocks(save, catalog);
  return save;
}

export function persistSave(save, storage) {
  try { (storage ?? globalThis.localStorage).setItem(KEY, JSON.stringify(save)); return true; }
  catch { return false; }
}

export function powerUpCost(item, level = 0) { return Math.ceil(item.baseCost * Math.pow(item.costScale ?? 1.5, level)); }
export function purchase(save, id, catalog) {
  const item = catalog.powerUps.find(p => p.id === id);
  if (!item) return false;
  const level = integer(save.powerUps[id], item.maxLevel), cost = powerUpCost(item, level);
  if (level >= item.maxLevel || save.gold < cost) return false;
  save.gold -= cost; save.powerUps[id] = level + 1;
  return true;
}

export function refundPowerUps(save, catalog) {
  let refund = 0;
  for (const item of catalog.powerUps) {
    const level = integer(save.powerUps[item.id], item.maxLevel);
    for (let rank = 0; rank < level; rank++) refund += powerUpCost(item, rank);
    save.powerUps[item.id] = 0;
  }
  save.gold = integer(save.gold + refund);
  return refund;
}

export function purchaseAugment(save, characterId, catalog) {
  const cost = catalog.config.eggCost, count = integer(save.eggs?.[characterId], catalog.config.maxEggs);
  if (!catalog.characters.some(c => c.id === characterId) || !save.unlocked.includes(characterId) || !Number.isFinite(cost) || cost <= 0 || count >= catalog.config.maxEggs || save.gold < cost) return false;
  save.gold -= cost; save.eggs[characterId] = count + 1;
  return true;
}

export function toggleSeal(save, id, catalog) {
  if (!catalog.weapons.some(w => w.id === id)) return false;
  const index = save.sealed.indexOf(id);
  if (index >= 0) { save.sealed.splice(index, 1); return true; }
  if (!save.collection.weapons.includes(id) || save.sealed.length >= catalog.config.sealLimit) return false;
  save.sealed.push(id); return true;
}

export function weaponUnlockStatus(save, catalog) {
  const starters = new Set(catalog.characters.filter(c => save.unlocked.includes(c.id)).map(c => c.weapon));
  return catalog.weapons.map(weapon => {
    const rule = PROGRESSION.weapons.find(item => item.id === weapon.id), target = rule?.target || 0;
    const progress = Math.min(target, integer(save.stats[rule?.stat]));
    const unlocked = !target || progress >= target || save.collection.weapons.includes(weapon.id) || starters.has(weapon.id);
    return { id: weapon.id, unlocked, progress, target, label: rule?.label.replace('{target}', String(target)) || '' };
  });
}
export const unlockedWeapons = (save, catalog) => weaponUnlockStatus(save, catalog).filter(item => item.unlocked).map(item => item.id);
export const stageUnlockStatus = (save, catalog) => catalog.stages.map(stage => ({
  id: stage.id,
  unlocked: !stage.unlockRequirement || save.collection.stages.includes(stage.id) || (save.stageWins[stage.id] || 0) > 0 || (save.stats[stage.unlockRequirement.stat] || 0) >= stage.unlockRequirement.value,
  progress: Math.min(stage.unlockRequirement?.value || 0, save.stats[stage.unlockRequirement?.stat] || 0),
  target: stage.unlockRequirement?.value || 0,
  label: stage.unlock || ''
}));

function applyUnlocks(save, catalog) {
  const unlocked = [];
  for (const character of catalog.characters) {
    const rule = character.unlockRequirement;
    if (!save.unlocked.includes(character.id) && (character.unlocked || (rule && (save.stats[rule.stat] ?? 0) >= rule.value))) {
      save.unlocked.push(character.id); unlocked.push(character.name);
    }
  }
  return unlocked;
}

export function recordRun(save, result, catalog) {
  const gold = integer(result.gold);
  save.gold = integer(save.gold + gold);
  save.stats.runs++;
  save.stats.wins += result.won || result.victory ? 1 : 0;
  if (result.won && result.mode === 'standard') save.stats.standardWins++;
  if (result.won && result.inverse) save.stats.inverseWins++;
  save.stats.kills += integer(result.kills);
  save.stats.goldEarned += gold;
  save.stats.evolutions += integer(result.evolutions ?? result.stats?.evolutions);
  save.stats.relics += integer(result.relics ?? result.stats?.relics);
  save.stats.bestKills = Math.max(save.stats.bestKills, integer(result.kills));
  save.stats.bestTime = Math.max(save.stats.bestTime, integer(result.time));
  save.stats.maxLevel = Math.max(save.stats.maxLevel, integer(result.level));
  for (const key of ['rescues', 'unions', 'merchantPurchases', 'bosses', 'cycles', 'goldFevers', 'feverGold', 'stageItems']) save.stats[key] += integer(result[key] ?? result.stats?.[key]);
  if (result.won && catalog.stages.some(s => s.id === result.stageId)) save.stageWins[result.stageId] = (save.stageWins[result.stageId] || 0) + 1;
  const discover = (key, ids) => { save.collection[key] = [...new Set([...save.collection[key], ...ids])]; };
  discover('weapons', (result.weapons || []).flatMap(w => [w.id, ...(w.provenance || []).map(p => p.id)]).filter(id => catalog.weapons.some(w => w.id === id)));
  discover('evolutions', (result.weapons || []).filter(w => w.evolved).map(w => w.id).filter(id => catalog.weapons.some(w => w.id === id)));
  discover('enemies', Object.keys(result.stats?.killsByKind || {}).filter(id => catalog.enemies.some(e => e.id === id)));
  if (catalog.stages.some(s => s.id === result.stageId)) discover('stages', [result.stageId]);
  return applyUnlocks(save, catalog);
}

export const achievementProgress = (save, achievement) => Math.min(achievement.target, achievement.stage ? save.stageWins[achievement.stage] || 0 : save.stats[achievement.stat] || 0);
export function awardAchievements(save) {
  const earned = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!save.achievements.includes(achievement.id) && achievementProgress(save, achievement) >= achievement.target) {
      save.achievements.push(achievement.id); save.gold = integer(save.gold + achievement.gold); earned.push(achievement);
    }
  }
  return earned;
}
