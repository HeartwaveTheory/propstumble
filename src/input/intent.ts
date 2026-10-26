/** What the player wants this step, independent of keyboard or touch. Edge flags are cleared after each step. */
export interface Intent {
  moveX: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
  hyperPressed: boolean;
  crouch: boolean;
  dropPressed: boolean;
  /** Aim as a unit vector, or null to keep the last aim. */
  aim: { x: number; y: number } | null;
  /** Aim at a screen point (mouse); the game turns it into a direction. */
  aimScreen: { x: number; y: number } | null;
  fire: boolean;
  riftPressed: boolean;
  swapPressed: boolean;
  grenadePressed: boolean;
  pausePressed: boolean;
}

export function emptyIntent(): Intent {
  return {
    moveX: 0,
    jumpHeld: false,
    jumpPressed: false,
    hyperPressed: false,
    crouch: false,
    dropPressed: false,
    aim: null,
    aimScreen: null,
    fire: false,
    riftPressed: false,
    swapPressed: false,
    grenadePressed: false,
    pausePressed: false,
  };
}

export function clearEdges(i: Intent): void {
  i.jumpPressed = false;
  i.hyperPressed = false;
  i.dropPressed = false;
  i.riftPressed = false;
  i.swapPressed = false;
  i.grenadePressed = false;
  i.pausePressed = false;
}
