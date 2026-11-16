// Level-up upgrade cards. Each upgrade names exactly what it changes; stacks
// are capped so no single choice can break the tuning.

export const UPGRADES = [
  {
    id: 'ember-bolt',
    name: 'Ember Bolt',
    glyph: '✦',
    blurb: '+30% bolt damage',
    detail: 'Your lantern bolts burn hotter.',
    max: 5,
    apply(player) { player.damage *= 1.3; },
  },
  {
    id: 'quick-flame',
    name: 'Quick Flame',
    glyph: '≫',
    blurb: '+22% fire rate',
    detail: 'The lantern spits bolts faster.',
    max: 5,
    apply(player) { player.fireInterval *= 0.82; },
  },
  {
    id: 'twin-lantern',
    name: 'Twin Lantern',
    glyph: '✧✧',
    blurb: '+1 bolt per shot',
    detail: 'An extra flame joins every volley.',
    max: 3,
    apply(player) { player.projectiles += 1; },
  },
  {
    id: 'piercing-light',
    name: 'Piercing Light',
    glyph: '➶',
    blurb: 'Bolts pierce +1 foe',
    detail: 'Light passes through the gloom.',
    max: 3,
    apply(player) { player.pierce += 1; },
  },
  {
    id: 'swift-wings',
    name: 'Swift Wings',
    glyph: '❧',
    blurb: '+14% move speed',
    detail: 'Lighter wings, quicker turns.',
    max: 4,
    apply(player) { player.speed *= 1.14; },
  },
  {
    id: 'sturdy-husk',
    name: 'Sturdy Husk',
    glyph: '♥',
    blurb: '+25 max health, heal 25',
    detail: 'A thicker shell for long nights.',
    max: 5,
    apply(player) { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); },
  },
  {
    id: 'keen-eye',
    name: 'Keen Eye',
    glyph: '◎',
    blurb: '+12% critical chance',
    detail: 'Critical bolts deal double damage.',
    max: 4,
    apply(player) { player.critChance += 0.12; },
  },
  {
    id: 'lodestone-charm',
    name: 'Lodestone Charm',
    glyph: '◉',
    blurb: '+60% shard magnet range',
    detail: 'Experience shards fly to you.',
    max: 3,
    apply(player) { player.magnetRadius *= 1.6; },
  },
  {
    id: 'nova-star',
    name: 'Nova Star',
    glyph: '✺',
    blurb: '+1 nova charge, +20% nova damage',
    detail: 'Press E to burst the gloom away.',
    max: 3,
    apply(player) {
      player.novaMaxCharges += 1;
      player.novaCharges = Math.min(player.novaMaxCharges, player.novaCharges + 1);
      player.novaDamage *= 1.2;
    },
  },
  {
    id: 'moth-dash',
    name: 'Moth Dash',
    glyph: '↯',
    blurb: '-25% dash cooldown',
    detail: 'Dodge more often. Dashing grants brief immunity.',
    max: 3,
    apply(player) { player.dashCooldown *= 0.75; },
  },
  {
    id: 'sipping-light',
    name: 'Sipping Light',
    glyph: '❋',
    blurb: 'Heal 1 HP per 12 kills worth of damage dealt',
    detail: 'Bolts drink a little light back. (Lifesteal 4%)',
    max: 3,
    apply(player) { player.lifesteal += 0.04; },
  },
  {
    id: 'thorn-aura',
    name: 'Thorn Aura',
    glyph: '❖',
    blurb: 'Damages nearby foes over time',
    detail: 'A ring of thorns bites what comes close.',
    max: 3,
    apply(player) {
      player.thornRadius = player.thornRadius === 0 ? 78 : player.thornRadius + 18;
      player.thornDamage += 9;
    },
  },
  {
    id: 'heavy-ember',
    name: 'Heavy Ember',
    glyph: '●',
    blurb: '+45% damage, -12% fire rate',
    detail: 'Slow, heavy, decisive bolts.',
    max: 3,
    apply(player) { player.damage *= 1.45; player.fireInterval *= 1.12; },
  },
  {
    id: 'guardian-ward',
    name: 'Guardian Ward',
    glyph: '◈',
    blurb: 'Start each wave with a shield',
    detail: 'The shield absorbs one hit, then fades.',
    max: 1,
    apply(player) { player.wardEachWave = true; },
  },
];

export function availableUpgrades(player) {
  return UPGRADES.filter((upgrade) => (player.upgradeStacks[upgrade.id] || 0) < upgrade.max);
}

export function rollUpgradeChoices(rng, player, count) {
  const pool = rng.shuffle(availableUpgrades(player));
  if (pool.length === 0) return [];
  const picks = pool.slice(0, Math.min(count, pool.length));
  // Always offer three cards: repeat the pool only if nearly everything is maxed.
  while (picks.length < count && pool.length > 0) {
    picks.push(pool[picks.length % pool.length]);
  }
  return picks.slice(0, count);
}

export function applyUpgrade(upgrade, player) {
  upgrade.apply(player);
  player.upgradeStacks[upgrade.id] = (player.upgradeStacks[upgrade.id] || 0) + 1;
}
