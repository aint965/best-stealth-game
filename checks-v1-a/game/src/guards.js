// Starlight Archive — the night sentries.
// A sentry patrols its waypoints, pausing to scan. When it glimpses the
// archivist its suspicion rises and it stands and stares; past halfway it
// walks to the last-seen spot to investigate, and at full suspicion it
// raises the alarm and chases. Break line of sight and the chase cools
// back to a search, then to calm — detection is always recoverable.
import {
  PATROL_SPEED,
  INVESTIGATE_SPEED,
  CHASE_SPEED,
  CATCH_RADIUS,
  INVESTIGATE_AT,
  SUSPICION_RISE_BASE,
  SUSPICION_RISE_CLOSE,
  SUSPICION_DECAY,
  CHASE_LOSE_TIME,
} from './config.js';
import { canSee, detectionRange } from './vision.js';
import { moveCircle } from './level.js';

/** A live sentry from a level's patrol definition. */
export function makeGuard(def) {
  return {
    x: def.start.x,
    y: def.start.y,
    angle: 0,
    waypoints: def.waypoints,
    waypointIndex: 0,
    pauseTimer: 0,
    suspicion: 0,
    state: 'patrol', // patrol | investigate | chase | return
    target: null,
    lookTimer: 0,
    loseTimer: 0,
    lastSeen: null,
    isLure: false,
  };
}

function angleToward(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function stepToward(g, target, speed, dt, level) {
  const dx = target.x - g.x;
  const dy = target.y - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  g.angle = Math.atan2(dy, dx);
  moveCircle(g, (dx / dist) * step, (dy / dist) * step, level, 14);
  return Math.hypot(target.x - g.x, target.y - g.y) < 10;
}

function patrolStep(g, dt, level) {
  if (g.pauseTimer > 0) {
    g.pauseTimer -= dt;
    g.angle += 0.6 * dt; // scan the room while paused
    return;
  }
  const target = g.waypoints[g.waypointIndex];
  if (stepToward(g, target, PATROL_SPEED, dt, level)) {
    g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
    g.pauseTimer = 1.2;
  }
}

function investigateStep(g, dt, level) {
  if (!g.target) {
    g.state = 'return';
    return;
  }
  if (stepToward(g, g.target, INVESTIGATE_SPEED, dt, level)) {
    g.lookTimer += dt;
    g.angle += 1.1 * dt; // look around the spot
    if (g.lookTimer > 2) {
      g.lookTimer = 0;
      g.target = null;
      g.isLure = false;
      g.state = 'return';
    }
  }
}

function chaseStep(g, dt, world, seen) {
  const { player, level } = world;
  if (!seen) {
    g.loseTimer += dt;
    if (g.loseTimer > CHASE_LOSE_TIME) {
      g.loseTimer = 0;
      g.state = 'investigate';
      g.target = g.lastSeen ? { ...g.lastSeen } : { x: player.x, y: player.y };
      return;
    }
  } else {
    g.loseTimer = 0;
  }
  stepToward(g, player, CHASE_SPEED, dt, level);
  if (Math.hypot(player.x - g.x, player.y - g.y) < CATCH_RADIUS) world.caught = true;
}

function returnStep(g, dt, level) {
  const target = g.waypoints[g.waypointIndex];
  if (stepToward(g, target, PATROL_SPEED, dt, level)) {
    g.suspicion = 0;
    g.state = 'patrol';
  }
}

/** One tick of a sentry's mind. `world` carries level, player and callbacks. */
export function updateGuard(g, dt, world) {
  const { level, player } = world;
  const seen = canSee(g, player, level);
  if (seen) {
    g.lastSeen = { x: player.x, y: player.y };
    g.loseTimer = 0;
    const dist = Math.hypot(player.x - g.x, player.y - g.y);
    const rate = SUSPICION_RISE_BASE + SUSPICION_RISE_CLOSE * (1 - dist / detectionRange(player));
    g.suspicion = Math.min(100, g.suspicion + rate * dt);
    g.angle = angleToward(g, player);
    if (g.suspicion >= 100 && g.state !== 'chase') {
      g.state = 'chase';
      world.onAlarm?.(g);
    } else if (g.suspicion >= INVESTIGATE_AT && g.state === 'patrol') {
      g.state = 'investigate';
      g.target = { ...g.lastSeen };
      g.isLure = false;
    }
    if (g.state !== 'chase') return; // stand and stare while the player is seen
  } else if (g.state !== 'chase') {
    g.suspicion = Math.max(0, g.suspicion - SUSPICION_DECAY * dt);
  }

  if (g.state === 'patrol') patrolStep(g, dt, level);
  else if (g.state === 'investigate') investigateStep(g, dt, level);
  else if (g.state === 'chase') chaseStep(g, dt, world, seen);
  else if (g.state === 'return') returnStep(g, dt, level);
}

/** Send the nearest sentry within range to inspect a thrown lure. */
export function lureGuards(guards, x, y, radius) {
  let best = null;
  let bestDist = Infinity;
  for (const g of guards) {
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < radius && d < bestDist && g.state !== 'chase') {
      best = g;
      bestDist = d;
    }
  }
  if (!best) return false;
  best.state = 'investigate';
  best.target = { x, y };
  best.isLure = true;
  best.lookTimer = 0;
  return true;
}
