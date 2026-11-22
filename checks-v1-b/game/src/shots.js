// Quiet Vault: the screenshot scenes behind ?shot=cover|patrol|alert|exit.
// Each one builds a real game for the level it shows and poses it — player,
// guards, suspicion and objectives set by hand — so the frame is what the
// game really looks like at that moment, and the same seed always gives the
// same frame. No scene is drawn or composited: it is the game, rendered.
import { createGame } from './game.js';
import { GUARD_CHASE, GUARD_PATROL } from './guards.js';
import { SCREEN_PLAY } from './render.js';

function at(world, tx, ty) {
  return { x: tx * 32 + 16, y: ty * 32 + 16 };
}

/**
 * Build the named scene's world and return it with the screen to draw.
 * Any other name is the cover.
 */
export function stageShot(name) {
  if (name === 'patrol') {
    // Level 2, mid-patrol: three cones sweeping the cold rooms, the
    // courier flat in a shadow patch on the left.
    const world = createGame(1);
    world.guards[0].x = at(world, 3, 8).x;
    world.guards[0].y = at(world, 3, 8).y;
    world.guards[0].angle = Math.PI / 2;
    world.guards[1].x = at(world, 22, 10).x;
    world.guards[1].y = at(world, 22, 10).y;
    world.guards[1].angle = -Math.PI / 2;
    world.guards[2].x = at(world, 12, 17).x;
    world.guards[2].y = at(world, 12, 17).y;
    world.guards[2].angle = 0;
    world.player.x = at(world, 2, 6).x;
    world.player.y = at(world, 2, 6).y;
    world.player.angle = 0;
    world.player.sneaking = true;
    return { world, screen: SCREEN_PLAY };
  }
  if (name === 'alert') {
    // Level 1, the alarm: a warden has the courier in its red cone and is
    // closing in, the courier one step from the crates.
    const world = createGame(0);
    const guard = world.guards[0];
    guard.x = at(world, 12, 8).x;
    guard.y = at(world, 12, 8).y;
    guard.angle = Math.atan2(at(world, 10, 10).y - guard.y, at(world, 10, 10).x - guard.x);
    guard.state = GUARD_CHASE;
    guard.suspicion = 100;
    world.guards[1].x = at(world, 18, 9).x;
    world.guards[1].y = at(world, 18, 9).y;
    world.guards[1].angle = Math.PI;
    world.guards[1].suspicion = 72;
    world.player.x = at(world, 10, 10).x;
    world.player.y = at(world, 10, 10).y;
    world.player.angle = -Math.PI / 2;
    world.objectives[0].taken = true;
    return { world, screen: SCREEN_PLAY };
  }
  if (name === 'exit') {
    // Level 3, the way out: all three seed-cases taken, the service door
    // glowing open, the courier crossing the deep vault toward it.
    const world = createGame(2);
    for (const o of world.objectives) o.taken = true;
    world.exitOpen = true;
    world.player.x = at(world, 12, 12).x;
    world.player.y = at(world, 12, 12).y;
    world.player.angle = Math.PI / 2;
    world.guards[0].x = at(world, 2, 10).x;
    world.guards[0].y = at(world, 2, 10).y;
    world.guards[0].angle = 0;
    world.guards[2].x = at(world, 9, 5).x;
    world.guards[2].y = at(world, 9, 5).y;
    world.guards[2].angle = Math.PI;
    world.guards[3].x = at(world, 18, 13).x;
    world.guards[3].y = at(world, 18, 13).y;
    world.guards[3].angle = Math.PI;
    return { world, screen: SCREEN_PLAY };
  }
  // Cover: level 1, the courier crouched behind crates while a warden's
  // cone sweeps past, one seed-case already in hand.
  const world = createGame(0);
  world.player.x = at(world, 10, 10).x;
  world.player.y = at(world, 10, 10).y;
  world.player.angle = -Math.PI / 2;
  world.player.sneaking = true;
  world.guards[0].x = at(world, 12, 6).x;
  world.guards[0].y = at(world, 12, 6).y;
  world.guards[0].angle = Math.PI / 2;
  world.guards[0].state = GUARD_PATROL;
  world.guards[1].x = at(world, 16, 9).x;
  world.guards[1].y = at(world, 16, 9).y;
  world.guards[1].angle = Math.PI;
  world.objectives[0].taken = true;
  return { world, screen: SCREEN_PLAY };
}
