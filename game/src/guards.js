// Quiet Vault: the guards. Each guard is a small state machine — patrol,
// investigate, chase, search, return — driven by what it can see. A guard
// never teleports and never knows where the player is without seeing or
// hearing something: suspicion is the only thing that carries over.
import {
  CHASE_LOSE_TIME,
  GUARD_CAUGHT_RANGE,
  GUARD_CHASE_SPEED,
  GUARD_PATROL_SPEED,
  INVESTIGATE_TIME,
  LURE_RANGE,
  SEARCH_TIME,
  SUSPICION_DECAY,
  SUSPICION_INVESTIGATE_AT,
  SUSPICION_RISE,
  SHADOW_DETECTION,
  SNEAK_DETECTION,
} from './config.js';
import { isShadowAt } from './level.js';
import { canSee } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

/** One guard from a level's patrol definition. */
export function createGuard(def) {
  return {
    x: def.start.x,
    y: def.start.y,
    angle: 0,
    state: GUARD_PATROL,
    waypointIndex: 0,
    waypoints: def.waypoints,
    pause: def.pause,
    wait: 0,
    suspicion: 0,
    lastSeen: null,
    loseTimer: 0,
    searchTimer: 0,
    investigateTimer: 0,
    target: null,
  };
}

function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

/** Turn `angle` toward `target` by at most `maxStep` radians. */
function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) <= maxStep) return target;
  return angle + Math.sign(diff) * maxStep;
}

/** Move toward (tx, ty) at `speed`, sliding on one axis at a time. */
function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.angle = turnToward(guard.angle, angleTo(guard.x, guard.y, tx, ty), 6 * dt);
  return dist - step < 1;
}

/**
 * One fixed step for one guard. `player` is {x, y, sneaking}; `lure` is the
 * active lure or null. Returns 'caught' when this guard catches the player.
 */
export function updateGuard(guard, level, player, lure, dt) {
  const sees = canSee(level, guard.x, guard.y, guard.angle, player.x, player.y);
  if (sees) {
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseTimer = 0;
    // Closer and louder is worse: suspicion rises with closeness, halved
    // while the player sneaks or hides in shadow.
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    let rate = SUSPICION_RISE * (1 - (dist / 178) * 0.6);
    if (player.sneaking) rate *= SNEAK_DETECTION;
    if (isShadowAt(level, player.x, player.y)) rate *= SHADOW_DETECTION;
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
    guard.angle = turnToward(guard.angle, angleTo(guard.x, guard.y, player.x, player.y), 8 * dt);
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DECAY * dt);
  }

  // A lure landing nearby pulls a calm guard off its patrol.
  if (lure !== null && guard.state === GUARD_PATROL && guard.suspicion < SUSPICION_INVESTIGATE_AT) {
    const d = Math.hypot(lure.x - guard.x, lure.y - guard.y);
    if (d < LURE_RANGE) {
      guard.state = GUARD_INVESTIGATE;
      guard.target = { x: lure.x, y: lure.y };
      guard.investigateTimer = INVESTIGATE_TIME;
    }
  }

  if (guard.suspicion >= 100 && guard.state !== GUARD_CHASE) {
    guard.state = GUARD_CHASE;
    guard.loseTimer = 0;
  }

  switch (guard.state) {
    case GUARD_PATROL: {
      if (guard.suspicion >= SUSPICION_INVESTIGATE_AT && guard.lastSeen !== null) {
        guard.state = GUARD_INVESTIGATE;
        guard.target = { x: guard.lastSeen.x, y: guard.lastSeen.y };
        guard.investigateTimer = INVESTIGATE_TIME;
        break;
      }
      if (guard.wait > 0) {
        guard.wait -= dt;
        break;
      }
      const wp = guard.waypoints[guard.waypointIndex];
      if (moveToward(guard, wp.x, wp.y, GUARD_PATROL_SPEED, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.wait = guard.pause;
      }
      break;
    }
    case GUARD_INVESTIGATE: {
      if (guard.target !== null && moveToward(guard, guard.target.x, guard.target.y, GUARD_PATROL_SPEED * 1.25, dt)) {
        guard.target = null;
        guard.investigateTimer = INVESTIGATE_TIME;
      }
      if (guard.target === null) {
        guard.investigateTimer -= dt;
        guard.angle += 1.6 * dt; // look around the spot
        if (guard.investigateTimer <= 0) {
          guard.state = GUARD_RETURN;
          guard.target = null;
        }
      }
      break;
    }
    case GUARD_CHASE: {
      if (sees) {
        moveToward(guard, player.x, player.y, GUARD_CHASE_SPEED, dt);
        guard.loseTimer = 0;
      } else {
        guard.loseTimer += dt;
        if (guard.lastSeen !== null) moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD_CHASE_SPEED, dt);
        if (guard.loseTimer >= CHASE_LOSE_TIME) {
          guard.state = GUARD_SEARCH;
          guard.searchTimer = SEARCH_TIME;
          guard.target = guard.lastSeen !== null ? { x: guard.lastSeen.x, y: guard.lastSeen.y } : { x: guard.x, y: guard.y };
        }
      }
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD_CAUGHT_RANGE) return 'caught';
      break;
    }
    case GUARD_SEARCH: {
      if (guard.target !== null) moveToward(guard, guard.target.x, guard.target.y, GUARD_PATROL_SPEED * 1.25, dt);
      guard.searchTimer -= dt;
      guard.angle += 1.2 * dt;
      if (guard.searchTimer <= 0) {
        guard.state = GUARD_RETURN;
        guard.target = null;
      }
      break;
    }
    case GUARD_RETURN: {
      const wp = guard.waypoints[guard.waypointIndex];
      if (moveToward(guard, wp.x, wp.y, GUARD_PATROL_SPEED, dt)) {
        guard.state = GUARD_PATROL;
        guard.wait = guard.pause;
      }
      break;
    }
    default:
      break;
  }
  return null;
}
