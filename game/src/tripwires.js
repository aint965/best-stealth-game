// Starlight Archive — the tripwires.
// A tripwire is a pulsing red line across a lane. Cross it slowly, while
// sneaking, and it stays quiet. Cross it walking — or sprinting — and it
// trips: the alarm sting sounds and every nearby sentry walks to the spot.
// Pure logic, no DOM.
import { TRIPWIRE_ALARM } from './config.js';

/** A live tripwire from a level's tripwire definition. */
export function makeTripwire(def) {
  return {
    x1: def.a.x,
    y1: def.a.y,
    x2: def.b.x,
    y2: def.b.y,
    cooldown: 0,
    flash: 0,
  };
}

/** Whether segments p1-p2 and p3-p4 cross (or touch). */
export function segmentsCross(p1, p2, p3, p4) {
  const d = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d1 = d(p3.x, p3.y, p4.x, p4.y, p1.x, p1.y);
  const d2 = d(p3.x, p3.y, p4.x, p4.y, p2.x, p2.y);
  const d3 = d(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  const d4 = d(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * One tick for every tripwire. `prev` is where the archivist stood last
 * tick, so a fast crossing is caught even between frames. A sneaking
 * archivist slips under the wire; anyone else trips it.
 */
export function updateTripwires(world, dt, prev, player) {
  for (const wire of world.tripwires || []) {
    wire.cooldown = Math.max(0, wire.cooldown - dt);
    wire.flash = Math.max(0, wire.flash - dt * 1.5);
    if (wire.cooldown > 0 || player.sneaking) continue;
    if (segmentsCross(prev, player, { x: wire.x1, y: wire.y1 }, { x: wire.x2, y: wire.y2 })) {
      wire.cooldown = 2;
      wire.flash = 1;
      world.onTripwire?.({ x: player.x, y: player.y });
    }
  }
}
