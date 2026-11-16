// Emberwild — tuning constants and enemy definitions.
// One place for every number that decides how the game feels.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const ARENA_MARGIN = 34;
export const ARENA = {
  left: ARENA_MARGIN,
  top: 86,
  right: GAME_WIDTH - ARENA_MARGIN,
  bottom: GAME_HEIGHT - ARENA_MARGIN,
};

export const BOSS_WAVE = 10;
export const ENDLESS_BOSS_EVERY = 5;

export const PALETTE = {
  skyTop: '#0a1826',
  skyMid: '#0e2a33',
  groundTop: '#14382e',
  groundBottom: '#0d241f',
  hedge: '#1d4a35',
  hedgeLight: '#2c6b4a',
  cream: '#f6ecd4',
  amber: '#f2b23e',
  amberBright: '#ffd97a',
  teal: '#57c7a8',
  magenta: '#e86a9a',
  violet: '#9a7be8',
  ember: '#ff7a3c',
  danger: '#ff5a4e',
  slate: '#8fa8b3',
};

export const PLAYER_BASE = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  damage: 14,
  fireInterval: 0.24,
  projectiles: 1,
  pierce: 0,
  bulletSpeed: 620,
  bulletRadius: 6,
  critChance: 0.06,
  critMultiplier: 2,
  magnetRadius: 90,
  dashSpeed: 720,
  dashTime: 0.17,
  dashCooldown: 2.1,
  novaRadius: 230,
  novaDamage: 55,
  novaCharges: 1,
  novaMaxCharges: 3,
  lifesteal: 0,
  thornRadius: 0,
  thornDamage: 0,
  xpNext: 14,
};

// Enemy kinds. touchDamage is contact damage; score and xp are per kill.
export const ENEMY_TYPES = {
  husk: {
    name: 'Husk Beetle',
    radius: 17,
    speed: 62,
    hp: 34,
    touchDamage: 12,
    score: 50,
    xp: 3,
    body: '#7d5a3c',
    glow: '#c98f4e',
    unlockWave: 1,
  },
  crawler: {
    name: 'Thorn Crawler',
    radius: 12,
    speed: 128,
    hp: 18,
    touchDamage: 8,
    score: 40,
    xp: 2,
    body: '#4e7d46',
    glow: '#8fd45a',
    unlockWave: 1,
  },
  floater: {
    name: 'Spore Floater',
    radius: 15,
    speed: 74,
    hp: 26,
    touchDamage: 9,
    score: 70,
    xp: 4,
    body: '#8a5aa8',
    glow: '#c98ff0',
    unlockWave: 2,
    shoots: true,
    shootInterval: 2.6,
    keepDistance: 300,
  },
  wisp: {
    name: 'Gloom Wisp',
    radius: 13,
    speed: 168,
    hp: 22,
    touchDamage: 10,
    score: 80,
    xp: 4,
    body: '#3c6a8a',
    glow: '#7ad4ff',
    unlockWave: 3,
    weaves: true,
  },
  brute: {
    name: 'Ember Brute',
    radius: 26,
    speed: 46,
    hp: 120,
    touchDamage: 20,
    score: 180,
    xp: 9,
    body: '#8a3c2e',
    glow: '#ff8a4e',
    unlockWave: 4,
    charges: true,
  },
  boss: {
    name: 'The Hollow Moth',
    radius: 52,
    speed: 58,
    hp: 1500,
    touchDamage: 26,
    score: 2500,
    xp: 60,
    body: '#5a3c7d',
    glow: '#e8a0ff',
    unlockWave: BOSS_WAVE,
    shoots: true,
    shootInterval: 1.9,
    isBoss: true,
  },
};

export const ELITE_MULTIPLIER = { hp: 2.6, speed: 0.92, score: 3, xp: 3, radius: 1.28 };

// Wave composition: how many of each kind spawn, before the trickle spawner
// spaces them out. Waves grow in count and mix; wave 10 (and every 5th wave
// after it) is a boss wave with escorts.
export function waveComposition(wave) {
  const list = [];
  const push = (type, count) => {
    for (let i = 0; i < count; i++) list.push(type);
  };
  if (wave % ENDLESS_BOSS_EVERY === 0 && wave >= BOSS_WAVE) {
    push('boss', 1);
    push('crawler', 4 + wave);
    push('floater', 2 + Math.floor(wave / 2));
    push('wisp', 2 + Math.floor(wave / 3));
    return list;
  }
  push('husk', 4 + wave);
  push('crawler', 3 + wave);
  if (wave >= 2) push('floater', 1 + Math.floor(wave / 2));
  if (wave >= 3) push('wisp', Math.floor(wave / 2) + 1);
  if (wave >= 4) push('brute', Math.floor((wave - 2) / 2));
  return list;
}

export function waveHpScale(wave) {
  return 1 + 0.13 * (wave - 1);
}

export function waveSpeedScale(wave) {
  return Math.min(1.35, 1 + 0.02 * (wave - 1));
}

export function spawnIntervalForWave(wave) {
  return Math.max(0.28, 0.85 - wave * 0.045);
}

export const PICKUP_TYPES = {
  heart: { label: 'Heart', color: '#ff6a7a', glyph: '♥' },
  shield: { label: 'Ward', color: '#7ad4ff', glyph: '◈' },
  star: { label: 'Nova Star', color: '#ffd97a', glyph: '✦' },
  magnet: { label: 'Lodestone', color: '#9a7be8', glyph: '◎' },
};

export const COMBO_WINDOW = 3.0;
export const COMBO_STEP = 8;

export function comboMultiplier(combo) {
  return Math.min(4, 1 + Math.floor(combo / COMBO_STEP) * 0.5);
}

export function xpForNextLevel(level) {
  return Math.round(PLAYER_BASE.xpNext * Math.pow(1.32, level - 1));
}
