// Entrées : clavier, écran tactile et manette.
import { clamp } from './util.js';

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressedOnce = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, hb: false };
    this.steer = 0;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedOnce.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  bindTouch(root) {
    root.querySelectorAll('[data-touch]').forEach((el) => {
      const k = el.dataset.touch;
      const on = (e) => { e.preventDefault(); this.touch[k] = true; el.classList.add('on'); };
      const off = (e) => { e.preventDefault(); this.touch[k] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    });
  }

  // Vrai une seule fois par appui.
  consume(code) {
    if (this.pressedOnce.has(code)) { this.pressedOnce.delete(code); return true; }
    return false;
  }

  endFrame() { this.pressedOnce.clear(); }

  gamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  read(dt) {
    const k = this.keys, t = this.touch;
    const left = k.has('ArrowLeft') || k.has('KeyA') || k.has('KeyQ') || t.left;
    const right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    let throttle = k.has('ArrowUp') || k.has('KeyW') || k.has('KeyZ') || t.gas ? 1 : 0;
    let brake = k.has('ArrowDown') || k.has('KeyS') || t.brake ? 1 : 0;
    let handbrake = k.has('Space') || t.hb;

    // Direction clavier progressive (retour au centre plus rapide).
    const target = (left ? 1 : 0) - (right ? 1 : 0);
    const rate = target === 0 || Math.sign(target) !== Math.sign(this.steer) ? 7 : 3.2;
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    let steer = this.steer;

    const pad = this.gamepad();
    if (pad) {
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.12) steer = -Math.sign(ax) * Math.pow((Math.abs(ax) - 0.12) / 0.88, 1.4);
      const rt = pad.buttons[7]?.value || 0, lt = pad.buttons[6]?.value || 0;
      throttle = Math.max(throttle, rt, pad.buttons[0]?.pressed ? 1 : 0);
      brake = Math.max(brake, lt, pad.buttons[1]?.pressed ? 1 : 0);
      handbrake = handbrake || !!pad.buttons[2]?.pressed || !!pad.buttons[5]?.pressed;
      if (pad.buttons[3]?.pressed) this.pressedOnce.add('PadReset');
      if (pad.buttons[9]?.pressed && !this._startHeld) this.pressedOnce.add('Escape');
      this._startHeld = !!pad.buttons[9]?.pressed;
    }
    return { throttle, brake, steer, handbrake };
  }
}
