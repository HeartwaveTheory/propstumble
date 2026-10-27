import type { Intent } from './intent';

/** On-screen buttons, in CSS pixels. Laid out from the screen size each frame. */
export interface TouchButton {
  id: 'rift' | 'swap' | 'pause';
  x: number;
  y: number;
  r: number;
}

interface Sample {
  t: number;
  y: number;
}

interface PadTouch {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

const DEAD = 0.14;
const FULL = 0.46;
const FLICK = 0.3;
const FLICK_MS = 140;
const HIGH = 0.82;
const REARM = 0.22;
const CROUCH = 0.42;
// How far down versus sideways the thumb must be to count as a crouch; under 1 so a run-and-pull-down still crouches.
const CROUCH_SLANT = 0.6;
const HYPER_HOLD_MS = 70;
const AIM_MIN = 0.12;
const FIRE_MIN = 0.3;

/**
 * Two-thumb controls. The left half is a floating pad: drag sideways to run, flick up to jump,
 * hold down to crouch, crouch then flick up to hyper-jump, flick down to drop.
 * The right half is a floating aim stick that fires past 30% of its radius.
 */
export class TouchControls {
  active = false;
  left: PadTouch | null = null;
  right: PadTouch | null = null;
  buttons: TouchButton[] = [];
  radius = 70;

  private samples: Sample[] = [];
  private jumpArmed = true;
  private dropArmed = true;
  private peakY = 0;
  private lowY = 0;
  private crouchSince = -1;
  private crouchEndedAt = -1;
  private crouchHeldFor = 0;
  private edges = { jump: false, hyper: false, drop: false, rift: false, swap: false, pause: false };
  private lastAim: { x: number; y: number } | null = null;

  constructor(target: HTMLElement, private onAny: () => void) {
    const opts = { passive: false } as AddEventListenerOptions;
    target.addEventListener('touchstart', (e) => this.start(e), opts);
    target.addEventListener('touchmove', (e) => this.move(e), opts);
    target.addEventListener('touchend', (e) => this.end(e), opts);
    target.addEventListener('touchcancel', (e) => this.end(e), opts);
  }

  layout(w: number, h: number): void {
    this.radius = Math.max(48, Math.min(90, Math.min(w, h) * 0.14));
    const br = Math.max(24, this.radius * 0.5);
    this.buttons = [
      { id: 'rift', x: w - br * 1.5, y: h * 0.42, r: br },
      { id: 'swap', x: w - br * 1.5, y: h * 0.42 - br * 2.6, r: br * 0.8 },
      { id: 'pause', x: 34, y: 34, r: 22 },
    ];
  }

  private hitButton(x: number, y: number): TouchButton | null {
    for (const b of this.buttons) {
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= (b.r * 1.25) ** 2) return b;
    }
    return null;
  }

  private start(e: TouchEvent): void {
    e.preventDefault();
    this.active = true;
    this.onAny();
    const w = window.innerWidth;
    for (const t of Array.from(e.changedTouches)) {
      const b = this.hitButton(t.clientX, t.clientY);
      if (b) {
        this.edges[b.id] = true;
        continue;
      }
      const p: PadTouch = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
      if (t.clientX < w / 2) {
        if (!this.left) {
          this.left = p;
          this.samples = [{ t: performance.now(), y: p.y }];
          this.jumpArmed = true;
          this.dropArmed = true;
          this.peakY = this.lowY = p.y;
          this.crouchSince = -1;
        }
      } else if (!this.right) {
        this.right = p;
      }
    }
  }

  private move(e: TouchEvent): void {
    e.preventDefault();
    const now = performance.now();
    for (const t of Array.from(e.changedTouches)) {
      if (this.left && t.identifier === this.left.id) {
        this.left.x = t.clientX;
        this.left.y = t.clientY;
        this.leftGestures(now);
      } else if (this.right && t.identifier === this.right.id) {
        this.right.x = t.clientX;
        this.right.y = t.clientY;
      }
    }
  }

