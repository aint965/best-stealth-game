// Starlight Archive — keyboard and mouse.
// WASD/arrows move, Shift sneaks, E takes a chart, P pauses, M mutes,
// R retries after being caught, Enter confirms. A mouse click throws a
// lure at that spot. Held keys are read every frame; one-shot keys are
// queued and consumed once, so a single press never fires twice.
export function makeInput(canvas, onClick) {
  const held = new Set();
  const pressed = new Set();
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    consume(name) {
      if (pressed.has(name)) {
        pressed.delete(name);
        return true;
      }
      return false;
    },
    clearPressed() {
      pressed.clear();
    },
    sync() {
      input.up = held.has('up');
      input.down = held.has('down');
      input.left = held.has('left');
      input.right = held.has('right');
      input.sneak = held.has('sneak');
    },
  };

  const KEY_ACTIONS = {
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    ShiftLeft: 'sneak',
    ShiftRight: 'sneak',
  };
  const KEY_PRESSED = {
    KeyE: 'interact',
    Enter: 'confirm',
    KeyP: 'pause',
    KeyM: 'mute',
    KeyR: 'retry',
  };

  window.addEventListener('keydown', (event) => {
    if (event.code in KEY_ACTIONS) {
      held.add(KEY_ACTIONS[event.code]);
      event.preventDefault();
    } else if (event.code in KEY_PRESSED) {
      if (!event.repeat) pressed.add(KEY_PRESSED[event.code]);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code in KEY_ACTIONS) held.delete(KEY_ACTIONS[event.code]);
  });
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    onClick(event.clientX - rect.left, event.clientY - rect.top);
  });
  return input;
}
