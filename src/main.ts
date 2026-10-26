import { Audio } from './audio/audio';
import { Game } from './game/game';
import { clearEdges, emptyIntent } from './input/intent';
import { KeyboardMouse } from './input/keyboard';
import { TouchControls } from './input/touch';
import { Renderer } from './render/render';
import { Menus } from './ui/menus';

const STEP = 1 / 60;
const MAX_STEPS = 5;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const audio = new Audio();
const game = new Game((s) => audio.play(s));
const renderer = new Renderer(canvas);
const unlock = () => audio.unlock();
const keys = new KeyboardMouse(canvas, unlock);
const touch = new TouchControls(canvas, unlock);
const intent = emptyIntent();
const menus = new Menus(game, () => {
  unlock();
  game.start();
});

function resize(): void {
  renderer.resize();
  game.setView(renderer.cssW, renderer.cssH);
  touch.layout(renderer.cssW, renderer.cssH);
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', (e) => {
  if ((e.code === 'Enter' || e.code === 'Space') && (game.state === 'title' || game.state === 'dead' || game.state === 'clear')) {
    unlock();
    game.start();
  }
});

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  const real = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += real;
  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS) {
    keys.apply(intent);
    touch.apply(intent);
    game.step(STEP, intent);
    clearEdges(intent);
    acc -= STEP;
    steps++;
  }
  if (steps === MAX_STEPS) acc = 0;
  renderer.draw(game, touch, real);
  menus.sync();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for automated playtests.
(window as unknown as { __game: Game }).__game = game;
