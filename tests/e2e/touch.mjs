// Drives the two-thumb touch controls in a phone-sized headless browser and checks run, jump, hyper-jump, fire and rift.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const W = 844;
const H = 390;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html'));
await page.tap('button[data-act=start]');
const cdp = await ctx.newCDPSession(page);
const touches = new Map();
const send = (type) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...touches.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })) });
const down = async (id, x, y) => {
  touches.set(id, { x, y });
  await send('touchStart');
};
const move = async (id, x, y, steps = 4) => {
  const p = touches.get(id);
  for (let s = 1; s <= steps; s++) {
    touches.set(id, { x: p.x + ((x - p.x) * s) / steps, y: p.y + ((y - p.y) * s) / steps });
    await send('touchMove');
  }
};
const up = async (id) => {
  const p = touches.get(id);
  touches.delete(id);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [...touches.entries()].map(([i, q]) => ({ id: i, x: q.x, y: q.y })) });
  void p;
};
const g = () => page.evaluate(() => {
  const g = window.__game;
  return { x: g.player.x, y: g.player.y, vy: g.player.vy, pulls: g.score.pulls, rift: g.clock.riftOn, R: 0 };
});
const results = {};
const check = (name, ok) => {
  results[name] = ok;
};

await page.waitForTimeout(300);
const s0 = await g();
await down(1, 200, 280);
await move(1, 270, 280);
await page.waitForTimeout(500);
const s1 = await g();
check('run right', s1.x > s0.x + 50);

// Flick up for a jump.
await move(1, 270, 220, 2);
await page.waitForTimeout(120);
const s2 = await g();
check('jump', s2.y < -30);
await move(1, 270, 280, 3);
await page.waitForTimeout(900);

// Hold down, then flick up: hyper-jump.
await move(1, 270, 330, 3);
await page.waitForTimeout(150);
await move(1, 270, 250, 2);
let top = 0;
for (let n = 0; n < 12; n++) {
  await page.waitForTimeout(50);
  top = Math.min(top, (await g()).y);
}
check('hyper-jump', top < -200);
await up(1);
await page.waitForTimeout(900);

// Right thumb: drag past 30% to fire.
await down(2, 650, 230);
await move(2, 700, 200);
await page.waitForTimeout(500);
const s3 = await g();
check('fire', s3.pulls > s2.pulls);
await up(2);

// Rift button.
const rift = await page.evaluate(() => {
  const b = document.querySelector('canvas');
  return b ? true : false;
});
void rift;
await page.touchscreen.tap(W - 45, H * 0.42);
await page.waitForTimeout(200);
check('rift button', (await g()).rift);
await page.screenshot({ path: 'shots/touch.png' });

await browser.close();
console.log(JSON.stringify(results));
if (errors.length) console.error(errors.join('\n'));
process.exit(Object.values(results).every(Boolean) && !errors.length ? 0 : 1);
