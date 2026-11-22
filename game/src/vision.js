// Quiet Vault: what a guard can see. Line of sight is sampled along the
// segment in short steps; a wall or a crate anywhere on it blocks the view.
// A cone check is range, then angle, then line of sight, in that order,
// so the common miss (too far) costs almost nothing.
import { GUARD_VISION_HALF_ANGLE, GUARD_VISION_RANGE } from './config.js';
import { isSolidTile, tileAt } from './level.js';

/** Whether the straight segment from (x0, y0) to (x1, y1) crosses no solid tile. */
export function losClear(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;
  const steps = Math.ceil(dist / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidTile(tileAt(level, x0 + dx * t, y0 + dy * t))) return false;
  }
  return true;
}

/**
 * Whether a guard at (gx, gy) facing `angle` can see a point (px, py):
 * inside the vision range, inside the cone's half-angle, with line of sight.
 */
export function canSee(level, gx, gy, angle, px, py, range = GUARD_VISION_RANGE) {
  const dx = px - gx;
  const dy = py - gy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > GUARD_VISION_HALF_ANGLE) return false;
  return losClear(level, gx, gy, px, py);
}
