import CATALOG from '../../data/night-game.json' with { type: 'json' };
export { CATALOG };

// This module has no browser dependencies. Every random decision belongs to the run.
const CFG = CATALOG.config;
const byId = records => Object.fromEntries(records.map(record => [record.id, record]));
const WEAPONS = byId(CATALOG.weapons);
const PASSIVES = byId(CATALOG.passives);
const ENEMIES = byId(CATALOG.enemies);
const ARCANA = byId(CATALOG.arcana);
const UNIONS = byId(CATALOG.unions);
const LANDMARKS = new Set(['chest', 'relic', 'coffin', 'merchant', 'stageitem', 'arsenal']);
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const pointSegmentDistance2 = (point, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((point.x - ax) * dx + (point.y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return (point.x - ax - dx * t) ** 2 + (point.y - ay - dy * t) ** 2;
};
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = Math.imul(value ^ value >>> 15, value | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

class SpatialHash {
  constructor(size) { this.size = size; this.cells = new Map(); }
  build(entities) {
    this.cells.clear();
    for (const entity of entities) {
      if (entity.hp <= 0) continue;
      const key = `${Math.floor(entity.x / this.size)},${Math.floor(entity.y / this.size)}`;
      const cell = this.cells.get(key);
      if (cell) cell.push(entity); else this.cells.set(key, [entity]);
    }
  }
  query(x, y, radius) {
    const found = [];
    const minX = Math.floor((x - radius) / this.size), maxX = Math.floor((x + radius) / this.size);
    const minY = Math.floor((y - radius) / this.size), maxY = Math.floor((y + radius) / this.size);
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      const cell = this.cells.get(`${cx},${cy}`);
      if (cell) for (const entity of cell) if (entity.hp > 0) found.push(entity);
    }
    return found;
  }
}

class Run {
  constructor(options = {}) {
    this.character = CATALOG.characters.find(item => item.id === options.characterId) || CATALOG.characters[0];
    this.stage = CATALOG.stages.find(item => item.id === options.stageId) || CATALOG.stages[0];
    this.characterId = this.character.id;
    this.stageId = this.stage.id;
    this.mode = Object.hasOwn(CFG.modes, options.mode) ? options.mode : 'quick';
    this.duration = CFG.modes[this.mode] || Infinity;
    this.hyper = options.hyper === true;
    this.hurry = options.hurry === true;
    this.inverse = options.inverse === true;
    this.weaponLimit = clamp(Math.floor(Number(options.weaponLimit) || CFG.weaponSlots), 1, CFG.weaponSlots);
    this.arcanaEnabled = options.arcanaEnabled !== false;
    this.limitBreakEnabled = options.limitBreak !== false && CFG.limitBreakEnabled;
    this.arcanaLimit = this.arcanaEnabled ? (this.mode === 'endless' ? CFG.endlessArcanaSlots : CFG.arcanaSlots) : 0;
    this.extraArcanaSlots = 0;
    this.sealed = [...new Set((Array.isArray(options.sealed) ? options.sealed : []).filter(id => WEAPONS[id]))].slice(0, CFG.sealLimit);
    this.unlockedWeapons = [...new Set([this.character.weapon, ...(Array.isArray(options.unlockedWeapons) ? options.unlockedWeapons.filter(id => WEAPONS[id]) : CATALOG.weapons.map(item => item.id))])];
    this.eggs = clamp(Math.floor(Number(options.eggs) || 0), 0, CFG.maxEggs);
    this.finalBossRequired = options.finalBossRequired === true && this.mode !== 'endless';
    this.overtime = false; this.cycle = 0; this.cycleTime = 0;
    this.seed = Number.isFinite(options.seed) ? options.seed >>> 0 : 1;
    this._random = seededRandom(this.seed);
    this._id = 0;
    this.state = 'playing';
    this.time = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = CFG.baseXpNeed;
    this.kills = 0;
    this.gold = 0;
    this.viewport = { ...CFG.defaultViewport };
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.effects = [];
    this.props = [];
    this.obstacles = [];
    this.objective = { ...this.stage.objective, state: 'sealed', guardsKilled: 0, spawned: 0 };
    this.stageItems = (this.stage.items || []).map(item => ({ ...item, state: 'sealed', collected: false, guardId: null }));
    this.goldFever = { active: false, remaining: 0, chain: 0, chainWindow: 0, gold: 0, totalGold: 0, activations: 0 };
    this.merchantOffers = [];
    this._merchantVisited = false;
    this.merchantCyclePurchases = 0;
    this._consumed = new Set();
    this.weapons = [{ id: this.character.weapon, level: 1, evolved: false, damage: 0, kills: 0, timer: 0 }];
    this.passives = [];
    this.arcana = [];
    this.arcanaChoices = [];
    this.arsenalChoices = [];
    this.arsenalCollected = false;
    this.choices = [];
    this.chestRewards = [];
    this.notices = [];
    this.rerolls = CFG.rerolls;
    this.skips = CFG.skips;
    this.banishes = CFG.banishes;
    this.revives = 0;
    this.relicCollected = false;
    this.stats = { damage: 0, damageTaken: 0, healing: 0, chests: 0, evolutions: 0, relics: 0, bosses: 0, elites: 0, props: 0, revivals: 0, rescues: 0, unions: 0, merchantPurchases: 0, secretObjectives: 0, stageItems: 0, goldFevers: 0, feverGold: 0, cycles: 0, maxLevel: 1, killsByKind: {}, maxEnemies: 0, maxProjectiles: 0, maxPickups: 0 };
    this.stats.arsenals = 0;
    this.stats.shieldBlocks = 0;
    this.player = { x: 0, y: 0, face: 0, hp: CATALOG.player.hp, maxHp: CATALOG.player.hp, speed: CATALOG.player.speed, magnet: CATALOG.player.magnet, r: CATALOG.player.r, invulnerable: 0, dashCooldown: 0, dashTime: 0, shieldCharges: 0, shieldMax: 0, shieldCooldown: 0 };
    this._meta = {};
    for (const item of CATALOG.powerUps) this._meta[item.id] = clamp(Math.floor(Number(options.meta?.[item.id]) || 0), 0, item.maxLevel);
    this._relicBonuses = {};
    this._banned = new Set();
    this._events = [];
    this._hash = new SpatialHash(CFG.cellSize);
    this._propHash = new SpatialHash(CFG.cellSize);
    this._propCells = new Map();
    this._hazards = [];
    this._zones = [];
    this._spawnTimer = 0;
    this._spawnRemainder = 0;
    this._eliteTimer = CFG.eliteEvery;
    this._bossTimer = CFG.bossEvery;
    this._bossIndex = 0;
    this._finalSpawned = false;
    this._arcanaIndex = 0;
    this._stageTimer = this.stage.mechanic.initial;
    this._stageEvents = 0;
    this._eventIndex = 0;
    this._worldTimer = 0;
    this._regenTimer = 0;
    this._orbitAngle = 0;
    this._birdAngle = 0;
    this._textTimer = 0;
    this._moving = false;
    this._recalculate();
    this.player.hp = this.player.maxHp;
    this.revives = this.modifiers.revival;
    if (this.arcanaEnabled && ARCANA[options.arcanaId]) this.arcana.push(options.arcanaId);
    this._ensureWorld();
    this._pickup('relic', this.stage.relic.x, this.stage.relic.y, 1);
    this._pickup('coffin', this.objective.x, this.objective.y, 1);
    this._pickup('merchant', this.stage.merchant.x, this.stage.merchant.y, 1);
    if (this.stage.arsenal) this._pickup('arsenal', this.stage.arsenal.x, this.stage.arsenal.y, 1);
    for (const item of this.stageItems) {
      const pickup = this._pickup('stageitem', item.x, item.y, 1);
      if (pickup) pickup.itemId = item.id;
    }
    const openingAngle = this._random() * TAU;
    for (let index = 0; index < CFG.openingWaveCount; index++) {
      const angle = openingAngle + index / CFG.openingWaveCount * TAU;
      this._spawn(CFG.openingEnemy, { x: Math.cos(angle) * CFG.openingWaveRadius, y: Math.sin(angle) * CFG.openingWaveRadius });
    }
  }

  _emit(type, text, extra = {}) {
    this._events.push({ type, text, ...extra });
    if (this._events.length > CFG.maxEvents) this._events.shift();
    if (text && (!['hit', 'kill', 'pickup'].includes(type) || type === 'pickup' && extra.kind === 'relic')) {
      this.notices.push({ text, time: this.time, type });
      if (this.notices.length > CFG.maxNotices) this.notices.shift();
    }
  }
  drainEvents() { return this._events.splice(0); }
  _effect(kind, x, y, radius, life = CFG.effectDuration, extra = {}) {
    if (this.effects.length >= CFG.maxEffects) {
      const disposable = this.effects.findIndex(effect => effect.kind !== 'warning' && !(effect.kind === 'pool' && effect.enemy));
      if (disposable < 0) return;
      this.effects.splice(disposable, 1);
    }
    this.effects.push({ kind, x, y, radius, life, max: life, color: '#d7b668', ...extra });
  }
  _text(x, y, text, color) {
    if (this._textTimer > 0 || this.effects.filter(effect => effect.kind === 'text').length >= CFG.damageTextCap) return;
    this._textTimer = CFG.hitTextInterval;
    this._effect('text', x, y, 0, CFG.textDuration, { text: String(text), color });
  }
  _recalculate() {
    const base = CATALOG.player;
    const mods = { might: base.might, cooldown: base.cooldown, area: base.area, duration: base.duration, amount: base.amount, projectileSpeed: base.projectileSpeed, growth: base.growth, luck: base.luck, curse: base.curse, armor: base.armor, magnet: base.magnet, health: 1, speed: 1, regen: base.regen, revival: 0 };
    const add = (stat, value) => { mods[stat] = (mods[stat] || 0) + value; };
    for (const [stat, value] of Object.entries(this.character.stats)) add(stat, value);
    for (const [stat, value] of Object.entries(this.character.perLevel || {})) add(stat, value * (this.level - 1));
    for (const record of CATALOG.powerUps) add(record.stat, record.perLevel * this._meta[record.id]);
    for (let index = 0; index < CFG.eggStats.length; index++) {
      const egg = CFG.eggStats[index], count = Math.max(0, Math.floor((this.eggs + CFG.eggStats.length - 1 - index) / CFG.eggStats.length));
      add(egg.stat, count * egg.amount);
    }
    for (const equipped of this.passives) {
      const definition = PASSIVES[equipped.id];
      if (!definition) continue;
      add(definition.stat, definition.perLevel * equipped.level);
      for (const [stat, value] of Object.entries(definition.secondary || {})) add(stat, value * equipped.level);
    }
    for (const [stat, value] of Object.entries(this._relicBonuses)) add(stat, value);
    if (this.inverse) mods.growth *= CFG.inverseGrowth;
    mods.cooldown = clamp(mods.cooldown, CFG.minimumCooldownMultiplier, CFG.maximumCooldownMultiplier);
    mods.amount = Math.floor(mods.amount);
    mods.armor = Math.floor(mods.armor);
    const oldMax = this.player.maxHp;
    this.modifiers = mods;
    this.player.maxHp = Math.round(base.hp * mods.health);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, this.player.maxHp - oldMax));
    this.player.speed = base.speed * mods.speed * (this.hyper ? CFG.hyperSpeed : 1);
    this.player.magnet = mods.magnet;
    this.player.armor = mods.armor;
  }
  _heal(amount) {
    const healed = Math.min(amount, this.player.maxHp - this.player.hp);
    if (healed > 0) { this.player.hp += healed; this.stats.healing += healed; }
    return healed;
  }
  _weaponStats(equipped) {
    const definition = WEAPONS[equipped.id];
    const raw = definition.levels[clamp(equipped.level, 1, definition.maxLevel) - 1];
    const evolution = equipped.union ? UNIONS[equipped.unionId].evolution : equipped.evolved ? definition.evolution : null;
    const beyond = equipped.limitBreak || {};
    return { ...raw,
      damage: raw.damage * this.modifiers.might * (evolution?.damageMultiplier || 1) * (1 + (beyond.damage || 0)),
      retaliation: (raw.retaliation || 0) * this.modifiers.might * (evolution?.damageMultiplier || 1) * (1 + (beyond.damage || 0)),
      cooldown: raw.cooldown * this.modifiers.cooldown * (evolution?.cooldownMultiplier || 1) * Math.max(CFG.minimumCooldownMultiplier, 1 + (beyond.cooldown || 0)),
      count: raw.count + this.modifiers.amount + (evolution?.extraProjectiles || 0) + Math.floor((beyond.amount || 0) + 1e-9),
      radius: Math.min(equipped.id === 'aegis' ? CFG.aegisMaxRadius : equipped.id === 'lancet' ? CFG.lancetMaxRange : Infinity, raw.radius * this.modifiers.area * (evolution?.areaMultiplier || 1) * (1 + (beyond.area || 0))),
      duration: Math.min(equipped.id === 'lancet' ? CFG.lancetMaxFreeze : Infinity, raw.duration * this.modifiers.duration * (1 + (beyond.duration || 0))),
      speed: raw.speed * this.modifiers.projectileSpeed * (evolution?.speedMultiplier || 1) * (1 + (beyond.speed || 0)),
      color: definition.color,
    };
  }
  _upgradeDescription(type, item, owned) {
    if (type === 'passive') {
      const level = owned?.level || 0;
      const format = value => item.format === 'percent' ? `${Math.round(value * 100)}%` : `${item.stat === 'amount' ? Math.floor(value) : value}`;
      return `${item.description} ${item.statLabel}: +${format(Math.abs(item.perLevel) * level)} → +${format(Math.abs(item.perLevel) * (level + 1))}${item.perLevel < 0 ? ' reduction' : ''}.`;
    }
    const next = this._weaponStats({ id: item.id, level: (owned?.level || 0) + 1 });
    const previous = owned ? this._weaponStats(owned) : null;
    const formats = [
      ['damage', 'damage', value => Math.round(value)],
      ['cooldown', 'cooldown', value => `${value.toFixed(2)}s`],
      ['count', item.id === 'aegis' ? 'barrier charges' : item.id === 'lancet' ? 'freeze beams' : 'projectiles', value => value],
      ['radius', 'reach', value => Math.round(value)],
      ['duration', 'duration', value => `${value.toFixed(2)}s`],
      ['pierce', 'piercing', value => value],
    ];
    const changes = formats.filter(([stat]) => !previous || next[stat] !== previous[stat]).map(([stat, label, format]) => `${label} ${previous ? `${format(previous[stat])} → ` : ''}${format(next[stat])}`);
    return `${item.description} ${changes.slice(0, CFG.upgradeDescriptionStats).join(' · ')}.`;
  }
  _nearest(x, y, radius = CFG.targetingRadius, exclude = null) {
    let nearest = null, best = radius * radius;
    for (const enemy of this._hash.query(x, y, radius)) {
      if (enemy === exclude || enemy.hp <= 0) continue;
      const d = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
      if (d < best) { best = d; nearest = enemy; }
    }
    return nearest;
  }
  _forwardTarget() {
    let closest = null, distance = CFG.targetingRadius ** 2;
    for (const enemy of this._hash.query(this.player.x, this.player.y, CFG.targetingRadius)) {
      const dx = enemy.x - this.player.x, dy = enemy.y - this.player.y;
      const angle = Math.atan2(dy, dx) - this.player.face;
      if (Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) > CFG.knifeAimCone) continue;
      const d = dx * dx + dy * dy;
      if (d < distance) { distance = d; closest = enemy; }
    }
    return closest;
  }
  _damage(enemy, amount, weapon, options = {}) {
    if (!enemy || enemy.hp <= 0 || amount <= 0) return 0;
    const criticalChance = CFG.critChance * this.modifiers.luck + (this.arcana.includes('critical') ? CFG.criticalArcanaChance : 0);
    const critical = options.overTime ? false : options.critical === undefined ? this._random() < criticalChance : Boolean(options.critical);
    if (critical) amount *= CFG.critMultiplier + (this.arcana.includes('critical') ? CFG.criticalArcanaMultiplier : 0);
    amount = options.overTime ? amount : Math.max(CFG.damageMinimum, amount - (ENEMIES[enemy.kind]?.armor || 0));
    const actual = Math.min(enemy.hp, amount);
    enemy.hp -= amount;
    if (!options.overTime && weapon) {
      const force = CFG.enemyKnockback * WEAPONS[weapon.id].knockback * (enemy.boss ? CFG.bossKnockbackResistance : enemy.elite ? CFG.eliteKnockbackResistance : 1);
      const angle = options.knockbackAngle ?? Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
      enemy.x += Math.cos(angle) * force; enemy.y += Math.sin(angle) * force;
      this._collide(enemy);
    }
    enemy.hit = CFG.effectDuration;
    this.stats.damage += actual;
    if (weapon) weapon.damage += actual;
    this._text(enemy.x, enemy.y - enemy.r, Math.ceil(amount), critical ? '#f6d082' : '#e5dac8');
    if (this.arcana.includes('frost') && this._random() < CFG.iceArcanaChance) enemy.frozen = CFG.iceArcanaDuration;
    this._emit('hit', '', { x: enemy.x, y: enemy.y, damage: actual, critical, weapon: weapon?.id });
    if (enemy.hp <= 0) this._kill(enemy, weapon, options);
    return actual;
  }
  _kill(enemy, weapon, options = {}) {
    this.kills++;
    this.stats.killsByKind[enemy.kind] = (this.stats.killsByKind[enemy.kind] || 0) + 1;
    if (enemy.guard) {
      this.objective.guardsKilled++;
      if (this.objective.guardsKilled >= this.objective.guardCount) { this.objective.state = 'open'; this._emit('objective', `${this.objective.name} — quarantine broken. Recover the researcher.`, { kind: 'coffin', state: 'open' }); }
    }
    if (enemy.stageItemId) {
      const item = this.stageItems.find(item => item.id === enemy.stageItemId);
      if (item && item.state === 'sealed') { item.state = 'open'; this._emit('stageitem', CATALOG.ui.stageItemOpen, { id: item.id, passiveId: item.passiveId, state: 'open' }); }
    }
    if (weapon) weapon.kills++;
    if (enemy.boss) {
      this.stats.bosses++;
      this._pickup('chest', enemy.x, enemy.y, 1);
      this._pickup('gold', enemy.x, enemy.y, CFG.bossDropGold);
    } else if (enemy.elite) {
      this.stats.elites++;
      this._pickup('gold', enemy.x, enemy.y, CFG.eliteGold);
      if (this._random() < CFG.chestThreeChance * this.modifiers.luck) this._pickup('chest', enemy.x, enemy.y, 1);
    }
    if (!options.eraseXp) this._pickup('xp', enemy.x, enemy.y, enemy.xp);
    if (this.goldFever.active && this.kills % CFG.goldFeverDropEvery === 0) this._pickup('gold', enemy.x, enemy.y, CFG.goldFeverDropValue);
    if (this.arcana.includes('blood')) this._heal(CFG.bloodArcanaHeal);
    this._effect('impact', enemy.x, enemy.y, enemy.r + CFG.killEffectRadius, CFG.killEffectDuration, { color: ENEMIES[enemy.kind].color });
    this._emit('kill', '', { kind: enemy.kind, boss: enemy.boss, elite: enemy.elite, weapon: weapon?.id });
    if (enemy.final) {
      if (this.relicCollected && this.objective.state === 'rescued') { this.stats.secretObjectives++; this._gainGold(CFG.secretObjectiveGold, false); this._emit('objective', CATALOG.ui.secretObjectiveText, { secret: true }); }
      this.state = 'won';
      this._emit('win', CATALOG.ui.winText, { finalBoss: true });
    }
  }
  _hurt(amount) {
    if (this.player.invulnerable > 0 || this.state !== 'playing') return false;
    const barrier = this._syncShield();
    if (barrier && barrier.shieldCharges > 0) {
      const s = this._weaponStats(barrier);
      barrier.shieldCharges--;
      barrier.timer = s.cooldown;
      this.player.invulnerable = CFG.aegisInvulnerability;
      this.stats.shieldBlocks++;
      this._syncShield();
      this._effect('shield', this.player.x, this.player.y, s.radius, CFG.aegisEffectDuration, { charges: this.player.shieldCharges, maxCharges: this.player.shieldMax, blocked: true, evolved: barrier.evolved, color: s.color });
      this._emit('shield', '', { charges: this.player.shieldCharges, absorbed: amount });
      if (barrier.evolved) {
        this._hash.build(this.enemies);
        this._burst(this.player.x, this.player.y, s.radius, s.retaliation, barrier);
      }
      return false;
    }
    amount = Math.max(CFG.damageMinimum, amount - this.modifiers.armor);
    const actual = Math.min(this.player.hp, amount);
    this.player.hp -= amount;
    this.stats.damageTaken += actual;
    this.player.invulnerable = CFG.hitInvulnerable;
    this._effect('impact', this.player.x, this.player.y, this.player.r * 3, CFG.effectDuration, { color: '#de6b86', player: true });
    this._emit('hit', '', { player: true, damage: actual });
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.state = 'dead';
      this._emit('death', CATALOG.ui.deathText);
    }
    return true;
  }
  _syncShield() {
    const equipped = this.weapons.find(weapon => weapon.id === 'aegis');
    if (!equipped) { this.player.shieldCharges = this.player.shieldMax = this.player.shieldCooldown = 0; return null; }
    const maximum = clamp(Math.floor(this._weaponStats(equipped).count), 1, CFG.aegisMaxCharges);
    if (!Number.isFinite(equipped.shieldCharges)) equipped.shieldCharges = maximum;
    equipped.shieldCharges = clamp(equipped.shieldCharges, 0, maximum);
    this.player.shieldCharges = equipped.shieldCharges;
    this.player.shieldMax = maximum;
    this.player.shieldCooldown = equipped.shieldCharges < maximum ? Math.max(0, equipped.timer || 0) : 0;
    return equipped;
  }
  _burst(x, y, radius, damage, weapon, options = {}) {
    const maxRadius = radius + CFG.cellSize;
    for (const enemy of this._hash.query(x, y, maxRadius)) if ((enemy.x - x) ** 2 + (enemy.y - y) ** 2 <= (radius + enemy.r) ** 2) this._damage(enemy, damage, weapon, options);
    for (const prop of this._propHash.query(x, y, maxRadius)) if ((prop.x - x) ** 2 + (prop.y - y) ** 2 <= (radius + CFG.propRadius) ** 2) this._damageProp(prop, damage);
  }
  _damageProp(prop, damage) {
    if (prop.hp <= 0) return;
    prop.hp -= damage;
    if (prop.hp > 0) return;
    this.stats.props++;
    const weights = Object.entries(CFG.propDropWeights);
    let roll = this._random() * weights.reduce((sum, [, value]) => sum + value, 0), kind = weights[0][0];
    for (const [candidate, weight] of weights) { roll -= weight; if (roll <= 0) { kind = candidate; break; } }
    const values = { gold: CFG.goldPickupValue, heal: CFG.healPickupValue, xp: CFG.propXp, magnet: 1, bomb: 1, freeze: 1 };
    this._pickup(kind, prop.x, prop.y, values[kind]);
    this._effect('impact', prop.x, prop.y, CFG.propRadius * 2, CFG.effectDuration, { color: this.stage.color });
  }
  _pickup(kind, x, y, value) {
    const pickup = { id: ++this._id, kind, x, y, value, r: kind === 'relic' ? CFG.relicRadius : CFG.pickupRadius, life: CFG.pickupLife };
    if (this.pickups.length >= CFG.maxPickups) {
      const merge = this.pickups.find(item => item.kind === kind && !LANDMARKS.has(kind));
      if (merge) { merge.value += value; return merge; }
      const expendable = this.pickups.findIndex(item => !LANDMARKS.has(item.kind));
      if (expendable >= 0) this.pickups.splice(expendable, 1); else return null;
    }
    if (kind === 'xp' || kind === 'gold') {
      const merge = this.pickups.find(item => item.kind === kind && (item.x - x) ** 2 + (item.y - y) ** 2 < CFG.pickupMergeRadius ** 2);
      if (merge) { merge.value += value; return merge; }
    }
    this.pickups.push(pickup);
    return pickup;
  }
  _gainGold(value, pickup = true) {
    const fever = this.goldFever;
    const base = value * (pickup ? this.stage.goldMultiplier * (this.hyper ? CFG.hyperGold : 1) : 1) * (this.inverse ? CFG.inverseGold : 1) * (1 + this.cycle * CFG.endlessGoldPerCycle);
    if (pickup) {
      fever.chain += base; fever.chainWindow = CFG.goldFeverChainWindow;
      if (!fever.active && fever.chain >= CFG.goldFeverThreshold) {
        fever.active = true; fever.remaining = CFG.goldFeverDuration; fever.gold = 0; fever.activations++; this.stats.goldFevers++;
        this._emit('goldfever', CATALOG.ui.goldFeverStart, { active: true });
      }
      if (fever.active) fever.remaining = Math.min(CFG.goldFeverMaxDuration, fever.remaining + base * CFG.goldFeverExtension);
    }
    const amount = Math.round(base * (fever.active ? CFG.goldFeverMultiplier : 1));
    this.gold += amount;
    if (fever.active) { fever.gold += amount; fever.totalGold += amount; this.stats.feverGold += amount; }
    if (this.arcana.includes('greed')) this._heal(amount * CFG.goldArcanaHeal);
    return amount;
  }
  _updateGoldFever(dt) {
    const fever = this.goldFever;
    fever.chainWindow = Math.max(0, fever.chainWindow - dt);
    if (!fever.active) { if (!fever.chainWindow) fever.chain = 0; return; }
    fever.remaining = Math.max(0, fever.remaining - dt);
    if (!fever.remaining) {
      fever.active = false; fever.chain = 0; fever.chainWindow = 0;
      this._emit('goldfever', CATALOG.ui.goldFeverEnd, { active: false, gold: fever.gold });
    }
  }
  _syncCycle() {
    const cycle = this.mode === 'endless' ? Math.floor(this.time / CFG.endlessCycleDuration) : 0;
    this.cycleTime = this.mode === 'endless' ? this.time % CFG.endlessCycleDuration : this.time;
    if (cycle <= this.cycle) return;
    // The final authored formation belongs to the ending loop, before the clock resets.
    this._authoredEvents();
    this.cycle = cycle; this.stats.cycles = cycle;
    this._spawnTimer = 0; this._spawnRemainder = 0; this._eliteTimer = CFG.eliteEvery; this._bossTimer = CFG.bossEvery; this._bossIndex = 0;
    this._stageTimer = this.stage.mechanic.initial; this._stageEvents = 0;
    this._eventIndex = 0; this._eventCycle = cycle; this._arcanaIndex = 0;
    this._merchantVisited = false; this.merchantOffers = []; this.merchantCyclePurchases = 0;
    this._merchantNeedsDeparture = false; this._merchantCooldown = 0;
    this.pickups = this.pickups.filter(pickup => pickup.kind !== 'merchant');
    this._pickup('merchant', this.stage.merchant.x, this.stage.merchant.y, 1);
    this._emit('cycle', CATALOG.ui.endlessCycleText, { cycle });
  }
  _collect(pickup) {
    this._emit('pickup', '', { kind: pickup.kind, value: pickup.value });
    switch (pickup.kind) {
      case 'xp': this.xp += pickup.value * this.modifiers.growth; break;
      case 'gold': {
        this._gainGold(pickup.value);
        break;
      }
      case 'stageitem': {
        const item = this.stageItems.find(item => item.id === pickup.itemId);
        if (!item || item.state !== 'open') break;
        const equipped = this.passives.find(passive => passive.id === item.passiveId);
        if (equipped && equipped.level < CFG.passiveMaxLevel) equipped.level++;
        else if (!equipped) this.passives.push({ id: item.passiveId, level: 1, fromFloor: true });
        else this._gainGold(CFG.stageItemMaxedGold);
        item.state = 'collected'; item.collected = true; this.stats.stageItems++;
        this._recalculate();
        this._emit('stageitem', `${CATALOG.ui.stageItemCollected} ${PASSIVES[item.passiveId].name}`, { id: item.id, passiveId: item.passiveId, state: 'collected' });
        break;
      }
      case 'heal': this._heal(pickup.value); this._effect('heal', this.player.x, this.player.y, this.player.r * 3, CFG.effectDuration, { color: '#9fd4a1' }); break;
      case 'magnet': for (const gem of this.pickups) if (gem.kind === 'xp' || gem.kind === 'gold') gem.attracted = true; break;
      case 'bomb': this._burst(this.player.x, this.player.y, CFG.bombRadius, CFG.bombDamage, null); this._effect('blast', this.player.x, this.player.y, CFG.bombRadius, CFG.effectDuration); break;
      case 'freeze': for (const enemy of this.enemies) enemy.frozen = CFG.freezeDuration; this._effect('freeze', this.player.x, this.player.y, CFG.screenPurgeRadius, CFG.effectDuration, { color: '#a4d8ee' }); break;
      case 'chest': this._openChest(); break;
      case 'arsenal': this._openArsenal(); break;
      case 'coffin':
        if (this.objective.state !== 'open') break;
        this.objective.state = 'rescued'; this.stats.rescues++;
        this._gainGold(CFG.objectiveGold, false); this.xp += CFG.objectiveXp * this.modifiers.growth;
        this._relicBonuses.might = (this._relicBonuses.might || 0) + CFG.objectiveMight;
        this._recalculate(); this._emit('rescue', `${this.objective.name} — ${CATALOG.ui.rescueText}`, { kind: 'coffin', state: 'rescued' });
        break;
      case 'merchant': this._openMerchant(); break;
      case 'relic': {
        if (this.relicCollected) break;
        const relic = this.stage.relic;
        this.relicCollected = true;
        this.stats.relics++;
        this._relicBonuses[relic.stat] = (this._relicBonuses[relic.stat] || 0) + relic.value;
        this.revives += relic.revives || 0;
        this._gainGold(CFG.relicGold, false);
        this.xp += CFG.relicXp * this.modifiers.growth;
        this._recalculate();
        this._effect('evolution', this.player.x, this.player.y, CFG.reviveBlast, CFG.reviveDuration, { color: this.stage.color });
        this._emit('pickup', `${relic.name} — ${relic.description}`, { kind: 'relic', value: 1 });
        break;
      }
    }
  }
  _collectPickups(dt) {
    const snapshot = [...this.pickups];
    for (const pickup of snapshot) {
      if (this.state !== 'playing') break;
      let d = Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y);
      if (!LANDMARKS.has(pickup.kind) && d < this.player.magnet) pickup.attracted = true;
      if (pickup.attracted && d > this.player.r) {
        const move = Math.min(d, CFG.xpMagnetSpeed * dt);
        pickup.x += (this.player.x - pickup.x) / d * move;
        pickup.y += (this.player.y - pickup.y) / d * move;
        d -= move;
      }
      if (d <= this.player.r + pickup.r) {
        if (pickup.kind === 'coffin' && this.objective.state !== 'open') continue;
        if (pickup.kind === 'stageitem' && this.stageItems.find(item => item.id === pickup.itemId)?.state !== 'open') continue;
        const index = this.pickups.indexOf(pickup);
        if (index < 0) continue;
        this.pickups.splice(index, 1);
        this._collect(pickup);
      }
    }
    if (this.state === 'playing') this._checkLevel();
  }
  _checkLevel() {
    if (this.state !== 'playing' || this.xp < this.xpNeed) return;
    this.xp -= this.xpNeed;
    this.level++;
    this.stats.maxLevel = this.level;
    this.xpNeed = Math.round(CFG.baseXpNeed + CFG.xpLinear * (this.level - 1) + CFG.xpQuadratic * (this.level - 1) ** 2);
    this._recalculate();
    this._heal(CFG.levelHeal);
    this.state = 'upgrade';
    this.choices = this._rollChoices();
    this._emit('level', `Level ${this.level} — choose your exploit.`, { level: this.level });
  }
  _candidates() {
    const candidates = [];
    for (const [type, definitions, equipped, slots] of [['weapon', CATALOG.weapons, this.weapons, this.weaponLimit], ['passive', CATALOG.passives, this.passives, CFG.passiveSlots]]) {
      for (const item of definitions) {
        if (this._banned.has(`${type}:${item.id}`) || type === 'weapon' && this._consumed.has(item.id)) continue;
        const owned = equipped.find(record => record.id === item.id);
        if (type === 'weapon' && !owned && !this._canAcquireWeapon(item.id)) continue;
        if (owned ? owned.level >= item.maxLevel : equipped.length >= slots) continue;
        const level = (owned?.level || 0) + 1;
        candidates.push({ type, id: item.id, name: item.name, description: this._upgradeDescription(type, item, owned), level, icon: item.icon, color: item.color, owned: !!owned });
      }
    }
    if (!candidates.length) {
      if (this.limitBreakEnabled) for (const weapon of this.weapons) for (const limit of CFG.limitBreakStats) {
        if (this._banned.has(`limitbreak:${weapon.id}:${limit.stat}`)) continue;
        if (limit.stat === 'speed' && WEAPONS[weapon.id].levels[weapon.level - 1].speed === 0) continue;
        const item = WEAPONS[weapon.id];
        candidates.push({ type: 'limitbreak', id: weapon.id, stat: limit.stat, amount: limit.amount, name: `${weapon.union?.name || (weapon.evolved ? item.evolution.name : item.name)} / ${limit.label}`, description: limit.description, level: (weapon.limitBreakLevel || 0) + 1, icon: item.icon, color: item.color, owned: true });
      }
      candidates.push(this._rewardChoice('heal'), this._rewardChoice('gold'));
    }
    return candidates;
  }
  _rewardChoice(type) {
    return { type, id: type, name: CATALOG.ui[`${type}Name`], description: CATALOG.ui[`${type}Description`], level: 1, icon: type, color: type === 'gold' ? '#d7b96b' : '#9ecb9d' };
  }
  _canAcquireWeapon(id) {
    return !!WEAPONS[id] && this.unlockedWeapons.includes(id) && !this.sealed.includes(id) && !this._consumed.has(id) && this.weapons.length < this.weaponLimit;
  }
  _rollChoices() {
    const candidates = this._candidates();
    const count = this._random() < CFG.luckyChoiceChance * this.modifiers.luck ? CFG.luckyChoiceCount : CFG.choiceCount;
    const choices = [];
    while (choices.length < count && candidates.length) {
      // Existing items are more likely, so a focused build can reach its evolutions.
      const weighted = candidates.map(candidate => candidate.owned ? CFG.existingChoiceWeight : CFG.newChoiceWeight);
      let roll = this._random() * weighted.reduce((sum, n) => sum + n, 0), index = 0;
      while (index < weighted.length - 1 && (roll -= weighted[index]) >= 0) index++;
      choices.push(candidates.splice(index, 1)[0]);
    }
    return choices;
  }
  _applyReward(reward) {
    if (reward.type === 'weapon') {
      const owned = this.weapons.find(item => item.id === reward.id);
      if (owned && owned.level < CFG.weaponMaxLevel) owned.level++;
      else if (!owned && this._canAcquireWeapon(reward.id)) this.weapons.push({ id: reward.id, level: 1, evolved: false, damage: 0, kills: 0, timer: 0 });
      else return false;
    } else if (reward.type === 'passive') {
      const owned = this.passives.find(item => item.id === reward.id);
      if (owned && owned.level < CFG.passiveMaxLevel) owned.level++;
      else if (!owned && this.passives.length < CFG.passiveSlots) this.passives.push({ id: reward.id, level: 1 });
      else return false;
      this._recalculate();
    } else if (reward.type === 'limitbreak') {
      const owned = this.weapons.find(item => item.id === reward.id);
      const limit = CFG.limitBreakStats.find(item => item.stat === reward.stat);
      if (!this.limitBreakEnabled || !owned || owned.level !== CFG.weaponMaxLevel || !limit) return false;
      owned.limitBreak ||= {};
      owned.limitBreak[limit.stat] = (owned.limitBreak[limit.stat] || 0) + limit.amount;
      owned.limitBreakLevel = (owned.limitBreakLevel || 0) + 1;
    } else if (reward.type === 'union') {
      const union = UNIONS[reward.id];
      const sources = union?.weapons.map(id => this.weapons.find(item => item.id === id && item.level === CFG.weaponMaxLevel));
      if (!union || sources.some(item => !item) || !this.passives.some(item => item.id === union.passive)) return false;
      const [retained, consumed] = sources;
      retained.union = { id: union.id, name: union.name, with: consumed.id }; retained.unionId = union.id; retained.evolved = true; retained.timer = 0;
      retained.provenance = sources.map(item => ({ id: item.id, damage: item.damage, kills: item.kills }));
      retained.damage += consumed.damage; retained.kills += consumed.kills;
      this._consumed.add(consumed.id); this.weapons = this.weapons.filter(item => item !== consumed);
      this.projectiles = this.projectiles.filter(item => item.weapon !== consumed); this._zones = this._zones.filter(item => item.weapon !== consumed);
      this.stats.unions++; this.stats.evolutions++;
      this._emit('evolution', union.name, { union: true, id: union.id });
      this._effect('evolution', this.player.x, this.player.y, CFG.reviveBlast, CFG.reviveDuration, { color: union.color, union: true });
    } else if (reward.type === 'evolution') {
      const owned = this.weapons.find(item => item.id === reward.id);
      if (!owned || owned.evolved || owned.level !== CFG.weaponMaxLevel || !this.passives.some(item => item.id === WEAPONS[owned.id].evolution.passive)) return false;
      owned.evolved = true;
      owned.timer = 0;
      this.stats.evolutions++;
      this._effect('evolution', this.player.x, this.player.y, CFG.reviveBlast, CFG.reviveDuration, { color: WEAPONS[owned.id].color });
      this._emit('evolution', `${WEAPONS[owned.id].name} → ${WEAPONS[owned.id].evolution.name}`, { id: owned.id });
    } else if (reward.type === 'gold') this._gainGold(reward.value || CFG.levelGoldChoice, false);
    else if (reward.type === 'heal') this._heal(CFG.levelHealChoice);
    else return false;
    return true;
  }
  choose(index) {
    if (this.state !== 'upgrade' || !Number.isInteger(index) || !this.choices[index]) return false;
    if (!this._applyReward(this.choices[index])) return false;
    this.choices = [];
    this.state = 'playing';
    this._checkLevel();
    return true;
  }
  reroll() {
    if (this.state !== 'upgrade' || this.rerolls <= 0) return false;
    this.rerolls--;
    this.choices = this._rollChoices();
    return true;
  }
  skip() {
    if (this.state !== 'upgrade' || this.skips <= 0) return false;
    this.skips--;
    this.choices = [];
    this.state = 'playing';
    this._checkLevel();
    return true;
  }
  banish(index) {
    if (this.state !== 'upgrade' || this.banishes <= 0 || !Number.isInteger(index) || !this.choices[index] || !['weapon', 'passive', 'limitbreak'].includes(this.choices[index].type)) return false;
    const choice = this.choices[index];
    this._banned.add(`${choice.type}:${choice.id}${choice.type === 'limitbreak' ? `:${choice.stat}` : ''}`);
    this.banishes--;
    this.choices = [];
    this.state = 'playing';
    this._checkLevel();
    return true;
  }
  _openArsenal() {
    if (this.state !== 'playing' || this.arsenalCollected) return false;
    this.arsenalCollected = true; this.stats.arsenals++;
    this.arsenalChoices = this._candidates().filter(choice => choice.type === 'weapon' && !choice.owned);
    if (!this.arsenalChoices.length) {
      this._gainGold(CFG.arsenalFallbackGold, false);
      this._emit('arsenal', CATALOG.ui.arsenalFallback, { fallback: true });
      return true;
    }
    this.state = 'arsenal';
    this._emit('arsenal', CATALOG.ui.arsenalOpen, { fallback: false });
    return true;
  }
  selectWeapon(id) {
    if (this.state !== 'arsenal' || !this.arsenalChoices.some(choice => choice.id === id) || !this._canAcquireWeapon(id)) return false;
    if (!this._applyReward({ type: 'weapon', id })) return false;
    this.arsenalChoices = []; this.state = 'playing';
    this._emit('arsenal', `${CATALOG.ui.arsenalSelected} ${WEAPONS[id].name}`, { id });
    this._checkLevel(); return true;
  }
  skipArsenal() {
    if (this.state !== 'arsenal') return false;
    this.arsenalChoices = []; this.state = 'playing';
    this._gainGold(CFG.arsenalFallbackGold, false);
    this._emit('arsenal', CATALOG.ui.arsenalSkipped, { fallback: true });
    this._checkLevel(); return true;
  }
  _openChest() {
    if (this.state !== 'playing') return false;
    const roll = this._random() / this.modifiers.luck;
    const count = roll < CFG.chestFiveChance ? 5 : roll < CFG.chestThreeChance ? 3 : 1;
    const rewards = [];
    const union = this.time >= CFG.chestEvolutionMinimum[this.mode] ? CATALOG.unions.find(item => item.weapons.every(id => this.weapons.some(weapon => weapon.id === id && weapon.level === CFG.weaponMaxLevel && !weapon.union)) && this.passives.some(passive => passive.id === item.passive)) : null;
    if (union) rewards.push({ type: 'union', id: union.id, name: union.name, description: union.description, icon: union.icon, color: union.color, level: union.maxLevel });
    const eligible = this.time >= CFG.chestEvolutionMinimum[this.mode] ? this.weapons.filter(item => !item.evolved && item.level === CFG.weaponMaxLevel && this.passives.some(passive => passive.id === WEAPONS[item.id].evolution.passive)) : [];
    if (eligible.length && !union) {
      const item = eligible[Math.floor(this._random() * eligible.length)], definition = WEAPONS[item.id];
      rewards.push({ type: 'evolution', id: item.id, name: definition.evolution.name, description: definition.evolution.description, icon: definition.icon, color: definition.color, level: item.level });
    }
    const available = this._candidates().filter(item => item.owned && !rewards.some(reward => reward.id === item.id));
    while (rewards.length < count) {
      if (available.length) rewards.push(available.splice(Math.floor(this._random() * available.length), 1)[0]);
      else rewards.push({ ...this._rewardChoice('gold'), value: CFG.chestGold });
    }
    if (this.arcana.includes('greed')) rewards.push({ ...this._rewardChoice('gold'), value: CFG.chestGold });
    this.chestRewards = rewards;
    this.state = 'chest';
    this._emit('chest', 'Exploit chain recovered. Open the treasure.', { rewards: rewards.map(item => item.type) });
    return true;
  }
  collectChest() {
    if (this.state !== 'chest') return false;
    for (const reward of this.chestRewards) this._applyReward(reward);
    this.stats.chests++;
    this.chestRewards = [];
    this.state = 'playing';
    this._checkLevel();
    return true;
  }
  selectArcana(id) {
    if (!this.arcanaEnabled || this.state !== 'arcana' || !ARCANA[id] || !this.arcanaChoices.some(choice => choice.id === id) || this.arcana.includes(id) || this.arcana.length >= this.arcanaLimit) return false;
    this.arcana.push(id);
    this.choices = []; this.arcanaChoices = [];
    this._emit('arcana', `${ARCANA[id].name} — ${ARCANA[id].description}`, { id });
    this.state = 'playing';
    this._checkLevel();
    return true;
  }
  _openArcana() {
    if (!this.arcanaEnabled || this.state !== 'playing' || this.arcana.length >= this.arcanaLimit) return false;
    if (!this._draftArcana().length) return false;
    this.state = 'arcana';
    this._emit('arcana', CATALOG.ui.arcanaDraftText, { draft: true });
    return true;
  }
  _draftArcana() {
    const pool = CATALOG.arcana.filter(item => !this.arcana.includes(item.id));
    this.arcanaChoices = [];
    while (pool.length && this.arcanaChoices.length < CFG.arcanaDraftSize) this.arcanaChoices.push({ type: 'arcana', ...pool.splice(Math.floor(this._random() * pool.length), 1)[0], level: 1 });
    this.choices = [...this.arcanaChoices];
    return this.arcanaChoices;
  }
  rerollArcana() {
    if (this.state !== 'arcana' || this.rerolls <= 0 || this.arcana.length >= this.arcanaLimit) return false;
    this.rerolls--; this._draftArcana(); return true;
  }
  skipArcana() {
    if (this.state !== 'arcana' || this.skips <= 0) return false;
    this.skips--; this.arcanaChoices = []; this.choices = []; this.state = 'playing';
    this._checkLevel(); return true;
  }
  revive() {
    if (this.state !== 'dead' || this.revives <= 0) return false;
    this.revives--;
    this.stats.revivals++;
    this.player.hp = this.player.maxHp * CFG.reviveHp;
    this.player.invulnerable = CFG.reviveInvulnerable;
    this.state = 'playing';
    this._hash.build(this.enemies);
    this._burst(this.player.x, this.player.y, CFG.reviveBlast, CFG.reviveDamage, null);
    this.projectiles = this.projectiles.filter(item => !item.enemy);
    this._hazards = [];
    this._effect('blast', this.player.x, this.player.y, CFG.reviveBlast, CFG.reviveDuration, { color: '#d8c7ec' });
    this._emit('revive', CATALOG.ui.reviveText);
    return true;
  }

  _openMerchant() {
    if (this.state !== 'playing') return false;
    if (this._merchantVisited) { this._refreshMerchantOffers(); this.state = 'merchant'; return true; }
    this._merchantVisited = true;
    const arcana = CATALOG.arcana.filter(item => !this.arcana.includes(item.id));
    this.merchantOffers = CATALOG.merchantOffers.filter(offer => (!offer.inverseOnly || this.inverse) && (offer.type !== 'arcana-slot' || this._canBuyArcanaSlot()) && (offer.type !== 'arcana' || this.arcana.length < this.arcanaLimit && arcana.length) && (offer.type !== 'weapon' || this._candidates().some(item => item.type === 'weapon'))).map(offer => ({ ...offer, purchased: false, ...(offer.type === 'arcana' ? { arcanaId: arcana[Math.floor(this._random() * arcana.length)].id } : {}) }));
    this._refreshMerchantOffers(); this.state = 'merchant'; this._emit('merchant', CATALOG.ui.merchantOpenText);
    return true;
  }
  _canBuyArcanaSlot() {
    return this.inverse && this.arcanaEnabled && this.extraArcanaSlots < CFG.inverseArcanaBonus && this.arcanaLimit < CATALOG.arcana.length && this.arcana.length < this.arcanaLimit + 1 && CATALOG.arcana.some(item => !this.arcana.includes(item.id));
  }
  _refreshMerchantOffers() {
    for (const offer of this.merchantOffers) {
      const arcanaUnavailable = offer.type === 'arcana' && (this.arcana.length >= this.arcanaLimit || this.arcana.includes(offer.arcanaId));
      const slotUnavailable = offer.type === 'arcana-slot' && !this._canBuyArcanaSlot();
      const inverseUnavailable = offer.inverseOnly && !this.inverse;
      const weaponUnavailable = offer.type === 'weapon' && !this._candidates().some(choice => choice.type === 'weapon');
      offer.disabled = offer.purchased || inverseUnavailable || arcanaUnavailable || slotUnavailable || weaponUnavailable || this.gold < offer.cost || this.merchantCyclePurchases >= CFG.merchantPurchaseLimit || offer.type === 'heal' && this.player.hp >= this.player.maxHp;
      offer.disabledReason = offer.purchased ? 'ACQUIRED' : this.merchantCyclePurchases >= CFG.merchantPurchaseLimit ? 'VISIT LIMIT' : inverseUnavailable ? 'INVERSE ONLY' : arcanaUnavailable || slotUnavailable ? 'ARCANA UNAVAILABLE' : weaponUnavailable ? 'ARSENAL COMPLETE' : offer.type === 'heal' && this.player.hp >= this.player.maxHp ? 'INTEGRITY FULL' : this.gold < offer.cost ? 'INSUFFICIENT BOUNTY' : '';
    }
  }
  buyMerchant(id) {
    const offer = this.merchantOffers.find(item => item.id === id);
    if (this.state !== 'merchant' || !offer || offer.purchased || offer.inverseOnly && !this.inverse || this.gold < offer.cost || this.merchantCyclePurchases >= CFG.merchantPurchaseLimit) return false;
    if (offer.type === 'heal' && this.player.hp >= this.player.maxHp) return false;
    const choices = offer.type === 'weapon' ? this._candidates().filter(item => item.type === 'weapon') : [];
    if (offer.type === 'weapon' && !choices.length || offer.type === 'arcana' && (this.arcana.length >= this.arcanaLimit || this.arcana.includes(offer.arcanaId)) || offer.type === 'arcana-slot' && !this._canBuyArcanaSlot()) return false;
    this.gold -= offer.cost; offer.purchased = true; this.stats.merchantPurchases++; this.merchantCyclePurchases++;
    if (offer.type === 'heal') this._heal(offer.value);
    if (offer.type === 'revive') this.revives += offer.value;
    if (offer.type === 'stat') { this._relicBonuses[offer.stat] = (this._relicBonuses[offer.stat] || 0) + offer.value; this._recalculate(); }
    if (offer.type === 'arcana') { this.arcana.push(offer.arcanaId); this._emit('arcana', ARCANA[offer.arcanaId].name, { id: offer.arcanaId }); }
    if (offer.type === 'arcana-slot') {
      this.extraArcanaSlots++;
      this.arcanaLimit++;
      this.state = 'playing';
      this._openArcana();
      this._merchantNeedsDeparture = true; this._merchantCooldown = CFG.merchantInteractionCooldown;
    }
    if (offer.type === 'weapon') {
      this.choices = [];
      while (choices.length && this.choices.length < CFG.merchantChoiceCount) this.choices.push(choices.splice(Math.floor(this._random() * choices.length), 1)[0]);
      this.state = 'upgrade'; this._merchantNeedsDeparture = true; this._merchantCooldown = CFG.merchantInteractionCooldown;
    }
    this._refreshMerchantOffers(); return true;
  }
  leaveMerchant() {
    if (this.state !== 'merchant') return false;
    this.state = 'playing'; this._merchantNeedsDeparture = true; this._merchantCooldown = CFG.merchantInteractionCooldown; this._checkLevel(); return true;
  }

  _collide(entity) {
    const r = entity.r || CATALOG.player.r;
    if (this.stage.geometry.kind === 'corridor') {
      const axis = this.stage.geometry.axis === 'x' ? 'x' : 'y';
      const half = axis === 'x' ? this.stage.geometry.halfWidth : this.stage.geometry.halfHeight;
      entity[axis] = clamp(entity[axis], -half + r, half - r);
    }
    for (const obstacle of this.stage.geometry.kind === 'pillars' ? this.obstacles : []) {
      const left = obstacle.x - obstacle.width / 2, right = obstacle.x + obstacle.width / 2, top = obstacle.y - obstacle.height / 2, bottom = obstacle.y + obstacle.height / 2;
      const dx = entity.x - clamp(entity.x, left, right), dy = entity.y - clamp(entity.y, top, bottom), d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d > 0) { entity.x += dx / d * (r - d); entity.y += dy / d * (r - d); }
      else {
        const gaps = [[entity.x - left, 'x', left - r], [right - entity.x, 'x', right + r], [entity.y - top, 'y', top - r], [bottom - entity.y, 'y', bottom + r]].sort((a, b) => a[0] - b[0]);
        entity[gaps[0][1]] = gaps[0][2];
      }
    }
  }
  _updateObjective() {
    const objective = this.objective;
    if (objective.state !== 'sealed' || distance2(objective, this.player) > CFG.objectiveTriggerRadius ** 2) return;
    while (objective.spawned < objective.guardCount) {
      const angle = objective.spawned / objective.guardCount * TAU;
      const guard = this._spawn(objective.guardKind, { x: objective.x + Math.cos(angle) * CFG.objectiveGuardRadius, y: objective.y + Math.sin(angle) * CFG.objectiveGuardRadius, elite: true, guard: true });
      if (!guard) break;
      objective.spawned++;
    }
  }
  _updateStageItems() {
    for (const item of this.stageItems) {
      if (item.state !== 'sealed' || item.guardId || distance2(item, this.player) > CFG.stageItemTriggerRadius ** 2) continue;
      const guard = this._spawn(item.guardKind, { x: item.x + CFG.stageItemGuardRadius, y: item.y, elite: true, stageItemId: item.id });
      if (guard) item.guardId = guard.id;
    }
  }

  _ensureWorld() {
    const cellSize = CFG.propCellSize, px = Math.floor(this.player.x / cellSize), py = Math.floor(this.player.y / cellSize);
    this.props = this.props.filter(prop => prop.hp > 0 && distance2(prop, this.player) < CFG.propRespawnDistance ** 2);
    for (let y = py - CFG.propCellRadius; y <= py + CFG.propCellRadius; y++) for (let x = px - CFG.propCellRadius; x <= px + CFG.propCellRadius; x++) {
      const key = `${x},${y}`;
      if (this._propCells.has(key)) continue;
      this._propCells.set(key, this.time);
      if (this._random() < CFG.propChance && this.props.length < CFG.maxProps) this.props.push({ id: ++this._id, kind: this.stage.id, x: (x + this._random()) * cellSize, y: (y + this._random()) * cellSize, hp: CFG.propHp });
    }
    while (this._propCells.size > CFG.propCellCap) this._propCells.delete(this._propCells.keys().next().value);
    this.obstacles = [];
    if (this.stage.geometry.kind === 'corridor') for (const sign of [-1, 1]) {
      const vertical = this.stage.geometry.axis === 'x';
      this.obstacles.push({ kind: 'librarywall',
        x: vertical ? sign * (this.stage.geometry.halfWidth + CFG.geometryWallThickness / 2) : this.player.x,
        y: vertical ? this.player.y : sign * (this.stage.geometry.halfHeight + CFG.geometryWallThickness / 2),
        width: vertical ? CFG.geometryWallThickness : this.viewport.width * CFG.geometryWallViewportMultiplier,
        height: vertical ? this.viewport.height * CFG.geometryWallViewportMultiplier : CFG.geometryWallThickness });
    }
    if (this.stage.geometry.kind === 'pillars') {
      const size = CFG.geometryCellSize, cx = Math.floor(this.player.x / size), cy = Math.floor(this.player.y / size);
      for (let y = cy - CFG.geometryCellRadius; y <= cy + CFG.geometryCellRadius; y++) for (let x = cx - CFG.geometryCellRadius; x <= cx + CFG.geometryCellRadius; x++) if (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ this.seed) >>> 0) % CFG.geometryPillarModulo === 0) {
        const pillar = { kind: 'foundrypillar', x: (x + 0.5) * size, y: (y + 0.5) * size, width: CFG.geometryPillarWidth, height: CFG.geometryPillarHeight };
        if (![this.stage.relic, this.stage.objective, this.stage.merchant, this.stage.arsenal, ...this.stageItems].filter(Boolean).some(landmark => distance2(pillar, landmark) < CFG.geometryLandmarkClearance ** 2)) this.obstacles.push(pillar);
      }
    }
  }
  _spawn(kind, options = {}) {
    if (this.enemies.length >= CFG.maxEnemies) {
      if (!options.boss && !options.guard && !options.stageItemId) return null;
      const ordinary = this.enemies.findIndex(enemy => !enemy.boss && !enemy.guard && !enemy.stageItemId);
      if (ordinary < 0) return null;
      this.enemies.splice(ordinary, 1);
    }
    const definition = ENEMIES[kind];
    if (!definition) return null;
    const angle = options.angle ?? this._random() * TAU;
    const radius = Math.max(CFG.spawnSafeRadius, Math.hypot(this.viewport.width / 2, this.viewport.height / 2) + CFG.spawnRingPadding);
    const minute = this.time / CFG.bossEvery;
    const boss = options.boss === true, elite = options.elite === true;
    const hpScale = this.stage.enemyHp * (1 + minute * CFG.enemyHpPerMinute) * this.modifiers.curse * (this.inverse ? CFG.inverseEnemyHp : 1) * (1 + this.cycle * CFG.endlessHpPerCycle) * (boss ? (1 + minute * CFG.bossHpPerMinute) * (options.final ? CFG.finalBossHpMultiplier : CFG.eliteHpMultiplier) : elite ? CFG.eliteHpMultiplier : 1);
    const hp = definition.hp * hpScale;
    const enemy = { id: ++this._id, kind, x: options.x ?? this.player.x + Math.cos(angle) * radius, y: options.y ?? this.player.y + Math.sin(angle) * radius, r: definition.r * (boss ? CFG.eliteSizeMultiplier : elite ? CFG.eliteSizeMultiplier : 1), hp, maxHp: hp, boss, elite, hit: 0, phase: 0, age: 0, speed: definition.speed * this.stage.enemySpeed * (1 + minute * CFG.enemySpeedPerMinute) * this.modifiers.curse * (this.inverse ? CFG.inverseEnemySpeed : 1) * (1 + this.cycle * CFG.endlessSpeedPerCycle) * (this.hyper ? CFG.hyperEnemySpeed : 1), damage: definition.damage * (1 + minute * CFG.enemyDamagePerMinute) * (boss ? CFG.bossDamageBonus : elite ? CFG.eliteDamageMultiplier : 1), xp: Math.ceil(definition.xp * (1 + minute * CFG.enemyXpPerMinute) * (boss ? CFG.bossDropXp : elite ? CFG.eliteXpMultiplier : 1)), specialTimer: this._random() * CFG.enemySpecialCooldown, attackTimer: CFG.bossAttackBase, frozen: 0, split: options.split === true, final: options.final === true, guard: options.guard === true, stageItemId: options.stageItemId || null };
    this.enemies.push(enemy);
    if (boss) {
      this._effect('warning', enemy.x, enemy.y, enemy.r * 2, CFG.bossWarning, { color: definition.color, shape: 'circle' });
      this._emit('boss', options.final ? CATALOG.ui.finalBossName : `${CATALOG.ui.bossName}: ${definition.name}`, { kind, final: !!options.final });
    }
    return enemy;
  }
  _wave(dt) {
    const clock = this.mode === 'endless' ? this.cycleTime : this.time;
    const minute = clock / CFG.bossEvery;
    const pressure = Math.min(1, clock / (Number.isFinite(this.duration) ? this.duration : CFG.endlessCycleDuration));
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      const interval = Math.max(CFG.spawnMinimumInterval, (CFG.spawnBaseInterval - pressure * CFG.spawnProgressPressure) / (this.stage.spawnRate * this.modifiers.curse * (this.inverse ? CFG.inverseSpawnRate : 1) * (1 + this.cycle * CFG.endlessSpawnPerCycle)));
      this._spawnTimer += interval;
      const pool = this.stage.enemyPool;
      const unlocked = Math.min(pool.length, Math.max(2, 2 + Math.floor(minute)));
      this._spawnRemainder += Math.min(CFG.spawnBatchHardCap, Math.min(CFG.spawnBatchCap, 1 + Math.floor(minute / CFG.spawnBatchMinutes)) * this.modifiers.curse);
      const batch = Math.floor(this._spawnRemainder + 1e-9);
      this._spawnRemainder = Math.max(0, this._spawnRemainder - batch);
      for (let index = 0; index < batch; index++) this._spawn(pool[Math.floor(this._random() * unlocked)]);
    }
    this._eliteTimer -= dt;
    if (this._eliteTimer <= 0) {
      this._eliteTimer += CFG.eliteEvery;
      this._spawn(this.stage.enemyPool[Math.floor(this._random() * this.stage.enemyPool.length)], { elite: true });
    }
    this._bossTimer -= dt;
    if (this._bossTimer <= 0) {
      this._bossTimer += CFG.bossEvery;
      this._spawn(this.stage.bossKinds[this._bossIndex++ % this.stage.bossKinds.length], { boss: true });
    }
    if (Number.isFinite(this.duration) && !this._finalSpawned && this.time >= this.duration - CFG.finalBossLead) {
      this._finalSpawned = Boolean(this._spawn('reaper', { boss: true, final: true }));
    }
  }
  _enemyBolt(enemy, angle, speed = CFG.enemyBoltSpeed) {
    this._projectile({ kind: 'bolt', x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: CFG.enemyBoltRadius, angle, color: ENEMIES[enemy.kind].color, enemy: true, life: CFG.enemyBoltLife, damage: enemy.damage, pierce: 1 });
  }
  _bossAttack(enemy) {
    const count = CFG.bossBoltCount + enemy.phase * CFG.bossBoltPhaseCount;
    const offset = this._random() * TAU;
    for (let index = 0; index < count; index++) this._enemyBolt(enemy, offset + index / count * TAU, CFG.bossBoltSpeed);
    const radius = CFG.bossRingRadius + enemy.phase * CFG.bossRingPhaseRadius;
    const hazard = { x: this.player.x, y: this.player.y, radius, delay: CFG.bossHazardTell, life: CFG.bossHazardLife, damage: CFG.bossHazardDamage * (1 + enemy.phase), color: ENEMIES[enemy.kind].color, shape: enemy.phase > 0 ? 'ring' : 'circle', innerRadius: enemy.phase > 0 ? radius * CFG.bossRingInnerRatio : 0, active: false, hitTimer: 0 };
    if (this._hazards.length < CFG.maxHazards) this._hazards.push(hazard);
    this._effect('warning', hazard.x, hazard.y, radius, CFG.bossHazardTell, { shape: hazard.shape, innerRadius: hazard.innerRadius, color: hazard.color });
  }
  _stageMechanic(dt) {
    this._stageTimer -= dt;
    if (this._stageTimer > 0) return;
    const mechanic = this.stage.mechanic;
    this._stageTimer += mechanic.interval;
    this._stageEvents++;
    this._emit('stage', `${mechanic.name} — ${mechanic.description}`, { id: mechanic.id });
    if (mechanic.id === 'bell') {
      const offset = this._random() * TAU;
      for (let index = 0; index < mechanic.count; index++) {
        const angle = offset + index / mechanic.count * TAU;
        this._spawn(mechanic.enemy, { x: this.player.x + Math.cos(angle) * mechanic.radius, y: this.player.y + Math.sin(angle) * mechanic.radius, elite: index === 0 && this._stageEvents % mechanic.eliteEvery === 0 });
      }
      this._effect('rune', this.player.x, this.player.y, mechanic.radius, CFG.bossWarning, { color: this.stage.color });
      return;
    }
    const count = mechanic.count || 1;
    for (let index = 0; index < (mechanic.id === 'sweep' ? 2 : count); index++) {
      if (this._hazards.length >= CFG.maxHazards) break;
      const angle = this._random() * TAU;
      const hazard = { x: this.player.x, y: this.player.y, radius: mechanic.radius, delay: mechanic.delay, life: mechanic.life, damage: mechanic.damage, color: this.stage.color, active: false, hitTimer: 0, source: mechanic.id };
      if (mechanic.id === 'sweep') {
        const vertical = this._stageEvents % 2 === 0;
        hazard.shape = 'line';
        hazard.angle = vertical ? Math.PI / 2 : 0;
        hazard.length = Math.max(CFG.stageSweepLengthMinimum, (vertical ? this.viewport.height : this.viewport.width) * CFG.stageSweepViewportRatio);
        if (vertical) hazard.x += (index ? 1 : -1) * mechanic.laneOffset; else hazard.y += (index ? 1 : -1) * mechanic.laneOffset;
      } else {
        hazard.x += Math.cos(angle) * mechanic.scatter;
        hazard.y += Math.sin(angle) * mechanic.scatter;
        if (mechanic.id === 'gravity') { hazard.pullStrength = mechanic.pullStrength; hazard.pullRadius = mechanic.pullRadius; }
      }
      this._hazards.push(hazard);
      this._effect('warning', hazard.x, hazard.y, hazard.radius, mechanic.delay, { shape: hazard.shape || 'circle', angle: hazard.angle, length: hazard.length, color: hazard.color });
    }
  }
  _authoredEvents() {
    const events = this.stage.events, clock = this.time * (this.mode === 'quick' ? CFG.authoredEventQuickScale : 1);
    const cycle = this._eventCycle || 0;
    while (this._eventIndex < events.length && clock >= events[this._eventIndex].time + cycle * CFG.modes.standard) {
      const event = events[this._eventIndex++], offset = this._random() * TAU;
      this._emit('stage', `${event.name} — ${ENEMIES[event.kind].name}`, { authored: true, pattern: event.pattern, time: event.time });
      for (let index = 0; index < event.count; index++) {
        const angle = offset + index / event.count * TAU;
        const x = event.pattern === 'rush-lines' ? this.player.x + (index % 2 ? 1 : -1) * event.radius : this.player.x + Math.cos(angle) * event.radius;
        const y = event.pattern === 'rush-lines' ? this.player.y + (index - (event.count - 1) / 2) * CFG.authoredRushLineSpacing : this.player.y + Math.sin(angle) * event.radius;
        const enemy = this._spawn(event.kind, { x, y, elite: event.pattern === 'elites' && index % CFG.authoredEliteEvery === 0 });
        if (enemy) this._effect('warning', x, y, enemy.r * 2, CFG.bossWarning, { color: this.stage.color });
      }
    }
    if (this._eventIndex >= events.length && this.mode === 'endless') { this._eventIndex = 0; this._eventCycle = cycle + 1; }
  }
  _updateEnemies(dt) {
    const player = this.player;
    for (const enemy of [...this.enemies]) {
      if (enemy.hp <= 0) continue;
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.age += dt;
      if (enemy.bleed > 0) {
        enemy.bleed -= dt;
        this._damage(enemy, enemy.bleedDamage * dt, this.weapons.find(item => item.id === 'whip'), { overTime: true });
        if (enemy.hp <= 0) continue;
      }
      if (enemy.frozen > 0) { enemy.frozen -= dt; continue; }
      const definition = ENEMIES[enemy.kind], behavior = definition.behavior;
      let dx = player.x - enemy.x, dy = player.y - enemy.y, length = Math.hypot(dx, dy) || 1;
      let angle = Math.atan2(dy, dx), speed = enemy.speed;
      enemy.specialTimer -= dt;
      if (enemy.boss) {
        const leash = Math.max(CFG.spawnSafeRadius, Math.hypot(this.viewport.width / 2, this.viewport.height / 2) + CFG.spawnRingPadding);
        if (length > leash * CFG.bossLeashMultiplier) {
          enemy.x = player.x - Math.cos(angle) * leash;
          enemy.y = player.y - Math.sin(angle) * leash;
          dx = player.x - enemy.x; dy = player.y - enemy.y; length = leash; angle = Math.atan2(dy, dx);
          this._effect('warning', enemy.x, enemy.y, enemy.r * 2, CFG.bossWarning, { color: definition.color, shape: 'circle' });
        }
        const phase = CFG.bossPhaseThresholds.filter(threshold => enemy.hp / enemy.maxHp < threshold).length;
        if (phase > enemy.phase) {
          enemy.phase = phase;
          enemy.attackTimer = 0;
          this._effect('blast', enemy.x, enemy.y, enemy.r * 3, CFG.effectDuration, { color: definition.color });
        }
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) { enemy.attackTimer = CFG.bossAttackBase - enemy.phase * CFG.bossAttackPhaseReduction; this._bossAttack(enemy); }
      }
      if (behavior === 'zigzag') angle += Math.sin(enemy.age * CFG.raceFrequency + enemy.id) * CFG.raceAmplitude;
      if (behavior === 'caster') {
        if (length < CFG.spawnSafeRadius) speed *= CFG.casterRetreatSpeed;
        if (enemy.specialTimer <= 0 && length < CFG.despawnRadius) { this._enemyBolt(enemy, angle); enemy.specialTimer = CFG.enemySpecialCooldown; }
      }
      if (behavior === 'blink' && enemy.specialTimer <= 0) {
        this._effect('rune', enemy.x, enemy.y, enemy.r * 2, CFG.effectDuration, { color: definition.color });
        enemy.x = player.x - Math.cos(angle) * CFG.ssrfBlinkDistance;
        enemy.y = player.y - Math.sin(angle) * CFG.ssrfBlinkDistance;
        enemy.specialTimer = CFG.ssrfBlinkCooldown;
        this._effect('rune', enemy.x, enemy.y, enemy.r * 2, CFG.effectDuration, { color: definition.color });
      }
      if (behavior === 'charge') {
        if (enemy.chargeTime > 0) { enemy.chargeTime -= dt; angle = enemy.chargeAngle; speed *= CFG.authChargeMultiplier; }
        else if (enemy.windup > 0) { enemy.windup -= dt; speed = 0; if (enemy.windup <= 0) enemy.chargeTime = CFG.authChargeTime; }
        else if (enemy.specialTimer <= 0) {
          enemy.windup = CFG.authWindup;
          enemy.chargeAngle = angle;
          enemy.specialTimer = CFG.enemySpecialCooldown;
          this._effect('warning', enemy.x, enemy.y, enemy.r * 2, CFG.authWindup, { angle, shape: 'circle', color: definition.color });
        }
      }
      if (behavior === 'summoner' && enemy.specialTimer <= 0) {
        const children = this.enemies.filter(item => item.summoned && item.hp > 0).length;
        if (children < CFG.enemySummonLimit) for (let index = 0; index < CFG.enemySummonCount; index++) {
          const spawnAngle = this._random() * TAU;
          const child = this._spawn('xss', { x: enemy.x + Math.cos(spawnAngle) * enemy.r * 2, y: enemy.y + Math.sin(spawnAngle) * enemy.r * 2 });
          if (child) child.summoned = true;
        }
        enemy.specialTimer = CFG.enemySpecialCooldown;
      }
      if (behavior === 'split' && !enemy.split && enemy.hp / enemy.maxHp < CFG.idorSplitHp) {
        enemy.split = true;
        for (let index = 0; index < CFG.idorSplitCount; index++) {
          const spawnAngle = this._random() * TAU;
          const child = this._spawn('idor', { x: enemy.x + Math.cos(spawnAngle) * enemy.r, y: enemy.y + Math.sin(spawnAngle) * enemy.r, split: true });
          if (child) { child.hp *= CFG.idorSplitHp; child.maxHp = child.hp; child.r *= CFG.idorSplitHp; }
        }
      }
      if (behavior === 'poison' && enemy.specialTimer <= 0) {
        if (this._hazards.length < CFG.maxHazards) this._hazards.push({ x: enemy.x, y: enemy.y, radius: CFG.prototypeZoneRadius, delay: 0, life: CFG.prototypeZoneLife, damage: CFG.prototypeZoneDamage, color: definition.color, hitTimer: 0 });
        this._effect('pool', enemy.x, enemy.y, CFG.prototypeZoneRadius, CFG.prototypeZoneLife, { color: definition.color, enemy: true });
        enemy.specialTimer = CFG.prototypeZoneInterval;
      }
      enemy.x += Math.cos(angle) * speed * dt;
      enemy.y += Math.sin(angle) * speed * dt;
      this._collide(enemy);
      if (distance2(enemy, player) <= (enemy.r + player.r) ** 2) this._hurt(enemy.damage);
    }
    this.enemies = this.enemies.filter(enemy => enemy.hp > 0 && (enemy.boss || enemy.guard || enemy.stageItemId || distance2(enemy, player) < CFG.despawnRadius ** 2));
  }
  _projectile(projectile) {
    if (this.projectiles.length >= CFG.maxProjectiles) {
      const removable = this.projectiles.findIndex(item => item.enemy === projectile.enemy);
      if (removable < 0) return;
      this.projectiles.splice(removable, 1);
    }
    this.projectiles.push({ id: ++this._id, age: 0, hits: new Map(), enemy: false, angle: 0, color: '#d7b668', ...projectile });
  }
  _fire(equipped) {
    const s = this._weaponStats(equipped), p = this.player;
    const target = this._nearest(p.x, p.y), aim = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.face;
    const projectile = (kind, angle, extra = {}) => this._projectile({ kind, x: p.x, y: p.y, vx: Math.cos(angle) * s.speed, vy: Math.sin(angle) * s.speed, r: s.radius, angle, color: s.color, life: s.duration, damage: s.damage, weapon: equipped, pierce: s.pierce, bounces: this.arcana.includes('ricochet') ? CFG.ricochetArcanaBounces : 0, ...extra });
    switch (equipped.id) {
      case 'whip': {
        if (!this._moving && target) p.face = aim;
        for (let strike = 0; strike < Math.min(s.count, CFG.weaponSlots); strike++) {
          const angle = p.face + (strike % 2 ? Math.PI : 0), radius = s.radius + Math.floor(strike / 2) * CATALOG.player.r;
          this._effect('slash', p.x, p.y, radius, s.duration, { angle, spread: s.spread, color: s.color, evolved: equipped.evolved });
          for (const enemy of this._hash.query(p.x, p.y, radius + CFG.cellSize)) {
            const a = Math.atan2(enemy.y - p.y, enemy.x - p.x), difference = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
            if (distance2(enemy, p) <= (radius + enemy.r) ** 2 && Math.abs(difference) < s.spread / 2) {
              const dealt = this._damage(enemy, s.damage, equipped);
              if (equipped.evolved) { this._heal(Math.min(CFG.lifeStealCap, dealt * CFG.lifeStealFraction * (this.arcana.includes('blood') ? 2 : 1))); enemy.bleed = CFG.bleedDuration; enemy.bleedDamage = s.damage * CFG.bleedFraction; }
            }
          }
          for (const prop of this._propHash.query(p.x, p.y, radius)) if (distance2(prop, p) < radius ** 2) this._damageProp(prop, s.damage);
        }
        break;
      }
      case 'knife': {
        const assist = this._moving ? this._forwardTarget() : target;
        const direction = assist ? Math.atan2(assist.y - p.y, assist.x - p.x) : p.face;
        if (!this._moving && assist) p.face = direction;
        for (let index = 0; index < s.count; index++) projectile('knife', direction + (index - (s.count - 1) / 2) * CFG.knifeFanAngle, { critical: equipped.evolved });
        break;
      }
      case 'wand': for (let index = 0; index < s.count; index++) projectile('wand', aim + (index - (s.count - 1) / 2) * CFG.wandFanAngle, { homing: true, blastRadius: equipped.evolved ? s.radius * CFG.evolvedWandBlast : 0 }); break;
      case 'orbit': {
        // Recreate the orbit once per short cadence, with shared hit cooldowns.
        this.projectiles = this.projectiles.filter(item => item.weapon !== equipped || item.kind !== 'orbit');
        for (let index = 0; index < s.count; index++) projectile('orbit', this._orbitAngle + index / s.count * TAU, { r: s.projectileRadius * this.modifiers.area, orbitRadius: s.radius, orbitSpeed: s.speed, life: s.cooldown + CFG.maxStep, pierce: Infinity, hits: equipped.orbitHits || (equipped.orbitHits = new Map()) });
        break;
      }
      case 'pool': {
        for (let index = 0; index < s.count; index++) {
          const angle = aim + index / s.count * TAU, range = target ? Math.min(s.radius * CFG.poolTargetRangeMultiplier, Math.hypot(target.x - p.x, target.y - p.y)) : s.radius;
          this._zone('pool', p.x + Math.cos(angle) * range, p.y + Math.sin(angle) * range, s.radius, s.duration, s.damage, equipped, s.color);
        }
        break;
      }
      case 'rune': for (let index = 0; index < s.count; index++) projectile('rune', aim + index / s.count * TAU, { bouncing: true, pierce: Infinity, r: s.radius * (equipped.evolved ? CFG.evolvedRuneRadius : 1) }); break;
      case 'lightning': {
        const candidates = this.enemies.filter(item => item.hp > 0 && distance2(item, p) < CFG.screenPurgeRadius ** 2);
        for (let index = 0; index < s.count && candidates.length; index++) {
          let enemy = candidates.splice(Math.floor(this._random() * candidates.length), 1)[0];
          const visited = new Set();
          for (let chain = 0; chain < s.pierce + (equipped.evolved ? s.count : 0) && enemy; chain++) {
            visited.add(enemy.id);
            this._effect('lightning', p.x, p.y - s.radius, s.radius, s.duration, { targetX: enemy.x, targetY: enemy.y, color: s.color });
            this._damage(enemy, s.damage, equipped);
            const x = enemy.x, y = enemy.y;
            enemy = this._hash.query(x, y, s.radius * CFG.lightningChainRangeMultiplier).find(item => !visited.has(item.id) && item.hp > 0);
          }
        }
        break;
      }
      case 'axe': for (let index = 0; index < s.count + (equipped.evolved ? s.count : 0); index++) {
        if (equipped.evolved) projectile('scythe', aim + index / (s.count * 2) * TAU, { pierce: Infinity });
        else projectile('axe', -Math.PI / 2 + (index - (s.count - 1) / 2) * CFG.axeFanAngle, { gravity: s.gravity, pierce: Infinity });
      } break;
      case 'cross': for (let index = 0; index < s.count; index++) projectile('cross', aim + index / s.count * TAU, { returning: false, returnAfter: s.returnAfter, pierce: Infinity, speed: s.speed, r: s.radius * (equipped.evolved ? CFG.evolvedCrossRadius : 1) }); break;
      case 'pentagram': {
        const keep = equipped.evolved || this._random() < s.keepXp * this.modifiers.luck;
        this._burst(p.x, p.y, s.radius, s.damage, equipped, { eraseXp: !keep });
        if (!keep) this.pickups = this.pickups.filter(pickup => CFG.purgeProtectedKinds.includes(pickup.kind) || distance2(pickup, p) > s.radius ** 2);
        if (equipped.evolved) for (const pickup of this.pickups) if (pickup.kind === 'xp') pickup.attracted = true;
        this._effect('pentagram', p.x, p.y, s.radius, s.duration, { color: s.color, evolved: equipped.evolved });
        break;
      }
      case 'fireball': for (let index = 0; index < s.count; index++) projectile('fireball', aim + (index - (s.count - 1) / 2) * CFG.fireballFanAngle, { blastRadius: s.blastRadius * this.modifiers.area * (equipped.evolved ? CFG.evolvedFireballBlast : 1) }); break;
      case 'birds': {
        for (let index = 0; index < s.count; index++) {
          const angle = this._birdAngle + index / s.count * TAU;
          const x = equipped.evolved && target ? target.x + Math.cos(angle) * s.radius : p.x + Math.cos(angle) * s.orbitRadius;
          const y = equipped.evolved && target ? target.y + Math.sin(angle) * s.radius : p.y + Math.sin(angle) * s.orbitRadius;
          this._zone('birds', x, y, s.radius, s.duration, s.damage, equipped, s.color);
          if (equipped.union) {
            const union = UNIONS[equipped.unionId];
            projectile('cross', angle, { r: union.projectileRadius * this.modifiers.area, life: union.projectileLife * this.modifiers.duration, returning: false, returnAfter: union.returnAfter, pierce: Infinity, speed: s.speed });
          }
        }
        this._birdAngle += CFG.birdAngleStep;
        break;
      }
      case 'aegis': {
        this._syncShield();
        if (equipped.shieldCharges < p.shieldMax) {
          equipped.shieldCharges++;
          this._syncShield();
          this._effect('shield', p.x, p.y, s.radius, CFG.aegisEffectDuration, { charges: p.shieldCharges, maxCharges: p.shieldMax, blocked: false, evolved: equipped.evolved, color: s.color });
        }
        break;
      }
      case 'lancet': {
        const direction = equipped.beamStep || 0;
        const count = clamp(Math.floor(s.count), 1, CFG.lancetMaxBeams);
        const hit = new Set();
        for (let index = 0; index < count; index++) {
          const angle = direction / CFG.lancetDirections * TAU + index / count * TAU;
          const endX = p.x + Math.cos(angle) * s.radius, endY = p.y + Math.sin(angle) * s.radius;
          this._effect('timebeam', p.x, p.y, s.radius, CFG.lancetBeamLife, { angle, length: s.radius, width: s.beamWidth, color: s.color, evolved: equipped.evolved });
          for (const enemy of this._hash.query(p.x, p.y, s.radius + CFG.cellSize)) {
            if (hit.has(enemy.id) || enemy.hp <= 0 || pointSegmentDistance2(enemy, p.x, p.y, endX, endY) > (s.beamWidth / 2 + enemy.r) ** 2) continue;
            hit.add(enemy.id);
            if (equipped.evolved) {
              const fraction = Math.min(CFG.lancetMaxHealthFraction, s.healthFraction * this.modifiers.might * (1 + (equipped.limitBreak?.damage || 0))) * (enemy.boss ? CFG.lancetBossHealthMultiplier : 1);
              this._damage(enemy, enemy.hp * fraction, equipped, { overTime: true });
            }
            enemy.frozen = Math.max(enemy.frozen || 0, s.duration * (enemy.boss ? CFG.lancetBossFreezeMultiplier : 1));
          }
        }
        equipped.beamStep = (direction + 1) % CFG.lancetDirections;
        break;
      }
    }
  }
  _zone(kind, x, y, radius, life, damage, weapon, color) {
    if (this._zones.length >= CFG.maxProjectiles) this._zones.shift();
    this._zones.push({ kind, x, y, radius, life, damage, weapon, timer: 0, color, originalRadius: radius });
    this._effect(kind, x, y, radius, life, { color, evolved: weapon.evolved, weapon: weapon.id, union: !!weapon.union });
  }
  _fireFusion(equipped, fusion) {
    const s = this._weaponStats({ id: fusion.weapon, level: CFG.weaponMaxLevel, evolved: true });
    const p = this.player, target = this._nearest(p.x, p.y), aim = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.face;
    const count = Math.min(CFG.fusionProjectileCap, fusion.count + this.modifiers.amount);
    for (let index = 0; index < count; index++) {
      const angle = fusion.bouncing ? aim + index / count * TAU : aim + (index - (count - 1) / 2) * fusion.fanAngle;
      const speed = s.speed * fusion.speedMultiplier;
      this._projectile({ kind: fusion.weapon, x: p.x, y: p.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: s.radius * fusion.radiusMultiplier, angle,
        color: UNIONS[equipped.unionId].color, life: s.duration * fusion.durationMultiplier, damage: s.damage * fusion.damageMultiplier, weapon: equipped,
        pierce: fusion.bouncing ? Infinity : s.pierce, bouncing: !!fusion.bouncing, homing: !!fusion.homing,
        blastRadius: fusion.blastMultiplier ? s.blastRadius * this.modifiers.area * CFG.evolvedFireballBlast * fusion.blastMultiplier : 0,
        bounces: this.arcana.includes('ricochet') ? CFG.ricochetArcanaBounces : 0 });
    }
  }
  _updateWeapons(dt) {
    this._orbitAngle += dt * WEAPONS.orbit.levels[0].speed;
    this._syncShield();
    for (const weapon of this.weapons) {
      weapon.timer = (weapon.timer || 0) - dt;
      if (weapon.timer <= 0) {
        this._fire(weapon);
        weapon.timer += this._weaponStats(weapon).cooldown;
      }
      const fusion = weapon.union && UNIONS[weapon.unionId].fusion;
      if (fusion) {
        weapon.fusionTimer = (weapon.fusionTimer || 0) - dt;
        if (weapon.fusionTimer <= 0) { this._fireFusion(weapon, fusion); weapon.fusionTimer += fusion.cooldown * this.modifiers.cooldown; }
      }
      if (weapon.orbitHits && weapon.orbitHits.size > CFG.maxEnemies) for (const [id, time] of weapon.orbitHits) if (time < this.time - CFG.orbitHitInterval) weapon.orbitHits.delete(id);
    }
    this._syncShield();
    for (const zone of this._zones) {
      zone.life -= dt;
      zone.timer -= dt;
      if (zone.weapon.evolved && zone.kind === 'pool') {
        const dx = this.player.x - zone.x, dy = this.player.y - zone.y, d = Math.hypot(dx, dy) || 1;
        zone.x += dx / d * CATALOG.player.speed * dt * CFG.poolReturnSpeedFraction;
        zone.y += dy / d * CATALOG.player.speed * dt * CFG.poolReturnSpeedFraction;
        zone.radius += dt * zone.originalRadius / WEAPONS.pool.levels[0].duration;
        const effect = this.effects.find(item => item.kind === 'pool' && item.weapon === zone.weapon.id && Math.abs(item.life - zone.life) < CFG.maxStep * 2);
        if (effect) { effect.x = zone.x; effect.y = zone.y; effect.radius = zone.radius; }
      }
      if (zone.timer <= 0) { this._burst(zone.x, zone.y, zone.radius, zone.damage, zone.weapon); zone.timer += CFG.poolHitInterval; }
    }
    this._zones = this._zones.filter(zone => zone.life > 0);
  }
  _updateProjectiles(dt) {
    const p = this.player;
    for (const shot of this.projectiles) {
      shot.life -= dt;
      shot.age += dt;
      if (shot.life <= 0) continue;
      const oldX = shot.x, oldY = shot.y;
      if (shot.kind === 'orbit') { shot.angle += shot.orbitSpeed * dt; shot.x = p.x + Math.cos(shot.angle) * shot.orbitRadius; shot.y = p.y + Math.sin(shot.angle) * shot.orbitRadius; }
      else {
        if (shot.homing) {
          const target = shot.target?.hp > 0 ? shot.target : this._nearest(shot.x, shot.y);
          shot.target = target;
          if (target) {
            const angle = Math.atan2(target.y - shot.y, target.x - shot.x), speed = Math.hypot(shot.vx, shot.vy);
            shot.vx = Math.cos(angle) * speed; shot.vy = Math.sin(angle) * speed;
          }
        }
        if (shot.kind === 'cross' && shot.age > shot.returnAfter) {
          const angle = Math.atan2(p.y - shot.y, p.x - shot.x);
          shot.vx = Math.cos(angle) * shot.speed; shot.vy = Math.sin(angle) * shot.speed; shot.returning = true;
          if (distance2(shot, p) < (p.r + shot.r) ** 2) shot.life = 0;
        }
        if (shot.gravity) shot.vy += shot.gravity * dt;
        shot.x += shot.vx * dt; shot.y += shot.vy * dt;
        shot.angle = Math.atan2(shot.vy, shot.vx);
      }
      const edgeX = this.viewport.width / 2 + CFG.spawnRingPadding, edgeY = this.viewport.height / 2 + CFG.spawnRingPadding;
      if ((shot.bouncing || shot.bounces > 0) && (Math.abs(shot.x - p.x) > edgeX || Math.abs(shot.y - p.y) > edgeY)) {
        if (Math.abs(shot.x - p.x) > edgeX) { shot.vx *= -1; shot.x = p.x + clamp(shot.x - p.x, -edgeX, edgeX); }
        if (Math.abs(shot.y - p.y) > edgeY) { shot.vy *= -1; shot.y = p.y + clamp(shot.y - p.y, -edgeY, edgeY); }
        shot.bounces--;
      }
      if (shot.enemy) {
        if (pointSegmentDistance2(p, oldX, oldY, shot.x, shot.y) < (p.r + shot.r) ** 2) { this._hurt(shot.damage); shot.life = 0; }
        continue;
      }
      const travel = Math.hypot(shot.x - oldX, shot.y - oldY), midpointX = (shot.x + oldX) / 2, midpointY = (shot.y + oldY) / 2;
      for (const enemy of this._hash.query(midpointX, midpointY, travel / 2 + shot.r + CFG.cellSize)) {
        if (shot.life <= 0 || enemy.hp <= 0) continue;
        const lastHit = shot.hits.get(enemy.id);
        const interval = shot.kind === 'orbit' ? CFG.orbitHitInterval : shot.kind === 'cross' ? CFG.crossHitInterval : CFG.runeHitInterval;
        if (lastHit !== undefined && (Number.isFinite(shot.pierce) || this.time - lastHit < interval)) continue;
        if (pointSegmentDistance2(enemy, oldX, oldY, shot.x, shot.y) > (enemy.r + shot.r) ** 2) continue;
        shot.hits.set(enemy.id, this.time);
        this._damage(enemy, shot.damage, shot.weapon, { critical: shot.critical, knockbackAngle: shot.angle });
        if (shot.kind === 'rune' && shot.weapon.evolved && (!shot.fragmentAt || this.time >= shot.fragmentAt)) {
          shot.fragmentAt = this.time + CFG.runeFragmentInterval;
          this._zone('rune', shot.x, shot.y, CFG.runeFragmentRadius * this.modifiers.area, CFG.runeFragmentDuration * this.modifiers.duration, shot.damage * CFG.runeFragmentDamage, shot.weapon, shot.color);
        }
        if (shot.blastRadius || this.arcana.includes('volatile')) {
          const radius = shot.blastRadius || CFG.explosionArcanaRadius;
          this._burst(shot.x, shot.y, radius, shot.damage * (shot.blastRadius ? 1 : CFG.explosionArcanaDamage), shot.weapon);
          this._effect('blast', shot.x, shot.y, radius, CFG.effectDuration, { color: shot.color });
        }
        if (Number.isFinite(shot.pierce)) { shot.pierce--; if (shot.pierce <= 0) shot.life = 0; }
      }
      for (const prop of this._propHash.query(shot.x, shot.y, shot.r + CFG.propRadius)) if (pointSegmentDistance2(prop, oldX, oldY, shot.x, shot.y) <= (shot.r + CFG.propRadius) ** 2 && !shot.hits.has(`p${prop.id}`)) {
        shot.hits.set(`p${prop.id}`, this.time); this._damageProp(prop, shot.damage);
      }
      if (shot.hits.size > CFG.maxEnemies) for (const [id, time] of shot.hits) if (time < this.time - CFG.runeHitInterval) shot.hits.delete(id);
    }
    this.projectiles = this.projectiles.filter(shot => shot.life > 0 && distance2(shot, p) < CFG.despawnRadius ** 2);
  }
  _updateHazards(dt) {
    for (const hazard of this._hazards) {
      if (hazard.delay > 0) { hazard.delay -= dt; continue; }
      if (!hazard.active) { hazard.active = true; this._effect('pool', hazard.x, hazard.y, hazard.radius, hazard.life, { color: hazard.color, enemy: true, shape: hazard.shape, innerRadius: hazard.innerRadius, angle: hazard.angle, length: hazard.length }); }
      hazard.life -= dt;
      hazard.hitTimer -= dt;
      const playerDistance = Math.sqrt(distance2(hazard, this.player));
      if (hazard.pullStrength && playerDistance > 0 && playerDistance < hazard.pullRadius && this.player.dashTime <= 0) {
        const pull = hazard.pullStrength * (1 - playerDistance / hazard.pullRadius) * dt;
        this.player.x += (hazard.x - this.player.x) / playerDistance * pull;
        this.player.y += (hazard.y - this.player.y) / playerDistance * pull;
        hazard.pulseTimer = (hazard.pulseTimer || 0) - dt;
        if (hazard.pulseTimer <= 0) { this._effect('rune', hazard.x, hazard.y, hazard.pullRadius, CFG.stageGravityEffectDuration, { color: hazard.color }); hazard.pulseTimer = CFG.stageGravityEffectDuration; }
      }
      let collides = playerDistance < hazard.radius + this.player.r && (!hazard.innerRadius || playerDistance + this.player.r > hazard.innerRadius);
      if (hazard.shape === 'line') {
        const dx = this.player.x - hazard.x, dy = this.player.y - hazard.y;
        const along = dx * Math.cos(hazard.angle) + dy * Math.sin(hazard.angle);
        const across = -dx * Math.sin(hazard.angle) + dy * Math.cos(hazard.angle);
        collides = Math.abs(along) <= hazard.length / 2 + this.player.r && Math.abs(across) <= hazard.radius + this.player.r;
      }
      if (hazard.hitTimer <= 0 && collides) { this._hurt(hazard.damage); hazard.hitTimer = CFG.contactInterval; }
    }
    this._hazards = this._hazards.filter(hazard => hazard.life > 0);
  }
  _step(dt, input) {
    this.time += dt;
    this._syncCycle(); this._updateGoldFever(dt);
    const player = this.player;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.dashTime = Math.max(0, player.dashTime - dt);
    this._textTimer = Math.max(0, this._textTimer - dt);
    const dx = Number.isFinite(input.dx) ? clamp(input.dx, -1, 1) : 0, dy = Number.isFinite(input.dy) ? clamp(input.dy, -1, 1) : 0;
    const length = Math.hypot(dx, dy);
    this._moving = length > 0;
    if (length > 0) player.face = Math.atan2(dy, dx);
    if (input.dash && player.dashCooldown <= 0) { player.dashCooldown = CATALOG.player.dashCooldown; player.dashTime = CATALOG.player.dashDuration; player.invulnerable = Math.max(player.invulnerable, CATALOG.player.dashInvulnerable); }
    if (length > 0 || player.dashTime > 0) {
      const speed = player.speed * (player.dashTime > 0 ? CATALOG.player.dashMultiplier : 1);
      const angle = length > 0 ? Math.atan2(dy, dx) : player.face;
      const magnitude = player.dashTime > 0 ? 1 : Math.min(1, length);
      player.x += Math.cos(angle) * speed * dt * magnitude;
      player.y += Math.sin(angle) * speed * dt * magnitude;
    }
    this._regenTimer += dt;
    if (this._regenTimer >= CFG.regenTick) { this._regenTimer -= CFG.regenTick; this._heal(this.modifiers.regen); }
    this._worldTimer -= dt;
    if (this._worldTimer <= 0) { this._worldTimer = CFG.poolHitInterval; this._ensureWorld(); }
    this._collide(player);
    this._merchantCooldown = Math.max(0, (this._merchantCooldown || 0) - dt);
    if (this._merchantNeedsDeparture && !this._merchantCooldown && distance2(this.stage.merchant, player) > CFG.merchantReturnDistance ** 2) { this._merchantNeedsDeparture = false; this._pickup('merchant', this.stage.merchant.x, this.stage.merchant.y, 1); }
    this._wave(dt);
    this._authoredEvents();
    this._stageMechanic(dt);
    this._updateObjective(); this._updateStageItems();
    this._updateEnemies(dt);
    if (this.state !== 'playing') return;
    this._hash.build(this.enemies);
    this._propHash.build(this.props);
    this._updateWeapons(dt);
    this._updateProjectiles(dt);
    this._updateHazards(dt);
    this.enemies = this.enemies.filter(enemy => enemy.hp > 0);
    this.props = this.props.filter(prop => prop.hp > 0);
    this.effects = this.effects.filter(effect => { effect.life -= dt; if (effect.kind === 'text') effect.y -= CFG.textRise * dt; return effect.life > 0; });
    this._collectPickups(dt);
    this.stats.maxEnemies = Math.max(this.stats.maxEnemies, this.enemies.length);
    this.stats.maxProjectiles = Math.max(this.stats.maxProjectiles, this.projectiles.length);
    this.stats.maxPickups = Math.max(this.stats.maxPickups, this.pickups.length);
    if (this.state !== 'playing') return;
    if (this.time >= this.duration && this.finalBossRequired) {
      if (!this.overtime) { this.overtime = true; this._emit('boss', CATALOG.ui.finalOvertimeText, { overtime: true, final: true }); }
    } else if (this.time >= this.duration) {
      this.time = this.duration;
      this.state = 'won';
      this._emit('win', CATALOG.ui.winText);
      return;
    }
    const arcanaTimes = CFG.arcanaTimes[this.mode];
    if (this.arcanaEnabled && this._arcanaIndex < arcanaTimes.length && this.cycleTime >= arcanaTimes[this._arcanaIndex]) {
      this._arcanaIndex++;
      if (this.arcana.length < this.arcanaLimit) this._openArcana();
    }
  }
  tick(dt, input = {}) {
    if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return false;
    let remaining = Math.min(dt, CFG.maxTick) * (this.hurry ? CFG.hurrySpeed : 1);
    while (remaining > 0 && this.state === 'playing') {
      const step = Math.min(remaining, CFG.maxStep);
      this._step(step, input);
      remaining -= step;
      if (remaining < Number.EPSILON) break;
    }
    return true;
  }
  getResult() {
    return { characterId: this.characterId, stageId: this.stageId, mode: this.mode, hyper: this.hyper, hurry: this.hurry, inverse: this.inverse, weaponLimit: this.weaponLimit, arcanaEnabled: this.arcanaEnabled, limitBreak: this.limitBreakEnabled, eggs: this.eggs, sealed: [...this.sealed], unlockedWeapons: [...this.unlockedWeapons], arsenalCollected: this.arsenalCollected, finalBossRequired: this.finalBossRequired, overtime: this.overtime, cycle: this.cycle, seed: this.seed, state: this.state, won: this.state === 'won', time: this.time, duration: Number.isFinite(this.duration) ? this.duration : null, level: this.level, kills: this.kills, gold: this.gold, goldEarned: this.gold, runs: 1, wins: this.state === 'won' ? 1 : 0, evolutions: this.stats.evolutions, relics: this.stats.relics, bestKills: this.kills, bestTime: this.time, arcana: [...this.arcana], arcanaLimit: this.arcanaLimit, extraArcanaSlots: this.extraArcanaSlots, stats: { ...this.stats, killsByKind: { ...this.stats.killsByKind } }, weapons: this.weapons.map(item => ({ id: item.id, name: item.union ? UNIONS[item.unionId].name : item.evolved ? WEAPONS[item.id].evolution.name : WEAPONS[item.id].name, level: item.level, limitBreakLevel: item.limitBreakLevel || 0, evolved: item.evolved, union: !!item.union, unionId: item.unionId || null, unionName: item.union?.name || null, provenance: item.provenance ? item.provenance.map(source => ({ ...source })) : [], damage: Math.round(item.damage), kills: item.kills })), passives: this.passives.map(item => ({ ...item })) };
  }
}

export function createRun(options = {}) { return new Run(options); }
