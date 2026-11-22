// Starlight Archive — Wren, the junior archivist.
// Walks the galleries, sneaks when Shift is held, and takes a star chart
// with E when standing close to one. Footsteps sound with every stride —
// louder walking, softer sneaking — and shadow alcoves hide her from sight.
import { PLAYER_RADIUS, WALK_SPEED, SNEAK_SPEED, PICKUP_RADIUS } from './config.js';
import { moveCircle, tileAt } from './level.js';

/** A fresh archivist at the level's start. */
export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    angle: -Math.PI / 2,
    sneaking: false,
    inShadow: false,
    stepAcc: 0,
  };
}

/** One tick of movement, hiding and picking up. */
export function updatePlayer(player, dt, input, world) {
  player.sneaking = input.sneak;
  const speed = player.sneaking ? SNEAK_SPEED : WALK_SPEED;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  moveCircle(player, dx * speed * dt, dy * speed * dt, world.level, PLAYER_RADIUS);
  if (dx !== 0 || dy !== 0) {
    player.angle = Math.atan2(dy, dx);
    player.stepAcc += Math.hypot(dx, dy) * speed * dt;
    if (player.stepAcc > 30) {
      player.stepAcc = 0;
      world.onFootstep?.(player.sneaking);
    }
  }
  player.inShadow = tileAt(world.level, player.x, player.y) === 'S';

  if (input.consume('interact')) {
    for (const chart of world.objectives) {
      if (!chart.taken && Math.hypot(chart.x - player.x, chart.y - player.y) < PICKUP_RADIUS) {
        chart.taken = true;
        world.onPickup?.();
        if (world.objectives.every((c) => c.taken)) {
          world.exitOpen = true;
          world.onDoorOpen?.();
        }
        break;
      }
    }
  }
}
