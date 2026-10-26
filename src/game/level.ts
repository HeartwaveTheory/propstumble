import type { EnemyKind } from './enemies';

/** Axis-aligned block. y grows downward; the main ground's top is y = 0. */
export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Catwalks: stand on them from above, jump up through them, drop down through them. */
  oneWay: boolean;
}

export interface Spawn {
  kind: EnemyKind;
  /** World x, or 'ahead' / 'behind' to fly in from just off screen on that side of the player. */
  at: number | 'ahead' | 'behind';
  /** World y for turrets (the surface they sit on). */
  y?: number;
}

export interface Wave {
  triggerX: number;
  spawns: Spawn[];
}

export interface Stage {
  name: string;
  startX: number;
  endX: number;
  parTime: number;
  solids: Solid[];
  waves: Wave[];
  /** Score needed for two and three stars. */
  stars: [number, number];
}

const ground = (x: number, w: number): Solid => ({ x, y: 0, w, h: 800, oneWay: false });
const block = (x: number, top: number, w: number): Solid => ({ x, y: top, w, h: -top + 1, oneWay: false });
const walk = (x: number, y: number, w: number): Solid => ({ x, y, w, h: 14, oneWay: true });

export const STAGE_1: Stage = {
  name: 'Brine Yard',
  startX: 80,
  endX: 5500,
  parTime: 150,
  stars: [14000, 24000],
  solids: [
    { x: -600, y: -2000, w: 600, h: 2800, oneWay: false },
    ground(0, 5600),
    { x: 5600, y: -2000, w: 600, h: 2800, oneWay: false },
    block(900, -60, 200),
    block(2200, -90, 260),
    block(3600, -60, 180),
    walk(480, -150, 220),
    walk(1300, -170, 260),
    walk(1720, -290, 220),
    walk(2700, -160, 300),
    walk(3080, -300, 220),
    walk(4100, -170, 280),
    walk(4650, -300, 240),
    walk(5000, -160, 260),
  ],
  waves: [
    { triggerX: 150, spawns: [{ kind: 'wasp', at: 'ahead' }, { kind: 'wasp', at: 'ahead' }] },
    {
      triggerX: 650,
      spawns: [
        { kind: 'picket', at: 1000, y: -60 },
        { kind: 'gnat', at: 'ahead' },
        { kind: 'gnat', at: 'ahead' },
        { kind: 'gnat', at: 'ahead' },
      ],
    },
    {
      triggerX: 1450,
      spawns: [
        { kind: 'picket', at: 1830, y: -290 },
        { kind: 'wasp', at: 'ahead' },
        { kind: 'wasp', at: 'ahead' },
        { kind: 'wasp', at: 'behind' },
      ],
    },
    {
      triggerX: 2250,
      spawns: [
        { kind: 'picket', at: 2330, y: -90 },
        { kind: 'gnat', at: 'ahead' },
        { kind: 'gnat', at: 'ahead' },
        { kind: 'gnat', at: 'behind' },
        { kind: 'gnat', at: 'behind' },
        { kind: 'wasp', at: 'ahead' },
      ],
    },
    {
      triggerX: 2950,
      spawns: [
        { kind: 'picket', at: 3190, y: -300 },
        { kind: 'wasp', at: 'ahead' },
        { kind: 'wasp', at: 'ahead' },
        { kind: 'wasp', at: 'behind' },
      ],
    },
    {
      triggerX: 3700,
      spawns: [
        { kind: 'picket', at: 3690, y: -60 },
        { kind: 'gnat', at: 'ahead' },
        { kind: 'gnat', at: 'ahead' },
        { kind: 'gnat', at: 'ahead' },
        { kind: 'gnat', at: 'behind' },
        { kind: 'gnat', at: 'behind' },
        { kind: 'wasp', at: 'ahead' },
        { kind: 'wasp', at: 'behind' },
      ],
    },
    {
      triggerX: 4450,
      spawns: [
        { kind: 'brute', at: 'ahead' },
        { kind: 'wasp', at: 'ahead' },
        { kind: 'wasp', at: 'behind' },
        { kind: 'picket', at: 5130, y: -160 },
      ],
    },
  ],
};
