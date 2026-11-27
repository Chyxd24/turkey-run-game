// Canvas 2D renderer for Turkey Trot: Escape the Harvest.
// All art is drawn with canvas primitives (no external assets): the turkey,
// the farmer, ovens, knives, corn, the parallax farm/kitchen backdrop, the HUD,
// and the three screens (title, play, end). Everything scales to the design
// resolution and letterboxes into the real canvas.

import { CONFIG, SCREEN, END_REASON } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
    const vw = CONFIG.view.width;
    const vh = CONFIG.view.height;
    this.scale = Math.min(w / vw, h / vh);
    this.offsetX = (w - vw * this.scale) / 2;
    this.offsetY = (h - vh * this.scale) / 2;
  }

  frame(world, input) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b1120';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // clip to the letterboxed play area
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.offsetX, this.offsetY, CONFIG.view.width * this.scale, CONFIG.view.height * this.scale);
    ctx.clip();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    if (world.screen === SCREEN.TITLE) this.drawTitle(world);
    else if (world.screen === SCREEN.PLAY) this.drawPlay(world);
    else if (world.screen === SCREEN.END) this.drawEnd(world);

    ctx.restore();

    // vignette
    this.drawVignette(ctx);
  }

  // ---- helpers ------------------------------------------------------------
  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  text(ctx, str, x, y, size, color, align = 'center', weight = 'bold') {
    ctx.save();
    ctx.font = `${weight} ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.palette.hudShadow;
    ctx.fillText(str, x + 3, y + 3);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  drawVignette(ctx) {
    const g = ctx.createRadialGradient(
      CONFIG.view.width / 2, CONFIG.view.height / 2, CONFIG.view.height * 0.4,
      CONFIG.view.width / 2, CONFIG.view.height / 2, CONFIG.view.height * 0.85,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,5,14,0.55)');
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.view.width, CONFIG.view.height);
    ctx.restore();
  }

  // ---- backdrop -----------------------------------------------------------
  drawBackdrop(ctx, world) {
    const stage = world.currentStage();
    const scroll = world.distance * 4;

    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.groundY);
    sky.addColorStop(0, stage.sky);
    sky.addColorStop(1, this.mix(stage.sky, '#e8712a', 0.35));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CONFIG.view.width, CONFIG.groundY);

    // a pale harvest moon
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#f4ede2';
    ctx.beginPath();
    ctx.arc(CONFIG.view.width - 220, 130, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(CONFIG.view.width - 220, 130, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // far hills (parallax slow)
    this.drawHills(ctx, scroll * 0.15, stage, 0.55);
    // mid silhouette: barns / fences / kitchen counters
    this.drawMidLayer(ctx, scroll * 0.4, stage);

    // ground
    ctx.fillStyle = stage.ground;
    ctx.fillRect(0, CONFIG.groundY, CONFIG.view.width, CONFIG.view.height - CONFIG.groundY);
    // ground stripe
    ctx.fillStyle = this.mix(stage.ground, '#000000', 0.25);
    ctx.fillRect(0, CONFIG.groundY, CONFIG.view.width, 8);
    // ground texture dashes (parallax full speed)
    ctx.save();
    ctx.strokeStyle = this.mix(stage.ground, '#ffffff', 0.12);
    ctx.lineWidth = 2;
    const gs = 64;
    const off = scroll % gs;
    ctx.beginPath();
    for (let x = -off; x < CONFIG.view.width + gs; x += gs) {
      ctx.moveTo(x, CONFIG.groundY + 26);
      ctx.lineTo(x + 22, CONFIG.groundY + 26);
      ctx.moveTo(x + 32, CONFIG.groundY + 52);
      ctx.lineTo(x + 48, CONFIG.groundY + 52);
    }
    ctx.stroke();
    ctx.restore();

    // stage label ribbon when it changes
    ctx.save();
    ctx.globalAlpha = 0.9;
    this.text(ctx, stage.name, CONFIG.view.width / 2, 96, 30, stage.accent, 'center');
    ctx.restore();
  }

  drawHills(ctx, scroll, stage, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.mix(stage.sky, '#000000', 0.35);
    const baseY = CONFIG.groundY;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    const period = 420;
    const off = scroll % period;
    for (let x = -off; x < CONFIG.view.width + period; x += period) {
      ctx.quadraticCurveTo(x + period * 0.25, baseY - 120, x + period * 0.5, baseY - 60);
      ctx.quadraticCurveTo(x + period * 0.75, baseY - 10, x + period, baseY - 60);
    }
    ctx.lineTo(CONFIG.view.width, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawMidLayer(ctx, scroll, stage) {
    ctx.save();
    const period = 360;
    const off = scroll % period;
    for (let i = -1; i < 5; i++) {
      const x = i * period - off;
      if (stage.name === 'The Kitchen') {
        this.drawCounter(ctx, x + 40, CONFIG.groundY - 4);
      } else {
        this.drawBarn(ctx, x + 40, CONFIG.groundY - 4, stage);
        this.drawFence(ctx, x + 220, CONFIG.groundY);
      }
    }
    ctx.restore();
  }

  drawBarn(ctx, x, baseY, stage) {
    ctx.fillStyle = this.mix('#7a2f2a', stage.sky, 0.25);
    ctx.fillRect(x, baseY - 90, 120, 90);
    // gambrel roof
    ctx.fillStyle = this.mix('#3a1c2a', '#000000', 0.2);
    ctx.beginPath();
    ctx.moveTo(x - 10, baseY - 90);
    ctx.lineTo(x + 60, baseY - 140);
    ctx.lineTo(x + 130, baseY - 90);
    ctx.closePath();
    ctx.fill();
    // door
    ctx.fillStyle = '#2a1418';
    ctx.fillRect(x + 45, baseY - 50, 30, 50);
    // X brace
    ctx.strokeStyle = this.mix('#7a2f2a', '#ffffff', 0.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 45, baseY - 50); ctx.lineTo(x + 75, baseY);
    ctx.moveTo(x + 75, baseY - 50); ctx.lineTo(x + 45, baseY);
    ctx.stroke();
  }

  drawFence(ctx, x, baseY) {
    ctx.fillStyle = this.mix('#5a3a24', '#ffffff', 0.1);
    for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 22, baseY - 40, 8, 40);
    ctx.fillRect(x - 6, baseY - 32, 92, 6);
    ctx.fillRect(x - 6, baseY - 16, 92, 6);
  }

  drawCounter(ctx, x, baseY) {
    ctx.fillStyle = '#6b5a4a';
    ctx.fillRect(x, baseY - 70, 150, 70);
    ctx.fillStyle = '#d8d2c4';
    ctx.fillRect(x - 6, baseY - 78, 162, 10);
    // pot on the counter
    ctx.fillStyle = '#3d3a42';
    ctx.fillRect(x + 40, baseY - 108, 50, 32);
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(x + 40, baseY - 108, 50, 6);
  }

  // ---- actors -------------------------------------------------------------
  drawTurkey(ctx, world) {
    const tk = world.turkey;
    const P = CONFIG.palette;
    const blink = tk.invuln > 0 && Math.floor(tk.invuln * 14) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    const bob = tk.onGround ? Math.sin(tk.runCycle) * 3 : 0;
    const x = tk.x, y = tk.y + bob, w = tk.w, h = tk.h;

    // tail fan
    ctx.fillStyle = P.turkeyTail;
    const fanX = x + w * 0.18, fanY = y + h * 0.42;
    for (let i = -3; i <= 3; i++) {
      ctx.save();
      ctx.translate(fanX, fanY);
      ctx.rotate(i * 0.32);
      ctx.fillStyle = i % 2 === 0 ? P.turkeyTail : P.turkeyBody;
      this.rr(ctx, -6, -34, 12, 36, 6);
      ctx.fill();
      ctx.restore();
    }

    // body
    ctx.fillStyle = P.turkeyBody;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.55, w * 0.42, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // wing
    ctx.fillStyle = P.turkeyWing;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.42, y + h * 0.6, w * 0.24, h * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // head + neck
    ctx.fillStyle = P.turkeyBody;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.74, y + h * 0.26, w * 0.18, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + w * 0.62, y + h * 0.34, w * 0.14, h * 0.2);

    // beak
    ctx.fillStyle = P.turkeyBeak;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.9, y + h * 0.24);
    ctx.lineTo(x + w * 1.06, y + h * 0.3);
    ctx.lineTo(x + w * 0.9, y + h * 0.32);
    ctx.closePath();
    ctx.fill();

    // snood
    ctx.fillStyle = P.turkeySnood;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.92, y + h * 0.38, 5, 9, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // eye
    ctx.fillStyle = P.turkeyEye;
    ctx.beginPath();
    ctx.arc(x + w * 0.78, y + h * 0.22, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + w * 0.79, y + h * 0.21, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.strokeStyle = P.turkeyBeak;
    ctx.lineWidth = 4;
    const legPhase = tk.onGround ? Math.sin(tk.runCycle) * 8 : 4;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y + h * 0.86);
    ctx.lineTo(x + w * 0.45 + legPhase, y + h);
    ctx.moveTo(x + w * 0.58, y + h * 0.86);
    ctx.lineTo(x + w * 0.58 - legPhase, y + h);
    ctx.stroke();
    ctx.restore();
  }

  drawFarmer(ctx, world) {
    const fm = world.farmer;
    const P = CONFIG.palette;
    ctx.save();
    const x = fm.x, y = fm.y, w = fm.w, h = fm.h;
    const surge = fm.surge > 0;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, CONFIG.groundY + 2, w * 0.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.fillStyle = '#3a3a2a';
    const swing = Math.sin(fm.armSwing) * 6;
    ctx.fillRect(x + w * 0.28, y + h * 0.62, 12, h * 0.38 + swing);
    ctx.fillRect(x + w * 0.55, y + h * 0.62, 12, h * 0.38 - swing);

    // coat
    ctx.fillStyle = surge ? '#5d7348' : P.farmerCoat;
    this.rr(ctx, x + w * 0.12, y + h * 0.22, w * 0.76, h * 0.46, 8);
    ctx.fill();
    // coat buttons
    ctx.fillStyle = '#2f3a26';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w * 0.48, y + h * (0.3 + i * 0.1), 5, 5);

    // arms reaching forward
    ctx.strokeStyle = P.farmerCoat;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    const reach = surge ? 16 : 6;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.34);
    ctx.lineTo(x - reach, y + h * 0.3 + swing);
    ctx.stroke();

    // head
    ctx.fillStyle = P.farmerSkin;
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.16, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // beard
    ctx.fillStyle = P.farmerBeard;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.32, y + h * 0.2);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.42, x + w * 0.68, y + h * 0.2);
    ctx.closePath();
    ctx.fill();
    // straw hat
    ctx.fillStyle = P.farmerHat;
    ctx.fillRect(x + w * 0.16, y + h * 0.02, w * 0.68, 7);
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.02, w * 0.24, 12, 0, Math.PI, 0);
    ctx.fill();
    // angry eye
    ctx.fillStyle = '#1b1120';
    ctx.fillRect(x + w * 0.56, y + h * 0.12, 4, 4);
    ctx.restore();
  }

  drawOven(ctx, world, o) {
    const P = CONFIG.palette;
    ctx.save();
    // glow aura
    const g = ctx.createRadialGradient(o.x + o.w / 2, o.y + o.h * 0.6, 6, o.x + o.w / 2, o.y + o.h * 0.6, o.w * 0.9);
    g.addColorStop(0, 'rgba(255,138,61,0.55)');
    g.addColorStop(1, 'rgba(255,138,61,0)');
    ctx.fillStyle = g;
    ctx.fillRect(o.x - o.w * 0.5, o.y - o.h * 0.5, o.w * 2, o.h * 1.8);
    // body
    ctx.fillStyle = P.ovenBody;
    this.rr(ctx, o.x, o.y, o.w, o.h, 8);
    ctx.fill();
    // door window
    ctx.fillStyle = P.ovenDoor;
    this.rr(ctx, o.x + 10, o.y + 18, o.w - 20, o.h * 0.5, 6);
    ctx.fill();
    // fire inside
    ctx.fillStyle = CONFIG.oven.glow;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * 0.3, o.y + o.h * 0.66);
    ctx.quadraticCurveTo(o.x + o.w * 0.4, o.y + o.h * 0.45, o.x + o.w * 0.5, o.y + o.h * 0.66);
    ctx.quadraticCurveTo(o.x + o.w * 0.6, o.y + o.h * 0.42, o.x + o.w * 0.7, o.y + o.h * 0.66);
    ctx.closePath();
    ctx.fill();
    // knobs
    ctx.fillStyle = '#cdd6df';
    ctx.beginPath();
    ctx.arc(o.x + o.w * 0.3, o.y + 10, 4, 0, Math.PI * 2);
    ctx.arc(o.x + o.w * 0.7, o.y + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawKnife(ctx, k) {
    const P = CONFIG.palette;
    ctx.save();
    ctx.translate(k.x + k.w / 2, k.y + k.h / 2);
    ctx.rotate(Math.sin(k.spin) * 0.35);
    // blade
    ctx.fillStyle = P.knifeBlade;
    ctx.beginPath();
    ctx.moveTo(-k.w * 0.5, -k.h * 0.2);
    ctx.lineTo(k.w * 0.2, -k.h * 0.7);
    ctx.lineTo(k.w * 0.2, k.h * 0.2);
    ctx.lineTo(-k.w * 0.5, k.h * 0.2);
    ctx.closePath();
    ctx.fill();
    // edge glint
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-k.w * 0.45, k.h * 0.15);
    ctx.lineTo(k.w * 0.18, k.h * 0.15);
    ctx.stroke();
    // handle
    ctx.fillStyle = P.knifeHandle;
    this.rr(ctx, k.w * 0.2, -k.h * 0.35, k.w * 0.3, k.h * 0.7, 4);
    ctx.fill();
    ctx.restore();
  }

  drawCorn(ctx, c) {
    const bob = Math.sin(c.bob) * 5;
    ctx.save();
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2 + bob);
    ctx.fillStyle = CONFIG.palette.cornGold;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.w * 0.42, c.h * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    // husk leaves
    ctx.fillStyle = '#7fa04a';
    ctx.beginPath();
    ctx.moveTo(-2, -c.h * 0.4);
    ctx.quadraticCurveTo(-14, 0, -4, c.h * 0.5);
    ctx.quadraticCurveTo(-6, 0, -2, -c.h * 0.4);
    ctx.fill();
    // kernel grid
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

  drawParticles(ctx, world) {
    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      this.text(ctx, f.text, f.x, f.y, 18, f.color, 'left');
    }
    ctx.globalAlpha = 1;
  }

  // ---- HUD ----------------------------------------------------------------
  drawHUD(ctx, world) {
    const pad = 26;
    // hearts (lives)
    for (let i = 0; i < CONFIG.lives; i++) {
      this.drawHeart(ctx, pad + i * 40, pad, 28, i < world.lives);
    }
    // distance + score pill (top center)
    const cx = CONFIG.view.width / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(18,10,22,0.6)';
    this.rr(ctx, cx - 150, pad - 6, 300, 48, 24);
    ctx.fill();
    ctx.restore();
    this.text(ctx, `${Math.floor(world.distance)} m`, cx, pad + 10, 24, CONFIG.palette.hudText, 'center');
    this.text(ctx, `CORN ${Math.floor(world.score)}`, cx, pad + 30, 16, CONFIG.palette.corn, 'center');

    // farmer proximity warning (right)
    const gap = world.turkey.x - (world.farmer.x + world.farmer.w);
    if (gap < 260) {
      const urgency = 1 - gap / 260;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(world.time * 14) * 0.35 * urgency;
      this.text(ctx, 'HE\'S CLOSE!', CONFIG.view.width - pad, pad + 14, 22, '#ff6b6b', 'right');
      ctx.restore();
    }

    // stage progress bar (bottom)
    const bw = CONFIG.view.width - pad * 2;
    const by = CONFIG.view.height - 22;
    ctx.save();
    ctx.fillStyle = 'rgba(18,10,22,0.55)';
    this.rr(ctx, pad, by, bw, 10, 5);
    ctx.fill();
    const prog = Math.min(1, world.distance / CONFIG.escapeDistance);
    ctx.fillStyle = CONFIG.palette.harvest;
    this.rr(ctx, pad, by, Math.max(6, bw * prog), 10, 5);
    ctx.fill();
    ctx.restore();
    this.text(ctx, 'ESCAPE', CONFIG.view.width - pad, by - 12, 13, CONFIG.palette.hudText, 'right', 'bold');
  }

  drawHeart(ctx, x, y, s, filled) {
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    ctx.scale(s / 32, s / 32);
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
      ctx.strokeStyle = 'rgba(244,237,226,0.5)';
    }
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // ---- screens ------------------------------------------------------------
  drawTitle(world) {
    const ctx = this.ctx;
    // static decorative backdrop
    const fakeWorld = { distance: 0, currentStage: () => CONFIG.stages[0], time: 0 };
    this.drawBackdrop(ctx, fakeWorld);

    // animated turkey + farmer vignette at the bottom
    ctx.save();
    const t = performance.now() / 1000;
    ctx.translate(Math.sin(t) * 6, 0);
    this.drawTurkey(ctx, { turkey: { x: 420, y: CONFIG.groundY - 64, w: 56, h: 64, onGround: true, runCycle: t * 8, invuln: 0, ducking: false } });
    this.drawFarmer(ctx, { farmer: { x: 300, y: CONFIG.groundY - 92, w: 64, h: 92, armSwing: t * 8, surge: 0 } });
    ctx.restore();

    // title block
    ctx.save();
    ctx.fillStyle = 'rgba(18,10,22,0.55)';
    this.rr(ctx, CONFIG.view.width / 2 - 470, 120, 940, 300, 28);
    ctx.fill();
    ctx.restore();

    this.text(ctx, 'TURKEY TROT', CONFIG.view.width / 2, 190, 84, CONFIG.palette.turkeyTail, 'center');
    this.text(ctx, 'Escape the Harvest', CONFIG.view.width / 2, 252, 38, CONFIG.palette.harvest, 'center');

    this.text(ctx, 'Run from the farmer. Leap the ovens. Duck the carving knives.', CONFIG.view.width / 2, 312, 22, CONFIG.palette.hudText, 'center');
    this.text(ctx, 'Grab corn for points. Reach 4000 m to escape for good.', CONFIG.view.width / 2, 344, 20, CONFIG.palette.hay, 'center');

    // controls
    this.text(ctx, 'SPACE / ↑ / W  jump    ·    ↓ / S  duck    ·    ← → / A D  move', CONFIG.view.width / 2, 392, 18, '#cbbfae', 'center');
    this.text(ctx, 'Tap or click to steer on touch', CONFIG.view.width / 2, 420, 16, '#9c8f80', 'center');

    // prompt
    const pulse = 0.7 + Math.sin(performance.now() / 300) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    this.text(ctx, 'PRESS SPACE TO START', CONFIG.view.width / 2, 500, 30, CONFIG.palette.corn, 'center');
    ctx.restore();

    // lives preview
    for (let i = 0; i < CONFIG.lives; i++) this.drawHeart(ctx, CONFIG.view.width / 2 - 44 + i * 40, 540, 28, true);
  }

  drawPlay(world) {
    const ctx = this.ctx;
    ctx.save();
    const sx = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    const sy = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    ctx.translate(sx, sy);
    this.drawBackdrop(ctx, world);
    for (const o of world.ovens) this.drawOven(ctx, world, o);
    for (const c of world.corn) this.drawCorn(ctx, c);
    for (const k of world.knives) this.drawKnife(ctx, k);
    this.drawFarmer(ctx, world);
    this.drawTurkey(ctx, world);
    this.drawParticles(ctx, world);
    ctx.restore();

    // near-miss flash overlay
    if (world.flash > 0) {
      ctx.save();
      ctx.globalAlpha = world.flash * 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CONFIG.view.width, CONFIG.view.height);
      ctx.restore();
    }

    this.drawHUD(ctx, world);
  }

  drawEnd(world) {
    const ctx = this.ctx;
    // frozen play scene behind the panel
    this.drawBackdrop(ctx, world);
    this.drawFarmer(ctx, world);
    this.drawTurkey(ctx, world);
    for (const o of world.ovens) this.drawOven(ctx, world, o);

    ctx.save();
    ctx.fillStyle = 'rgba(18,10,22,0.72)';
    ctx.fillRect(0, 0, CONFIG.view.width, CONFIG.view.height);
    ctx.restore();

    const escaped = world.endReason === END_REASON.ESCAPED;
    const title = escaped ? 'YOU ESCAPED!' : 'CAUGHT!';
    const color = escaped ? CONFIG.palette.corn : '#ff6b6b';
    const sub = escaped
      ? 'The turkey lives to gobble another day.'
      : 'The farmer got you. Dinner is served... almost.';

    ctx.save();
    ctx.fillStyle = 'rgba(30,16,36,0.85)';
    this.rr(ctx, CONFIG.view.width / 2 - 380, 130, 760, 420, 28);
    ctx.fill();
    ctx.strokeStyle = escaped ? CONFIG.palette.corn : '#c0303f';
    ctx.lineWidth = 4;
    this.rr(ctx, CONFIG.view.width / 2 - 380, 130, 760, 420, 28);
    ctx.stroke();
    ctx.restore();

    this.text(ctx, title, CONFIG.view.width / 2, 200, 76, color, 'center');
    this.text(ctx, sub, CONFIG.view.width / 2, 258, 22, CONFIG.palette.hudText, 'center');

    // stats
    this.text(ctx, `DISTANCE`, CONFIG.view.width / 2 - 160, 320, 18, CONFIG.palette.hay, 'center');
    this.text(ctx, `${Math.floor(world.distance)} m`, CONFIG.view.width / 2 - 160, 350, 30, CONFIG.palette.hudText, 'center');
    this.text(ctx, `SCORE`, CONFIG.view.width / 2, 320, 18, CONFIG.palette.hay, 'center');
    this.text(ctx, `${Math.floor(world.score)}`, CONFIG.view.width / 2, 350, 30, CONFIG.palette.corn, 'center');
    this.text(ctx, `LIVES LEFT`, CONFIG.view.width / 2 + 160, 320, 18, CONFIG.palette.hay, 'center');
    this.text(ctx, `${world.lives}`, CONFIG.view.width / 2 + 160, 350, 30, CONFIG.palette.hudText, 'center');

    for (let i = 0; i < CONFIG.lives; i++) {
      this.drawHeart(ctx, CONFIG.view.width / 2 + 130 + i * 32, 380, 24, i < world.lives);
    }

    const pulse = 0.7 + Math.sin(performance.now() / 280) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    this.text(ctx, 'PRESS SPACE TO RUN AGAIN', CONFIG.view.width / 2, 480, 30, CONFIG.palette.harvest, 'center');
    ctx.restore();
  }

  // ---- colour util --------------------------------------------------------
  mix(a, b, t) {
    const pa = this.hex(a), pb = this.hex(b);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
}
