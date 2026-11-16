// Keyboard and mouse state, translated into game coordinates.
// Edge-triggered presses are collected per frame and cleared by endFrame().

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';

export class InputTracker {
  constructor(canvas) {
    this.canvas = canvas;
    this.keysDown = new Set();
    this.keysPressed = new Set();
    this.mouseX = GAME_WIDTH * 0.72;
    this.mouseY = GAME_HEIGHT * 0.42;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseSeen = false;
    this.onKeyDown = (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.keysPressed.add(event.code);
      this.keysDown.add(event.code);
    };
    this.onKeyUp = (event) => {
      this.keysDown.delete(event.code);
    };
    this.onMouseMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.mouseX = ((event.clientX - rect.left) / rect.width) * GAME_WIDTH;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * GAME_HEIGHT;
      this.mouseSeen = true;
    };
    this.onMouseDown = (event) => {
      if (event.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
      this.onMouseMove(event);
    };
    this.onMouseUp = (event) => {
      if (event.button !== 0) return;
      this.mouseDown = false;
    };
    this.onBlur = () => {
      this.keysDown.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  isDown(code) {
    return this.keysDown.has(code);
  }

  wasPressed(code) {
    return this.keysPressed.has(code);
  }

  // Normalised WASD / arrow movement axis.
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  wantsFire(autoFire) {
    return this.mouseDown || this.isDown('KeyF') || autoFire;
  }

  endFrame() {
    this.keysPressed.clear();
    this.mouseClicked = false;
  }
}
