import { Clock } from '../core/clock';
import { DEG, clamp, dist2, lerp, rand, segPointDist2, wrapAngle } from '../core/math';
import type { Intent } from '../input/intent';
import { Effects } from './effects';
import { type Enemy, type EnemyKind, type EnemyWorld, makeEnemy, updateEnemy } from './enemies';
import { STAGE_1, type Stage } from './level';
import { Player } from './player';
import { Score } from './scoring';
import { ShotPool } from './shots';
import { Arsenal, WEAPONS } from './weapons';

export type GameState = 'title' | 'play' | 'paused' | 'clear' | 'dead';
export type Sfx = 'shoot' | 'scatter' | 'hit' | 'boom' | 'bigboom' | 'hurt' | 'rift-on' | 'rift-off' | 'pickup' | 'jump' | 'enemy-shot' | 'clear' | 'swap';

export interface Pickup {
  alive: boolean;
  kind: 'health' | 'energy' | 'rifle' | 'scatter';
  x: number;
  y: number;
  vy: number;
  life: number;
}

/** Height of the visible world, in world units, whatever the screen size. */
export const VIEW_H = 540;
/** The player sits this far down the view, leaving room above for gunships and hyper-jumps. */
const PLAYER_VIEW_Y = 0.68;

export class Game {
  state: GameState = 'title';
  stage: Stage = STAGE_1;
  clock = new Clock();
  player = new Player();
  arsenal = new Arsenal();
  enemies: Enemy[] = [];
  shots = new ShotPool(900);
  fx = new Effects(700);
  pickups: Pickup[] = [];
  score = new Score();
  waveIndex = 0;
  time = 0;
  deathTimer = 0;
  results: { rows: { label: string; pts: number }[]; total: number; stars: number } | null = null;

  /** Camera top-left in world units, and CSS pixels per world unit. */
  camX = 0;
  camY = 0;
  scale = 1;
  viewW = 960;
  shake = 0;
  aimAssist = true;

  private gunshipKills = 0;
  private droneKills = 0;
  private lastAim: { x: number; y: number } | null = null;

  constructor(public sfx: (s: Sfx) => void = () => {}) {
    this.reset();
  }

  setView(cssW: number, cssH: number): void {
    this.scale = cssH / VIEW_H;
    this.viewW = cssW / this.scale;
    if (this.state === 'title') this.camX = this.stage.startX - this.viewW * 0.4;
  }

  start(): void {
    this.reset();
    this.state = 'play';
  }

  /** Puts the stage back to its opening moment without starting play (the title screen shows this). */
  reset(): void {
    const s = this.stage;
    this.clock.reset();
    this.player.spawn(s.startX, 0);
    this.arsenal.reset();
    this.enemies = [];
    this.shots.clear();
    this.fx.clear();
    this.pickups = [];
    this.score.reset();
    this.waveIndex = 0;
    this.time = 0;
    this.deathTimer = 0;
    this.results = null;
    this.gunshipKills = this.droneKills = 0;
    this.camX = s.startX - this.viewW * 0.4;
    this.camY = -VIEW_H * PLAYER_VIEW_Y;
  }

