import { DEG, approach, clamp, rand, turnToward } from '../core/math';

export type EnemyKind = 'wasp' | 'brute' | 'gnat' | 'picket';
export type EnemyClass = 'gunship' | 'drone' | 'turret';
type Phase = 'idle' | 'tele' | 'fire' | 'recover';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  cls: EnemyClass;
  hp: number;
  r: number;
  idle: [number, number];
  tele: number;
  recover: number;
  shotSpeed: number;
  energy: number;
  score: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  wasp: {
    kind: 'wasp',
    name: 'Wasp',
    cls: 'gunship',
    hp: 110,
    r: 26,
    idle: [1.0, 1.8],
    tele: 0.75,
    recover: 0.9,
    shotSpeed: 330,
    energy: 14,
    score: 300,
  },
  brute: {
    kind: 'brute',
    name: 'Bullhorn',
    cls: 'gunship',
    hp: 520,
    r: 46,
    idle: [0.9, 1.4],
    tele: 1.0,
    recover: 1.3,
    shotSpeed: 270,
    energy: 30,
    score: 2000,
  },
  gnat: {
    kind: 'gnat',
    name: 'Gnat',
    cls: 'drone',
    hp: 26,
    r: 14,
    idle: [1.6, 2.6],
    tele: 0.5,
    recover: 0.6,
    shotSpeed: 150,
    energy: 5,
    score: 100,
  },
  picket: {
    kind: 'picket',
    name: 'Picket',
    cls: 'turret',
    hp: 130,
    r: 20,
    idle: [1.0, 1.6],
    tele: 0.9,
    recover: 1.4,
    shotSpeed: 380,
    energy: 9,
    score: 250,
  },
};

export interface Enemy {
  def: EnemyDef;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  phase: Phase;
  t: number;
  /** Length of the current phase. */
  dur: number;
  aim: number;
  shotsLeft: number;
  shotT: number;
  /** Bullhorn alternates fans and a leading burst. */
  pattern: number;
  flash: number;
  /** Personal hover offset and wobble phase, so a group doesn't stack. */
  offX: number;
  offY: number;
  wobble: number;
  /** Turrets: the surface they sit on. */
  baseY: number;
}

export interface EnemyWorld {
  px: number;
  py: number;
  pvx: number;
  pvy: number;
  fire(x: number, y: number, angle: number, speed: number, dmg: number, look: 'bullet' | 'orb' | 'heavy'): void;
}

const MAX_RISE = 25 * DEG;
const PICKET_TURN = 110 * DEG;

export function makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
  const def = ENEMIES[kind];
  return {
    def,
    alive: true,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: def.hp,
    phase: 'idle',
    t: 0,
    dur: rand(def.idle[0], def.idle[1]) + 0.6,
    aim: Math.PI / 2,
    shotsLeft: 0,
    shotT: 0,
    pattern: 0,
    flash: 0,
    offX: rand(250, 390),
    offY: rand(-40, 40),
    wobble: rand(0, 6),
    baseY: y,
  };
}

/** Angle from the enemy to a point, with gunships unable to tilt their guns far upward. */
function aimAt(e: Enemy, tx: number, ty: number): number {
  const dx = tx - e.x;
  const dy = ty - e.y;
  if (e.def.kind === 'wasp' || e.def.kind === 'brute') {
    const rise = Math.atan2(-dy, Math.abs(dx));
    if (rise > MAX_RISE) {
      const a = MAX_RISE;
      return dx >= 0 ? -a : Math.PI + a;
    }
  }
  return Math.atan2(dy, dx);
}

function muzzle(e: Enemy): { x: number; y: number } {
  if (e.def.kind === 'picket') return { x: e.x + Math.cos(e.aim) * 26, y: e.y + Math.sin(e.aim) * 26 };
  if (e.def.kind === 'gnat') return { x: e.x, y: e.y };
  return { x: e.x, y: e.y + e.def.r * 0.5 };
}

