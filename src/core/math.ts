export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
export const sign = (v: number): number => (v < 0 ? -1 : 1);

/** Moves `cur` toward `target` by at most `step`. */
export function approach(cur: number, target: number, step: number): number {
  if (cur < target) return Math.min(cur + step, target);
  return Math.max(cur - step, target);
}

/** Wraps an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  while (a <= -Math.PI) a += TAU;
  while (a > Math.PI) a -= TAU;
  return a;
}

/** Turns angle `cur` toward `target` by at most `step` radians, the short way round. */
export function turnToward(cur: number, target: number, step: number): number {
  const d = wrapAngle(target - cur);
  if (Math.abs(d) <= step) return target;
  return wrapAngle(cur + Math.sign(d) * step);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Squared distance from point (px,py) to the segment (ax,ay)-(bx,by). */
export function segPointDist2(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len > 0 ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  t = clamp(t, 0, 1);
  return dist2(ax + dx * t, ay + dy * t, px, py);
}
