// Foes of the garden: definitions, spawning, movement AI and drawing.
// Each kind reads differently at a glance: shape, colour and motion.

import { ARENA, ELITE_MULTIPLIER, ENEMY_TYPES, waveHpScale, waveSpeedScale } from './config.js';

let nextEnemyId = 1;

export function resetEnemyIds() {
  nextEnemyId = 1;
}

export function createEnemy(type, x, y, wave, rng, elite) {
  const def = ENEMY_TYPES[type];
  const hpScale = waveHpScale(wave) * (elite ? ELITE_MULTIPLIER.hp : 1);
  return {
    id: nextEnemyId++,
    type,
    def,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius * (elite ? ELITE_MULTIPLIER.radius : 1),
    speed: def.speed * waveSpeedScale(wave) * (elite ? ELITE_MULTIPLIER.speed : 1),
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    touchDamage: def.touchDamage,
    score: def.score * (elite ? ELITE_MULTIPLIER.score : 1),
    xp: def.xp * (elite ? ELITE_MULTIPLIER.xp : 1),
    elite: Boolean(elite),
    flash: 0,
    hitCooldown: 0,
    shootTimer: def.shootInterval ? def.shootInterval * rng.range(0.5, 1.2) : 0,
    weavePhase: rng.range(0, Math.PI * 2),
    chargeState: 'stalk',
    chargeTimer: rng.range(1.6, 2.8),
    chargeAngle: 0,
    knockX: 0,
    knockY: 0,
    wobble: rng.range(0, Math.PI * 2),
  };
}

export function edgeSpawnPoint(rng, player) {
  // Spawn on an arena edge, biased away from the player.
  for (let attempt = 0; attempt < 8; attempt++) {
    const side = rng.int(0, 3);
    let x = ARENA.left + 10;
    let y = ARENA.top + 10;
    if (side === 0) { x = rng.range(ARENA.left, ARENA.right); y = ARENA.top + 12; }
    if (side === 1) { x = rng.range(ARENA.left, ARENA.right); y = ARENA.bottom - 12; }
    if (side === 2) { x = ARENA.left + 12; y = rng.range(ARENA.top, ARENA.bottom); }
    if (side === 3) { x = ARENA.right - 12; y = rng.range(ARENA.top, ARENA.bottom); }
    if (Math.hypot(x - player.x, y - player.y) > 240) return { x, y };
  }
  return { x: ARENA.left + 12, y: ARENA.top + 12 };
}

export function updateEnemies(game, dt) {
  const player = game.player;
  const time = game.time;
  for (const enemy of game.enemies) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / dist;
    const ny = dy / dist;
    let moveX = nx;
    let moveY = ny;
    let speed = enemy.speed;

    if (enemy.def.weaves) {
      const side = Math.sin(time * 3.1 + enemy.weavePhase);
      moveX = nx - ny * side * 0.7;
      moveY = ny + nx * side * 0.7;
      const len = Math.max(1, Math.hypot(moveX, moveY));
      moveX /= len;
      moveY /= len;
    }

    if (enemy.def.keepDistance !== undefined) {
      if (dist < enemy.def.keepDistance - 60) {
        moveX = -nx;
        moveY = -ny;
      } else if (dist < enemy.def.keepDistance + 40) {
        moveX = -ny;
        moveY = nx;
      }
    }

    if (enemy.def.charges) {
      updateBruteCharge(enemy, dt, nx, ny, dist);
      if (enemy.chargeState === 'charging') {
        moveX = Math.cos(enemy.chargeAngle);
        moveY = Math.sin(enemy.chargeAngle);
        speed = enemy.speed * 4.4;
      } else if (enemy.chargeState === 'telegraph') {
        speed = 0;
      }
    }

    if (enemy.def.isBoss) {
      updateBoss(enemy, game, dt, nx, ny, dist);
      speed = enemy.speed * (enemy.hp < enemy.maxHp * 0.25 ? 1.45 : 1);
    } else if (enemy.def.shoots) {
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < 560) {
        enemy.shootTimer = enemy.def.shootInterval;
        game.spawnEnemyBullet(enemy.x, enemy.y, nx, ny, 190, 10, enemy.def.glow, 6);
        game.particles.burst(enemy.x, enemy.y, { count: 6, color: enemy.def.glow, speed: 70, size: 3, life: 0.3 });
      }
    }

    // Knockback decays and adds to the steering velocity.
    enemy.knockX *= Math.max(0, 1 - 6 * dt);
    enemy.knockY *= Math.max(0, 1 - 6 * dt);
    enemy.x += (moveX * speed + enemy.knockX) * dt;
    enemy.y += (moveY * speed + enemy.knockY) * dt;
    enemy.x = Math.min(ARENA.right - enemy.radius, Math.max(ARENA.left + enemy.radius, enemy.x));
    enemy.y = Math.min(ARENA.bottom - enemy.radius, Math.max(ARENA.top + enemy.radius, enemy.y));
  }
  separateEnemies(game.enemies);
}

