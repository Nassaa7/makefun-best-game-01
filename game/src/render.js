// Drawing: the frame, the HUD, the wave banner, the boss bar, and the DOM
// screens (title, pause, upgrade choice, victory/defeat) kept in sync with
// the game state.

import { ARENA, COMBO_STEP, GAME_HEIGHT, GAME_WIDTH, PALETTE, PICKUP_TYPES, comboMultiplier } from './config.js';
import { drawGarden, drawArenaBorder } from './world.js';
import { drawPlayer } from './player.js';
import { drawEnemy } from './enemies.js';

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";

let lastScreenSignature = '';
let lastUpgradeSignature = '';
let lastEndSignature = '';
let lastBestShown = -1;

export function drawFrame(ctx, game, garden) {
  const shake = game.shakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawGarden(ctx, garden, game.time);
  drawGems(ctx, game);
  drawPickups(ctx, game);
  const sortedEnemies = game.enemies.slice().sort((a, b) => a.y - b.y);
  for (const enemy of sortedEnemies) drawEnemy(ctx, enemy, game.time);
  drawBullets(ctx, game);
  drawEnemyBullets(ctx, game);
  if (game.screen !== 'defeat') drawPlayer(ctx, game.player, game.time);
  game.particles.draw(ctx);
  game.floaters.draw(ctx);
  drawArenaBorder(ctx, game.time);
  ctx.restore();

  drawVignette(ctx, game);
  if (game.screen === 'playing' || game.screen === 'paused' || game.screen === 'upgrade') {
    drawHud(ctx, game);
  }
  drawWaveBanner(ctx, game);
  if (game.screen === 'playing') drawAimReticle(ctx, game);
}

