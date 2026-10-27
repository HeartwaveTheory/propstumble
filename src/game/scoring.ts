/** Kills within this many real seconds chain into a combo. */
export const COMBO_WINDOW = 3;
const MULT_AT = [
  [11, 5],
  [7, 4],
  [4, 3],
  [2, 2],
] as const;
const CALLOUTS: Record<number, string> = { 2: 'DOUBLE', 3: 'TRIPLE', 5: 'RAMPAGE', 8: 'WRECKING', 12: 'UNSTOPPABLE', 20: 'PROPELLAR STORM' };

export const CLOSE_CALL = { dist: 22, points: 25, cooldown: 0.35 };

export const BONUS = { clear: 2000, perSecUnderPar: 40, perHp: 15, flawless: 3000, perAccuracyPct: 30 };

export function multiplierFor(chain: number): number {
  for (const [n, m] of MULT_AT) if (chain >= n) return m;
  return 1;
}

export class Score {
  points = 0;
  chain = 0;
  comboTimer = 0;
  bestChain = 0;
  kills = 0;
  pulls = 0;
  hitPulls = new Set<number>();
  closeCalls = 0;
  closeCooldown = 0;
  damageTaken = 0;

  reset(): void {
    this.points = this.chain = this.comboTimer = this.bestChain = this.kills = this.pulls = 0;
    this.closeCalls = this.closeCooldown = this.damageTaken = 0;
    this.hitPulls.clear();
  }

  get mult(): number {
    return multiplierFor(this.chain);
  }

  get accuracy(): number {
    return this.pulls > 0 ? this.hitPulls.size / this.pulls : 0;
  }

  /** Returns [points awarded, callout or null]. */
  kill(base: number): [number, string | null] {
    this.chain++;
    this.kills++;
    this.bestChain = Math.max(this.bestChain, this.chain);
    this.comboTimer = COMBO_WINDOW;
    const pts = base * this.mult;
    this.points += pts;
    return [pts, CALLOUTS[this.chain] ?? null];
  }

  /** Returns true if a close call was scored. */
  closeCall(): boolean {
    if (this.closeCooldown > 0) return false;
    this.closeCooldown = CLOSE_CALL.cooldown;
    this.closeCalls++;
    this.points += CLOSE_CALL.points;
    return true;
  }

  tick(realDt: number): void {
    this.closeCooldown = Math.max(0, this.closeCooldown - realDt);
    if (this.comboTimer > 0) {
      this.comboTimer -= realDt;
      if (this.comboTimer <= 0) this.chain = 0;
    }
  }

  stageBonus(time: number, par: number, hp: number): { label: string; pts: number }[] {
    const rows = [
      { label: 'Clear', pts: BONUS.clear },
      { label: 'Time', pts: Math.max(0, Math.floor(par - time)) * BONUS.perSecUnderPar },
      { label: 'Health', pts: Math.round(hp) * BONUS.perHp },
      { label: 'Accuracy', pts: Math.round(this.accuracy * 100) * BONUS.perAccuracyPct },
    ];
    if (this.damageTaken === 0) rows.push({ label: 'Flawless', pts: BONUS.flawless });
    return rows;
  }
}
