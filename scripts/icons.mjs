// Renders the PWA icons from an SVG with the pre-installed Chromium.
// Usage: node scripts/icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.cwd(), 'public');
mkdirSync(out, { recursive: true });

const mark = (padding, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">
  <rect width="64" height="64" rx="${radius}" fill="#1c2326"/>
  <g transform="translate(${padding} ${padding}) scale(${1 - (2 * padding) / 64})">
    <path d="M19 14v36" stroke="#f4efe6" stroke-width="6" stroke-linecap="round"/>
    <path d="M44 15 25 32l19 18" fill="none" stroke="#d9825a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="47" cy="15" r="5" fill="#f4efe6"/>
  </g>
</svg>`;

const targets = [
  { file: 'pwa-192.png', size: 192, svg: mark(0, 16) },
  { file: 'pwa-512.png', size: 512, svg: mark(0, 16) },
  { file: 'apple-touch-icon.png', size: 180, svg: mark(0, 0) },
  // Maskable: content inside the central 80% safe zone, square background.
  { file: 'pwa-maskable-512.png', size: 512, svg: mark(9, 0) },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { file, size, svg } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(resolve(out, file), png);
  console.log(`public/${file} (${size}px)`);
}
await browser.close();