  private end(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (this.left && t.identifier === this.left.id) this.left = null;
      if (this.right && t.identifier === this.right.id) this.right = null;
    }
  }

  private leftGestures(now: number): void {
    const p = this.left!;
    const R = this.radius;
    // Let the pad follow a thumb that drifts far sideways, so running never runs out of room.
    const dxRaw = p.x - p.ox;
    if (Math.abs(dxRaw) > R * 1.2) p.ox = p.x - Math.sign(dxRaw) * R * 1.2;

    this.samples.push({ t: now, y: p.y });
    while (this.samples.length && now - this.samples[0].t > FLICK_MS) this.samples.shift();
    let maxY = -Infinity;
    let minY = Infinity;
    for (const s of this.samples) {
      if (s.y > maxY) maxY = s.y;
      if (s.y < minY) minY = s.y;
    }
    const dy = (p.y - p.oy) / R;
    const dx = (p.x - p.ox) / R;

    // Crouch tracking, used for hyper-jump.
    const crouching = dy > CROUCH && dy > Math.abs(dx) * CROUCH_SLANT;
    if (crouching && this.crouchSince < 0) this.crouchSince = now;
    if (!crouching && this.crouchSince >= 0) {
      this.crouchHeldFor = now - this.crouchSince;
      this.crouchEndedAt = now;
      this.crouchSince = -1;
    }

    if (this.jumpArmed) {
      if (maxY - p.y >= FLICK * R || dy < -HIGH) {
        const heldCrouch =
          (this.crouchSince >= 0 && now - this.crouchSince >= HYPER_HOLD_MS) ||
          (now - this.crouchEndedAt < FLICK_MS * 1.5 && this.crouchHeldFor >= HYPER_HOLD_MS);
        if (heldCrouch) this.edges.hyper = true;
        else this.edges.jump = true;
        this.jumpArmed = false;
        this.peakY = p.y;
        this.crouchEndedAt = -1;
      }
    } else {
      this.peakY = Math.min(this.peakY, p.y);
      if (p.y - this.peakY >= REARM * R) this.jumpArmed = true;
    }

    if (this.dropArmed) {
      if (p.y - minY >= FLICK * R) {
        this.edges.drop = true;
        this.dropArmed = false;
        this.lowY = p.y;
      }
    } else {
      this.lowY = Math.max(this.lowY, p.y);
      if (this.lowY - p.y >= REARM * R) this.dropArmed = true;
    }
  }

  apply(i: Intent): void {
    if (!this.active) return;
    const R = this.radius;
    if (this.left) {
      const dx = (this.left.x - this.left.ox) / R;
      const dy = (this.left.y - this.left.oy) / R;
      const ax = Math.abs(dx);
      i.moveX = ax < DEAD ? 0 : Math.sign(dx) * Math.min(1, (ax - DEAD) / (FULL - DEAD));
      i.jumpHeld = !this.jumpArmed;
      i.crouch = dy > CROUCH && dy > ax * CROUCH_SLANT;
    } else {
      i.moveX = 0;
      i.jumpHeld = false;
      i.crouch = false;
      this.jumpArmed = true;
    }
    i.fire = false;
    if (this.right) {
      const dx = (this.right.x - this.right.ox) / R;
      const dy = (this.right.y - this.right.oy) / R;
      const m = Math.hypot(dx, dy);
      if (m > AIM_MIN) {
        this.lastAim = { x: dx / m, y: dy / m };
        i.aim = this.lastAim;
        i.fire = m > FIRE_MIN;
      }
    }
    const e = this.edges;
    if (e.jump) i.jumpPressed = true;
    if (e.hyper) i.hyperPressed = true;
    if (e.drop) i.dropPressed = true;
    if (e.rift) i.riftPressed = true;
    if (e.swap) i.swapPressed = true;
    if (e.pause) i.pausePressed = true;
    e.jump = e.hyper = e.drop = e.rift = e.swap = e.pause = false;
  }
}