  step(dt: number, i: Intent): void {
    if (i.pausePressed && (this.state === 'play' || this.state === 'paused')) {
      this.state = this.state === 'play' ? 'paused' : 'play';
    }
    if (this.state !== 'play') {
      if (this.state === 'clear' || this.state === 'dead') this.fx.update(dt, dt);
      return;
    }
    const c = this.clock;
    if (i.riftPressed) this.sfx(c.toggleRift() ? 'rift-on' : 'rift-off');
    const wasOn = c.riftOn;
    c.step(dt);
    if (wasOn && !c.riftOn) this.sfx('rift-off');
    this.time += c.real;

    const p = this.player;
    if (p.hp > 0) {
      const wasGround = p.onGround;
      p.update(c.player, i, this.stage.solids);
      if (wasGround && !p.onGround && p.vy < 0) this.sfx('jump');
      this.updateAim(i);
      if (i.swapPressed) {
        this.arsenal.swap();
        this.sfx('swap');
      }
      const pulls = this.arsenal.update(c.player, i.fire, Math.atan2(p.aimY, p.aimX), (a, d) => {
        const mx = p.x + p.aimX * 22;
        const my = p.cy + p.aimY * 22;
        this.shots.spawn('player', d.pellets > 1 ? 'pellet' : 'bullet', mx, my, a, d.speed, d.dmg, d.pellets > 1 ? 3 : 3.5, d.life, d.color, this.arsenal.group);
      });
      if (pulls > 0) {
        this.score.pulls += pulls;
        this.sfx(this.arsenal.current.def.pellets > 1 ? 'scatter' : 'shoot');
        this.fx.spark(p.x + p.aimX * 26, p.cy + p.aimY * 26, 2, this.arsenal.current.def.color, 160, Math.atan2(p.aimY, p.aimX), 0.6);
        this.shake = Math.max(this.shake, this.arsenal.current.def.kick);
      }
    }

    this.spawnWaves();
    this.updateEnemies();
    this.updateShots();
    this.updatePickups();
    this.fx.update(c.world, c.real);
    this.score.tick(c.real);
    this.updateCamera(c.real);
    this.checkEnd(c.real);
  }

  private updateAim(i: Intent): void {
    const p = this.player;
    let ax = 0;
    let ay = 0;
    if (i.aimScreen) {
      ax = this.camX + i.aimScreen.x / this.scale - p.x;
      ay = this.camY + i.aimScreen.y / this.scale - p.cy;
    } else if (i.aim) {
      ax = i.aim.x;
      ay = i.aim.y;
      if (this.aimAssist && i.fire) [ax, ay] = this.assist(ax, ay);
    } else {
      ax = p.facing;
      ay = 0;
    }
    const m = Math.hypot(ax, ay);
    if (m > 0.001) {
      p.aimX = ax / m;
      p.aimY = ay / m;
      this.lastAim = { x: p.aimX, y: p.aimY };
    }
  }

  /** Light aim assist for touch: bends the aim up to 10 degrees toward the nearest enemy near the line. */
  private assist(ax: number, ay: number): [number, number] {
    const p = this.player;
    const a = Math.atan2(ay, ax);
    let best = 10 * DEG;
    let pick = a;
    for (const e of this.enemies) {
      const ea = Math.atan2(e.y - p.cy, e.x - p.x);
      const d = Math.abs(wrapAngle(ea - a));
      if (d < best && dist2(p.x, p.cy, e.x, e.y) < 650 * 650) {
        best = d;
        pick = ea;
      }
    }
    return [Math.cos(pick), Math.sin(pick)];
  }

