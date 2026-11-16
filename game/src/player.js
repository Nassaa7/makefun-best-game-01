// Luma, the lanternkeeper: movement, dash, aiming and firing.
// Drawing lives here too, so the hero's look stays in one file.

import { ARENA, PLAYER_BASE } from './config.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius: PLAYER_BASE.radius,
    speed: PLAYER_BASE.speed,
    hp: PLAYER_BASE.maxHp,
    maxHp: PLAYER_BASE.maxHp,
    damage: PLAYER_BASE.damage,
    fireInterval: PLAYER_BASE.fireInterval,
    projectiles: PLAYER_BASE.projectiles,
    pierce: PLAYER_BASE.pierce,
    bulletSpeed: PLAYER_BASE.bulletSpeed,
    bulletRadius: PLAYER_BASE.bulletRadius,
    critChance: PLAYER_BASE.critChance,
    critMultiplier: PLAYER_BASE.critMultiplier,
    magnetRadius: PLAYER_BASE.magnetRadius,
    dashSpeed: PLAYER_BASE.dashSpeed,
    dashTime: PLAYER_BASE.dashTime,
    dashCooldown: PLAYER_BASE.dashCooldown,
    novaRadius: PLAYER_BASE.novaRadius,
    novaDamage: PLAYER_BASE.novaDamage,
    novaCharges: PLAYER_BASE.novaCharges,
    novaMaxCharges: PLAYER_BASE.novaMaxCharges,
    lifesteal: PLAYER_BASE.lifesteal,
    thornRadius: PLAYER_BASE.thornRadius,
    thornDamage: PLAYER_BASE.thornDamage,
    aimAngle: -Math.PI / 6,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldownLeft: 0,
    dashAngle: 0,
    invulnerableLeft: 0,
    shieldLeft: 0,
    wardEachWave: false,
    thornTimer: 0,
    wingPhase: 0,
    level: 1,
    xp: 0,
    xpNext: PLAYER_BASE.xpNext,
    upgradeStacks: {},
    facing: 1,
    moving: false,
  };
}

export function healPlayer(player, amount) {
  player.hp = Math.min(player.maxHp, player.hp + amount);
}

export function updatePlayer(player, input, dt, game) {
  player.wingPhase += dt * (player.moving ? 14 : 7);
  player.fireTimer = Math.max(0, player.fireTimer - dt);
  player.dashCooldownLeft = Math.max(0, player.dashCooldownLeft - dt);
  player.invulnerableLeft = Math.max(0, player.invulnerableLeft - dt);
  player.shieldLeft = Math.max(0, player.shieldLeft - dt);

  const aimDx = input.mouseX - player.x;
  const aimDy = input.mouseY - player.y;
  if (Math.hypot(aimDx, aimDy) > 4) {
    player.aimAngle = Math.atan2(aimDy, aimDx);
  }
  player.facing = Math.cos(player.aimAngle) >= 0 ? 1 : -1;

  const axis = input.moveAxis();
  player.moving = axis.x !== 0 || axis.y !== 0;

  // Dash: a short burst along the movement direction (or aim if standing
  // still), with brief invulnerability.
  if ((input.wasPressed('Space') || input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight'))
    && player.dashCooldownLeft <= 0 && player.dashTimer <= 0) {
    const angle = player.moving ? Math.atan2(axis.y, axis.x) : player.aimAngle;
    player.dashAngle = angle;
    player.dashTimer = player.dashTime;
    player.dashCooldownLeft = player.dashCooldown;
    player.invulnerableLeft = Math.max(player.invulnerableLeft, player.dashTime + 0.05);
    game.sound.play('dash');
    game.particles.burst(player.x, player.y, {
      count: 10, color: '#ffd97a', speed: 120, size: 4, life: 0.3,
    });
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = Math.cos(player.dashAngle) * player.dashSpeed;
    player.vy = Math.sin(player.dashAngle) * player.dashSpeed;
    game.particles.trail(player.x, player.y, '#ffd97a', 6);
  } else {
    const targetVx = axis.x * player.speed;
    const targetVy = axis.y * player.speed;
    const blend = Math.min(1, dt * 14);
    player.vx += (targetVx - player.vx) * blend;
    player.vy += (targetVy - player.vy) * blend;
  }

  player.x = Math.min(ARENA.right - player.radius, Math.max(ARENA.left + player.radius, player.x + player.vx * dt));
  player.y = Math.min(ARENA.bottom - player.radius, Math.max(ARENA.top + player.radius, player.y + player.vy * dt));

  // Firing: hold mouse (or F, or auto-fire) to loose bolts toward the aim.
  if (input.wantsFire(game.settings.autoFire) && player.fireTimer <= 0) {
    fireBolts(player, game);
    player.fireTimer = player.fireInterval;
  }

  // Nova: E spends a charge and clears space around the player.
  if (input.wasPressed('KeyE') && player.novaCharges > 0) {
    game.fireNova();
  }

  // Thorn aura ticks twice a second while anything is in range.
  if (player.thornRadius > 0) {
    player.thornTimer -= dt;
    if (player.thornTimer <= 0) {
      player.thornTimer = 0.5;
      game.applyThornAura();
    }
  }
}

export function fireBolts(player, game) {
  const count = player.projectiles;
  const spreadStep = 0.13;
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spreadStep;
    const angle = player.aimAngle + offset;
    const isCrit = game.rng.next() < player.critChance;
    game.bullets.push({
      x: player.x + Math.cos(angle) * 22,
      y: player.y + Math.sin(angle) * 22,
      vx: Math.cos(angle) * player.bulletSpeed,
      vy: Math.sin(angle) * player.bulletSpeed,
      radius: player.bulletRadius,
      damage: player.damage * (isCrit ? player.critMultiplier : 1),
      pierceLeft: player.pierce,
      crit: isCrit,
      life: 1.1,
      hitIds: new Set(),
    });
  }
  game.sound.play('shoot');
  game.particles.trail(
    player.x + Math.cos(player.aimAngle) * 24,
    player.y + Math.sin(player.aimAngle) * 24,
    '#ffd97a',
    4,
  );
}

