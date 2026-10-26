export type ShotOwner = 'player' | 'enemy';
export type ShotLook = 'bullet' | 'pellet' | 'orb' | 'heavy';

export interface Shot {
  alive: boolean;
  owner: ShotOwner;
  look: ShotLook;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  /** Trigger pull this shot belongs to, for accuracy. */
  group: number;
  grazed: boolean;
  color: string;
}

/** Fixed pool so firing never allocates. */
export class ShotPool {
  readonly items: Shot[] = [];
  private next = 0;

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      this.items.push({
        alive: false,
        owner: 'enemy',
        look: 'bullet',
        x: 0,
        y: 0,
        px: 0,
        py: 0,
        vx: 0,
        vy: 0,
        r: 4,
        dmg: 0,
        life: 0,
        group: 0,
        grazed: false,
        color: '#fff',
      });
    }
  }

  spawn(
    owner: ShotOwner,
    look: ShotLook,
    x: number,
    y: number,
    angle: number,
    speed: number,
    dmg: number,
    r: number,
    life: number,
    color: string,
    group = 0,
  ): Shot {
    // Round-robin; if the pool is full the oldest shot is reused.
    let s = this.items[this.next];
    for (let n = 0; n < this.items.length; n++) {
      const c = this.items[(this.next + n) % this.items.length];
      if (!c.alive) {
        s = c;
        this.next = (this.next + n + 1) % this.items.length;
        break;
      }
    }
    s.alive = true;
    s.owner = owner;
    s.look = look;
    s.x = s.px = x;
    s.y = s.py = y;
    s.vx = Math.cos(angle) * speed;
    s.vy = Math.sin(angle) * speed;
    s.dmg = dmg;
    s.r = r;
    s.life = life;
    s.group = group;
    s.grazed = false;
    s.color = color;
    return s;
  }

  clear(): void {
    for (const s of this.items) s.alive = false;
  }
}
