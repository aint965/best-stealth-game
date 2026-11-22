// Quiet Vault: the player. Movement is axis-separated against solid tiles,
// so the courier slides along walls instead of sticking to them. Pickup and
// lure are explicit actions the loop calls, never automatic, so the test
// can drive them one at a time.
import {
  EXIT_RANGE,
  PICKUP_RANGE,
  PLAYER_RADIUS,
  PLAYER_SNEAK_SPEED,
  PLAYER_WALK_SPEED,
} from './config.js';
import { isSolidTile, tileAt } from './level.js';

/** The player at the level's start. */
export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    angle: -Math.PI / 2,
    sneaking: false,
    moving: false,
    stepPhase: 0,
  };
}

/** Whether a circle at (x, y) with radius r overlaps a solid tile. */
function hitsSolid(level, x, y, r) {
  for (const [cx, cy] of [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r],
  ]) {
    if (isSolidTile(tileAt(level, cx, cy))) return true;
  }
  return false;
}

/**
 * Move the player by (dx, dy) for one step, one axis at a time. Returns
 * whether the player actually moved.
 */
export function movePlayer(level, player, dx, dy) {
  let moved = false;
  if (dx !== 0) {
    const nx = player.x + dx;
    if (!hitsSolid(level, nx, player.y, PLAYER_RADIUS)) {
      player.x = nx;
      moved = true;
    }
  }
  if (dy !== 0) {
    const ny = player.y + dy;
    if (!hitsSolid(level, player.x, ny, PLAYER_RADIUS)) {
      player.y = ny;
      moved = true;
    }
  }
  if (moved) {
    player.angle = Math.atan2(dy, dx);
    player.stepPhase += Math.hypot(dx, dy);
  }
  return moved;
}

/** Read the held keys into a velocity; sneaking is slower and quieter. */
export function playerVelocity(input, dt) {
  const mx = input.moveX();
  const my = input.moveY();
  const sneaking = input.sneaking();
  const speed = sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
  const len = Math.hypot(mx, my);
  if (len === 0) return { dx: 0, dy: 0, sneaking };
  return { dx: (mx / len) * speed * dt, dy: (my / len) * speed * dt, sneaking };
}

/** The nearest uncollected objective within pickup range, or null. */
export function nearestObjective(player, objectives) {
  let best = null;
  let bestDist = PICKUP_RANGE;
  for (const o of objectives) {
    if (o.taken) continue;
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      best = o;
    }
  }
  return best;
}

/** Whether the player stands close enough to the exit to leave. */
export function atExit(player, exit) {
  return Math.hypot(exit.x - player.x, exit.y - player.y) < EXIT_RANGE;
}
