// mulberry32 — a small, fast, seedable PRNG.
// A fixed seed makes a run reproducible: the same seed replays the same hazard
// pattern, which keeps playtests and screenshots deterministic.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Wrap a generator with the small helpers the world spawner wants.
export function makeRandom(seed) {
  const next = mulberry32(seed);
  return {
    seed,
    next,
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max] inclusive
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}
