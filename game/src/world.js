// The night garden: a fixed, seeded backdrop of stars, moon, treeline,
// glowing flowers and drifting fireflies, plus the hedge arena border.

import { ARENA, GAME_HEIGHT, GAME_WIDTH, PALETTE } from './config.js';
import { createSeededRandom } from './random.js';

export function createGarden(seed) {
  const rng = createSeededRandom(seed);
  const stars = [];
  for (let i = 0; i < 110; i++) {
    stars.push({ x: rng.range(0, GAME_WIDTH), y: rng.range(0, 150), radius: rng.range(0.6, 1.8), phase: rng.range(0, Math.PI * 2) });
  }
  const flowers = [];
  const flowerColors = ['#e86a9a', '#f2b23e', '#9a7be8', '#57c7a8', '#f6ecd4'];
  for (let i = 0; i < 46; i++) {
    flowers.push({
      x: rng.range(ARENA.left + 20, ARENA.right - 20),
      y: rng.range(ARENA.top + 26, ARENA.bottom - 12),
      color: flowerColors[i % flowerColors.length],
      phase: rng.range(0, Math.PI * 2),
      size: rng.range(3, 5.5),
    });
  }
  const grass = [];
  for (let i = 0; i < 130; i++) {
    grass.push({
      x: rng.range(ARENA.left + 8, ARENA.right - 8),
      y: rng.range(ARENA.top + 14, ARENA.bottom - 6),
      lean: rng.range(-4, 4),
      height: rng.range(6, 13),
    });
  }
  const fireflies = [];
  for (let i = 0; i < 26; i++) {
    fireflies.push({
      x: rng.range(ARENA.left, ARENA.right),
      y: rng.range(ARENA.top, ARENA.bottom),
      phase: rng.range(0, Math.PI * 2),
      speed: rng.range(0.25, 0.6),
      radius: rng.range(14, 42),
    });
  }
  const trees = [];
  for (let i = 0; i < 16; i++) {
    trees.push({ x: 30 + i * 82 + rng.range(-18, 18), height: rng.range(38, 66), width: rng.range(26, 44) });
  }
  return { stars, flowers, grass, fireflies, trees, seed };
}

export function drawGarden(ctx, garden, time) {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.32, PALETTE.skyMid);
  sky.addColorStop(0.34, PALETTE.groundTop);
  sky.addColorStop(1, PALETTE.groundBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Stars.
  for (const star of garden.stars) {
    const twinkle = 0.45 + Math.sin(time * 1.6 + star.phase) * 0.35;
    ctx.globalAlpha = Math.max(0.1, twinkle);
    ctx.fillStyle = '#f6ecd4';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon with halo.
  const moonX = GAME_WIDTH - 118;
  const moonY = 62;
  const halo = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 74);
  halo.addColorStop(0, 'rgba(246, 236, 212, 0.5)');
  halo.addColorStop(1, 'rgba(246, 236, 212, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6ecd4';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(14, 42, 51, 0.25)';
  ctx.beginPath();
  ctx.arc(moonX - 9, moonY - 6, 7, 0, Math.PI * 2);
  ctx.arc(moonX + 10, moonY + 9, 5, 0, Math.PI * 2);
  ctx.fill();

  // Treeline silhouettes along the horizon.
  ctx.fillStyle = '#0a1f1a';
  for (const tree of garden.trees) {
    ctx.beginPath();
    ctx.moveTo(tree.x - tree.width / 2, 150);
    ctx.quadraticCurveTo(tree.x, 150 - tree.height * 1.6, tree.x + tree.width / 2, 150);
    ctx.closePath();
    ctx.fill();
  }

  // Ground texture: soft mottling.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  for (let i = 0; i < 24; i++) {
    const gx = ((i * 173) % GAME_WIDTH) + 40;
    const gy = ARENA.top + ((i * 97) % (GAME_HEIGHT - ARENA.top - 60)) + 30;
    ctx.beginPath();
    ctx.ellipse(gx, gy, 90, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grass tufts.
  ctx.strokeStyle = 'rgba(87, 199, 168, 0.28)';
  ctx.lineWidth = 1.6;
  for (const blade of garden.grass) {
    const sway = Math.sin(time * 1.1 + blade.x * 0.05) * 1.6;
    ctx.beginPath();
    ctx.moveTo(blade.x, blade.y);
    ctx.quadraticCurveTo(blade.x + blade.lean + sway, blade.y - blade.height * 0.6, blade.x + blade.lean * 1.6 + sway, blade.y - blade.height);
    ctx.stroke();
  }

  // Glowing flowers.
  for (const flower of garden.flowers) {
    const pulse = 0.6 + Math.sin(time * 1.8 + flower.phase) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = flower.color;
    for (let petal = 0; petal < 5; petal++) {
      const angle = (petal / 5) * Math.PI * 2 + flower.phase;
      ctx.beginPath();
      ctx.arc(flower.x + Math.cos(angle) * flower.size, flower.y + Math.sin(angle) * flower.size, flower.size * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.arc(flower.x, flower.y, flower.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Fireflies.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const fly of garden.fireflies) {
    const fx = fly.x + Math.cos(time * fly.speed + fly.phase) * fly.radius;
    const fy = fly.y + Math.sin(time * fly.speed * 1.3 + fly.phase) * fly.radius * 0.6;
    const glowAlpha = 0.35 + Math.sin(time * 2.6 + fly.phase * 2) * 0.3;
    ctx.globalAlpha = Math.max(0.08, glowAlpha);
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(fx, fy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawArenaBorder(ctx, time) {
  // Hedge frame with corner lantern posts.
  ctx.save();
  ctx.strokeStyle = PALETTE.hedge;
  ctx.lineWidth = 14;
  ctx.strokeRect(ARENA.left - 7, ARENA.top - 7, ARENA.right - ARENA.left + 14, ARENA.bottom - ARENA.top + 14);
  ctx.strokeStyle = PALETTE.hedgeLight;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -time * 4;
  ctx.strokeRect(ARENA.left - 7, ARENA.top - 7, ARENA.right - ARENA.left + 14, ARENA.bottom - ARENA.top + 14);
  ctx.setLineDash([]);
  const corners = [
    [ARENA.left - 7, ARENA.top - 7],
    [ARENA.right + 7, ARENA.top - 7],
    [ARENA.left - 7, ARENA.bottom + 7],
    [ARENA.right + 7, ARENA.bottom + 7],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillStyle = '#2a1f2e';
    ctx.fillRect(cx - 4, cy - 16, 8, 22);
    const flicker = 0.75 + Math.sin(time * 5 + cx) * 0.2;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(cx, cy - 18, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
