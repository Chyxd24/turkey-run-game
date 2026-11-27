// Tuning table for Turkey Trot: Escape the Harvest.
// Every number the simulation and renderer lean on lives here so the run can be
// balanced in one place. Colours are the dark-November palette in #rrggbb.

export const CONFIG = {
  // --- canvas / world ---
  view: { width: 1280, height: 720 },   // design resolution; the canvas letterboxes to it
  groundY: 560,                          // top of the runway, in design pixels
  scrollSpeed: 360,                      // base world scroll, px per second
  scrollAccel: 9,                        // how much scrollSpeed grows per second of play
  scrollMax: 820,                        // hard ceiling on scroll speed

  // --- turkey (player) ---
  turkey: {
    w: 56, h: 64,
    runSpeed: 430,        // left/right control speed, px/s
    jumpVelocity: -760,   // initial jump impulse, px/s (negative = up)
    gravity: 2100,        // px/s^2
    maxFall: 1100,
    coyoteTime: 0.09,     // seconds of forgiveness after leaving the ground
    jumpBuffer: 0.12,     // seconds a jump press is remembered before landing
    duckH: 34,            // hitbox height while ducking
    invulnTime: 1.4,      // seconds of blinking after a hit
    boundsPadding: 24,    // how far from the screen edge the turkey may stray
  },

  // --- the farmer (chaser) ---
  farmer: {
    w: 64, h: 92,
    baseSpeed: 300,       // px/s, scales up with the run
    catchSpeed: 470,      // px/s during a panic surge when close
    surgeWindow: 2.4,     // seconds a surge lasts
    surgeCooldown: 9,     // seconds between surges
    startLag: 1.2,        // seconds before the farmer starts moving (title fade-in)
  },

  // --- hazards ---
  oven: {
    w: 92, h: 96,
    spawnEvery: [2.4, 3.6],   // seconds between ovens [min, max]
    glow: '#ff8a3d',
  },
  knife: {
    w: 74, h: 20,
    spawnEvery: [1.6, 2.6],
    speed: 260,               // extra speed knives fly at the turkey
    dropFrom: 'sky',          // knives arc in from the upper air
  },
  corn: {
    w: 26, h: 26,
    spawnEvery: [0.9, 1.8],
    value: 25,                // score per cob
  },

  // --- stages (farmyard -> barnyard -> kitchen) ---
  stages: [
    { name: 'Farmyard',   atDistance: 0,    sky: '#2b1a33', ground: '#5a3a24', accent: '#e8712a' },
    { name: 'Barnyard',   atDistance: 1200, sky: '#3a1c2a', ground: '#4a2a1c', accent: '#f2c14e' },
    { name: 'The Kitchen', atDistance: 2600, sky: '#401a22', ground: '#6b5a4a', accent: '#ff8a3d' },
  ],
  escapeDistance: 4000,   // distance (metres-ish) at which the turkey escapes for good

  lives: 3,

  // --- scoring ---
  score: {
    perMetre: 1,          // distance -> score
    nearMiss: 40,         // grazing a hazard without being hit
  },

  // --- colours ---
  palette: {
    turkeyBody: '#c76b2a',
    turkeyWing: '#8f4a1c',
    turkeyTail: '#f2c14e',
    turkeyBeak: '#f2a03d',
    turkeySnood: '#c0303f',
    turkeyEye: '#1b1120',
    farmerCoat: '#4a5d3a',
    farmerHat: '#2f3a26',
    farmerSkin: '#e0b089',
    farmerBeard: '#d8d2c4',
    ovenBody: '#3d3a42',
    ovenDoor: '#1e1c22',
    knifeBlade: '#cdd6df',
    knifeHandle: '#6b4a2a',
    cornGold: '#f2c14e',
    hudText: '#f4ede2',
    hudShadow: '#120a16',
  },
};

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  END: 'end',
};

export const END_REASON = {
  CAUGHT: 'caught',
  ESCAPED: 'escaped',
};
