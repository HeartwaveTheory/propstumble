import { RIFT } from '../core/clock';
import { TAU } from '../core/math';
import type { Enemy } from '../game/enemies';
import type { Game } from '../game/game';
import type { TouchControls } from '../input/touch';

const C = {
  skyTop: '#1b1430',
  skyMid: '#4a2a4f',
  skyLow: '#e0745a',
  sun: '#ffcf8a',
  far: '#2a2140',
  mid: '#211a33',
  ground: '#15111f',
  groundEdge: '#ff9e5e',
  block: '#2b2240',
  blockEdge: '#6c5a9a',
  walk: '#3b3156',
  walkEdge: '#c9b6ff',
  player: '#e8f1ff',
  playerSuit: '#3fa9f5',
  wasp: '#f2b134',
  brute: '#e0503c',
  gnat: '#9b7bff',
  picket: '#8aa0b8',
  hud: '#f4ecff',
  hudDim: 'rgba(244,236,255,0.55)',
  hp: '#ff5d7a',
  energy: '#5ee0ff',
};

interface Layer {
  shapes: { x: number; w: number; h: number; kind: number }[];
  period: number;
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeLayer(seed: number, period: number, minH: number, maxH: number): Layer {
  const r = seeded(seed);
  const shapes = [];
  let x = 0;
  while (x < period) {
    const w = 40 + r() * 110;
    shapes.push({ x, w, h: minH + r() * (maxH - minH), kind: Math.floor(r() * 4) });
    x += w + r() * 30;
  }
  return { shapes, period };
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private far = makeLayer(7, 2400, 120, 320);
  private mid = makeLayer(19, 1800, 60, 200);
  private t = 0;
  cssW = 0;
  cssH = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
  }

  draw(g: Game, touch: TouchControls | null, realDt: number): void {
    this.t += realDt;
    const ctx = this.ctx;
    const k = this.dpr * g.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.sky(g);

    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;
    ctx.setTransform(k, 0, 0, k, (-g.camX + sx) * k, (-g.camY + sy) * k);

    this.solids(g);
    this.pickups(g);
    for (const e of g.enemies) this.telegraph(e);
    for (const e of g.enemies) this.enemy(e);
    if (g.player.hp > 0) this.player(g);
    this.shots(g);
    this.particles(g);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.riftOverlay(g);
    if (g.state !== 'title') this.hud(g);
    if (touch?.active && (g.state === 'play' || g.state === 'paused')) this.touchUi(touch, g);
  }

  private sky(g: Game): void {
    const ctx = this.ctx;
    const w = this.cssW;
    const h = this.cssH;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, C.skyTop);
    grd.addColorStop(0.55, C.skyMid);
    grd.addColorStop(1, C.skyLow);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.sun;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(w * 0.72 - g.camX * 0.02 * g.scale, h * 0.62, h * 0.16, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    const horizon = (-g.camY) * g.scale;
    this.layer(this.far, 0.15, horizon + 20 * g.scale, C.far, g);
    this.layer(this.mid, 0.4, horizon + 10 * g.scale, C.mid, g);
  }

  private layer(l: Layer, par: number, baseY: number, color: string, g: Game): void {
    const ctx = this.ctx;
    const s = g.scale;
    ctx.fillStyle = color;
    const off = (g.camX * par) % l.period;
    for (let rep = -1; rep < Math.ceil(this.cssW / s / l.period) + 1; rep++) {
      for (const sh of l.shapes) {
        const x = (sh.x + rep * l.period - off) * s;
        if (x > this.cssW || x + sh.w * s < 0) continue;
        const top = baseY - sh.h * s;
        ctx.fillRect(x, top, sh.w * s, sh.h * s + 400);
        if (sh.kind === 0) {
          // Crane arm.
          ctx.fillRect(x + sh.w * s * 0.4, top - 60 * s, 6 * s, 60 * s);
          ctx.fillRect(x - 30 * s, top - 60 * s, sh.w * s + 60 * s, 5 * s);
        } else if (sh.kind === 1) {
          ctx.fillStyle = 'rgba(255,200,120,0.25)';
          for (let wy = top + 10 * s; wy < baseY - 10 * s; wy += 22 * s) {
            ctx.fillRect(x + 8 * s, wy, 6 * s, 8 * s);
            ctx.fillRect(x + sh.w * s - 16 * s, wy, 6 * s, 8 * s);
          }
          ctx.fillStyle = color;
        }
      }
    }
  }

