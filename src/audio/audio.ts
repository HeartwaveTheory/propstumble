import type { Sfx } from '../game/game';

/** Tiny synth: every sound is made in code, no files. Starts on the first user gesture. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<Sfx, number>();
  muted = false;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(this.master!);
    o.start();
    o.stop(c.currentTime + dur);
  }

  private hiss(dur: number, vol: number, cutoff: number): void {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(80, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start();
    s.stop(c.currentTime + dur);
  }

  play(s: Sfx): void {
    if (!this.ctx || this.muted) return;
    // Rate-limit busy sounds.
    const now = this.ctx.currentTime;
    const gap = s === 'hit' || s === 'enemy-shot' ? 0.05 : s === 'shoot' ? 0.06 : 0;
    if (gap && now - (this.last.get(s) ?? 0) < gap) return;
    this.last.set(s, now);
    switch (s) {
      case 'shoot':
        this.tone('square', 900, 180, 0.07, 0.12);
        break;
      case 'scatter':
        this.hiss(0.22, 0.5, 3000);
        this.tone('sawtooth', 220, 60, 0.15, 0.2);
        break;
      case 'enemy-shot':
        this.tone('triangle', 520, 300, 0.08, 0.06);
        break;
      case 'hit':
        this.tone('square', 260, 120, 0.04, 0.07);
        break;
      case 'boom':
        this.hiss(0.45, 0.6, 1400);
        this.tone('sine', 120, 40, 0.35, 0.4);
        break;
      case 'bigboom':
        this.hiss(1.1, 0.8, 1800);
        this.tone('sine', 90, 25, 0.9, 0.6);
        break;
      case 'hurt':
        this.tone('sawtooth', 300, 90, 0.18, 0.25);
        break;
      case 'rift-on':
        this.tone('sine', 220, 880, 0.25, 0.2);
        break;
      case 'rift-off':
        this.tone('sine', 880, 220, 0.2, 0.15);
        break;
      case 'pickup':
        this.tone('triangle', 660, 1320, 0.12, 0.2);
        break;
      case 'jump':
        this.tone('triangle', 300, 520, 0.08, 0.08);
        break;
      case 'swap':
        this.tone('square', 400, 600, 0.05, 0.06);
        break;
      case 'clear':
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone('triangle', f, f, 0.25, 0.2), i * 110));
        break;
    }
  }
}
