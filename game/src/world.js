// World simulation: a horizontally scrolling chase.
//
// The turkey runs right; the world scrolls left. Ovens are ground obstacles to
// jump, carving knives swoop in from the sky to duck under, corn is a bonus to
// grab, and the farmer shadows the turkey from behind, surging when he gets
// close. A run ends when the turkey is caught (farmer reaches it, or hazards
// spend the last life) or when it covers escapeDistance and gets away.

import { CONFIG, SCREEN, END_REASON } from './config.js';
import { makeRandom } from './random.js';

function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.rand = makeRandom(seed);
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.rand = makeRandom(seed);
    const T = CONFIG.turkey;
    const F = CONFIG.farmer;

    this.screen = SCREEN.TITLE;
    this.endReason = null;
    this.time = 0;            // seconds of live play
    this.distance = 0;        // metres-ish travelled
    this.score = 0;
    this.lives = CONFIG.lives;
    this.speed = CONFIG.scrollSpeed;
    this.shake = 0;           // camera shake on hit
    this.flash = 0;           // white flash on near-miss
    this.stagesCleared = 0;

    this.turkey = {
      x: 240, y: CONFIG.groundY - T.h, w: T.w, h: T.h,
      vy: 0, onGround: true,
      coyote: 0, jumpBuffer: 0,
      ducking: false,
      invuln: 0,
      runCycle: 0,
    };

    this.farmer = {
      x: 240 - 300, y: CONFIG.groundY - F.h, w: F.w, h: F.h,
      vx: 0, lag: F.startLag, surge: 0, surgeCooldown: F.surgeCooldown,
      armSwing: 0,
    };

    this.ovens = [];
    this.knives = [];
    this.corn = [];
    this.particles = [];
    this.floaters = [];     // "+25" style floating texts
    this.nearMissTimer = 0;

    this.timers = {
      oven: this.rand.range(...CONFIG.oven.spawnEvery),
      knife: this.rand.range(...CONFIG.knife.spawnEvery),
      corn: this.rand.range(...CONFIG.corn.spawnEvery),
    };
  }

  startRun(seed = Date.now() % 100000) {
    this.reset(seed);
    this.screen = SCREEN.PLAY;
  }

  // ---- spawning -----------------------------------------------------------
  spawnOven() {
    const O = CONFIG.oven;
    this.ovens.push({ x: CONFIG.view.width + 80, y: CONFIG.groundY - O.h, w: O.w, h: O.h, glow: 1 });
  }

  spawnKnife() {
    const K = CONFIG.knife;
    // Knives swoop toward the turkey's current height band.
    this.knives.push({
      x: CONFIG.view.width + 80,
      y: CONFIG.groundY - 150 - this.rand.range(0, 60),
      w: K.w, h: K.h,
      vy: 0,
      spin: 0,
    });
  }

  spawnCorn() {
    const C = CONFIG.corn;
    const high = this.rand.chance(0.45);
    this.corn.push({
      x: CONFIG.view.width + 60,
      y: high ? CONFIG.groundY - 150 : CONFIG.groundY - 70,
      w: C.w, h: C.h, bob: this.rand.range(0, Math.PI * 2),
    });
  }

  burst(x, y, color, n = 10, spread = 160) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y,
        vx: (this.rand.next() - 0.5) * spread,
        vy: -this.rand.range(40, 220),
        life: this.rand.range(0.4, 0.9),
        maxLife: 0.9,
        color,
        size: this.rand.range(3, 7),
      });
    }
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 0.9 });
  }

  currentStage() {
    let s = CONFIG.stages[0];
    for (const st of CONFIG.stages) if (this.distance >= st.atDistance) s = st;
    return s;
  }

  // ---- main fixed-step ----------------------------------------------------
  step(dt, input) {
    if (this.screen === SCREEN.TITLE) {
      if (input && input.startPressed) this.startRun();
      return;
    }
    if (this.screen === SCREEN.END) {
      if (input && input.startPressed) {
        // restart straight into a fresh run
        this.startRun();
      }
      return;
    }
    this.simulate(dt, input);
  }

  simulate(dt, input) {
    const T = CONFIG.turkey;
    const F = CONFIG.farmer;
    this.time += dt;

    // difficulty ramps with time on the run
    this.speed = Math.min(CONFIG.scrollMax, CONFIG.scrollSpeed + this.time * CONFIG.scrollAccel);

    // ---- turkey horizontal control ----
    const tk = this.turkey;
    let moveX = 0;
    if (input) {
      if (input.left) moveX -= 1;
      if (input.right) moveX += 1;
    }
    tk.x += moveX * T.runSpeed * dt;
    // keep the turkey on screen; the world scrolls under it
    tk.x = Math.max(T.boundsPadding, Math.min(CONFIG.view.width - T.w - T.boundsPadding, tk.x));
    tk.runCycle += dt * (this.speed / 90);

    // ---- jump / gravity ----
    if (input && input.jumpPressed) tk.jumpBuffer = T.jumpBuffer;
    tk.jumpBuffer = Math.max(0, tk.jumpBuffer - dt);
    tk.coyote = tk.onGround ? T.coyoteTime : Math.max(0, tk.coyote - dt);

    if (tk.jumpBuffer > 0 && tk.coyote > 0) {
      tk.vy = T.jumpVelocity;
      tk.onGround = false;
      tk.coyote = 0;
      tk.jumpBuffer = 0;
      this.burst(tk.x + tk.w / 2, tk.y + tk.h, '#d8b98a', 6, 90);
    }

    // duck shrinks the hitbox (only meaningful on the ground)
    tk.ducking = !!(input && input.duck) && tk.onGround;
    const targetH = tk.ducking ? T.duckH : T.h;

    tk.vy = Math.min(tk.vy + T.gravity * dt, T.maxFall);
    tk.y += tk.vy * dt;

    const groundTop = CONFIG.groundY - targetH;
    if (tk.y >= groundTop) {
      if (!tk.onGround && tk.vy > 0) {
        this.burst(tk.x + tk.w / 2, CONFIG.groundY, '#d8b98a', 4, 70);
      }
      tk.y = groundTop;
      tk.vy = 0;
      tk.onGround = true;
    }
    tk.h = targetH;
    if (tk.ducking) tk.y = CONFIG.groundY - T.duckH;

    if (tk.invuln > 0) tk.invuln -= dt;

    // ---- world scroll & distance ----
    this.distance += (this.speed * dt) / 10;   // px -> "metres"
    if (this.distance >= CONFIG.escapeDistance) {
      this.endRun(END_REASON.ESCAPED);
      return;
    }

    // ---- farmer chase ----
    const fm = this.farmer;
    if (fm.lag > 0) fm.lag -= dt;
    let fspeed = F.baseSpeed + this.speed * 0.25;
    fm.surgeCooldown -= dt;
    const gap = this.turkey.x - (fm.x + fm.w);
    if (fm.surgeCooldown <= 0 && gap < 320) {
      fm.surge = F.surgeWindow;
      fm.surgeCooldown = F.surgeCooldown;
    }
    if (fm.surge > 0) {
      fm.surge -= dt;
      fspeed = F.catchSpeed + this.speed * 0.25;
    }
    // farmer drifts toward the turkey's x, pulled forward by the scroll
    const chase = gap > 0 ? (gap / 320) : 0;
    fm.vx = fspeed * (0.55 + 0.45 * chase);
    fm.x += fm.vx * dt;
    fm.x = Math.min(fm.x, this.turkey.x - fm.w * 0.4);
    fm.y = CONFIG.groundY - fm.h;
    fm.armSwing += dt * 8;

    // farmer catches the turkey?
    if (aabb(this.turkeyBox(), fm)) {
      this.hitTurkey('caught');
    }

    // ---- hazards update ----
    this.updateOvens(dt);
    this.updateKnives(dt);
    this.updateCorn(dt);
    this.updateParticles(dt);

    // camera shake / flash decay
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.5);

    // spawn timers
    this.timers.oven -= dt;
    if (this.timers.oven <= 0) {
      this.spawnOven();
      this.timers.oven = this.rand.range(...CONFIG.oven.spawnEvery) * (CONFIG.scrollSpeed / this.speed + 0.3);
    }
    this.timers.knife -= dt;
    if (this.timers.knife <= 0) {
      this.spawnKnife();
      this.timers.knife = this.rand.range(...CONFIG.knife.spawnEvery) * (CONFIG.scrollSpeed / this.speed + 0.3);
    }
    this.timers.corn -= dt;
    if (this.timers.corn <= 0) {
      this.spawnCorn();
      this.timers.corn = this.rand.range(...CONFIG.corn.spawnEvery);
    }

    // score from distance
    this.score += this.speed * dt / 10 * CONFIG.score.perMetre;
    if (this.nearMissTimer > 0) this.nearMissTimer -= dt;
  }

  turkeyBox() {
    const tk = this.turkey;
    return { x: tk.x + 6, y: tk.y + 6, w: tk.w - 12, h: tk.h - 8 };
  }

  updateOvens(dt) {
    const tb = this.turkeyBox();
    for (const o of this.ovens) {
      o.x -= this.speed * dt;
      if (o.glow < 2) o.glow = 1 + Math.sin(this.time * 6) * 0.2;
      if (aabb(tb, o) && this.turkey.invuln <= 0) {
        this.hitTurkey('oven', o);
      } else if (!o.nearMissChecked && Math.abs(o.x + o.w - tb.x) < 26 && this.turkey.invuln <= 0 && this.turkey.onGround) {
        // grazed past an oven on the ground => near miss
        o.nearMissChecked = true;
        this.score += CONFIG.score.nearMiss;
        this.flash = 0.5;
        this.floater(tb.x, tb.y - 20, 'Close call! +' + CONFIG.score.nearMiss, '#f2c14e');
      }
    }
    this.ovens = this.ovens.filter((o) => o.x + o.w > -60);
  }

  updateKnives(dt) {
    const tb = this.turkeyBox();
    for (const k of this.knives) {
      k.x -= (this.speed + CONFIG.knife.speed) * dt;
      // gentle downward arc then hold
      k.vy += 140 * dt;
      k.y = Math.min(k.y + k.vy * dt, CONFIG.groundY - k.h);
      k.spin += dt * 10;
      if (aabb(tb, k) && this.turkey.invuln <= 0) {
        this.hitTurkey('knife', k);
      } else if (!k.nearMissChecked && k.x + k.w < tb.x && k.x + k.w > tb.x - 30) {
        k.nearMissChecked = true;
        this.score += CONFIG.score.nearMiss;
        this.flash = 0.5;
        this.floater(tb.x, tb.y - 20, 'Ducked! +' + CONFIG.score.nearMiss, '#f2c14e');
      }
    }
    this.knives = this.knives.filter((k) => k.x + k.w > -60);
  }

  updateCorn(dt) {
    const tb = this.turkeyBox();
    for (const c of this.corn) {
      c.x -= this.speed * dt;
      c.bob += dt * 4;
      if (aabb(tb, c)) {
        c.dead = true;
        this.score += CONFIG.corn.value;
        this.burst(c.x + c.w / 2, c.y + c.h / 2, CONFIG.palette.cornGold, 8, 120);
        this.floater(c.x, c.y - 10, '+' + CONFIG.corn.value, CONFIG.palette.cornGold);
      }
    }
    this.corn = this.corn.filter((c) => !c.dead && c.x + c.w > -40);
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.vy += 600 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.y -= 40 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  hitTurkey(cause, src) {
    const tk = this.turkey;
    if (cause === 'caught') {
      this.burst(tk.x + tk.w / 2, tk.y + tk.h / 2, CONFIG.palette.turkeyTail, 18, 220);
      this.endRun(END_REASON.CAUGHT);
      return;
    }
    // hazard hit: spend a life, grant invulnerability
    this.lives -= 1;
    tk.invuln = CONFIG.turkey.invulnTime;
    this.shake = 18;
    if (src) this.burst(src.x + src.w / 2, src.y + src.h / 2, '#ff8a3d', 14, 200);
    this.floater(tk.x, tk.y - 24, this.lives > 0 ? 'Ouch!' : 'Caught!', '#c0303f');
    if (this.lives <= 0) {
      this.endRun(END_REASON.CAUGHT);
    }
  }

  endRun(reason) {
    this.screen = SCREEN.END;
    this.endReason = reason;
    if (reason === END_REASON.ESCAPED) {
      this.score += 500; // escape bonus
    }
  }
}
