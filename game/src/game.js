// EmberwildGame: the run state machine, waves, combat resolution, scoring
// and pickups. Rendering lives in render.js; hero and foe behaviour in
// player.js and enemies.js.

import {
  ARENA, BOSS_WAVE, COMBO_STEP, COMBO_WINDOW, ENDLESS_BOSS_EVERY,
  GAME_HEIGHT, GAME_WIDTH, PICKUP_TYPES, comboMultiplier, spawnIntervalForWave,
  waveComposition, xpForNextLevel,
} from './config.js';
import { createSeededRandom } from './random.js';
import { createEnemy, edgeSpawnPoint, resetEnemyIds, updateEnemies } from './enemies.js';
import { createPlayer, healPlayer, updatePlayer } from './player.js';
import { applyUpgrade, rollUpgradeChoices } from './upgrades.js';
import { loadBestScore, saveBestScore } from './storage.js';

export class EmberwildGame {
  constructor(input, sound, particles, floaters, settings) {
    this.input = input;
    this.sound = sound;
    this.particles = particles;
    this.floaters = floaters;
    this.settings = settings;
    this.rng = createSeededRandom((Date.now() % 2147483647) + 1);
    this.screen = 'title';
    this.bestScore = loadBestScore();
    this.time = 0;
    this.player = createPlayer(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.gems = [];
    this.pickups = [];
    this.score = 0;
    this.kills = 0;
    this.maxCombo = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 0;
    this.runTime = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.intermissionTimer = 0;
    this.pendingLevels = 0;
    this.upgradeChoices = [];
    this.endless = false;
    this.banner = null;
    this.shakeTime = 0;
    this.shakeDuration = 1;
    this.shakeMagnitude = 0;
    this.gemSoundTimer = 0;
    this.victoryStats = null;
    this.defeatStats = null;
  }

  newRun(seed) {
    this.rng = createSeededRandom(seed);
    resetEnemyIds();
    this.player = createPlayer(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.gems = [];
    this.pickups = [];
    this.particles.clear();
    this.floaters.clear();
    this.score = 0;
    this.kills = 0;
    this.maxCombo = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 0;
    this.runTime = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.intermissionTimer = 0;
    this.pendingLevels = 0;
    this.upgradeChoices = [];
    this.endless = false;
    this.banner = null;
    this.shakeTime = 0;
    this.victoryStats = null;
    this.defeatStats = null;
    this.screen = 'playing';
    this.startNextWave();
  }

  startNextWave() {
    this.wave += 1;
    this.spawnQueue = this.rng.shuffle(waveComposition(this.wave));
    this.spawnTimer = 0.4;
    this.intermissionTimer = 0;
    if (this.player.wardEachWave) {
      this.player.shieldLeft = 20;
    }
    const isBossWave = this.wave % ENDLESS_BOSS_EVERY === 0 && this.wave >= BOSS_WAVE;
    if (isBossWave) {
      this.showBanner(`WAVE ${this.wave}`, 'The Hollow Moth stirs in the dark…', 2.6);
      this.sound.play('boss');
    } else if (this.wave === 1) {
      this.showBanner('WAVE 1', 'Defend the garden. Survive to wave 10.', 2.6);
      this.sound.play('wave');
    } else {
      this.showBanner(`WAVE ${this.wave}`, this.wave < BOSS_WAVE ? `${BOSS_WAVE - this.wave} waves until the Hollow Moth` : 'The gloom deepens…', 2.2);
      this.sound.play('wave');
    }
  }

  showBanner(title, subtitle, duration) {
    this.banner = { title, subtitle, timer: duration, duration };
  }

  addShake(magnitude, duration) {
    if (!this.settings.screenShake) return;
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
  }

  shakeOffset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const strength = this.shakeMagnitude * (this.shakeTime / this.shakeDuration);
    return {
      x: (Math.random() * 2 - 1) * strength,
      y: (Math.random() * 2 - 1) * strength,
    };
  }

  bossEnemy() {
    return this.enemies.find((enemy) => enemy.def.isBoss) || null;
  }

  pause() {
    if (this.screen !== 'playing') return;
    this.screen = 'paused';
  }

  resume() {
    if (this.screen !== 'paused') return;
    this.screen = 'playing';
  }

  toTitle() {
    this.screen = 'title';
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.gems = [];
    this.pickups = [];
  }

  update(dt) {
    if (this.screen !== 'playing') return;
    this.time += dt;
    this.runTime += dt;
    this.gemSoundTimer = Math.max(0, this.gemSoundTimer - dt);
    if (this.banner) {
      this.banner.timer -= dt;
      if (this.banner.timer <= 0) this.banner = null;
    }
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeMagnitude = 0;
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    updatePlayer(this.player, this.input, dt, this);
    updateEnemies(this, dt);
    this.updateSpawning(dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updateGems(dt);
    this.updatePickups(dt);
    this.checkContactDamage();

    if (this.pendingLevels > 0 && this.screen === 'playing') {
      this.openUpgradeScreen();
    }

    if (this.screen === 'playing' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.intermissionTimer += dt;
      if (this.intermissionTimer >= 2.4) this.startNextWave();
    } else {
      this.intermissionTimer = 0;
    }
  }

  updateSpawning(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = spawnIntervalForWave(this.wave);
    const type = this.spawnQueue.shift();
    const point = edgeSpawnPoint(this.rng, this.player);
    const elite = type !== 'boss' && this.wave >= 4 && this.rng.chance(0.09);
    const enemy = createEnemy(type, point.x, point.y, this.wave, this.rng, elite);
    this.enemies.push(enemy);
    this.particles.burst(point.x, point.y, { count: 8, color: enemy.def.glow, speed: 80, size: 3, life: 0.4 });
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      let dead = bullet.life <= 0
        || bullet.x < ARENA.left - 20 || bullet.x > ARENA.right + 20
        || bullet.y < ARENA.top - 20 || bullet.y > ARENA.bottom + 20;
      if (!dead) {
        for (const enemy of this.enemies) {
          if (bullet.hitIds.has(enemy.id)) continue;
          const dx = enemy.x - bullet.x;
          const dy = enemy.y - bullet.y;
          if (Math.hypot(dx, dy) < enemy.radius + bullet.radius) {
            bullet.hitIds.add(enemy.id);
            const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
            this.damageEnemy(enemy, bullet.damage, bullet.crit, bullet.vx / speed, bullet.vy / speed);
            this.sound.play('hit');
            if (bullet.pierceLeft > 0) {
              bullet.pierceLeft -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  updateEnemyBullets(dt) {
    const player = this.player;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = this.enemyBullets[i];
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      let dead = bullet.life <= 0
        || bullet.x < ARENA.left - 30 || bullet.x > ARENA.right + 30
        || bullet.y < ARENA.top - 30 || bullet.y > ARENA.bottom + 30;
      if (!dead && Math.hypot(player.x - bullet.x, player.y - bullet.y) < player.radius + bullet.radius) {
        this.damagePlayer(bullet.damage, bullet.x, bullet.y);
        dead = true;
      }
      if (dead) this.enemyBullets.splice(i, 1);
    }
  }

  updateGems(dt) {
    const player = this.player;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const magnetRange = gem.magnetized ? 10000 : player.magnetRadius;
      if (dist < magnetRange) {
        const pull = gem.magnetized ? 720 : 430;
        gem.vx += (dx / dist) * pull * dt * 4;
        gem.vy += (dy / dist) * pull * dt * 4;
      }
      gem.vx *= Math.max(0, 1 - 3 * dt);
      gem.vy *= Math.max(0, 1 - 3 * dt);
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      if (dist < player.radius + 10) {
        this.addXp(gem.value);
        if (this.gemSoundTimer <= 0) {
          this.sound.play('gem');
          this.gemSoundTimer = 0.06;
        }
        this.particles.burst(gem.x, gem.y, { count: 4, color: '#57c7a8', speed: 60, size: 3, life: 0.25 });
        this.gems.splice(i, 1);
      }
    }
  }

  updatePickups(dt) {
    const player = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.ttl -= dt;
      pickup.phase += dt * 3;
      if (pickup.ttl <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (Math.hypot(player.x - pickup.x, player.y - pickup.y) < player.radius + 16) {
        this.collectPickup(pickup);
        this.pickups.splice(i, 1);
      }
    }
  }

  checkContactDamage() {
    const player = this.player;
    for (const enemy of this.enemies) {
      if (enemy.hitCooldown > 0) continue;
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist < player.radius + enemy.radius - 2) {
        enemy.hitCooldown = 0.7;
        this.damagePlayer(enemy.touchDamage, enemy.x, enemy.y);
        enemy.knockX -= ((player.x - enemy.x) / Math.max(1, dist)) * 160;
        enemy.knockY -= ((player.y - enemy.y) / Math.max(1, dist)) * 160;
      }
    }
  }

  spawnEnemyBullet(x, y, dx, dy, speed, damage, color, radius) {
    this.enemyBullets.push({
      x, y,
      vx: dx * speed,
      vy: dy * speed,
      radius,
      damage,
      color,
      life: 4,
    });
  }

  damageEnemy(enemy, amount, isCrit, knockX, knockY) {
    if (enemy.hp <= 0) return;
    enemy.hp -= amount;
    enemy.flash = 0.09;
    enemy.knockX += (knockX || 0) * 130;
    enemy.knockY += (knockY || 0) * 130;
    this.floaters.add(enemy.x, enemy.y - enemy.radius, Math.round(amount), isCrit ? '#ffd97a' : '#f6ecd4', isCrit ? 22 : 16);
    this.particles.burst(enemy.x, enemy.y, { count: isCrit ? 8 : 4, color: enemy.def.glow, speed: 130, size: 3, life: 0.3 });
    if (this.player.lifesteal > 0) {
      healPlayer(this.player, amount * this.player.lifesteal);
    }
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index !== -1) this.enemies.splice(index, 1);
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = COMBO_WINDOW;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const gained = Math.round(enemy.score * comboMultiplier(this.combo));
    this.score += gained;
    this.floaters.add(enemy.x, enemy.y - enemy.radius - 12, `+${gained}`, '#f2b23e', 18);
    this.particles.burst(enemy.x, enemy.y, {
      count: enemy.def.isBoss ? 60 : enemy.elite ? 26 : 14,
      colors: [enemy.def.glow, '#f6ecd4', enemy.def.body],
      speed: enemy.def.isBoss ? 320 : 210,
      size: enemy.def.isBoss ? 6 : 4,
      life: 0.6,
    });
    this.particles.ring(enemy.x, enemy.y, enemy.def.glow, enemy.def.isBoss ? 220 : 70, 0.45);
    this.sound.play('die');
    if (enemy.def.isBoss) this.addShake(16, 0.5);
    else if (enemy.elite) this.addShake(6, 0.25);

    // Experience shards scatter from the fallen foe.
    const shards = Math.max(1, Math.min(6, Math.ceil(enemy.xp / 2)));
    for (let i = 0; i < shards; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(40, 150);
      this.gems.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        value: Math.max(1, Math.round(enemy.xp / shards)),
        magnetized: false,
      });
    }
    if (this.gems.length > 220) {
      const overflow = this.gems.splice(0, this.gems.length - 220);
      this.addXp(overflow.reduce((sum, gem) => sum + gem.value, 0));
    }

    // Pickups: elites and the boss always drop one; others sometimes do.
    if (enemy.def.isBoss || enemy.elite || this.rng.chance(0.07)) {
      const kinds = Object.keys(PICKUP_TYPES);
      const kind = enemy.def.isBoss ? 'heart' : this.rng.pick(kinds);
      this.pickups.push({ kind, x: enemy.x, y: enemy.y, ttl: 14, phase: 0 });
    }

    if (enemy.def.isBoss) {
      if (!this.endless && this.wave === BOSS_WAVE) {
        this.winRun();
      } else {
        this.showBanner('BOSS FELLED', `+${gained} — the garden breathes again`, 2.4);
      }
    }
  }

  damagePlayer(amount, fromX, fromY) {
    const player = this.player;
    if (this.screen !== 'playing' || player.invulnerableLeft > 0 || player.hp <= 0) return;
    if (player.shieldLeft > 0) {
      player.shieldLeft = 0;
      player.invulnerableLeft = 0.6;
      this.sound.play('shield');
      this.particles.ring(player.x, player.y, '#7ad4ff', 70, 0.4);
      this.floaters.add(player.x, player.y - 26, 'WARDED!', '#7ad4ff', 18);
      return;
    }
    player.hp -= amount;
    player.invulnerableLeft = 0.55;
    this.combo = 0;
    this.comboTimer = 0;
    this.sound.play('hurt');
    this.addShake(9, 0.3);
    this.particles.burst(player.x, player.y, { count: 16, color: '#ff5a4e', speed: 200, size: 4, life: 0.5 });
    this.floaters.add(player.x, player.y - 26, `-${Math.round(amount)}`, '#ff5a4e', 20);
    if (player.hp <= 0) {
      player.hp = 0;
      this.loseRun();
    }
    void fromX;
    void fromY;
  }

  fireNova() {
    const player = this.player;
    if (player.novaCharges <= 0) return;
    player.novaCharges -= 1;
    this.sound.play('nova');
    this.addShake(12, 0.4);
    this.particles.ring(player.x, player.y, '#ffd97a', player.novaRadius, 0.5);
    this.particles.burst(player.x, player.y, { count: 40, colors: ['#ffd97a', '#ff7a3c', '#f6ecd4'], speed: 380, size: 5, life: 0.55 });
    for (const enemy of this.enemies.slice()) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      if (dist < player.novaRadius + enemy.radius) {
        this.damageEnemy(enemy, player.novaDamage, false, dx / dist, dy / dist);
      }
    }
  }