function updateBruteCharge(enemy, dt, nx, ny, dist) {
  enemy.chargeTimer -= dt;
  if (enemy.chargeState === 'stalk' && enemy.chargeTimer <= 0 && dist > 90 && dist < 420) {
    enemy.chargeState = 'telegraph';
    enemy.chargeTimer = 0.55;
  } else if (enemy.chargeState === 'telegraph' && enemy.chargeTimer <= 0) {
    enemy.chargeState = 'charging';
    enemy.chargeAngle = Math.atan2(ny, nx);
    enemy.chargeTimer = 0.5;
  } else if (enemy.chargeState === 'charging' && enemy.chargeTimer <= 0) {
    enemy.chargeState = 'stalk';
    enemy.chargeTimer = 2.2;
  }
}

function updateBoss(enemy, game, dt, nx, ny, dist) {
  const hpFraction = enemy.hp / enemy.maxHp;
  enemy.shootTimer -= dt;
  if (enemy.shootTimer <= 0) {
    enemy.shootTimer = hpFraction < 0.5 ? 1.35 : 1.9;
    if (hpFraction < 0.5) {
      // Spiral burst in phase two.
      const base = game.time * 1.7;
      for (let i = 0; i < 10; i++) {
        const angle = base + (i / 10) * Math.PI * 2;
        game.spawnEnemyBullet(enemy.x, enemy.y, Math.cos(angle), Math.sin(angle), 150, 12, '#e8a0ff', 7);
      }
    } else {
      // Radial burst in phase one.
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + game.time * 0.4;
        game.spawnEnemyBullet(enemy.x, enemy.y, Math.cos(angle), Math.sin(angle), 140, 12, '#e8a0ff', 7);
      }
      game.spawnEnemyBullet(enemy.x, enemy.y, nx, ny, 230, 12, '#e8a0ff', 7);
    }
    game.particles.burst(enemy.x, enemy.y, { count: 14, color: '#e8a0ff', speed: 110, size: 4, life: 0.4 });
  }
  // Phase two: call wisps to the fight.
  if (hpFraction < 0.5 && game.enemies.length < 9 && game.rng.chance(dt * 0.5)) {
    const angle = game.rng.range(0, Math.PI * 2);
    const wisp = createEnemy('wisp', enemy.x + Math.cos(angle) * 70, enemy.y + Math.sin(angle) * 70, game.wave, game.rng, false);
    game.enemies.push(wisp);
  }
  void dist;
}

