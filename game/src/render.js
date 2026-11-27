// Turkey Trot: Escape the Harvest — the whole picture, drawn with canvas
// primitives only. No image assets, no library: every frame is a sky gradient,
// parallax farm/kitchen silhouettes, the turkey, the farmer, the hazards, the
// corn and the HUD, letterboxed into whatever canvas the browser gives us.
//
// The renderer owns no state of its own: `frame(world)` reads the world the
// simulation hands it and paints it. It also paints the three screens (title,
// play, end) and a small vignette over the whole play area.

import { CONFIG, SCREEN, END_REASON } from './config.js';

const P = CONFIG.palette;
const VW = CONFIG.view.width;
const VH = CONFIG.view.height;
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

// Break a #rrggbb string into [r, g, b]. Accepts the shorthand form too.
function rgb(hex) {
  let s = hex.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

// Mix two colours. `t` is how far towards `b` we go (0 = a, 1 = b).
function mix(a, b, t) {
  const pa = rgb(a);
  const pb = rgb(b);
  const ch = (i) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.scale = 1;
    this.offX = 0;
    this.offY = 0;
    this.fit();
    window.addEventListener('resize', () => this.fit());
  }

  // Fit the canvas to the window and work out the letterbox scale/offset so the
  // 1280x720 design area sits centred, with the rest filled in dark.
  fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
    this.scale = Math.min(w / VW, h / VH);
    this.offX = (w - VW * this.scale) / 2;
    this.offY = (h - VH * this.scale) / 2;
  }

  // Paint one frame. Called from main.js's animation loop with the current
  // world; the input layer is passed along for a subtle steering hint.
  frame(world) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b1120';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.rect(this.offX, this.offY, VW * this.scale, VH * this.scale);
    ctx.clip();
    ctx.translate(this.offX, this.offY);
    ctx.scale(this.scale, this.scale);

    if (world.screen === SCREEN.TITLE) this.title(ctx, world);
    else if (world.screen === SCREEN.PLAY) this.play(ctx, world);
    else this.endOfRun(ctx, world);

    ctx.restore();
    this.vignette(ctx);
  }

  // ---- small helpers -----------------------------------------------------

  // Rounded-rect path (no fill/stroke). Callers fill or stroke as they like.
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Centered-baseline text with a soft shadow, so it reads over any backdrop.
  label(ctx, str, x, y, size, color, align = 'center', weight = 'bold') {
    ctx.save();
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = P.hudShadow;
    ctx.fillText(str, x + 2, y + 3);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // Dark corners over the whole canvas, applied after the clip is popped.
  vignette(ctx) {
    const g = ctx.createRadialGradient(
      VW / 2, VH / 2, VH * 0.4,
      VW / 2, VH / 2, VH * 0.88,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,5,14,0.55)');
    ctx.save();
    ctx.translate(this.offX, this.offY);
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }

  // A filled heart, used for the lives row on both the HUD and the end screen.
  heart(ctx, x, y, size, filled) {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(size / 32, size / 32);
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-16, -2, -10, -16, 0, -6);
    ctx.bezierCurveTo(10, -16, 16, -2, 0, 10);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = '#c0303f';
      ctx.fill();
      ctx.strokeStyle = '#f4ede2';
    } else {
      ctx.strokeStyle = 'rgba(244,237,226,0.45)';
    }
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // ---- backdrop ----------------------------------------------------------

  // Sky, moon, far hills, mid silhouettes and the scrolling ground. `dist`
  // drives the parallax: far layers move slower than the runway.
  backdrop(ctx, world) {
    const stage = world.currentStage();
    const scroll = world.distance * 4;

    const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.groundY);
    sky.addColorStop(0, stage.sky);
    sky.addColorStop(1, mix(stage.sky, '#e8712a', 0.35));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VW, CONFIG.groundY);

    this.moon(ctx);
    this.hills(ctx, scroll * 0.15, stage, 0.55);
    this.silhouettes(ctx, scroll * 0.4, stage);

    ctx.fillStyle = stage.ground;
    ctx.fillRect(0, CONFIG.groundY, VW, VH - CONFIG.groundY);
    ctx.fillStyle = mix(stage.ground, '#000000', 0.25);
    ctx.fillRect(0, CONFIG.groundY, VW, 8);
    this.groundDashes(ctx, scroll, stage);
  }

  moon(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#f4ede2';
    ctx.beginPath();
    ctx.arc(VW - 220, 130, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(VW - 220, 130, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Rolling hills in the distance, tiled with a quadratic curve per period.
  hills(ctx, scroll, stage, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = mix(stage.sky, '#000000', 0.35);
    const baseY = CONFIG.groundY;
    const period = 420;
    const off = scroll % period;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = -off; x < VW + period; x += period) {
      ctx.quadraticCurveTo(x + period * 0.25, baseY - 120, x + period * 0.5, baseY - 60);
      ctx.quadraticCurveTo(x + period * 0.75, baseY - 10, x + period, baseY - 60);
    }
    ctx.lineTo(VW, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Mid layer: barns and fences on the farm stages, kitchen counters in the
  // last one. Tiled over `period` so the scroll looks continuous.
  silhouettes(ctx, scroll, stage) {
    ctx.save();
    const period = 360;
    const off = scroll % period;
    for (let i = -1; i < 5; i++) {
      const x = i * period - off;
      if (stage.name === 'The Kitchen') {
        this.counter(ctx, x + 40, CONFIG.groundY - 4);
      } else {
        this.barn(ctx, x + 40, CONFIG.groundY - 4, stage);
        this.fence(ctx, x + 220, CONFIG.groundY);
      }
    }
    ctx.restore();
  }

  barn(ctx, x, baseY, stage) {
    ctx.fillStyle = mix('#7a2f2a', stage.sky, 0.25);
    ctx.fillRect(x, baseY - 90, 120, 90);
    ctx.fillStyle = mix('#3a1c2a', '#000000', 0.2);
    ctx.beginPath();
    ctx.moveTo(x - 10, baseY - 90);
    ctx.lineTo(x + 60, baseY - 140);
    ctx.lineTo(x + 130, baseY - 90);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a1418';
    ctx.fillRect(x + 45, baseY - 50, 30, 50);
    ctx.strokeStyle = mix('#7a2f2a', '#ffffff', 0.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 45, baseY - 50);
    ctx.lineTo(x + 75, baseY);
    ctx.moveTo(x + 75, baseY - 50);
    ctx.lineTo(x + 45, baseY);
    ctx.stroke();
  }

  fence(ctx, x, baseY) {
    ctx.fillStyle = mix('#5a3a24', '#ffffff', 0.1);
    for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 22, baseY - 40, 8, 40);
    ctx.fillRect(x - 6, baseY - 32, 92, 6);
    ctx.fillRect(x - 6, baseY - 16, 92, 6);
  }

  counter(ctx, x, baseY) {
    ctx.fillStyle = '#6b5a4a';
    ctx.fillRect(x, baseY - 70, 150, 70);
    ctx.fillStyle = '#d8d2c4';
    ctx.fillRect(x - 6, baseY - 78, 162, 10);
    ctx.fillStyle = '#3d3a42';
    ctx.fillRect(x + 40, baseY - 108, 50, 32);
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(x + 40, baseY - 108, 50, 6);
  }

  groundDashes(ctx, scroll, stage) {
    ctx.save();
    ctx.strokeStyle = mix(stage.ground, '#ffffff', 0.12);
    ctx.lineWidth = 2;
    const step = 64;
    const off = scroll % step;
    ctx.beginPath();
    for (let x = -off; x < VW + step; x += step) {
      ctx.moveTo(x, CONFIG.groundY + 26);
      ctx.lineTo(x + 22, CONFIG.groundY + 26);
      ctx.moveTo(x + 32, CONFIG.groundY + 52);
      ctx.lineTo(x + 48, CONFIG.groundY + 52);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- actors ------------------------------------------------------------

  // The turkey. Legs swing with the run cycle while grounded, and it blinks
  // while the post-hit invulnerability is ticking down.
  turkey(ctx, world) {
    const tk = world.turkey;
    const blink = tk.invuln > 0 && Math.floor(tk.invuln * 14) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    const bob = tk.onGround ? Math.sin(tk.runCycle) * 3 : 0;
    const x = tk.x;
    const y = tk.y + bob;
    const w = tk.w;
    const h = tk.h;

    ctx.fillStyle = P.turkeyTail;
    const fanX = x + w * 0.18;
    const fanY = y + h * 0.42;
    for (let i = -3; i <= 3; i++) {
      ctx.save();
      ctx.translate(fanX, fanY);
      ctx.rotate(i * 0.32);
      ctx.fillStyle = i % 2 === 0 ? P.turkeyTail : P.turkeyBody;
      this.roundRect(ctx, -6, -34, 12, 36, 6);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = P.turkeyBody;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.55, w * 0.42, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.turkeyWing;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.42, y + h * 0.6, w * 0.24, h * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.turkeyBody;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.74, y + h * 0.26, w * 0.18, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + w * 0.62, y + h * 0.34, w * 0.14, h * 0.2);

    ctx.fillStyle = P.turkeyBeak;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.9, y + h * 0.24);
    ctx.lineTo(x + w * 1.06, y + h * 0.3);
    ctx.lineTo(x + w * 0.9, y + h * 0.32);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = P.turkeySnood;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.92, y + h * 0.38, 5, 9, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.turkeyEye;
    ctx.beginPath();
    ctx.arc(x + w * 0.78, y + h * 0.22, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + w * 0.79, y + h * 0.21, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = P.turkeyBeak;
    ctx.lineWidth = 4;
    const swing = tk.onGround ? Math.sin(tk.runCycle) * 8 : 4;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y + h * 0.86);
    ctx.lineTo(x + w * 0.45 + swing, y + h);
    ctx.moveTo(x + w * 0.58, y + h * 0.86);
    ctx.lineTo(x + w * 0.58 - swing, y + h);
    ctx.stroke();
    ctx.restore();
  }

  // The farmer, the chase on legs. He leans forward harder while surging, and
  // his arms and legs swing off the same clock the world hands him.
  farmer(ctx, world) {
    const fm = world.farmer;
    ctx.save();
    const x = fm.x;
    const y = fm.y;
    const w = fm.w;
    const h = fm.h;
    const surging = fm.surge > 0;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, CONFIG.groundY + 2, w * 0.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3a3a2a';
    const reach = Math.sin(fm.armSwing) * 6;
    ctx.fillRect(x + w * 0.28, y + h * 0.62, 12, h * 0.38 + reach);
    ctx.fillRect(x + w * 0.55, y + h * 0.62, 12, h * 0.38 - reach);

    ctx.fillStyle = surging ? '#5d7348' : P.farmerCoat;
    this.roundRect(ctx, x + w * 0.12, y + h * 0.22, w * 0.76, h * 0.46, 8);
    ctx.fill();
    ctx.fillStyle = '#2f3a26';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w * 0.48, y + h * (0.3 + i * 0.1), 5, 5);

    ctx.strokeStyle = P.farmerCoat;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    const forward = surging ? 16 : 6;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.34);
    ctx.lineTo(x - forward, y + h * 0.3 + reach);
    ctx.stroke();

    ctx.fillStyle = P.farmerSkin;
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.16, w * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.farmerBeard;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.32, y + h * 0.2);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.42, x + w * 0.68, y + h * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = P.farmerHat;
    ctx.fillRect(x + w * 0.16, y + h * 0.02, w * 0.68, 7);
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.02, w * 0.24, 12, 0, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#1b1120';
    ctx.fillRect(x + w * 0.56, y + h * 0.12, 4, 4);
    ctx.restore();
  }

  // A wood-burning oven on the runway: glowing aura, body, door window with
  // fire inside, and a pair of knobs on top.
  oven(ctx, world, o) {
    ctx.save();
    const g = ctx.createRadialGradient(
      o.x + o.w / 2, o.y + o.h * 0.6, 6,
      o.x + o.w / 2, o.y + o.h * 0.6, o.w * 0.9,
    );
    g.addColorStop(0, 'rgba(255,138,61,0.55)');
    g.addColorStop(1, 'rgba(255,138,61,0)');
    ctx.fillStyle = g;
    ctx.fillRect(o.x - o.w * 0.5, o.y - o.h * 0.5, o.w * 2, o.h * 1.8);

    ctx.fillStyle = P.ovenBody;
    this.roundRect(ctx, o.x, o.y, o.w, o.h, 8);
    ctx.fill();

    ctx.fillStyle = P.ovenDoor;
    this.roundRect(ctx, o.x + 10, o.y + 18, o.w - 20, o.h * 0.5, 6);
    ctx.fill();

    ctx.fillStyle = CONFIG.oven.glow;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * 0.3, o.y + o.h * 0.66);
    ctx.quadraticCurveTo(o.x + o.w * 0.4, o.y + o.h * 0.45, o.x + o.w * 0.5, o.y + o.h * 0.66);
    ctx.quadraticCurveTo(o.x + o.w * 0.6, o.y + o.h * 0.42, o.x + o.w * 0.7, o.y + o.h * 0.66);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#cdd6df';
    ctx.beginPath();
    ctx.arc(o.x + o.w * 0.3, o.y + 10, 4, 0, Math.PI * 2);
    ctx.arc(o.x + o.w * 0.7, o.y + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // A carving knife swooping in from the sky: blade glinting, handle behind.
  knife(ctx, k) {
    ctx.save();
    ctx.translate(k.x + k.w / 2, k.y + k.h / 2);
    ctx.rotate(Math.sin(k.spin) * 0.35);

    ctx.fillStyle = P.knifeBlade;
    ctx.beginPath();
    ctx.moveTo(-k.w * 0.5, -k.h * 0.2);
    ctx.lineTo(k.w * 0.2, -k.h * 0.7);
    ctx.lineTo(k.w * 0.2, k.h * 0.2);
    ctx.lineTo(-k.w * 0.5, k.h * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-k.w * 0.45, k.h * 0.15);
    ctx.lineTo(k.w * 0.18, k.h * 0.15);
    ctx.stroke();

    ctx.fillStyle = P.knifeHandle;
    this.roundRect(ctx, k.w * 0.2, -k.h * 0.35, k.w * 0.3, k.h * 0.7, 4);
    ctx.fill();
    ctx.restore();
  }

  // A bonus corn cob, bobbing gently. The kernel grid gives it some texture.
  corn(ctx, c) {
    const bob = Math.sin(c.bob) * 5;
    ctx.save();
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2 + bob);
    ctx.fillStyle = P.cornGold;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.w * 0.42, c.h * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7fa04a';
    ctx.beginPath();
    ctx.moveTo(-2, -c.h * 0.4);
    ctx.quadraticCurveTo(-14, 0, -4, c.h * 0.5);
    ctx.quadraticCurveTo(-6, 0, -2, -c.h * 0.4);
    ctx.fill();

    ctx.fillStyle = 'rgba(180,120,30,0.5)';
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.arc(i * 6, j * 8, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Short-lived particles (splashes, pickups) and floating "+25" texts.
  particles(ctx, world) {
    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      this.label(ctx, f.text, f.x, f.y, 18, f.color, 'left');
    }
    ctx.globalAlpha = 1;
  }

  // ---- HUD ---------------------------------------------------------------

  // Lives as hearts, distance + score in a pill, a flashing warning when the
  // farmer is close, and a progress bar along the bottom to 4000 m.
  hud(ctx, world) {
    const pad = 26;
    for (let i = 0; i < CONFIG.lives; i++) {
      this.heart(ctx, pad + i * 40, pad, 28, i < world.lives);
    }

    const cx = VW / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(18,10,22,0.6)';
    this.roundRect(ctx, cx - 150, pad - 6, 300, 48, 24);
    ctx.fill();
    ctx.restore();
    this.label(ctx, `${Math.floor(world.distance)} m`, cx, pad + 10, 24, P.hudText);
    this.label(ctx, `CORN ${Math.floor(world.score)}`, cx, pad + 30, 16, P.corn);

    const gap = world.turkey.x - (world.farmer.x + world.farmer.w);
    if (gap < 260) {
      const urgency = 1 - gap / 260;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(world.time * 14) * 0.35 * urgency;
      this.label(ctx, "HE'S CLOSE!", VW - pad, pad + 14, 22, '#ff6b6b', 'right');
      ctx.restore();
    }

    const barW = VW - pad * 2;
    const barY = VH - 22;
    ctx.save();
    ctx.fillStyle = 'rgba(18,10,22,0.55)';
    this.roundRect(ctx, pad, barY, barW, 10, 5);
    ctx.fill();
    const prog = Math.min(1, world.distance / CONFIG.escapeDistance);
    ctx.fillStyle = P.harvest;
    this.roundRect(ctx, pad, barY, Math.max(6, barW * prog), 10, 5);
    ctx.fill();
    ctx.restore();
    this.label(ctx, 'ESCAPE', VW - pad, barY - 12, 13, P.hudText, 'right');
  }

  // ---- screens -----------------------------------------------------------

  // Title: a still farm scene, the title block, the controls, a pulsing start
  // prompt, and the turkey/farmer vignette at the bottom.
  title(ctx, world) {
    this.backdrop(ctx, {
      distance: 0,
      currentStage: () => CONFIG.stages[0],
      time: 0,
    });

    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(Math.sin(t) * 6, 0);
    this.turkey(ctx, {
      turkey: { x: 420, y: CONFIG.groundY - 64, w: 56, h: 64, onGround: true, runCycle: t * 8, invuln: 0 },
    });
    this.farmer(ctx, {
      farmer: { x: 300, y: CONFIG.groundY - 92, w: 64, h: 92, armSwing: t * 8, surge: 0 },
    });
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(18,10,22,0.55)';
    this.roundRect(ctx, VW / 2 - 470, 120, 940, 300, 28);
    ctx.fill();
    ctx.restore();

    this.label(ctx, 'TURKEY TROT', VW / 2, 190, 84, P.turkeyTail);
    this.label(ctx, 'Escape the Harvest', VW / 2, 252, 38, P.harvest);
    this.label(ctx, 'Run from the farmer. Leap the ovens. Duck the carving knives.', VW / 2, 312, 22, P.hudText);
    this.label(ctx, 'Grab corn for points. Reach 4000 m to escape for good.', VW / 2, 344, 20, P.hay);
    this.label(ctx, 'SPACE / ^ / W  jump    .    v / S  duck    .    <- -> / A D  move', VW / 2, 392, 18, '#cbbfae');
    this.label(ctx, 'Tap or click to steer on touch', VW / 2, 420, 16, '#9c8f80');

    const pulse = 0.7 + Math.sin(performance.now() / 300) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    this.label(ctx, 'PRESS SPACE TO START', VW / 2, 500, 30, P.corn);
    ctx.restore();

    for (let i = 0; i < CONFIG.lives; i++) {
      this.heart(ctx, VW / 2 - 44 + i * 40, 540, 28, true);
    }
  }

  // Mid-run. Camera shake on a hit, hazards and actors, then the HUD. A
  // near-miss flashes a translucent white overlay for a few frames.
  play(ctx, world) {
    ctx.save();
    const sx = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    const sy = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    ctx.translate(sx, sy);

    this.backdrop(ctx, world);
    for (const o of world.ovens) this.oven(ctx, world, o);
    for (const c of world.corn) this.corn(ctx, c);
    for (const k of world.knives) this.knife(ctx, k);
    this.farmer(ctx, world);
    this.turkey(ctx, world);
    this.particles(ctx, world);
    ctx.restore();

    if (world.flash > 0) {
      ctx.save();
      ctx.globalAlpha = world.flash * 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }

    this.hud(ctx, world);
  }

  // End of run: the frozen scene behind a panel showing the outcome, distance,
  // score and lives left, with a prompt to run again.
  endOfRun(ctx, world) {
    this.backdrop(ctx, world);
    this.farmer(ctx, world);
    this.turkey(ctx, world);
    for (const o of world.ovens) this.oven(ctx, world, o);

    ctx.save();
    ctx.fillStyle = 'rgba(18,10,22,0.72)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    const escaped = world.endReason === END_REASON.ESCAPED;
    const outcome = escaped ? 'YOU ESCAPED!' : 'CAUGHT!';
    const tint = escaped ? P.corn : '#ff6b6b';
    const note = escaped
      ? 'The turkey lives to gobble another day.'
      : 'The farmer got you. Dinner is served... almost.';

    ctx.save();
    ctx.fillStyle = 'rgba(30,16,36,0.85)';
    this.roundRect(ctx, VW / 2 - 380, 130, 760, 420, 28);
    ctx.fill();
    ctx.strokeStyle = escaped ? P.corn : '#c0303f';
    ctx.lineWidth = 4;
    this.roundRect(ctx, VW / 2 - 380, 130, 760, 420, 28);
    ctx.stroke();
    ctx.restore();

    this.label(ctx, outcome, VW / 2, 200, 76, tint);
    this.label(ctx, note, VW / 2, 258, 22, P.hudText);

    this.label(ctx, 'DISTANCE', VW / 2 - 160, 320, 18, P.hay);
    this.label(ctx, `${Math.floor(world.distance)} m`, VW / 2 - 160, 350, 30, P.hudText);
    this.label(ctx, 'SCORE', VW / 2, 320, 18, P.hay);
    this.label(ctx, `${Math.floor(world.score)}`, VW / 2, 350, 30, P.corn);
    this.label(ctx, 'LIVES LEFT', VW / 2 + 160, 320, 18, P.hay);
    this.label(ctx, `${world.lives}`, VW / 2 + 160, 350, 30, P.hudText);

    for (let i = 0; i < CONFIG.lives; i++) {
      this.heart(ctx, VW / 2 + 130 + i * 32, 380, 24, i < world.lives);
    }

    const pulse = 0.7 + Math.sin(performance.now() / 280) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    this.label(ctx, 'PRESS SPACE TO RUN AGAIN', VW / 2, 480, 30, P.harvest);
    ctx.restore();
  }
}