  private spawnWaves(): void {
    const waves = this.stage.waves;
    while (this.waveIndex < waves.length && this.player.x >= waves[this.waveIndex].triggerX) {
      const w = waves[this.waveIndex++];
      let ahead = 0;
      let behind = 0;
      for (const s of w.spawns) {
        if (typeof s.at === 'number') {
          this.spawnEnemy(s.kind, s.at, (s.y ?? 0) - 18);
          continue;
        }
        const isAhead = s.at === 'ahead';
        const n = isAhead ? ahead++ : behind++;
        const edge = isAhead ? this.camX + this.viewW + 80 + n * 90 : this.camX - 80 - n * 90;
        const y = this.player.y - (s.kind === 'gnat' ? 170 : 230) - rand(0, 50);
        this.spawnEnemy(s.kind, edge, y);
      }
    }
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const e = makeEnemy(kind, x, y);
    if (kind === 'picket') e.aim = -Math.PI / 2;
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(): void {
    const p = this.player;
    const dt = this.clock.world;
    const world: EnemyWorld = {
      px: p.x,
      py: p.cy,
      pvx: p.vx,
      pvy: p.vy,
      fire: (x, y, a, speed, dmg, look) => {
        const r = look === 'orb' ? 7 : look === 'heavy' ? 6 : 4.5;
        const color = look === 'orb' ? '#d07bff' : look === 'heavy' ? '#ff5d7a' : '#ff8a3d';
        this.shots.spawn('enemy', look, x, y, a, speed, dmg, r, 6, color);
        this.sfx('enemy-shot');
      },
    };
    for (const e of this.enemies) updateEnemy(e, dt, world);
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private updateShots(): void {
    const p = this.player;
    const solids = this.stage.solids;
    const hw = p.w / 2 - 3;
    const top = p.y - p.h + 4;
    for (const s of this.shots.items) {
      if (!s.alive) continue;
      const dt = this.clock.shot;
      s.life -= dt;
      if (s.life <= 0) {
        s.alive = false;
        continue;
      }
      s.px = s.x;
      s.py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      let blocked = false;
      for (const b of solids) {
        if (!b.oneWay && s.x > b.x && s.x < b.x + b.w && s.y > b.y && s.y < b.y + b.h) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        s.alive = false;
        this.fx.spark(s.x, s.y, 3, s.color, 140);
        continue;
      }

      if (s.owner === 'player') {
        for (const e of this.enemies) {
          const rr = e.def.r + s.r;
          if (segPointDist2(s.px, s.py, s.x, s.y, e.x, e.y) <= rr * rr) {
            s.alive = false;
            this.score.hitPulls.add(s.group);
            this.damageEnemy(e, s.dmg, s.x, s.y, s.color);
            break;
          }
        }
      } else if (p.hp > 0) {
        // Nearest point on the body box to the shot.
        const nx = clamp(s.x, p.x - hw, p.x + hw);
        const ny = clamp(s.y, top, p.y);
        const d2 = dist2(nx, ny, s.x, s.y);
        if (d2 <= s.r * s.r) {
          s.alive = false;
          if (p.hurt(s.dmg)) {
            this.score.damageTaken += s.dmg;
            this.score.chain = 0;
            this.shake = 10;
            this.sfx('hurt');
            this.fx.spark(s.x, s.y, 8, '#ff5d7a', 220);
          }
        } else if (!s.grazed && d2 <= 22 * 22 && p.invuln <= 0) {
          s.grazed = true;
          if (this.score.closeCall()) this.fx.popup(p.x, p.y - p.h - 14, 'CLOSE +25', '#9fe8ff');
        }
      }
    }
  }

  private damageEnemy(e: Enemy, dmg: number, x: number, y: number, color: string): void {
    e.hp -= dmg;
    e.flash = 0.06;
    this.fx.spark(x, y, 3, color, 180);
    this.sfx('hit');
    if (e.hp > 0) return;
    e.alive = false;
    const d = e.def;
    const [pts, callout] = this.score.kill(d.score);
    this.clock.addEnergy(d.energy);
    this.fx.explode(e.x, e.y, d.r);
    this.fx.popup(e.x, e.y - d.r, `+${pts}`, '#ffe27a');
    if (callout) this.fx.popup(this.player.x, this.player.y - 110, callout, '#ff9e5e', true);
    const big = d.kind === 'brute';
    this.sfx(big ? 'bigboom' : 'boom');
    this.shake = Math.max(this.shake, big ? 16 : d.cls === 'gunship' ? 8 : 4);
    if (d.cls === 'gunship') this.clock.startKillcam(big ? 0.9 : 0.22);
    if (d.cls === 'drone') this.droneKills++;
    else this.gunshipKills++;
    if (big || this.gunshipKills >= 2 || this.droneKills >= 3) {
      if (!big) {
        if (this.gunshipKills >= 2) this.gunshipKills = 0;
        else this.droneKills = 0;
      }
      this.dropPickup(e.x, e.y);
    }
  }

  private dropPickup(x: number, y: number): void {
    const p = this.player;
    const rifle = this.arsenal.owned[1];
    const scatter = this.arsenal.owned[2];
    const w = {
      health: p.hp < 50 ? 4 : p.hp < 80 ? 2 : 0.6,
      energy: this.clock.energy < 40 ? 2.5 : 1,
      rifle: rifle.ammo < 40 ? 3 : 1.2,
      scatter: scatter.ammo < 8 ? 2.5 : 1,
    };
    let r = rand(0, w.health + w.energy + w.rifle + w.scatter);
    let kind: Pickup['kind'] = 'scatter';
    for (const k of ['health', 'energy', 'rifle'] as const) {
      if ((r -= w[k]) < 0) {
        kind = k;
        break;
      }
    }
    this.pickups.push({ alive: true, kind, x, y, vy: -120, life: 14 });
  }

  private updatePickups(): void {
    const p = this.player;
    const dt = this.clock.world;
    for (const k of this.pickups) {
      k.life -= dt;
      if (k.life <= 0) k.alive = false;
      k.vy = Math.min(500, k.vy + 900 * dt);
      const ny = k.y + k.vy * dt;
      let landed = false;
      for (const s of this.stage.solids) {
        if (k.x > s.x && k.x < s.x + s.w && k.y <= s.y && ny >= s.y) {
          k.y = s.y;
          k.vy = 0;
          landed = true;
          break;
        }
      }
      if (!landed) k.y = ny;
      // Magnet toward the player when close.
      const d2 = dist2(k.x, k.y - 12, p.x, p.cy);
      if (d2 < 90 * 90) {
        k.x = lerp(k.x, p.x, Math.min(1, dt * 8));
        k.y = lerp(k.y, p.cy, Math.min(1, dt * 8));
      }
      if (d2 < 28 * 28 && p.hp > 0) {
        k.alive = false;
        this.collect(k);
      }
    }
    this.pickups = this.pickups.filter((k) => k.alive);
  }

  private collect(k: Pickup): void {
    const p = this.player;
    let label = '';
    if (k.kind === 'health') {
      p.hp = Math.min(p.maxHp, p.hp + 30);
      label = '+30 HP';
    } else if (k.kind === 'energy') {
      this.clock.addEnergy(35);
      label = '+35 RIFT';
    } else {
      const def = WEAPONS[k.kind];
      this.arsenal.addAmmo(k.kind, def.id === 'rifle' ? 60 : 10);
      // Out of ammo and back on the sidearm: pick the new ammo's gun straight up.
      if (this.arsenal.index === 0) this.arsenal.index = this.arsenal.owned.findIndex((o) => o.def.id === k.kind);
      label = def.name.toUpperCase();
    }
    this.fx.popup(p.x, p.y - p.h - 20, label, '#8cffb0');
    this.sfx('pickup');
  }

  private updateCamera(dt: number): void {
    const p = this.player;
    const lookX = p.aimX * 70 + p.vx * 0.25;
    const tx = clamp(p.x - this.viewW / 2 + lookX, -200, this.stage.endX + 300 - this.viewW);
    const ty = p.y - VIEW_H * PLAYER_VIEW_Y;
    this.camX = lerp(this.camX, tx, Math.min(1, dt * 6));
    this.camY = lerp(this.camY, Math.min(ty, -VIEW_H * PLAYER_VIEW_Y + 60), Math.min(1, dt * 4));
    this.shake = Math.max(0, this.shake - dt * 40);
  }

  private checkEnd(dt: number): void {
    const p = this.player;
    if (p.hp <= 0) {
      if (this.deathTimer === 0) {
        this.fx.explode(p.x, p.cy, 30);
        this.sfx('bigboom');
        this.clock.riftOn = false;
      }
      this.deathTimer += dt;
      if (this.deathTimer > 1.4) this.state = 'dead';
      return;
    }
    if (this.waveIndex >= this.stage.waves.length && this.enemies.length === 0) {
      const rows = this.score.stageBonus(this.time, this.stage.parTime, p.hp);
      for (const r of rows) this.score.points += r.pts;
      const total = this.score.points;
      const stars = 1 + (total >= this.stage.stars[0] ? 1 : 0) + (total >= this.stage.stars[1] ? 1 : 0);
      this.results = { rows, total, stars };
      this.state = 'clear';
      this.clock.riftOn = false;
      this.sfx('clear');
    }
  }
}