function separateEnemies(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius - 4;
      if (dist > 0.01 && dist < minDist) {
        const push = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

export function drawEnemy(ctx, enemy, time) {
  const def = enemy.def;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const wobble = Math.sin(time * 3 + enemy.wobble) * 0.08;

  // Glow halo.
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, enemy.radius * 2.1);
  glow.addColorStop(0, hexWithAlpha(def.glow, 0.35));
  glow.addColorStop(1, hexWithAlpha(def.glow, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(wobble);
  const bodyColor = enemy.flash > 0 ? '#ffffff' : def.body;
  if (enemy.type === 'husk') drawBeetle(ctx, enemy, bodyColor);
  else if (enemy.type === 'crawler') drawCrawler(ctx, enemy, bodyColor, time);
  else if (enemy.type === 'floater') drawFloater(ctx, enemy, bodyColor, time);
  else if (enemy.type === 'wisp') drawWisp(ctx, enemy, bodyColor, time);
  else if (enemy.type === 'brute') drawBrute(ctx, enemy, bodyColor);
  else if (enemy.type === 'boss') drawBoss(ctx, enemy, bodyColor, time);

  if (enemy.elite && enemy.type !== 'boss') {
    ctx.strokeStyle = '#ffd97a';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // Health bar for hurt or elite foes (boss uses the big bar instead).
  if (!enemy.def.isBoss && (enemy.hp < enemy.maxHp || enemy.elite)) {
    const width = enemy.radius * 2;
    const x = enemy.x - width / 2;
    const y = enemy.y - enemy.radius - 11;
    ctx.fillStyle = 'rgba(6, 18, 24, 0.7)';
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = enemy.elite ? '#ffd97a' : '#e86a9a';
    ctx.fillRect(x, y, width * Math.max(0, enemy.hp / enemy.maxHp), 4);
  }
}

function drawBeetle(ctx, enemy, bodyColor) {
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, enemy.radius, enemy.radius * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -enemy.radius * 0.8);
  ctx.lineTo(0, enemy.radius * 0.8);
  ctx.stroke();
  ctx.fillStyle = enemy.def.glow;
  ctx.beginPath();
  ctx.arc(-6, -4, 3, 0, Math.PI * 2);
  ctx.arc(6, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(side * enemy.radius * 0.6, i * 7);
      ctx.lineTo(side * (enemy.radius + 7), i * 10);
      ctx.stroke();
    }
  }
}

function drawCrawler(ctx, enemy, bodyColor, time) {
  const wiggle = Math.sin(time * 10 + enemy.wobble) * 2;
  ctx.fillStyle = bodyColor;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-10 + i * 10, i === 1 ? wiggle : -wiggle, 8 - i, 0, Math.PI * 2);
    ctx.fill();
  }
  // Thorns.
  ctx.fillStyle = enemy.def.glow;
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI / 2 + (i - 1.5) * 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
    ctx.lineTo(Math.cos(angle) * 14, Math.sin(angle) * 14);
    ctx.lineTo(Math.cos(angle + 0.25) * 6, Math.sin(angle + 0.25) * 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#fff6dd';
  ctx.beginPath();
  ctx.arc(8, -3, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawFloater(ctx, enemy, bodyColor, time) {
  const bob = Math.sin(time * 2.4 + enemy.wobble) * 3;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(0, bob, enemy.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexWithAlpha(enemy.def.glow, 0.5);
  ctx.beginPath();
  ctx.arc(-4, bob - 4, enemy.radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Spore dots.
  ctx.fillStyle = '#f6ecd4';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + time;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 9, bob + Math.sin(angle) * 9, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1a0f22';
  ctx.beginPath();
  ctx.arc(0, bob + 1, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawWisp(ctx, enemy, bodyColor, time) {
  const flicker = 0.85 + Math.sin(time * 9 + enemy.wobble) * 0.15;
  ctx.globalAlpha = flicker;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(0, -enemy.radius - 4);
  ctx.quadraticCurveTo(enemy.radius, -2, enemy.radius * 0.6, enemy.radius * 0.8);
  ctx.quadraticCurveTo(0, enemy.radius * 1.3, -enemy.radius * 0.6, enemy.radius * 0.8);
  ctx.quadraticCurveTo(-enemy.radius, -2, 0, -enemy.radius - 4);
  ctx.fill();
  ctx.fillStyle = enemy.def.glow;
  ctx.beginPath();
  ctx.arc(0, -2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBrute(ctx, enemy, bodyColor) {
  const telegraph = enemy.chargeState === 'telegraph';
  ctx.fillStyle = telegraph ? '#ff8a4e' : bodyColor;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
  ctx.fill();
  // Ember cracks.
  ctx.strokeStyle = enemy.def.glow;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 10);
  ctx.moveTo(10, -12);
  ctx.lineTo(4, -2);
  ctx.lineTo(12, 8);
  ctx.stroke();
  // Horns.
  ctx.fillStyle = '#f6ecd4';
  ctx.beginPath();
  ctx.moveTo(-enemy.radius + 4, -10);
  ctx.lineTo(-enemy.radius - 8, -22);
  ctx.lineTo(-enemy.radius + 12, -16);
  ctx.closePath();
  ctx.moveTo(enemy.radius - 4, -10);
  ctx.lineTo(enemy.radius + 8, -22);
  ctx.lineTo(enemy.radius - 12, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff6dd';
  ctx.beginPath();
  ctx.arc(-7, -4, 3, 0, Math.PI * 2);
  ctx.arc(7, -4, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoss(ctx, enemy, bodyColor, time) {
  const flap = Math.sin(time * 2.2) * 0.3;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.35 + flap * 0.2));
    ctx.fillStyle = 'rgba(90, 60, 125, 0.9)';
    ctx.beginPath();
    ctx.ellipse(side * 44, -6, 40, 20, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 160, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(side * 48, -8, 14, 7, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0f22';
  ctx.beginPath();
  ctx.arc(-9, -12, 6, 0, Math.PI * 2);
  ctx.arc(9, -12, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath();
  ctx.arc(-9, -12, 2.6, 0, Math.PI * 2);
  ctx.arc(9, -12, 2.6, 0, Math.PI * 2);
  ctx.fill();
  // Crown of hollow light.
  ctx.strokeStyle = enemy.def.glow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-16, -30);
  ctx.lineTo(-10, -44);
  ctx.lineTo(-4, -32);
  ctx.lineTo(0, -46);
  ctx.lineTo(4, -32);
  ctx.lineTo(10, -44);
  ctx.lineTo(16, -30);
  ctx.stroke();
}

export function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
