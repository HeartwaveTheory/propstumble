import { approach } from '../core/math';
import type { Intent } from '../input/intent';
import type { Solid } from './level';

export const MOVE = {
  run: 255,
  groundAccel: 2600,
  airAccel: 1700,
  gravity: 1800,
  jumpApex: 123,
  hyperApex: 320,
  /** Releasing jump while rising cuts the remaining apex to this fraction. */
  shortHop: 0.45,
  maxFall: 950,
  coyote: 0.1,
  buffer: 0.13,
  hyperCrouchHold: 0.07,
  dropIgnore: 0.24,
  width: 22,
  height: 50,
  crouchHeight: 32,
  tuckHeight: 34,
};

const JUMP_V = Math.sqrt(2 * MOVE.gravity * MOVE.jumpApex);
const HYPER_V = Math.sqrt(2 * MOVE.gravity * MOVE.hyperApex);

export class Player {
  /** Centre x and feet y. */
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  h = MOVE.height;
  onGround = false;
  standingOnOneWay = false;
  facing = 1;
  aimX = 1;
  aimY = 0;
  hp = 100;
  maxHp = 100;
  invuln = 0;
  hurtFlash = 0;
  crouched = false;
  tucked = false;
  hyper = false;
  runPhase = 0;

  private coyote = 0;
  private buffer = 0;
  private bufferHyper = false;
  private crouchTime = 0;
  private dropTimer = 0;
  private cutApplied = false;

  spawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    this.hp = this.maxHp;
    this.invuln = 0;
    this.onGround = false;
  }

  get w(): number {
    return MOVE.width;
  }

  /** Centre of the body, where shots come from and where hits are measured. */
  get cy(): number {
    return this.y - this.h * 0.55;
  }

  update(dt: number, i: Intent, solids: Solid[]): void {
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);

    // Crouch, tuck and hyper-jump charge.
    this.crouched = this.onGround && i.crouch;
    this.tucked = !this.onGround && i.crouch;
    this.crouchTime = this.crouched ? this.crouchTime + dt : 0;
    this.h = this.crouched ? MOVE.crouchHeight : this.tucked ? MOVE.tuckHeight : MOVE.height;

    // Run.
    const target = this.crouched ? 0 : i.moveX * MOVE.run;
    const accel = this.onGround ? MOVE.groundAccel : MOVE.airAccel;
    this.vx = approach(this.vx, target, accel * dt);
    if (i.moveX !== 0) this.facing = Math.sign(i.moveX);
    if (this.onGround) this.runPhase += Math.abs(this.vx) * dt * 0.045;

    // Jump buffering and coyote time.
    this.coyote = this.onGround ? MOVE.coyote : Math.max(0, this.coyote - dt);
    if (i.jumpPressed || i.hyperPressed) {
      this.buffer = MOVE.buffer;
      this.bufferHyper = i.hyperPressed || this.crouchTime >= MOVE.hyperCrouchHold;
    } else {
      this.buffer = Math.max(0, this.buffer - dt);
    }

    if (i.dropPressed && this.onGround && this.standingOnOneWay) {
      this.dropTimer = MOVE.dropIgnore;
      this.onGround = false;
      this.coyote = 0;
      this.buffer = 0;
      this.y += 2;
    }

    if (this.buffer > 0 && this.coyote > 0) {
      this.hyper = this.bufferHyper;
      this.vy = -(this.hyper ? HYPER_V : JUMP_V);
      this.onGround = false;
      this.coyote = 0;
      this.buffer = 0;
      this.cutApplied = false;
      this.crouchTime = 0;
    }

    // Variable height: letting go early while rising trims the jump (not the hyper-jump).
    if (!this.onGround && this.vy < 0 && !i.jumpHeld && !this.cutApplied && !this.hyper) {
      this.vy *= Math.sqrt(MOVE.shortHop);
      this.cutApplied = true;
    }

    this.vy = Math.min(MOVE.maxFall, this.vy + MOVE.gravity * dt);

    this.moveX(this.vx * dt, solids);
    this.moveY(this.vy * dt, solids);
  }

  private overlaps(s: Solid): boolean {
    const hw = this.w / 2;
    return this.x + hw > s.x && this.x - hw < s.x + s.w && this.y > s.y && this.y - this.h < s.y + s.h;
  }

  private moveX(dx: number, solids: Solid[]): void {
    this.x += dx;
    const hw = this.w / 2;
    for (const s of solids) {
      if (s.oneWay || !this.overlaps(s)) continue;
      if (dx > 0) this.x = s.x - hw;
      else if (dx < 0) this.x = s.x + s.w + hw;
      this.vx = 0;
    }
  }

  private moveY(dy: number, solids: Solid[]): void {
    const prevFeet = this.y;
    this.y += dy;
    this.onGround = false;
    this.standingOnOneWay = false;
    const hw = this.w / 2;
    for (const s of solids) {
      const inX = this.x + hw > s.x && this.x - hw < s.x + s.w;
      if (!inX) continue;
      if (s.oneWay) {
        if (this.dropTimer > 0 || dy < 0) continue;
        if (prevFeet <= s.y + 0.5 && this.y >= s.y) {
          this.y = s.y;
          this.vy = 0;
          this.onGround = true;
          this.standingOnOneWay = true;
        }
        continue;
      }
      if (!this.overlaps(s)) {
        // Resting exactly on top still counts as ground.
        if (dy >= 0 && Math.abs(this.y - s.y) < 0.5) {
          this.onGround = true;
          this.vy = 0;
        }
        continue;
      }
      if (dy >= 0 && prevFeet <= s.y + 1) {
        this.y = s.y;
        this.vy = 0;
        this.onGround = true;
      } else if (dy < 0) {
        this.y = s.y + s.h + this.h;
        this.vy = 0;
      }
    }
    if (this.onGround) this.hyper = false;
  }

  /** Returns true if the hit landed. */
  hurt(dmg: number): boolean {
    if (this.invuln > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = 0.45;
    this.hurtFlash = 0.2;
    return true;
  }
}
