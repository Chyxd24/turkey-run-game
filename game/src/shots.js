// Screenshot driver. Open the game with ?shot=<name>&seed=<n> and this module
// walks the simulation to a representative state, so captures are reproducible.
// It waits for window.__TURKEY__ (set by main.js) and then drives the run.

const SHOTS = {
  // Title screen: exactly as the game boots.
  title: async (T) => {
    T.reset(1);
  },

  // Mid-gameplay with the HUD, a couple of hazards and the farmer in chase.
  play: async (T) => {
    T.start(7);
    // jump a little, then let the run settle into a busy frame
    T.step(0.35, { left: false, right: true, jump: false, duck: false, jumpPressed: false, startPressed: false });
    T.step(0.2, { left: false, right: false, jump: true, duck: false, jumpPressed: true, startPressed: false });
    T.step(0.6, { left: false, right: true, jump: false, duck: false, jumpPressed: false, startPressed: false });
    T.step(1.2, { left: false, right: false, jump: false, duck: false, jumpPressed: false, startPressed: false });
  },

  // End screen after the farmer catches the turkey.
  caught: async (T) => {
    T.start(3);
    // run until the farmer closes in (surge) — cap the wait so it is quick
    for (let i = 0; i < 40; i++) {
      T.step(0.25, { left: false, right: false, jump: false, duck: false, jumpPressed: false, startPressed: false });
      if (T.world.screen === 'end') break;
    }
    if (T.world.screen !== 'end') T.world.endRun('caught');
    T.step(0.05, { left: false, right: false, jump: false, duck: false, jumpPressed: false, startPressed: false });
  },

  // End screen after a full escape.
  escaped: async (T) => {
    T.start(11);
    // walk the distance out fast
    for (let i = 0; i < 220; i++) {
      T.step(0.25, { left: false, right: false, jump: true, duck: false, jumpPressed: true, startPressed: false });
      if (T.world.screen === 'end') break;
    }
    if (T.world.screen !== 'end') T.world.endRun('escaped');
    T.step(0.05, { left: false, right: false, jump: false, duck: false, jumpPressed: false, startPressed: false });
  },
};

export function shotFromURL() {
  const params = new URLSearchParams(location.search);
  return params.get('shot') || null;
}

export async function driveShot(name) {
  const T = window.__TURKEY__;
  if (!T) throw new Error('__TURKEY__ not ready');
  const fn = SHOTS[name];
  if (!fn) throw new Error('unknown shot: ' + name);
  await fn(T);
  return T.state();
}
