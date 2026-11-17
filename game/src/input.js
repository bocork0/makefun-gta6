// Keyboard + mouse input. Drag to look (no pointer lock, so it works headless too);
// arrow keys also rotate the camera. Actions are edge-triggered and consumed by takeActions().
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_INTERACT = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lookDX = 0;
  let lookDY = 0;
  let shootHeld = false;
  let shootQueued = false;

  function codeOf(e) {
    return e.code || e.key;
  }

  function onKeyDown(e) {
    const code = codeOf(e);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(code);
    if (code === 'Space' || code === 'Enter') actions |= ACTION_CONFIRM;
    if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
    if (code === 'KeyE') actions |= ACTION_ENTER_CAR;
    if (code === 'KeyF') actions |= ACTION_PUNCH;
    if (code === 'KeyQ') actions |= ACTION_INTERACT;
  }

  function onKeyUp(e) {
    keys.delete(codeOf(e));
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      shootHeld = true;
      shootQueued = true;
    }
  }

  function onMouseMove(e) {
    if (!dragging) return;
    lookDX += e.clientX - lastX;
    lookDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onMouseUp(e) {
    if (e.button === 0) {
      dragging = false;
      shootHeld = false;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    // Forward/back/strafe in camera space, -1..1 each.
    move() {
      let f = 0;
      let s = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
      if (keys.has('KeyA')) s -= 1;
      if (keys.has('KeyD')) s += 1;
      return { f, s };
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    cameraTurn() {
      let turn = 0;
      if (keys.has('ArrowLeft')) turn -= 1;
      if (keys.has('ArrowRight')) turn += 1;
      return turn;
    },
    takeLook() {
      const dx = lookDX;
      const dy = lookDY;
      lookDX = 0;
      lookDY = 0;
      return { dx, dy };
    },
    takeActions() {
      const a = actions;
      actions = 0;
      if (shootQueued) {
        shootQueued = false;
        return a | ACTION_SHOOT;
      }
      return a;
    },
    shooting() {
      return shootHeld;
    },
    held(code) {
      return keys.has(code);
    },
    // Test / automation hook: pretend keys are held.
    press(code) {
      keys.add(code);
    },
    release(code) {
      keys.delete(code);
    },
    queueAction(action) {
      actions |= action;
    },
  };
}
