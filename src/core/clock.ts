import { approach, lerp } from './math';

/** Tunables for the Time Rift. World things run at `worldScale` while it is on; the player keeps full speed. */
export const RIFT = {
  worldScale: 0.3,
  startCost: 4,
  drainPerSec: 18,
  minToStart: 12,
  blendSec: 0.12,
  startEnergy: 60,
  maxEnergy: 100,
};

/** Kill-cam slows every clock equally so relative timing never drifts. */
const KILLCAM_SCALE = 0.35;

/**
 * Splits each fixed step into four clocks:
 * real (UI, energy), player (movement, aim, cooldowns), world (enemies, their shots, effects)
 * and shot (player projectiles, same as world).
 */
export class Clock {
  energy = RIFT.startEnergy;
  riftOn = false;
  /** 0 = normal time, 1 = full rift. */
  blend = 0;
  killcam = 0;

  real = 0;
  player = 0;
  world = 0;
  shot = 0;

  get worldScale(): number {
    return lerp(1, RIFT.worldScale, this.blend);
  }

  reset(): void {
    this.energy = RIFT.startEnergy;
    this.riftOn = false;
    this.blend = 0;
    this.killcam = 0;
  }

  /** Returns true if the rift is now on. */
  toggleRift(): boolean {
    if (this.riftOn) {
      this.riftOn = false;
    } else if (this.energy >= RIFT.minToStart) {
      this.energy -= RIFT.startCost;
      this.riftOn = true;
    }
    return this.riftOn;
  }

  addEnergy(n: number): void {
    this.energy = Math.min(RIFT.maxEnergy, this.energy + n);
  }

  startKillcam(sec: number): void {
    this.killcam = Math.max(this.killcam, sec);
  }

  step(dt: number): void {
    if (this.riftOn) {
      this.energy -= RIFT.drainPerSec * dt;
      if (this.energy <= 0) {
        this.energy = 0;
        this.riftOn = false;
      }
    }
    this.blend = approach(this.blend, this.riftOn ? 1 : 0, dt / RIFT.blendSec);
    const kc = this.killcam > 0 ? KILLCAM_SCALE : 1;
    this.killcam = Math.max(0, this.killcam - dt);
    this.real = dt;
    this.player = dt * kc;
    this.world = dt * this.worldScale * kc;
    this.shot = this.world;
  }
}