  applyThornAura() {
    const player = this.player;
    for (const enemy of this.enemies.slice()) {
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < player.thornRadius + enemy.radius) {
        this.damageEnemy(enemy, player.thornDamage, false, 0, 0);
      }
    }
  }

  addXp(amount) {
    const player = this.player;
    player.xp += amount;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.level += 1;
      player.xpNext = xpForNextLevel(player.level);
      this.pendingLevels += 1;
    }
  }

  openUpgradeScreen() {
    this.upgradeChoices = rollUpgradeChoices(this.rng, this.player, 3);
    if (this.upgradeChoices.length === 0) {
      this.pendingLevels = 0;
      return;
    }
    this.screen = 'upgrade';
    this.sound.play('levelup');
    this.particles.ring(this.player.x, this.player.y, '#ffd97a', 90, 0.5);
  }

  chooseUpgrade(index) {
    const upgrade = this.upgradeChoices[index];
    if (!upgrade || this.screen !== 'upgrade') return;
    applyUpgrade(upgrade, this.player);
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    this.sound.play('pickup');
    this.floaters.add(this.player.x, this.player.y - 30, upgrade.name, '#ffd97a', 20);
    if (this.pendingLevels > 0) {
      this.upgradeChoices = rollUpgradeChoices(this.rng, this.player, 3);
      if (this.upgradeChoices.length === 0) {
        this.pendingLevels = 0;
        this.screen = 'playing';
      }
    } else {
      this.screen = 'playing';
    }
  }

  collectPickup(pickup) {
    const player = this.player;
    const label = PICKUP_TYPES[pickup.kind].label;
    if (pickup.kind === 'heart') {
      healPlayer(player, 30);
      this.floaters.add(player.x, player.y - 26, '+30 HP', '#ff6a7a', 19);
    } else if (pickup.kind === 'shield') {
      player.shieldLeft = 20;
      this.floaters.add(player.x, player.y - 26, 'WARD UP', '#7ad4ff', 19);
    } else if (pickup.kind === 'star') {
      player.novaCharges = Math.min(player.novaMaxCharges, player.novaCharges + 1);
      this.floaters.add(player.x, player.y - 26, '+1 NOVA', '#ffd97a', 19);
    } else if (pickup.kind === 'magnet') {
      for (const gem of this.gems) gem.magnetized = true;
      this.floaters.add(player.x, player.y - 26, 'SHARDS CALL', '#9a7be8', 19);
    }
    this.sound.play('pickup');
    this.particles.burst(pickup.x, pickup.y, { count: 12, color: PICKUP_TYPES[pickup.kind].color, speed: 140, size: 4, life: 0.4 });
    void label;
  }

  finishRunStats() {
    return {
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      level: this.player.level,
      time: this.runTime,
      maxCombo: this.maxCombo,
      best: Math.max(this.bestScore, this.score),
      isNewBest: this.score > this.bestScore,
    };
  }

  saveBestIfNeeded() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      saveBestScore(this.score);
    }
  }

  winRun() {
    this.saveBestIfNeeded();
    this.victoryStats = this.finishRunStats();
    this.screen = 'victory';
    this.sound.play('victory');
    this.particles.burst(GAME_WIDTH / 2, GAME_HEIGHT / 2, { count: 90, colors: ['#ffd97a', '#57c7a8', '#e86a9a', '#f6ecd4'], speed: 360, size: 5, life: 1.1 });
  }

  loseRun() {
    this.saveBestIfNeeded();
    this.defeatStats = this.finishRunStats();
    this.screen = 'defeat';
    this.sound.play('defeat');
    this.particles.burst(this.player.x, this.player.y, { count: 50, colors: ['#ff5a4e', '#f2b23e', '#f6ecd4'], speed: 300, size: 5, life: 0.9 });
  }

  continueEndless() {
    if (this.screen !== 'victory') return;
    this.endless = true;
    this.screen = 'playing';
    healPlayer(this.player, 50);
    this.player.novaCharges = this.player.novaMaxCharges;
    this.showBanner('ENDLESS NIGHT', 'The gloom returns, stronger than before…', 2.6);
    this.startNextWave();
  }

  get enemiesRemaining() {
    return this.enemies.length + this.spawnQueue.length;
  }
}
