// Boot: wire the world, renderer and input together and run a fixed-step loop.
// Also exposes window.__TURKEY__ = { start, step, state, reset } so the game can
// be driven programmatically (screenshots, automated playtests).

import { CONFIG, SCREEN, END_REASON } from './config.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { shotFromURL, driveShot } from './shots.js';

async function boot() {
  const canvas = document.getElementById('game');
  const renderer = new Renderer(canvas);
  const world = new World(1);
  const input = new Input(window);

  const STEP = 1 / 120;          // fixed physics step (s)
  const MAX_STEPS = 6;           // avoid a spiral of death after a stall
  let accumulator = 0;
  let last = performance.now();
  let running = true;

  function frame(now) {
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;    // tab was hidden; don't fast-forward
    accumulator += dt;

    // tell the input layer whether touch/mouse should steer (only mid-run)
    input.setSteering(world.screen === SCREEN.PLAY);

    // `world.frozen` pins the simulation (screenshot capture): the renderer
    // still draws every frame, but time does not advance.
    let steps = 0;
    if (!world.frozen) {
      while (accumulator >= STEP && steps < MAX_STEPS) {
        world.step(STEP, input);
        input.consumeEdges();
        accumulator -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) accumulator = 0; // drop the backlog
    } else {
      accumulator = 0;
    }

    renderer.frame(world, input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- debug / test harness -----------------------------------------------
  // step(dtSeconds, inputOverride): advance the simulation deterministically
  // without relying on the animation loop. Returns the resulting screen.
  function step(dtSeconds, inputOverride) {
    const total = Number(dtSeconds) || 0;
    const useOverride = inputOverride != null;
    let elapsed = 0;
    while (elapsed < total - 1e-9) {
      const dt = Math.min(STEP, total - elapsed);
      const src = useOverride ? inputOverride : input;
      world.step(dt, src);
      if (!useOverride) input.consumeEdges();
      elapsed += dt;
    }
    renderer.frame(world, input);
    return world.screen;
  }

  function state() {
    return {
      screen: world.screen,
      endReason: world.endReason,
      score: Math.floor(world.score),
      distance: Math.floor(world.distance),
      lives: world.lives,
      speed: world.speed,
      stage: world.currentStage().name,
      turkey: { x: world.turkey.x, y: world.turkey.y, onGround: world.turkey.onGround, ducking: world.turkey.ducking },
      farmerGap: Math.floor(world.turkey.x - (world.farmer.x + world.farmer.w)),
      hazards: { ovens: world.ovens.length, knives: world.knives.length, corn: world.corn.length },
    };
  }

  function start(seed) {
    world.startRun(seed);
    renderer.frame(world, input);
    return world.screen;
  }

  function reset(seed) {
    world.reset(seed);
    renderer.frame(world, input);
    return world.screen;
  }

  window.__TURKEY__ = { start, step, state, reset, world, CONFIG, SCREEN, END_REASON };

  // Screenshot driver: when opened with ?shot=<name>, walk to that state.
  const shot = shotFromURL();
  if (shot) {
    try {
      await driveShot(shot);
    } catch (err) {
      console.warn('shot driver failed:', err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
