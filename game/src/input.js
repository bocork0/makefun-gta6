// Solmar Bay — keyboard and mouse input.
// Holds the live key set plus edge-triggered "just pressed" flags that the
// game loop consumes once per frame, so a tap of E never fires twice.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.dragDX = 0;
    this.dragDY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.canvas = canvas;
    this.onFirstGesture = null;
    this.gestureSeen = false;
    this.attach(canvas);
  }

  noteGesture() {
    if (!this.gestureSeen) {
      this.gestureSeen = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.noteGesture();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.noteGesture();
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
      this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this.dragging) {
        this.dragDX += e.clientX - this.lastX;
        this.dragDY += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True once, on the frame the key went down; consumed by endFrame().
  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  takeDrag() {
    const d = { dx: this.dragDX, dy: this.dragDY };
    this.dragDX = 0;
    this.dragDY = 0;
    return d;
  }

  takeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  endFrame() {
    this.pressed.clear();
  }

  // Movement axes, -1..1. Forward is W / ArrowUp, strafe is A/D on foot.
  moveAxis() {
    const f = (this.down('KeyW', 'ArrowUp') ? 1 : 0) - (this.down('KeyS', 'ArrowDown') ? 1 : 0);
    const s = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    return { forward: f, strafe: s };
  }

  get sprint() {
    return this.down('ShiftLeft', 'ShiftRight');
  }
}