function drawGems(ctx, game) {
  ctx.save();
  for (const gem of game.gems) {
    const pulse = 1 + Math.sin(game.time * 6 + gem.x) * 0.15;
    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#57c7a8';
    const size = 5.5 * pulse;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.fillStyle = '#d8ffe9';
    ctx.fillRect(-size / 4, -size / 4, size / 2, size / 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawPickups(ctx, game) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const pickup of game.pickups) {
    const def = PICKUP_TYPES[pickup.kind];
    const bob = Math.sin(pickup.phase) * 3;
    const blink = pickup.ttl < 3 && Math.floor(game.time * 6) % 2 === 0;
    if (blink) continue;
    const glow = ctx.createRadialGradient(pickup.x, pickup.y + bob, 2, pickup.x, pickup.y + bob, 26);
    glow.addColorStop(0, def.color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y + bob, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#101c26';
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y + bob, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.font = `700 17px ${SERIF}`;
    ctx.fillText(def.glyph, pickup.x, pickup.y + bob + 1);
  }
  ctx.restore();
}

function drawBullets(ctx, game) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of game.bullets) {
    const glow = ctx.createRadialGradient(bullet.x, bullet.y, 1, bullet.x, bullet.y, bullet.radius * 2.6);
    glow.addColorStop(0, bullet.crit ? 'rgba(255, 217, 122, 0.95)' : 'rgba(255, 190, 90, 0.9)');
    glow.addColorStop(1, 'rgba(255, 122, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemyBullets(ctx, game) {
  ctx.save();
  for (const bullet of game.enemyBullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 8, 26, 0.8)';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx, game) {
  const gradient = ctx.createRadialGradient(
    GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.42,
    GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.85,
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(2, 8, 12, 0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const player = game.player;
  if (game.screen === 'playing' && player.hp > 0 && player.hp / player.maxHp < 0.3) {
    const pulse = 0.22 + Math.sin(game.time * 5) * 0.1;
    const red = ctx.createRadialGradient(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.3,
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.75,
    );
    red.addColorStop(0, 'rgba(255, 60, 50, 0)');
    red.addColorStop(1, `rgba(255, 60, 50, ${pulse})`);
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}

function drawHud(ctx, game) {
  const player = game.player;
  ctx.save();
  // Top bar.
  ctx.fillStyle = 'rgba(6, 16, 22, 0.72)';
  ctx.fillRect(0, 0, GAME_WIDTH, 66);
  ctx.fillStyle = 'rgba(242, 178, 62, 0.5)';
  ctx.fillRect(0, 66, GAME_WIDTH, 2);

  // Health.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 12px ${SANS}`;
  ctx.fillStyle = PALETTE.slate;
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 22, 22);
  drawBar(ctx, 22, 28, 220, 14, player.hp / player.maxHp, '#e86a9a', 'rgba(255,255,255,0.12)');
  ctx.font = `700 13px ${SANS}`;
  ctx.fillStyle = PALETTE.cream;
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 250, 41);
  if (player.shieldLeft > 0) {
    ctx.fillStyle = '#7ad4ff';
    ctx.fillText('◈ WARD', 330, 41);
  }

  // Experience and level.
  ctx.fillStyle = PALETTE.slate;
  ctx.font = `700 12px ${SANS}`;
  ctx.fillText(`LEVEL ${player.level}`, 22, 60);
  drawBar(ctx, 86, 50, 156, 8, player.xp / player.xpNext, '#57c7a8', 'rgba(255,255,255,0.12)');

  // Wave and foes.
  ctx.textAlign = 'center';
  ctx.font = `700 26px ${SERIF}`;
  ctx.fillStyle = PALETTE.cream;
  ctx.fillText(`WAVE ${game.wave}`, GAME_WIDTH / 2, 32);
  ctx.font = `400 13px ${SANS}`;
  ctx.fillStyle = PALETTE.slate;
  const remaining = game.enemiesRemaining;
  ctx.fillText(remaining > 0 ? `${remaining} foes remain` : 'Wave cleared!', GAME_WIDTH / 2, 52);

  // Boss bar: a dark-backed strip just inside the arena's top edge.
  const boss = game.bossEnemy();
  if (boss) {
    const width = 420;
    const x = GAME_WIDTH / 2 - width / 2;
    ctx.fillStyle = 'rgba(6, 16, 22, 0.72)';
    ctx.fillRect(x - 14, 92, width + 28, 30);
    ctx.textAlign = 'center';
    ctx.font = `700 12px ${SANS}`;
    ctx.fillStyle = '#e8a0ff';
    ctx.fillText('THE HOLLOW MOTH', GAME_WIDTH / 2, 105);
    drawBar(ctx, x, 109, width, 8, boss.hp / boss.maxHp, '#9a7be8', 'rgba(255,255,255,0.15)');
  }

  // Score, best, combo, time.
  ctx.textAlign = 'right';
  ctx.font = `700 24px ${SERIF}`;
  ctx.fillStyle = PALETTE.amberBright;
  ctx.fillText(`${game.score.toLocaleString('en-US')}`, GAME_WIDTH - 22, 29);
  ctx.font = `400 12px ${SANS}`;
  ctx.fillStyle = PALETTE.slate;
  ctx.fillText(`BEST ${Math.max(game.bestScore, game.score).toLocaleString('en-US')}  ·  ${formatTime(game.runTime)}`, GAME_WIDTH - 22, 46);
  if (game.combo >= 4) {
    ctx.textAlign = 'right';
    ctx.font = `700 13px ${SERIF}`;
    ctx.fillStyle = game.combo >= COMBO_STEP ? '#ff7a3c' : PALETTE.cream;
    ctx.fillText(`COMBO ×${comboMultiplier(game.combo).toFixed(1)}  (${game.combo})`, GAME_WIDTH - 22, 63);
  }

  // Dash and nova pips, bottom right.
  const dashReady = player.dashCooldownLeft <= 0;
  ctx.textAlign = 'right';
  ctx.font = `700 13px ${SANS}`;
  ctx.fillStyle = dashReady ? PALETTE.cream : PALETTE.slate;
  ctx.fillText(dashReady ? 'DASH READY  [SPACE]' : `DASH ${player.dashCooldownLeft.toFixed(1)}s`, GAME_WIDTH - 22, GAME_HEIGHT - 44);
  ctx.fillStyle = '#ffd97a';
  let novaText = '';
  for (let i = 0; i < player.novaMaxCharges; i++) novaText += i < player.novaCharges ? '✦ ' : '✧ ';
  ctx.fillText(`${novaText} NOVA [E]`, GAME_WIDTH - 22, GAME_HEIGHT - 22);

  // Controls hint, bottom left.
  ctx.textAlign = 'left';
  ctx.font = `400 12px ${SANS}`;
  ctx.fillStyle = 'rgba(246, 236, 212, 0.6)';
  ctx.fillText('WASD move  ·  Mouse aim  ·  Hold click to shoot  ·  Space dash  ·  E nova  ·  P pause  ·  M mute', 22, GAME_HEIGHT - 22);
  ctx.restore();
}

function drawBar(ctx, x, y, width, height, fraction, color, background) {
  const clamped = Math.max(0, Math.min(1, fraction));
  ctx.fillStyle = background;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * clamped, height);
  ctx.strokeStyle = 'rgba(246, 236, 212, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function drawWaveBanner(ctx, game) {
  if (!game.banner || game.screen !== 'playing') return;
  const banner = game.banner;
  const progress = 1 - banner.timer / banner.duration;
  const alpha = progress < 0.12 ? progress / 0.12 : banner.timer < 0.5 ? banner.timer / 0.5 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 52px ${SERIF}`;
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(6, 18, 24, 0.9)';
  ctx.strokeText(banner.title, GAME_WIDTH / 2, 190);
  ctx.fillStyle = PALETTE.amberBright;
  ctx.fillText(banner.title, GAME_WIDTH / 2, 190);
  ctx.font = `400 18px ${SANS}`;
  ctx.fillStyle = PALETTE.cream;
  ctx.fillText(banner.subtitle, GAME_WIDTH / 2, 228);
  ctx.restore();
}

function drawAimReticle(ctx, game) {
  const input = game.input;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 217, 122, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(input.mouseX, input.mouseY, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(input.mouseX - 14, input.mouseY);
  ctx.lineTo(input.mouseX - 6, input.mouseY);
  ctx.moveTo(input.mouseX + 6, input.mouseY);
  ctx.lineTo(input.mouseX + 14, input.mouseY);
  ctx.moveTo(input.mouseX, input.mouseY - 14);
  ctx.lineTo(input.mouseX, input.mouseY - 6);
  ctx.moveTo(input.mouseX, input.mouseY + 6);
  ctx.lineTo(input.mouseX, input.mouseY + 14);
  ctx.stroke();
  ctx.restore();
}

export function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

// --- DOM screens ---------------------------------------------------------

function setVisible(element, visible) {
  if (!element) return;
  element.classList.toggle('visible', visible);
  element.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

export function syncScreens(game) {
  const screen = game.screen;
  const signature = `${screen}|${game.endless}`;
  if (signature !== lastScreenSignature) {
    lastScreenSignature = signature;
    setVisible(document.getElementById('screen-title'), screen === 'title');
    setVisible(document.getElementById('screen-pause'), screen === 'paused');
    setVisible(document.getElementById('screen-upgrade'), screen === 'upgrade');
    setVisible(document.getElementById('screen-end'), screen === 'victory' || screen === 'defeat');
  }

  if (game.bestScore !== lastBestShown) {
    lastBestShown = game.bestScore;
    const bestLabel = document.getElementById('title-best');
    if (bestLabel) bestLabel.textContent = game.bestScore > 0 ? `Best score: ${game.bestScore.toLocaleString('en-US')}` : 'No runs yet — the garden awaits.';
  }

  if (screen === 'upgrade') {
    const upgradeSignature = game.upgradeChoices.map((u) => u.id).join(',') + `|${game.player.level}`;
    if (upgradeSignature !== lastUpgradeSignature) {
      lastUpgradeSignature = upgradeSignature;
      renderUpgradeCards(game);
    }
  }

  if (screen === 'victory' || screen === 'defeat') {
    const stats = screen === 'victory' ? game.victoryStats : game.defeatStats;
    const endSignature = `${screen}|${stats ? stats.score : 0}|${stats ? stats.wave : 0}`;
    if (endSignature !== lastEndSignature) {
      lastEndSignature = endSignature;
      renderEndScreen(game, screen, stats);
    }
  }
}

function renderUpgradeCards(game) {
  const label = document.getElementById('upgrade-level-label');
  if (label) label.textContent = `Level ${game.player.level} — choose a boon`;
  const container = document.getElementById('upgrade-cards');
  if (!container) return;
  container.innerHTML = '';
  game.upgradeChoices.forEach((upgrade, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'upgrade-card';
    card.dataset.upgradeIndex = String(index);
    const stacks = game.player.upgradeStacks[upgrade.id] || 0;
    card.innerHTML = `<span class="upgrade-glyph">${upgrade.glyph}</span>`
      + `<span class="upgrade-name">${upgrade.name}</span>`
      + `<span class="upgrade-blurb">${upgrade.blurb}</span>`
      + `<span class="upgrade-detail">${upgrade.detail}</span>`
      + `<span class="upgrade-key">Press ${index + 1}${stacks > 0 ? ` · owned ×${stacks}` : ''}</span>`;
    container.appendChild(card);
  });
}

function renderEndScreen(game, screen, stats) {
  const title = document.getElementById('end-title');
  const subtitle = document.getElementById('end-subtitle');
  const statsBox = document.getElementById('end-stats');
  const newBest = document.getElementById('end-new-best');
  const endlessButton = document.getElementById('btn-endless');
  if (!stats) return;
  if (title) {
    title.textContent = screen === 'victory' ? 'THE GARDEN BLOOMS AGAIN' : 'THE LIGHT FADES';
    title.classList.toggle('defeat', screen === 'defeat');
  }
  if (subtitle) {
    subtitle.textContent = screen === 'victory'
      ? 'The Hollow Moth is gone. Dawn returns to Emberwild.'
      : `The gloom took Luma on wave ${stats.wave}. The lantern can be lit again.`;
  }
  if (statsBox) {
    statsBox.innerHTML = statRow('Score', stats.score.toLocaleString('en-US'))
      + statRow('Wave reached', String(stats.wave))
      + statRow('Foes felled', String(stats.kills))
      + statRow('Level', String(stats.level))
      + statRow('Best combo', `×${stats.maxCombo}`)
      + statRow('Time', formatTime(stats.time));
  }
  if (newBest) newBest.classList.toggle('visible', stats.isNewBest);
  if (endlessButton) endlessButton.style.display = screen === 'victory' ? '' : 'none';
  void game;
}

function statRow(label, value) {
  return `<div class="stat-row"><span>${label}</span><strong>${value}</strong></div>`;
}
