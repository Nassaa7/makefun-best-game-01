// Particles, shockwave rings and floating damage numbers — the feedback layer
// that makes every hit, pickup and explosion read instantly.

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.rings = [];
  }

  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
  }

  burst(x, y, options) {
    const { count, color, colors, speed, size, life, gravity, drag } = options;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.35 + Math.random() * 0.85);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color: colors ? colors[i % colors.length] : color,
        gravity: gravity || 0,
        drag: drag ?? 3.2,
        glow: options.glow !== false,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  trail(x, y, color, size) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      life: 0.35,
      maxLife: 0.35,
      size: size || 5,
      color,
      gravity: 0,
      drag: 2,
      glow: true,
    });
  }

  ring(x, y, color, maxRadius, duration) {
    this.rings.push({ x, y, color, radius: 12, maxRadius, life: duration, maxLife: duration });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const dragFactor = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragFactor;
      p.vy *= dragFactor;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.life -= dt;
      const progress = 1 - ring.life / ring.maxLife;
      ring.radius = 12 + (ring.maxRadius - 12) * (1 - Math.pow(1 - progress, 2.2));
      if (ring.life <= 0) this.rings.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const ring of this.rings) {
      const alpha = Math.max(0, ring.life / ring.maxLife);
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 3 + alpha * 4;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class FloatingTexts {
  constructor() {
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  add(x, y, text, color, size) {
    this.items.push({
      x: x + (Math.random() - 0.5) * 14,
      y,
      text: String(text),
      color: color || '#f6ecd4',
      size: size || 17,
      life: 0.85,
      maxLife: 0.85,
    });
    if (this.items.length > 60) this.items.splice(0, this.items.length - 60);
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      item.y -= 46 * dt;
      if (item.life <= 0) this.items.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of this.items) {
      const alpha = Math.max(0, item.life / item.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${item.size}px Georgia, 'Times New Roman', serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6, 18, 24, 0.85)';
      ctx.strokeText(item.text, item.x, item.y);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.restore();
  }
}