export function drawPlayer(ctx, player, time) {
  const blink = player.invulnerableLeft > 0 && Math.floor(time * 18) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (blink) ctx.globalAlpha = 0.55;

  // Lantern glow.
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 64);
  glow.addColorStop(0, 'rgba(255, 217, 122, 0.5)');
  glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, Math.PI * 2);
  ctx.fill();

  // Thorn aura ring.
  if (player.thornRadius > 0) {
    ctx.strokeStyle = 'rgba(143, 212, 90, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -time * 30;
    ctx.beginPath();
    ctx.arc(0, 0, player.thornRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Wings: two flapping ellipses.
  const flap = Math.sin(player.wingPhase) * 0.55;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.5 + flap * 0.35));
    ctx.fillStyle = side === 1 ? '#e8d8b0' : '#d8c49a';
    ctx.beginPath();
    ctx.ellipse(side * 15, -4, 17, 9, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(242, 178, 62, 0.55)';
    ctx.beginPath();
    ctx.ellipse(side * 17, -5, 6, 3.5, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Body.
  ctx.fillStyle = '#3a2b3f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6ecd4';
  ctx.beginPath();
  ctx.arc(2 * player.facing, -12, 7, 0, Math.PI * 2);
  ctx.fill();
  // Antennae.
  ctx.strokeStyle = '#f6ecd4';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, -17);
  ctx.quadraticCurveTo(-9, -26, -13, -27);
  ctx.moveTo(5, -17);
  ctx.quadraticCurveTo(11, -26, 15, -27);
  ctx.stroke();

  // Lantern held toward the aim.
  const lanternX = Math.cos(player.aimAngle) * 21;
  const lanternY = Math.sin(player.aimAngle) * 21;
  ctx.strokeStyle = '#8a6a3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(lanternX, lanternY);
  ctx.stroke();
  ctx.fillStyle = '#ffd97a';
  ctx.beginPath();
  ctx.arc(lanternX, lanternY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6dd';
  ctx.beginPath();
  ctx.arc(lanternX, lanternY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Shield bubble.
  if (player.shieldLeft > 0) {
    ctx.strokeStyle = 'rgba(122, 212, 255, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