  private solids(g: Game): void {
    const ctx = this.ctx;
    const left = g.camX - 50;
    const right = g.camX + g.viewW + 50;
    for (const s of g.stage.solids) {
      if (s.x > right || s.x + s.w < left) continue;
      if (s.oneWay) {
        ctx.fillStyle = C.walk;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = C.walkEdge;
        ctx.fillRect(s.x, s.y, s.w, 2);
        ctx.strokeStyle = 'rgba(201,182,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = s.x + 10; x < s.x + s.w; x += 24) {
          ctx.moveTo(x, s.y);
          ctx.lineTo(x, s.y - 18);
        }
        ctx.moveTo(s.x, s.y - 18);
        ctx.lineTo(s.x + s.w, s.y - 18);
        ctx.stroke();
      } else {
        const ground = s.h > 600;
        ctx.fillStyle = ground ? C.ground : C.block;
        ctx.fillRect(s.x, s.y, s.w, Math.min(s.h, 900));
        if (ground) {
          // Dock planking, drawn only where it is on screen.
          ctx.fillStyle = 'rgba(255,158,94,0.07)';
          const x0 = Math.max(s.x, Math.floor(left / 60) * 60);
          const x1 = Math.min(s.x + s.w, right);
          for (let x = x0; x < x1; x += 60) ctx.fillRect(x, s.y + 3, 2, 26);
          ctx.fillRect(Math.max(s.x, left), s.y + 28, Math.min(s.w, right - left), 2);
          ctx.fillStyle = 'rgba(94,224,255,0.05)';
          ctx.fillRect(Math.max(s.x, left), s.y + 60, Math.min(s.w, right - left), 300);
        }
        ctx.fillStyle = ground ? C.groundEdge : C.blockEdge;
        ctx.fillRect(s.x, s.y, s.w, 3);
        if (!ground) {
          ctx.strokeStyle = 'rgba(108,90,154,0.5)';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x + 4, s.y + 6, s.w - 8, s.h - 10);
        }
      }
    }
    // Finish line.
    const fx = g.stage.endX;
    ctx.fillStyle = 'rgba(140,255,176,0.18)';
    ctx.fillRect(fx, -400, 6, 400);
  }

  private pickups(g: Game): void {
    const ctx = this.ctx;
    for (const k of g.pickups) {
      const bob = Math.sin(this.t * 5 + k.x) * 3;
      const blink = k.life < 3 && Math.floor(this.t * 8) % 2 === 0;
      if (blink) continue;
      const color = k.kind === 'health' ? '#ff5d7a' : k.kind === 'energy' ? C.energy : k.kind === 'rifle' ? '#7affd4' : '#ff9e5e';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(k.x, k.y - 12 + bob, 16, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillRect(k.x - 8, k.y - 20 + bob, 16, 16);
      ctx.fillStyle = '#15111f';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(k.kind === 'health' ? '+' : k.kind === 'energy' ? 'R' : k.kind === 'rifle' ? 'A' : 'S', k.x, k.y - 8 + bob);
    }
  }

  private telegraph(e: Enemy): void {
    if (e.phase !== 'tele') return;
    const ctx = this.ctx;
    const p = e.t / e.dur;
    const locked = p >= 0.7;
    const len = e.def.kind === 'gnat' ? 120 : 700;
    const ox = e.def.kind === 'picket' ? e.x + Math.cos(e.aim) * 26 : e.x;
    const oy = e.def.kind === 'picket' ? e.y + Math.sin(e.aim) * 26 : e.y + (e.def.kind === 'gnat' ? 0 : e.def.r * 0.5);
    ctx.strokeStyle = locked ? 'rgba(255,60,80,0.85)' : `rgba(255,170,80,${0.15 + p * 0.35})`;
    ctx.lineWidth = locked ? 2 : 1;
    ctx.setLineDash(locked ? [] : [8, 8]);
    ctx.beginPath();
    if (e.def.kind === 'brute' && e.pattern % 3 !== 2) {
      for (let i = 0; i < 7; i += 3) {
        const a = e.aim + (i / 6 - 0.5) * 70 * (Math.PI / 180);
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a) * len * 0.6, oy + Math.sin(a) * len * 0.6);
      }
    } else {
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(e.aim) * len, oy + Math.sin(e.aim) * len);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private enemy(e: Enemy): void {
    const ctx = this.ctx;
    const d = e.def;
    const flash = e.flash > 0;
    const spin = this.t * 40;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (d.kind === 'wasp' || d.kind === 'brute') {
      const big = d.kind === 'brute';
      const s = big ? 1.75 : 1;
      const face = e.vx >= 0 ? 1 : -1;
      ctx.rotate(Math.max(-0.25, Math.min(0.25, e.vx / 900)));
      ctx.scale(face * s, s);
      ctx.fillStyle = flash ? '#fff' : big ? C.brute : C.wasp;
      // Tail boom and fin.
      ctx.fillRect(-46, -5, 30, 6);
      ctx.fillRect(-50, -14, 6, 14);
      // Body.
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 13, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(30,20,40,0.85)';
      ctx.beginPath();
      ctx.ellipse(10, -3, 9, 6, 0, 0, TAU);
      ctx.fill();
      // Skids and gun pod.
      ctx.fillStyle = flash ? '#fff' : '#3a2f4f';
      ctx.fillRect(-14, 14, 28, 3);
      ctx.fillRect(-4, 8, 14, 6);
      // Rotor.
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const rw = 34 * Math.abs(Math.cos(spin));
      ctx.fillRect(-rw, -18, rw * 2, 2.5);
      ctx.fillRect(-2, -18, 4, 6);
      if (big) {
        const rw2 = 34 * Math.abs(Math.sin(spin));
        ctx.fillRect(-36 - rw2 * 0.5, -10, rw2, 2.5);
      }
    } else if (d.kind === 'gnat') {
      ctx.fillStyle = flash ? '#fff' : C.gnat;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = e.phase === 'tele' ? '#ff3c50' : '#ffe27a';
      ctx.beginPath();
      ctx.arc(Math.cos(e.aim) * 4, Math.sin(e.aim) * 4, 4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 17, spin * 0.2, spin * 0.2 + 1.2);
      ctx.arc(0, 0, 17, spin * 0.2 + Math.PI, spin * 0.2 + Math.PI + 1.2);
      ctx.stroke();
    } else {
      ctx.fillStyle = flash ? '#fff' : C.picket;
      ctx.beginPath();
      ctx.moveTo(-20, 18);
      ctx.lineTo(20, 18);
      ctx.lineTo(12, -4);
      ctx.lineTo(-12, -4);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.rotate(e.aim);
      ctx.fillRect(0, -4, 28, 8);
      ctx.restore();
      ctx.fillStyle = flash ? '#fff' : '#5c6c80';
      ctx.beginPath();
      ctx.arc(0, -2, 10, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (e.hp < d.hp) {
      const w = d.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - w / 2, e.y - d.r - 14, w, 4);
      ctx.fillStyle = C.hp;
      ctx.fillRect(e.x - w / 2, e.y - d.r - 14, (w * e.hp) / d.hp, 4);
    }
  }

  private player(g: Game): void {
    const ctx = this.ctx;
    const p = g.player;
    if (p.invuln > 0 && Math.floor(this.t * 20) % 2 === 0) return;
    const f = p.facing;
    const h = p.h;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Legs.
    ctx.strokeStyle = '#1d2a44';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const legH = h * 0.36;
    const swing = p.onGround && Math.abs(p.vx) > 20 ? Math.sin(p.runPhase) * 8 : p.onGround ? 0 : 5;
    ctx.beginPath();
    ctx.moveTo(-3, -legH);
    ctx.lineTo(-3 + swing, 0);
    ctx.moveTo(3, -legH);
    ctx.lineTo(3 - swing, p.onGround ? 0 : -6);
    ctx.stroke();
    // Body.
    ctx.fillStyle = p.hurtFlash > 0 ? '#ff5d7a' : C.playerSuit;
    ctx.fillRect(-9, -h + 12, 18, h - legH - 10);
    // Propeller pack on the back.
    ctx.fillStyle = '#ffcf5e';
    ctx.fillRect(-f * 15 - 4, -h + 14, 8, 18);
    const prop = (p.onGround ? 8 : 40) * this.t;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const pw = 16 * Math.abs(Math.cos(prop));
    ctx.fillRect(-f * 15 - pw, -h + 10, pw * 2, 2.5);
    // Head.
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(0, -h + 6, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d2a44';
    ctx.fillRect(f * 2, -h + 3, f * 6, 3);
    // Gun along the aim.
    ctx.translate(0, p.cy - p.y);
    ctx.rotate(Math.atan2(p.aimY, p.aimX));
    ctx.fillStyle = g.arsenal.current.def.color;
    ctx.fillRect(4, -3, 22, 6);
    ctx.fillStyle = '#1d2a44';
    ctx.fillRect(4, -3, 8, 6);
    ctx.restore();
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + p.aimX * 30, p.cy + p.aimY * 30);
    ctx.lineTo(p.x + p.aimX * 200, p.cy + p.aimY * 200);
    ctx.stroke();
  }

  private shots(g: Game): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of g.shots.items) {
      if (!s.alive) continue;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      if (s.look === 'orb' || s.look === 'heavy') {
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      } else {
        // Streak from a fixed-length tail so slowed shots still read as moving.
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const tail = s.owner === 'player' ? 16 : 10;
        ctx.lineWidth = s.r * 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x - (s.vx / sp) * tail, s.y - (s.vy / sp) * tail);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private particles(g: Game): void {
    const ctx = this.ctx;
    for (const p of g.fx.parts) {
      if (!p.alive) continue;
      const a = p.life / p.max;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.2 - a), 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of g.fx.popups) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.fillStyle = t.color;
      ctx.font = t.big ? '900 28px system-ui, sans-serif' : 'bold 14px system-ui, sans-serif';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  private riftOverlay(g: Game): void {
    const b = g.clock.blend;
    if (b <= 0) return;
    const ctx = this.ctx;
    const w = this.cssW;
    const h = this.cssH;
    ctx.fillStyle = `rgba(40,180,255,${0.14 * b})`;
    ctx.fillRect(0, 0, w, h);
    const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(20,80,160,${0.45 * b})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  private hud(g: Game): void {
    const ctx = this.ctx;
    const w = this.cssW;
    const pad = 14;
    const x0 = 64;
    const bw = Math.min(220, w * 0.28);
    // Health.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x0, pad, bw, 10);
    ctx.fillStyle = C.hp;
    ctx.fillRect(x0, pad, (bw * g.player.hp) / g.player.maxHp, 10);
    // Rift energy, with a notch at the minimum needed to start.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x0, pad + 16, bw, 8);
    ctx.fillStyle = g.clock.riftOn ? '#ffffff' : C.energy;
    ctx.fillRect(x0, pad + 16, (bw * g.clock.energy) / RIFT.maxEnergy, 8);
    ctx.fillStyle = C.hudDim;
    ctx.fillRect(x0 + (bw * RIFT.minToStart) / RIFT.maxEnergy, pad + 14, 1.5, 12);

    ctx.textAlign = 'right';
    ctx.fillStyle = C.hud;
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText(g.score.points.toLocaleString(), w - pad, pad + 20);
    if (g.score.chain >= 2) {
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.fillStyle = '#ff9e5e';
      ctx.fillText(`x${g.score.mult}  ${g.score.chain} chain`, w - pad, pad + 42);
      ctx.fillStyle = 'rgba(255,158,94,0.6)';
      const cw = (90 * g.score.comboTimer) / 3;
      ctx.fillRect(w - pad - cw, pad + 48, cw, 3);
    }
    const cur = g.arsenal.current;
    ctx.textAlign = 'left';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = cur.def.color;
    const ammo = cur.ammo === Infinity ? '∞' : String(cur.ammo);
    ctx.fillText(`${cur.def.name}  ${ammo}`, x0, pad + 44);
    // Stage progress.
    const prog = Math.max(0, Math.min(1, g.player.x / g.stage.endX));
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(w / 2 - 80, pad + 2, 160, 3);
    ctx.fillStyle = '#8cffb0';
    ctx.fillRect(w / 2 - 80 + 160 * prog - 2, pad - 1, 4, 9);
  }

  private touchUi(t: TouchControls, g: Game): void {
    const ctx = this.ctx;
    const R = t.radius;
    ctx.lineWidth = 2;
    for (const pad of [t.left, t.right]) {
      if (!pad) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(pad.ox, pad.oy, R, 0, TAU);
      ctx.stroke();
      if (pad === t.right) {
        ctx.strokeStyle = 'rgba(255,90,110,0.35)';
        ctx.beginPath();
        ctx.arc(pad.ox, pad.oy, R * 0.3, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, R * 0.35, 0, TAU);
      ctx.fill();
    }
    for (const b of t.buttons) {
      const on = b.id === 'rift' && g.clock.riftOn;
      ctx.fillStyle = on ? 'rgba(94,224,255,0.45)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(b.r * 0.55)}px system-ui, sans-serif`;
      ctx.fillText(b.id === 'rift' ? '⧗' : b.id === 'swap' ? '⇄' : 'II', b.x, b.y + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }
}

