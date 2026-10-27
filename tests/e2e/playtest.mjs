// Headless playtest: a simple bot runs right, aims at the nearest enemy, fires and uses the Time Rift.
// Saves screenshots to shots/ and fails on page errors. Usage: node tests/e2e/playtest.mjs [seconds] [width] [height]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Plain require so a globally installed Playwright (NODE_PATH) works as well as a local one.
const { chromium } = createRequire(import.meta.url)('playwright');

const secs = Number(process.argv[2] ?? 40);
const W = Number(process.argv[3] ?? 844);
const H = Number(process.argv[4] ?? 390);
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('file://' + resolve('dist/index.html'));
await page.screenshot({ path: 'shots/0-title.png' });
await page.click('button[data-act=start]');

const read = () =>
  page.evaluate(() => {
    const g = window.__game;
    const p = g.player;
    let best = null;
    let bd = Infinity;
    for (const e of g.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.cy);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return {
      state: g.state,
      x: p.x,
      hp: p.hp,
      score: g.score.points,
      energy: g.clock.energy,
      rift: g.clock.riftOn,
      enemies: g.enemies.length,
      wave: g.waveIndex,
      target: best ? { sx: (best.x - g.camX) * g.scale, sy: (best.y - g.camY) * g.scale, d: bd } : null,
    };
  });

await page.keyboard.down('KeyD');
let shot = 1;
const t0 = Date.now();
let s;
let jumpT = 0;
while ((Date.now() - t0) / 1000 < secs) {
  s = await read();
  if (s.state !== 'play') break;
  if (s.target && s.target.d < 650) {
    await page.mouse.move(s.target.sx, s.target.sy);
    await page.mouse.down();
    if (s.enemies >= 4 && !s.rift && s.energy > 40) await page.keyboard.press('KeyF');
  } else {
    await page.mouse.up();
  }
  // Keep pushing forward but hang back while a wave is up.
  if (s.enemies > 3) await page.keyboard.up('KeyD');
  else await page.keyboard.down('KeyD');
  if (Date.now() - jumpT > 1500) {
    jumpT = Date.now();
    await page.keyboard.press(Math.random() < 0.3 ? 'Shift+KeyW' : 'KeyW');
  }
  const el = (Date.now() - t0) / 1000;
  if (el > shot * (secs / 6)) {
    await page.screenshot({ path: `shots/${shot}-play.png` });
    shot++;
  }
  await page.waitForTimeout(80);
}
await page.mouse.up();
s = await read();
await page.screenshot({ path: 'shots/9-end.png' });
console.log(JSON.stringify({ ...s, target: undefined }));
await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  process.exit(1);
}
