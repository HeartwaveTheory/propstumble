import type { Game, GameState } from '../game/game';

/** Title, pause and end screens, as plain DOM over the canvas. */
export class Menus {
  private root: HTMLElement;
  private shown: GameState | null = null;

  constructor(
    private game: Game,
    private onStart: () => void,
  ) {
    this.root = document.getElementById('menu')!;
    this.root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
      if (act === 'start') this.onStart();
      if (act === 'resume') this.game.state = 'play';
    });
  }

  sync(): void {
    const s = this.game.state;
    if (s === this.shown) return;
    this.shown = s;
    this.root.className = s === 'play' ? 'hidden' : '';
    this.root.innerHTML = this.html(s);
  }

  private html(s: GameState): string {
    const touch = matchMedia('(pointer: coarse)').matches;
    switch (s) {
      case 'title':
        return `
          <h1>PROPELLAR<br><span>STUMBLE</span></h1>
          <p class="sub">Run one way, shoot the other. Tear a Time Rift to slow the world while you keep full speed.</p>
          <button data-act="start">Play</button>
          <p class="help">${
            touch
              ? 'Left thumb: drag to run, flick up to jump, hold down then flick up to hyper-jump, flick down to drop.<br>Right thumb: aim, push further to fire. ⧗ = Time Rift, ⇄ = swap weapon.'
              : 'A/D run · W or Space jump · S crouch · Shift+jump hyper-jump · X drop<br>Mouse aims and fires · F Time Rift · Q/E or wheel swap · P pause'
          }</p>
          <p class="rotate">Turn your phone sideways</p>`;
      case 'paused':
        return `<h2>Paused</h2><button data-act="resume">Resume</button><button class="ghost" data-act="start">Restart</button>`;
      case 'dead':
        return `<h2>Shot down</h2><p class="sub">Score ${this.game.score.points.toLocaleString()}</p><button data-act="start">Try again</button>`;
      case 'clear': {
        const r = this.game.results!;
        const rows = r.rows.map((x) => `<tr><td>${x.label}</td><td>+${x.pts.toLocaleString()}</td></tr>`).join('');
        const stars = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
        return `<h2>${this.game.stage.name} clear</h2><div class="stars">${stars}</div>
          <table>${rows}<tr class="total"><td>Total</td><td>${r.total.toLocaleString()}</td></tr></table>
          <p class="sub">Best chain ${this.game.score.bestChain} · Close calls ${this.game.score.closeCalls}</p>
          <button data-act="start">Play again</button>`;
      }
      default:
        return '';
    }
  }
}
