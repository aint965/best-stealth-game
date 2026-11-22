// Starlight Archive — the sweeping security cameras.
// A camera sits on a post and sweeps its cone back and forth. It watches
// like a sentry: suspicion rises while the archivist is in the cone and
// decays otherwise. At full suspicion the camera spots her — it sounds
// the alarm and every sentry walks to her position. Cameras never hear
// noise and never chase; timing is the answer to them. Pure logic, no DOM.
import { CAMERA_RANGE, CAMERA_HALF_ANGLE, CAMERA_RISE, CAMERA_DECAY } from './config.js';
import { hasLineOfSight } from './vision.js';

/** A live camera from a level's camera definition. */
export function makeCamera(def) {
  const mid = (def.from + def.to) / 2;
  const amp = (def.to - def.from) / 2;
  return {
    x: def.at.x,
    y: def.at.y,
    from: def.from,
    to: def.to,
    speed: def.speed,
    mid,
    amp,
    phase: 0,
    angle: mid,
    suspicion: 0,
    spotCooldown: 0,
  };
}

/** Whether this camera can currently see the archivist. */
export function cameraCanSee(camera, player, level) {
  const dx = player.x - camera.x;
  const dy = player.y - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA_RANGE) return false;
  if (dist > 4) {
    let diff = Math.atan2(dy, dx) - camera.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > CAMERA_HALF_ANGLE) return false;
  }
  return hasLineOfSight(level, camera.x, camera.y, player.x, player.y);
}

/** One tick of a camera: sweep, watch, and spot. `world` carries level, player and callbacks. */
export function updateCamera(camera, dt, world) {
  camera.phase += dt * camera.speed;
  camera.angle = camera.mid + camera.amp * Math.sin(camera.phase);
  camera.spotCooldown = Math.max(0, camera.spotCooldown - dt);
  if (cameraCanSee(camera, world.player, world.level)) {
    camera.suspicion = Math.min(100, camera.suspicion + CAMERA_RISE * dt);
    if (camera.suspicion >= 100 && camera.spotCooldown <= 0) {
      camera.spotCooldown = 3;
      world.onCameraSpot?.({ x: world.player.x, y: world.player.y });
    }
  } else {
    camera.suspicion = Math.max(0, camera.suspicion - CAMERA_DECAY * dt);
  }
}

/** One tick for every camera on the level. Tolerates a world without cameras. */
export function updateCameras(world, dt) {
  for (const camera of world.cameras || []) updateCamera(camera, dt, world);
}
