/** In-game offensive-security narrative. Reads simulation events; never changes combat. */
export function createIntel(catalog) {
  const enemies = new Map(catalog.enemies.map(enemy => [enemy.id, enemy]));
  const config = catalog.intel;
  let entries = [], known = new Set(), milestones = new Set(), classTimes = new Map();
  let focus = config.initialEnemy, focusUntil = 0;
  const add = (time, text) => {
    if (!text) return;
    entries.push({ time: Math.floor(time), text });
    entries = entries.slice(-config.maxFeed);
  };
  const select = (kind, time, force = false) => {
    if (!enemies.has(kind) || !force && time < focusUntil) return;
    focus = kind; focusUntil = time + config.focusHold;
  };
  return {
    reset(run) {
      entries = []; known = new Set(); milestones = new Set(); classTimes = new Map();
      focus = config.initialEnemy; focusUntil = 0;
      add(0, run.stage.scope);
      add(0, catalog.ui.scopeLoaded);
    },
    event(event, run) {
      const time = run.time, definition = enemies.get(event.kind);
      if (event.type === 'kill' && definition?.threat) {
        const first = !known.has(event.kind); known.add(event.kind);
        select(event.kind, time, event.boss);
        if (first || time - (classTimes.get(event.kind) ?? -Infinity) >= config.perClassLogInterval) {
          classTimes.set(event.kind, time);
          add(time, `${definition.threat.tag} / ${definition.threat.onKill}`);
        }
      } else if (event.type === 'boss' && definition?.threat) {
        select(event.kind, time, true);
        add(time, `${catalog.ui.bossName} / ${definition.threat.tag} / ${definition.threat.signature}`);
      } else if (event.type === 'level') add(time, catalog.ui.levelFeed);
      else if (event.type === 'chest') add(time, catalog.ui.chestFeed);
      else if (event.type === 'death') add(time, catalog.ui.deathFeed);
      else if (event.type === 'win') add(time, catalog.ui.winFeed);
      else if (['stage', 'evolution', 'arcana', 'rescue', 'objective', 'revive', 'merchant'].includes(event.type)) add(time, event.text);
      for (const milestone of config.milestones) {
        if (run.kills >= milestone.kills && !milestones.has(milestone.kills)) {
          milestones.add(milestone.kills); add(time, milestone.text);
        }
      }
    },
    choice(choice, run) {
      const key = choice.type === 'weapon' ? 'newWeapon' : choice.type === 'passive' ? 'passive' : 'evolution';
      add(run.time, config.quips[key].replace('{name}', choice.name));
    },
    snapshot(run) {
      if (run.time >= focusUntil) {
        let nearest, distance = Infinity;
        for (const enemy of run.enemies) {
          if (enemy.hp <= 0) continue;
          const d = (enemy.x - run.player.x) ** 2 + (enemy.y - run.player.y) ** 2;
          if (d < distance) { distance = d; nearest = enemy; }
        }
        if (nearest) select(nearest.kind, run.time, true);
      }
      return { threat: enemies.get(focus)?.threat, enemy: enemies.get(focus), entries: entries.map(entry => ({ ...entry })) };
    },
    report(run) {
      return Object.entries(run.stats.killsByKind || {}).filter(([kind, count]) => enemies.get(kind)?.threat && count > 0)
        .map(([kind, count]) => ({ kind, count, enemy: enemies.get(kind), ...enemies.get(kind).threat })).sort((a, b) => b.count - a.count);
    },
    research(cves, run) {
      const classes = new Set(this.report(run).map(threat => threat.researchClass).filter(Boolean));
      const matched = cves.filter(cve => classes.has(cve.vuln_class ?? cve.label));
      return (matched.length ? matched : cves).slice(0, config.researchLinks);
    }
  };
}
