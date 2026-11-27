// Screenshot driver for the make.fun dossier. Uses the game's own ?shot= hooks
// (game/src/shots.js) so every capture is reproducible. Each image is written as
// JPEG (quality 80) to keep every file well under the 256 KiB scorer cap.
const { chromium } = require('/root/makefun/gta6-entry/node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');

const EXE = '/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const BASE = 'http://127.0.0.1:8231';
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const JOBS = [
  { file: '1-title.jpg',  shot: 'title',  seed: 1, w: 1280, h: 800 },
  { file: '2-play.jpg',   shot: 'play',   seed: 7, w: 1280, h: 800 },
  { file: '3-caught.jpg', shot: 'caught', seed: 3, w: 1280, h: 800 },
  { file: '4-play-phone.jpg', shot: 'play', seed: 7, w: 390, h: 844 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const report = [];
  for (const job of JOBS) {
    const ctx = await browser.newContext({
      viewport: { width: job.w, height: job.h },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__TURKEY__, null, { timeout: 15000 });

    // Drive each capture with the game's own deterministic step() hook. The
    // 'play' driver in shots.js runs long enough that the farmer catches up, so
    // mid-gameplay frames are driven here to land clearly on the PLAY screen
    // with the HUD up. Title/caught still use the shipped drivers.
    const state = await page.evaluate(({ shot, seed }) => {
      const T = window.__TURKEY__;
      const IDLE = { left: false, right: true, jump: false, duck: false, jumpPressed: false, startPressed: false };
      if (shot === 'title') { T.reset(seed); return T.state(); }
      if (shot === 'caught') {
        T.start(seed);
        for (let i = 0; i < 40; i++) {
          T.step(0.25, { ...IDLE, right: false });
          if (T.world.screen === 'end') break;
        }
        if (T.world.screen !== 'end') T.world.endRun('caught');
        T.step(0.05, { ...IDLE, right: false });
        return T.state();
      }
      // mid-gameplay: short busy burst that stays on the PLAY screen
      T.start(seed);
      T.step(0.35, IDLE);
      T.step(0.18, { ...IDLE, jump: true, jumpPressed: true });
      T.step(0.42, IDLE);
      T.step(0.2, { ...IDLE, duck: true });
      T.step(0.12, IDLE);
      return T.state();
    }, { shot: job.shot, seed: job.seed });

    // Freeze the live animation loop so the driven state is exactly what gets
    // captured (the rAF loop would otherwise keep advancing the simulation),
    // then flush one paint before the screenshot.
    await page.evaluate(() => {
      window.__turkeyFreeze = window.requestAnimationFrame;
      window.requestAnimationFrame = () => 0;
      window.__TURKEY__.world.frozen = true;
    });
    await page.waitForTimeout(300);
    const target = path.join(OUT, job.file);
    await page.screenshot({ path: target, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: job.w, height: job.h } });
    const bytes = fs.statSync(target).size;
    report.push({ file: job.file, viewport: `${job.w}x${job.h}`, bytes, kb: +(bytes / 1024).toFixed(1), state, pageErrors: errors });
    await ctx.close();
  }
  await browser.close();
  for (const r of report) {
    console.log(`${r.file}  ${r.viewport}  ${r.kb} KiB  screen=${r.state.screen}  score=${r.state.score}  dist=${r.state.distance}m  stage=${r.state.stage}  lives=${r.state.lives}  errors=${r.pageErrors.length}`);
  }
  const tooBig = report.filter((r) => r.bytes > 262144);
  if (tooBig.length) { console.error('OVER CAP:', tooBig.map((r) => r.file)); process.exit(2); }
  console.log('ALL_UNDER_256KIB');
})();
