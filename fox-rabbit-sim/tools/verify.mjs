/**
 * Browser verification: drives dist/index.html with Playwright, exercises the
 * controls, screenshots each state and fails on any console error, page error,
 * layout overflow or missing mark.
 *
 * Run:  node tools/verify.mjs
 */
// Puppeteer is resolved from the globally installed mermaid-cli, and Chromium
// from PLAYWRIGHT_BROWSERS_PATH, so this runs with nothing added to the project.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const shots = path.join(root, '.verify');
fs.mkdirSync(shots, { recursive: true });

const require = createRequire(import.meta.url);
const puppeteer = require(
  require.resolve('puppeteer', {
    paths: [process.env.PUPPETEER_FROM ?? '/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules'],
  }),
);

const problems = [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 980 });

page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setSeed = async (v) => {
  await page.$eval('#seed', (n, val) => { n.value = val; n.dispatchEvent(new Event('change', { bubbles: true })); }, v);
};
await page.goto(`file://${path.join(root, 'dist', 'index.html')}`);
await sleep(400);

const text = (sel) => page.$eval(sel, (n) => n.textContent.trim());
const count = (sel) => page.$$eval(sel, (n) => n.length);
const readout = async () => ({
  gen: await text('#out-gen'),
  rabbits: await text('#out-rabbits'),
  foxes: await text('#out-foxes'),
});

// ---- initial state ---------------------------------------------------------
const start = await readout();
if (start.gen !== '0' || start.rabbits !== '4' || start.foxes !== '1') {
  problems.push(`bad initial readout: ${JSON.stringify(start)}`);
}
await page.screenshot({ path: path.join(shots, '01-initial.png'), fullPage: true });

// ---- instant speed, step through version 1 ---------------------------------
await page.select('#speed', '0');
for (let i = 0; i < 6; i += 1) {
  await page.click('#btn-step');
  await sleep(90);
}
const v1 = await readout();
if (v1.gen !== '6') problems.push(`v1 did not reach generation 6: ${JSON.stringify(v1)}`);
if (v1.foxes !== '0') problems.push(`v1 foxes should be extinct without immigration, got ${v1.foxes}`);
const v1rows = await count('#tally-body tr');
if (v1rows !== 6) problems.push(`expected 6 tally rows, found ${v1rows}`);
await page.screenshot({ path: path.join(shots, '02-v1-stepped.png'), fullPage: true });

// ---- version 3 with the ODE overlay ---------------------------------------
await page.click('[data-rules="v3"]');
await sleep(120);
const afterSwitch = await readout();
if (afterSwitch.gen !== '0') problems.push('switching rule sets did not reset the run');
const sanctuaryDrawn = await page.evaluate(
  () => document.querySelectorAll('#grid text').length > 0,
);
if (!sanctuaryDrawn) problems.push('sanctuary label not drawn for v3');

await page.click('#show-ode');
for (let i = 0; i < 12; i += 1) {
  await page.click('#btn-step');
  await sleep(70);
}
const v3 = await readout();
if (v3.gen !== '12') problems.push(`v3 did not reach generation 12: ${JSON.stringify(v3)}`);
const polylines = await count('#chart polyline');
if (polylines !== 4) problems.push(`expected 4 polylines (2 series + 2 ODE), found ${polylines}`);
await page.screenshot({ path: path.join(shots, '03-v3-ode.png'), fullPage: true });

// ---- hover tooltip ---------------------------------------------------------
await page.$eval('#chart', (n) => n.scrollIntoView({ block: 'center' }));
await sleep(200);
const chartBox = await page.$eval('#chart', (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
if (chartBox.y < 0) problems.push('chart is off-screen; the hover check would be meaningless');
await page.mouse.move(chartBox.x + chartBox.width * 0.55, chartBox.y + chartBox.height * 0.5, { steps: 6 });
await sleep(260);
const ttHidden = await page.$eval('#tooltip', (n) => n.hidden);
if (ttHidden) problems.push('tooltip did not appear on hover');
const ttText = await text('#tooltip');
if (!/Generation/.test(ttText ?? '')) problems.push(`tooltip content looks wrong: ${ttText}`);

// hovering the far right, past the last played generation, must still resolve
await page.mouse.move(chartBox.x + chartBox.width * 0.96, chartBox.y + chartBox.height * 0.5, { steps: 4 });
await sleep(200);
if (await page.$eval('#tooltip', (n) => n.hidden)) {
  problems.push('tooltip vanishes when hovering past the last played generation');
}
await page.screenshot({ path: path.join(shots, '04-tooltip.png') });

// ---- animated run at normal speed -----------------------------------------
await page.click('#btn-reset');
await page.select('#speed', '900');
await page.click('#btn-step');
await sleep(700);
await page.screenshot({ path: path.join(shots, '05-mid-animation.png'), fullPage: true });
await sleep(3200);

// ---- reproducibility: same seed must give the same trace -------------------
async function trace() {
  await page.click('#btn-reset');
  await page.select('#speed', '0');
  for (let i = 0; i < 8; i += 1) {
    await page.click('#btn-step');
    await sleep(60);
  }
  return page.$eval('#tally-body', (n) => n.innerText);
}
await page.click('[data-rules="v2"]');
await setSeed('7');
const traceA = await trace();
await setSeed('99');
const traceB = await trace();
await setSeed('7');
const traceC = await trace();
if (traceA !== traceC) problems.push('same seed produced a different run — not reproducible');
if (traceA === traceB) problems.push('different seeds produced identical runs — seed is ignored');
await page.screenshot({ path: path.join(shots, '06-v2-seeded.png'), fullPage: true });

// ---- appending a tally row must not scroll the page --------------------
await page.click('#btn-reset');
await page.select('#speed', '0');
await page.click('[data-rules="v2"]');
// Dispatch the clicks from inside the page: puppeteer's own click() scrolls the
// target into view, which would mask whether the APP scrolls the document.
await page.evaluate(() => window.scrollTo(0, 0));
for (let i = 0; i < 10; i += 1) {
  await page.evaluate(() => document.getElementById('btn-step').click());
  await sleep(50);
}
const scrolled = await page.evaluate(() => window.scrollY);
if (scrolled > 4) problems.push(`page scrolled by ${scrolled}px while stepping — it should stay put`);

// ---- layout checks ---------------------------------------------------------
for (const [label, width] of [['desktop', 1440], ['laptop', 1280], ['tablet', 900], ['phone', 420]]) {
  await page.setViewport({ width, height: 960 });
  await sleep(200);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 2) problems.push(`horizontal overflow at ${width}px: ${overflow}px`);
  await page.screenshot({ path: path.join(shots, `07-${label}.png`), fullPage: true });
}

// ---- dark mode -------------------------------------------------------------
await page.setViewport({ width: 1440, height: 980 });
const beforeDark = await count('#grid circle');
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await sleep(350);
const afterDark = await count('#grid circle');
if (beforeDark > 0 && afterDark !== beforeDark) {
  problems.push(`switching to dark mode changed the candies on the board: ${beforeDark} -> ${afterDark}`);
}
await page.screenshot({ path: path.join(shots, '08-dark.png'), fullPage: true });

await browser.close();

if (problems.length) {
  console.error(`\nFAILED — ${problems.length} problem(s):`);
  problems.forEach((p) => console.error('  • ' + p));
  process.exit(1);
}
console.log('\nAll browser checks passed. Screenshots in .verify/');
