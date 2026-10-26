import type { Intent } from './intent';

/** Keyboard and mouse. A/D run, W/Space jump, S crouch, Shift+jump hyper-jump, F rift, Q/E swap, G grenade. */
export class KeyboardMouse {
  private down = new Set<string>();
  private mouse: { x: number; y: number } | null = null;
  private mouseDown = false;
  active = false;

  constructor(target: HTMLElement, private onAny: () => void) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.active = true;
      this.edges.push(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      this.onAny();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
    });
    target.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      this.active = true;
    });
    target.addEventListener('mousedown', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.edges.push('Grenade');
      this.active = true;
      this.onAny();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > 4) this.edges.push('Swap');
    });
  }

  private edges: string[] = [];

  apply(i: Intent): void {
    if (!this.active) return;
    const d = this.down;
    const left = d.has('KeyA') || d.has('ArrowLeft');
    const right = d.has('KeyD') || d.has('ArrowRight');
    i.moveX = (right ? 1 : 0) - (left ? 1 : 0);
    i.jumpHeld = d.has('KeyW') || d.has('Space') || d.has('ArrowUp');
    i.crouch = d.has('KeyS') || d.has('ArrowDown');
    const shift = d.has('ShiftLeft') || d.has('ShiftRight');
    for (const code of this.edges) {
      if (code === 'KeyW' || code === 'Space' || code === 'ArrowUp') {
        if (shift) i.hyperPressed = true;
        else i.jumpPressed = true;
      }
      if (code === 'KeyX' || ((code === 'KeyS' || code === 'ArrowDown') && shift)) i.dropPressed = true;
      if (code === 'KeyF' || code === 'KeyR') i.riftPressed = true;
      if (code === 'KeyQ' || code === 'KeyE' || code === 'Swap') i.swapPressed = true;
      if (code === 'KeyG' || code === 'Grenade') i.grenadePressed = true;
      if (code === 'Escape' || code === 'KeyP') i.pausePressed = true;
    }
    this.edges.length = 0;
    i.aimScreen = this.mouse;
    i.fire = this.mouseDown || d.has('KeyJ');
  }
}
