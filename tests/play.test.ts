import { describe, expect, it } from 'vitest';
import { Clock } from '../src/core/clock';
import { emptyIntent } from '../src/input/intent';
import { Game } from '../src/game/game';
import { Player, MOVE } from '../src/game/player';
import type { Solid } from '../src/game/level';
import { Arsenal } from '../src/game/weapons';
import { updateEnemy, makeEnemy, type EnemyWorld } from '../src/game/enemies';
import { multiplierFor } from '../src/game/scoring';

const STEP = 1 / 60;
const floor: Solid[] = [{ x: -5000, y: 0, w: 10000, h: 800, oneWay: false }];

function apex(hyper: boolean): number {
  const p = new Player();
  p.spawn(0, 0);
  const i = emptyIntent();
  p.update(STEP, i, floor);
  i.jumpHeld = true;
  if (hyper) i.hyperPressed = true;
  else i.jumpPressed = true;
  let top = 0;
  for (let n = 0; n < 120; n++) {
    p.update(STEP, i, floor);
    i.jumpPressed = i.hyperPressed = false;
    top = Math.min(top, p.y);
  }
  return -top;
}

describe('movement', () => {
  it('jumps to about the designed apex', () => {
    expect(apex(false)).toBeGreaterThan(MOVE.jumpApex * 0.93);
    expect(apex(false)).toBeLessThan(MOVE.jumpApex * 1.03);
  });

  it('hyper-jumps about 2.5x higher', () => {
    const r = apex(true) / apex(false);
    expect(r).toBeGreaterThan(2.3);
    expect(r).toBeLessThan(2.8);
  });

  it('can drop through a catwalk but not through the ground', () => {
    const solids: Solid[] = [...floor, { x: -100, y: -150, w: 200, h: 14, oneWay: true }];
    const p = new Player();
    p.spawn(0, -150);
    const i = emptyIntent();
    for (let n = 0; n < 5; n++) p.update(STEP, i, solids);
    expect(p.y).toBe(-150);
    i.dropPressed = true;
    p.update(STEP, i, solids);
    i.dropPressed = false;
    for (let n = 0; n < 60; n++) p.update(STEP, i, solids);
    expect(p.y).toBe(0);
  });
});

describe('Time Rift fairness', () => {
  it('the rifle fires the same rounds per real second with and without the rift', () => {
    const count = (rift: boolean) => {
      const c = new Clock();
      if (rift) c.toggleRift();
      const a = new Arsenal();
      a.reset();
      a.index = 1;
      let shots = 0;
      for (let n = 0; n < 60; n++) {
        c.step(STEP);
        a.update(c.player, true, 0, () => shots++);
      }
      return shots;
    };
    expect(count(true)).toBe(count(false));
  });

  it('turret fire drops to about 30% inside the rift', () => {
    const fired = (rift: boolean) => {
      const c = new Clock();
      c.energy = 100000;
      if (rift) c.toggleRift();
      const e = makeEnemy('picket', 0, -18);
      let shots = 0;
      const w: EnemyWorld = { px: 200, py: -25, pvx: 0, pvy: 0, fire: () => shots++ };
      for (let n = 0; n < 60 * 60; n++) {
        c.step(STEP);
        updateEnemy(e, c.world, w);
      }
      return shots;
    };
    const ratio = fired(true) / fired(false);
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.36);
  });
});

describe('scoring', () => {
  it('climbs the combo multiplier at 2, 4, 7 and 11 kills', () => {
    expect([1, 2, 3, 4, 6, 7, 10, 11, 30].map(multiplierFor)).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});

describe('stage', () => {
  it('spawns every wave as the player walks through and can be cleared', () => {
    const g = new Game();
    g.setView(844, 390);
    g.start();
    const i = emptyIntent();
    for (let n = 0; n < 60 * 120 && g.state === 'play'; n++) {
      g.player.x += 3;
      g.player.hp = g.player.maxHp;
      for (const e of g.enemies) e.hp = 0;
      // Let the game's own hit code finish them off: a point-blank shot at each.
      for (const e of g.enemies) g.shots.spawn('player', 'bullet', e.x - 1, e.y, 0, 10, 999, 4, 1, '#fff');
      g.step(STEP, i);
    }
    expect(g.waveIndex).toBe(g.stage.waves.length);
    expect(g.state).toBe('clear');
    expect(g.results!.stars).toBeGreaterThanOrEqual(1);
  });
});
