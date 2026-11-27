// Input: keyboard (Space / Arrow / WASD) plus touch and mouse.
// The outside world talks to the game through a tiny intent object the
// simulation reads each step: { left, right, jump, duck, start }.

const KEY_LEFT = ['ArrowLeft', 'KeyA'];
const KEY_RIGHT = ['ArrowRight', 'KeyD'];
const KEY_JUMP = ['Space', 'ArrowUp', 'KeyW'];
const KEY_DUCK = ['ArrowDown', 'KeyS'];
const KEY_START = ['Space', 'Enter'];

export class Input {
  constructor(target = window) {
    this.target = target;
    this.left = false;
    this.right = false;
    this.jump = false;
    this.duck = false;
    this.jumpPressed = false;   // edge: consumed by the sim each step
    this.startPressed = false;  // edge: advances title -> play -> restart
    this._handlers = [];
    this.attach();
  }

  attach() {
    const on = (el, type, fn, opts) => {
      el.addEventListener(type, fn, opts);
      this._handlers.push([el, type, fn, opts]);
    };
    on(this.target, 'keydown', (e) => this._onKey(e, true));
    on(this.target, 'keyup', (e) => this._onKey(e, false));
    // Touch: left half steer/jump, right half duck. A tap anywhere starts.
    on(this.target, 'touchstart', (e) => this._onTouch(e, true), { passive: false });
    on(this.target, 'touchend', (e) => this._onTouch(e, false), { passive: false });
    on(this.target, 'touchcancel', (e) => this._onTouch(e, false), { passive: false });
    // Mouse: press advances screens / jumps; hold on lower half ducks.
    on(this.target, 'mousedown', (e) => this._onMouse(e, true));
    on(this.target, 'mouseup', (e) => this._onMouse(e, false));
    // Keep the page from scrolling on space.
    on(this.target, 'keydown', (e) => {
      if (KEY_JUMP.includes(e.code) || KEY_START.includes(e.code)) e.preventDefault();
    });
  }

  detach() {
    for (const [el, type, fn, opts] of this._handlers) el.removeEventListener(type, fn, opts);
    this._handlers = [];
  }

  _onKey(e, down) {
    if (e.repeat) {
      // Still allow held movement, but ignore repeat for edges.
      if (KEY_LEFT.includes(e.code)) this.left = down;
      if (KEY_RIGHT.includes(e.code)) this.right = down;
      return;
    }
    if (KEY_LEFT.includes(e.code)) this.left = down;
    if (KEY_RIGHT.includes(e.code)) this.right = down;
    if (KEY_DUCK.includes(e.code)) this.duck = down;
    if (KEY_JUMP.includes(e.code)) {
      this.jump = down;
      if (down) this.jumpPressed = true;
    }
    if (KEY_START.includes(e.code) && down) this.startPressed = true;
  }

  _touchX(e) {
    const t = e.changedTouches && e.changedTouches[0];
    return t ? t.clientX : 0;
  }

  _onTouch(e, down) {
    if (e.cancelable) e.preventDefault();
    const w = this.target.innerWidth || 1280;
    const x = this._touchX(e);
    if (down && this._screenSteers()) {
      // in play: left half jump/steer, right half duck
      if (x < w / 2) {
        this.jump = down;
        if (down) this.jumpPressed = true;
      } else {
        this.duck = down;
      }
    }
    if (down) this.startPressed = true;
    if (!down) {
      this.jump = false;
      this.duck = false;
    }
  }

  _onMouse(e, down) {
    const w = this.target.innerWidth || 1280;
    const x = e.clientX;
    if (this._screenSteers()) {
      if (x < w / 2) {
        this.jump = down;
        if (down) this.jumpPressed = true;
      } else {
        this.duck = down;
      }
    }
    if (down) this.startPressed = true;
  }

  _screenSteers() {
    return this._steering === true;
  }

  // The main loop sets this so touch/mouse only steer while a run is live.
  setSteering(on) {
    this._steering = on;
  }

  // Called by the sim after it consumes the one-shot edges.
  consumeEdges() {
    this.jumpPressed = false;
    this.startPressed = false;
  }
}
