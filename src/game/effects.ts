import { TAU, rand } from '../core/math';

export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  gravity: number;
  ring: boolean;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  big: boolean;
}

/** Sparks, smoke, shockwave rings and floating score text. Runs on the world clock. */
export class Effects {
  readonly parts: Particle[] = [];
  readonly popups: Popup[] = [];
  private next = 0;

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      this.parts.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', drag: 0, gravity: 0, ring: false });
    }
  }

  private take(): Particle {
    const p = this.parts[this.next];
    this.next = (this.next + 1) % this.parts.length;
    return p;
  }

  spark(x: number, y: number, n: number, color: string, speed = 260, angle?: number, cone = TAU): void {
    for (let i = 0; i < n; i++) {
      const p = this.take();
      const a = angle === undefined ? rand(0, TAU) : angle + rand(-cone / 2, cone / 2);
      const s = rand(0.3, 1) * speed;
      Object.assign(p, {
        alive: true,
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.18, 0.45),
        size: rand(1.5, 3.2),
        color,
        drag: 3,
        gravity: 500,
        ring: false,
      });
      p.max = p.life;
    }
  }

  smoke(x: number, y: number, n: number, size: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.take();
      Object.assign(p, {
        alive: true,
        x: x + rand(-size, size) * 0.5,
        y: y + rand(-size, size) * 0.5,
        vx: rand(-40, 40),
        vy: rand(-70, -10),
        life: rand(0.5, 1.1),
        size: rand(size * 0.4, size),
        color: 'rgba(40,36,52,0.55)',
        drag: 1.5,
        gravity: -30,
        ring: false,
      });
      p.max = p.life;
    }
  }

  ring(x: number, y: number, size: number, color: string): void {
    const p = this.take();
    Object.assign(p, { alive: true, x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, size, color, drag: 0, gravity: 0, ring: true });
  }

  explode(x: number, y: number, size: number): void {
    this.ring(x, y, size * 2.2, '#ffd27a');
    this.spark(x, y, Math.round(size * 0.8), '#ffb347', size * 9);
    this.spark(x, y, Math.round(size * 0.4), '#fff4c2', size * 6);
    this.smoke(x, y, Math.round(size * 0.35), size * 0.9);
  }

  popup(x: number, y: number, text: string, color = '#fff', big = false): void {
    this.popups.push({ x, y, text, life: big ? 1.3 : 0.8, color, big });
  }

  update(dt: number, realDt: number): void {
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const t = this.popups[i];
      t.life -= realDt;
      t.y -= 40 * realDt;
      if (t.life <= 0) this.popups.splice(i, 1);
    }
  }

  clear(): void {
    for (const p of this.parts) p.alive = false;
    this.popups.length = 0;
  }
}
