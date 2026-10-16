/**
 * Renders the XVS crest into the PNG icons an installed app needs.
 *
 * These are the fallback icons: the backend serves each school's own manifest
 * and icons from its crest, and these stand in where a school has none. The
 * crest sits on a white square; the maskable icon keeps it inside the middle
 * 60%, the safe zone a phone may crop its own shape from.
 *
 * Drives the installed Google Chrome through Playwright (no browser download),
 * as school-fe's overflow probe does. Run with `npm run icons` after the crest
 * changes and commit the PNGs it writes.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const crest = readFileSync(join(root, "public/svg/xvs-logo.svg"), "utf8");

const ICONS = [
  { file: "icon-192.png", size: 192, fill: 0.8 },
  { file: "icon-512.png", size: 512, fill: 0.8 },
  { file: "maskable-512.png", size: 512, fill: 0.6 },
  { file: "apple-touch-icon.png", size: 180, fill: 0.78 },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
for (const { file, size, fill } of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;
    display:flex;align-items:center;justify-content:center;background:#FFFFFF">
    <div style="height:${Math.round(size * fill)}px;display:flex">${crest.replace("<svg ", '<svg style="height:100%;width:auto" ')}</div>
    </body></html>`);
  await page.screenshot({ path: join(root, "public/icons", file), omitBackground: false });
  console.log(`public/icons/${file}`);
}
await browser.close();
