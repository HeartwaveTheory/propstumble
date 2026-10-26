import { DEG, rand } from '../core/math';

export interface WeaponDef {
  id: 'sidearm' | 'rifle' | 'scatter';
  name: string;
  /** Shots per second on the player clock. */
  rate: number;
  dmg: number;
  speed: number;
  /** Random spread per shot, in degrees either way. */
  spread: number;
  pellets: number;
  /** Fan width for multi-pellet weapons, in degrees. */
  fan: number;
  life: number;
  maxAmmo: number;
  color: string;
  kick: number;
}

export const WEAPONS: Record<WeaponDef['id'], WeaponDef> = {
  sidearm: {
    id: 'sidearm',
    name: 'Peashooter',
    rate: 4.5,
    dmg: 24,
    speed: 920,
    spread: 1,
    pellets: 1,
    fan: 0,
    life: 0.9,
    maxAmmo: Infinity,
    color: '#ffe27a',
    kick: 1,
  },
  rifle: {
    id: 'rifle',
    name: 'Rattler',
    rate: 11,
    dmg: 15,
    speed: 1050,
    spread: 2.5,
    pellets: 1,
    fan: 0,
    life: 0.8,
    maxAmmo: 160,
    color: '#7affd4',
    kick: 1.5,
  },
  scatter: {
    id: 'scatter',
    name: 'Bucketgun',
    rate: 1.7,
    dmg: 12,
    speed: 820,
    spread: 3,
    pellets: 7,
    fan: 22,
    life: 0.42,
    maxAmmo: 28,
    color: '#ff9e5e',
    kick: 5,
  },
};

export interface Owned {
  def: WeaponDef;
  ammo: number;
}

export type FireFn = (angle: number, def: WeaponDef) => void;

/** The weapons the player carries, the current one, and its cooldown on the player clock. */
export class Arsenal {
  owned: Owned[] = [];
  index = 0;
  cooldown = 0;
  /** Bumps once per trigger pull, so a shotgun blast counts as one shot for accuracy. */
  group = 0;

  reset(): void {
    this.owned = [
      { def: WEAPONS.sidearm, ammo: Infinity },
      { def: WEAPONS.rifle, ammo: 120 },
      { def: WEAPONS.scatter, ammo: 14 },
    ];
    this.index = 1;
    this.cooldown = 0;
  }

  get current(): Owned {
    return this.owned[this.index];
  }

  swap(): void {
    for (let n = 1; n <= this.owned.length; n++) {
      const i = (this.index + n) % this.owned.length;
      if (this.owned[i].ammo > 0) {
        this.index = i;
        this.cooldown = Math.min(this.cooldown, 0.12);
        return;
      }
    }
  }

  /** Advances the cooldown and fires as many shots as fit in `dt`. Returns the number of trigger pulls. */
  update(dt: number, wantFire: boolean, aim: number, fire: FireFn): number {
    this.cooldown -= dt;
    if (!wantFire) {
      if (this.cooldown < 0) this.cooldown = 0;
      return 0;
    }
    let pulls = 0;
    while (this.cooldown <= 0) {
      const w = this.current;
      if (w.ammo <= 0) {
        this.index = 0;
        continue;
      }
      const d = w.def;
      this.group++;
      for (let p = 0; p < d.pellets; p++) {
        const fanOff = d.pellets > 1 ? (p / (d.pellets - 1) - 0.5) * d.fan : 0;
        fire(aim + (fanOff + rand(-d.spread, d.spread)) * DEG, d);
      }
      if (w.ammo !== Infinity) w.ammo--;
      this.cooldown += 1 / d.rate;
      pulls++;
    }
    return pulls;
  }

  addAmmo(id: WeaponDef['id'], amount: number): void {
    const w = this.owned.find((o) => o.def.id === id);
    if (w && w.ammo !== Infinity) w.ammo = Math.min(w.def.maxAmmo, w.ammo + amount);
  }
}
