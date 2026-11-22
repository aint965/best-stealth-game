// Quiet Vault: keyboard and mouse. Held keys give a move direction and a
// sneak flag; one-shot presses (interact, pause, mute, confirm, retry) are
// queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice. A click throws a lure at
// the clicked point, converted from screen pixels to game pixels.
export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_RETRY = 16;
export const ACTION_CLICK = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyR') actions |= ACTION_RETRY;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    click = {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
    // A click is its own action: during play it throws a lure (the loop
    // reads takeClick), on the title screen it starts the game. It never
    // sets CONFIRM, so a lure thrown mid-play cannot skip a later screen.
    actions |= ACTION_CLICK;
  });

  function has(keys) {
    for (const k of keys) if (held.has(k)) return true;
    return false;
  }

  return {
    /** -1, 0 or 1 on each axis. */
    moveX() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    moveY() {
      return (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
    },
    sneaking() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** Screen-level presses (pause, mute, confirm, retry, click) since the last call; only those bits are cleared. */
    takeScreenActions() {
      const taken = actions & (ACTION_PAUSE | ACTION_MUTE | ACTION_CONFIRM | ACTION_RETRY | ACTION_CLICK);
      actions &= ~(ACTION_PAUSE | ACTION_MUTE | ACTION_CONFIRM | ACTION_RETRY | ACTION_CLICK);
      return taken;
    },
    /** Whether E was pressed since the last call; only that bit is cleared. */
    takeInteract() {
      const taken = (actions & ACTION_INTERACT) !== 0;
      actions &= ~ACTION_INTERACT;
      return taken;
    },
    /** The last click's game coordinates, or null; taken once. */
    takeClick() {
      const c = click;
      click = null;
      return c;
    },
  };
}
