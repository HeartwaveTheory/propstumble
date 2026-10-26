import { describe, expect, it } from 'vitest';
import { Clock, RIFT } from '../src/core/clock';

const STEP = 1 / 60;

describe('Time Rift clock', () => {
  it('slows the world but not the player', () => {
    const c = new Clock();
    c.toggleRift();
    for (let i = 0; i < 30; i++) c.step(STEP);
    expect(c.player).toBeCloseTo(STEP);
    expect(c.world).toBeCloseTo(STEP * RIFT.worldScale);
    expect(c.shot).toBe(c.world);
  });

  it('charges the start cost, drains, and switches itself off when empty', () => {
    const c = new Clock();
    expect(c.toggleRift()).toBe(true);
    expect(c.energy).toBe(RIFT.startEnergy - RIFT.startCost);
    for (let i = 0; i < 60; i++) c.step(STEP);
    expect(c.energy).toBeCloseTo(RIFT.startEnergy - RIFT.startCost - RIFT.drainPerSec, 1);
    for (let i = 0; i < 60 * 5; i++) c.step(STEP);
    expect(c.riftOn).toBe(false);
    expect(c.energy).toBe(0);
  });

  it('will not start below the minimum energy', () => {
    const c = new Clock();
    c.energy = RIFT.minToStart - 1;
    expect(c.toggleRift()).toBe(false);
    expect(c.energy).toBe(RIFT.minToStart - 1);
  });

  it('blends in over the blend time instead of snapping', () => {
    const c = new Clock();
    c.toggleRift();
    c.step(STEP);
    expect(c.blend).toBeGreaterThan(0);
    expect(c.blend).toBeLessThan(1);
    for (let i = 0; i < Math.ceil(RIFT.blendSec / STEP); i++) c.step(STEP);
    expect(c.blend).toBe(1);
  });

  it('kill-cam scales every clock by the same amount', () => {
    const c = new Clock();
    c.startKillcam(0.5);
    c.step(STEP);
    expect(c.world / c.player).toBeCloseTo(1);
    expect(c.player).toBeLessThan(STEP);
    expect(c.real).toBe(STEP);
  });
});