function steer(e: Enemy, dt: number, w: EnemyWorld): void {
  const k = e.def.kind;
  e.wobble += dt;
  if (k === 'picket') return;
  let tx: number;
  let ty: number;
  let maxV: number;
  if (k === 'gnat') {
    const a = e.wobble * 0.7 + e.offX;
    tx = w.px + Math.cos(a) * 200;
    ty = w.py - 150 + Math.sin(a * 1.3) * 90;
    maxV = 170;
  } else {
    const side = e.x >= w.px ? 1 : -1;
    const big = k === 'brute';
    tx = w.px + side * (big ? 340 : e.offX);
    ty = w.py - (big ? 250 : 205) + e.offY + Math.sin(e.wobble * 1.7) * 18;
    maxV = big ? 150 : 230;
  }
  const accel = k === 'gnat' ? 320 : 260;
  e.vx = approach(e.vx, clamp((tx - e.x) * 1.6, -maxV, maxV), accel * dt);
  e.vy = approach(e.vy, clamp((ty - e.y) * 1.6, -maxV, maxV), accel * dt);
  // Gunships slow down while their guns are committed.
  const hold = e.phase === 'fire' && k !== 'gnat' ? 0.35 : 1;
  e.x += e.vx * dt * hold;
  e.y += e.vy * dt * hold;
  e.y = Math.min(e.y, w.py + 40);
}

export function updateEnemy(e: Enemy, dt: number, w: EnemyWorld): void {
  e.flash = Math.max(0, e.flash - dt);
  steer(e, dt, w);
  const d = e.def;
  const tx = w.px;
  const ty = w.py;

  if (d.kind === 'picket') {
    const want = Math.atan2(ty - e.y, tx - e.x);
    const slow = e.phase === 'tele' ? 0.5 : e.phase === 'fire' ? 0 : 1;
    e.aim = turnToward(e.aim, want, PICKET_TURN * slow * dt);
  }

  e.t += dt;
  switch (e.phase) {
    case 'idle':
      if (d.kind !== 'picket') e.aim = aimAt(e, tx, ty);
      if (e.t >= e.dur) {
        // Stay quiet while well off screen.
        if (Math.abs(e.x - w.px) > 700) {
          e.t = e.dur - 0.3;
          break;
        }
        e.phase = 'tele';
        e.t = 0;
        e.dur = d.tele;
      }
      break;
    case 'tele':
      if (d.kind !== 'picket' && e.t < e.dur * 0.7) e.aim = aimAt(e, tx, ty);
      if (e.t >= e.dur) {
        e.phase = 'fire';
        e.t = 0;
        e.shotT = 0;
        e.shotsLeft = d.kind === 'wasp' ? 3 : d.kind === 'picket' ? 3 : d.kind === 'gnat' ? 1 : e.pattern % 3 === 2 ? 6 : 2;
      }
      break;
    case 'fire':
      e.shotT -= dt;
      while (e.shotT <= 0 && e.shotsLeft > 0) {
        fireOnce(e, w);
        e.shotsLeft--;
        e.shotT += d.kind === 'brute' ? (e.pattern % 3 === 2 ? 0.1 : 0.32) : 0.11;
      }
      if (e.shotsLeft <= 0) {
        e.phase = 'recover';
        e.t = 0;
        e.dur = d.recover;
        e.pattern++;
      }
      break;
    case 'recover':
      if (e.t >= e.dur) {
        e.phase = 'idle';
        e.t = 0;
        e.dur = rand(d.idle[0], d.idle[1]);
      }
      break;
  }
}

function fireOnce(e: Enemy, w: EnemyWorld): void {
  const d = e.def;
  const m = muzzle(e);
  if (d.kind === 'gnat') {
    w.fire(m.x, m.y, e.aim, d.shotSpeed, 12, 'orb');
  } else if (d.kind === 'brute') {
    if (e.pattern % 3 === 2) {
      // Leading burst: aim where the player will be.
      const dist = Math.hypot(w.px - m.x, w.py - m.y);
      const lead = dist / (d.shotSpeed * 1.3);
      const a = aimAt(e, w.px + w.pvx * lead, w.py + w.pvy * lead * 0.5);
      w.fire(m.x, m.y, a, d.shotSpeed * 1.3, 10, 'bullet');
    } else {
      const off = e.shotsLeft % 2 === 0 ? 0 : 0.5;
      for (let i = 0; i < 7; i++) w.fire(m.x, m.y, e.aim + ((i + off) / 6 - 0.5) * 70 * DEG, d.shotSpeed, 10, 'heavy');
    }
  } else {
    w.fire(m.x, m.y, e.aim + rand(-2, 2) * DEG, d.shotSpeed, d.kind === 'picket' ? 12 : 10, 'bullet');
  }
}
