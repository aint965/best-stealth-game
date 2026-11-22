// Starlight Archive — what a sentry can see.
// A sentry sees the archivist when three things are true: the archivist is
// inside the cone's range, inside its angle, and in line of sight (no wall
// or crate between them). Sneaking and standing in a shadow alcove both
// shrink the range, so cover and darkness are real tools, not decoration.
import { CONE_RANGE, CONE_HALF_ANGLE, SNEAK_RANGE_FACTOR, SHADOW_RANGE_FACTOR } from './config.js';
import { isSolidTile, tileAt } from './level.js';

/** How far a sentry can spot the archivist right now. */
export function detectionRange(player) {
  let range = CONE_RANGE;
  if (player.sneaking) range *= SNEAK_RANGE_FACTOR;
  if (player.inShadow) range *= SHADOW_RANGE_FACTOR;
  return range;
}

/** Whether any wall or crate stands between two points. */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidTile(tileAt(level, x0 + dx * t, y0 + dy * t))) return false;
  }
  return true;
}

/** Whether this sentry can currently see the archivist. */
export function canSee(guard, player, level) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > detectionRange(player)) return false;
  if (dist > 4) {
    let diff = Math.atan2(dy, dx) - guard.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > CONE_HALF_ANGLE) return false;
  }
  return hasLineOfSight(level, guard.x, guard.y, player.x, player.y);
}
