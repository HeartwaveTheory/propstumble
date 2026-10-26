// Bundles the game into one self-contained dist/index.html. `node build.mjs --serve` rebuilds on change and serves it.
import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';

const serve = process.argv.includes('--serve');

async function build() {
  const out = await esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    minify: !serve,
    format: 'iife',
    target: 'es2020',
    write: false,
  });
  const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  const css = readFileSync('src/styles.css', 'utf8');
  const html = readFileSync('index.html', 'utf8')
    .replace('/*STYLES*/', () => css)
    .replace('/*SCRIPT*/', () => js);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  return html.length;
}

const size = await build();
console.log(`dist/index.html ${(size / 1024).toFixed(0)} KB`);

if (serve) {
  const ctx = await esbuild.context({ entryPoints: ['src/main.ts'], bundle: true, write: false, plugins: [{ name: 'rebuild', setup: (b) => b.onEnd(() => build().catch(console.error)) }] });
  await ctx.watch();
  const port = 5173;
  createServer((_, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(readFileSync('dist/index.html'));
  }).listen(port, '0.0.0.0');
  const lan = Object.values(networkInterfaces()).flat().find((n) => n && n.family === 'IPv4' && !n.internal);
  console.log(`Playing at http://localhost:${port}`);
  if (lan) console.log(`On your phone (same Wi-Fi): http://${lan.address}:${port}`);
}
