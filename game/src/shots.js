// Deterministic screenshot scenes. Each scene stages the real game state
// through the same update code the player runs, then freezes it so a
// screenshot tool can capture a fixed frame. Scenes: start, play, upgrade,
// victory. Nothing here changes normal play; main.js only calls it when the
// page URL carries ?shot=<scene>.

import { ARENA, GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { createEnemy } from './enemies.js';
import { createSeededRandom } from './random.js';

export function shotSceneFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot) return null;
    const seed = parseInt(params.get('seed') || '1', 10);
    return { scene: shot, seed: Number.isFinite(seed) ? seed : 1 };
  } catch (error) {
    return null;
  }
}

// A scripted stand-in for the player's input during staging: aim at the
// nearest foe, hold fire, strafe gently.
function scriptedInput(game, tick) {
  const player = game.player;
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of game.enemies) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }
  const pressed = new Set();
  if (tick === 20) pressed.add('Space');
  const strafe = Math.sin(tick * 0.06);
  return {
    mouseX: nearest ? nearest.x : player.x + 300,
    mouseY: nearest ? nearest.y : player.y,
    mouseDown: true,
    wasPressed: (code) => pressed.has(code),
    isDown: (code) => (code === 'KeyA' && strafe < -0.3) || (code === 'KeyD' && strafe > 0.3),
    moveAxis: () => ({ x: strafe > 0.3 ? 1 : strafe < -0.3 ? -1 : 0, y: 0 }),
    wantsFire: () => true,
    endFrame: () => {},
  };
}

function stageMidRun(game, seed) {
  game.newRun(1000 + seed);
  game.wave = 4;
  game.player.level = 5;
  game.player.xpNext = 40;
  game.player.xp = 18;
  game.player.damage = 20;
  game.player.projectiles = 2;
  game.player.pierce = 1;
  game.player.novaCharges = 2;
  game.player.novaMaxCharges = 3;
  game.player.hp = 78;
  game.player.x = 470;
  game.player.y = 400;
  game.score = 4350;
  game.kills = 61;
  game.combo = 11;
  game.comboTimer = 2.4;
  game.maxCombo = 14;
  game.runTime = 187;
  game.spawnQueue = [];
  game.enemies = [];
  const rng = createSeededRandom(77 + seed);
  const placements = [
    ['husk', 820, 300], ['husk', 900, 470], ['crawler', 760, 220],
    ['crawler', 950, 330], ['crawler', 700, 540], ['floater', 1010, 250],
    ['floater', 830, 560], ['wisp', 1080, 420], ['wisp', 690, 300],
    ['brute', 1000, 520],
  ];
  for (const [type, x, y] of placements) {
    const enemy = createEnemy(type, x, y, 4, rng, type === 'brute');
    if (type === 'husk') enemy.hp = Math.round(enemy.maxHp * 0.55);
    game.enemies.push(enemy);
  }
  game.gems = [
    { x: 560, y: 360, vx: 0, vy: 0, value: 3, magnetized: false },
    { x: 610, y: 430, vx: 0, vy: 0, value: 2, magnetized: false },
    { x: 520, y: 470, vx: 0, vy: 0, value: 4, magnetized: false },
    { x: 660, y: 330, vx: 0, vy: 0, value: 2, magnetized: false },
  ];
  game.pickups = [{ kind: 'heart', x: 380, y: 520, ttl: 12, phase: 1 }];
  game.showBanner('WAVE 4', '6 waves until the Hollow Moth', 2.2);
  // Run the real simulation for a short burst so bolts, particles and
  // enemy motion are all genuine.
  const realInput = game.input;
  for (let tick = 0; tick < 26; tick++) {
    game.input = scriptedInput(game, tick);
    game.update(1 / 60);
    if (game.screen !== 'playing') break;
  }
  game.input = realInput;
  game.banner = { title: 'WAVE 4', subtitle: '6 waves until the Hollow Moth', timer: 1.6, duration: 2.2 };
  game.combo = 11;
  game.comboTimer = 2.4;
}

export function stageShotScene(game, scene, seed) {
  if (scene === 'start') {
    game.screen = 'title';
    game.time = 2.4;
    game.player.x = GAME_WIDTH / 2;
    game.player.y = GAME_HEIGHT / 2 + 90;
    game.bestScore = 12840;
    const rng = createSeededRandom(31 + seed);
    game.enemies = [
      createEnemy('husk', 210, 520, 1, rng, false),
      createEnemy('crawler', 1060, 540, 1, rng, false),
      createEnemy('floater', 990, 220, 1, rng, false),
      createEnemy('wisp', 250, 260, 1, rng, false),
    ];
    return;
  }
  if (scene === 'play') {
    stageMidRun(game, seed);
    game.screen = 'playing';
    return;
  }
  if (scene === 'upgrade') {
    stageMidRun(game, seed);
    game.player.level = 6;
    game.pendingLevels = 1;
    game.openUpgradeScreen();
    return;
  }
  if (scene === 'victory') {
    stageMidRun(game, seed);
    game.wave = 10;
    game.score = 24860;
    game.kills = 214;
    game.player.level = 12;
    game.runTime = 612;
    game.maxCombo = 31;
    game.bestScore = 18730;
    game.saveBestIfNeeded();
    game.victoryStats = game.finishRunStats();
    game.screen = 'victory';
    game.particles.burst(GAME_WIDTH / 2, 300, {
      count: 70, colors: ['#ffd97a', '#57c7a8', '#e86a9a', '#f6ecd4'], speed: 300, size: 5, life: 1,
    });
    return;
  }
  if (scene === 'defeat') {
    stageMidRun(game, seed);
    game.player.hp = 0;
    game.wave = 7;
    game.score = 11240;
    game.kills = 132;
    game.runTime = 402;
    game.maxCombo = 19;
    game.defeatStats = game.finishRunStats();
    game.screen = 'defeat';
    return;
  }
  // Unknown scene: fall back to the title.
  game.screen = 'title';
}

export function markShotReady() {
  window.__shotReady = true;
}

export function arenaCenter() {
  return { x: (ARENA.left + ARENA.right) / 2, y: (ARENA.top + ARENA.bottom) / 2 };
}
