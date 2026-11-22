// Quiet Vault: the world and its one step. createGame builds a level's
// state; stepWorld advances it one fixed step from the player's input and
// returns what happened as bit flags, so the loop can react (sounds,
// screens) without the world knowing about them. Nothing here touches the
// DOM or the network.
import { LURES_PER_LEVEL, LURE_LIFE } from './config.js';
import { createAudio } from './audio.js';
import { createGuard, updateGuard } from './guards.js';
import { buildLevel, levelCount } from './level.js';
import { atExit, createPlayer, movePlayer, nearestObjective, playerVelocity } from './player.js';

export const EVENT_CAUGHT = 1;
export const EVENT_LEVEL_CLEAR = 2;
export const EVENT_WIN = 4;
export const EVENT_PICKUP = 8;
export const EVENT_ALERT = 16;
export const EVENT_EXIT_OPEN = 32;

/** A fresh world for level `index`: player, guards, objectives, exit shut. */
export function createGame(levelIndex) {
  const level = buildLevel(levelIndex);
  return {
    levelIndex,
    level,
    player: createPlayer(level.playerStart),
    guards: level.guards.map(createGuard),
    objectives: level.objectives.map((o) => ({ x: o.x, y: o.y, taken: false })),
    exitOpen: false,
    luresLeft: LURES_PER_LEVEL,
    lure: null,
    lureTimer: 0,
    elapsed: 0,
    lastStepPhase: 0,
    audio: createAudio(),
  };
}

/**
 * One fixed step. `input` is the input handle (its one-shot actions are
 * taken here); `dt` is seconds. Returns EVENT_* flags.
 */
export function stepWorld(world, input, dt) {
  let events = 0;
  world.elapsed += dt;
  const player = world.player;

  // Movement, with a footstep sound every 28 px travelled.
  const vel = playerVelocity(input, dt);
  player.sneaking = vel.sneaking;
  const moved = movePlayer(world.level, player, vel.dx, vel.dy);
  player.moving = moved;
  if (moved && player.stepPhase - world.lastStepPhase >= 28) {
    world.lastStepPhase = player.stepPhase;
    world.audio.footstep(player.sneaking);
  }

  // E: pick up the nearest seed-case in reach.
  if (input.takeInteract()) {
    const o = nearestObjective(player, world.objectives);
    if (o !== null) {
      o.taken = true;
      world.audio.pickup();
      events |= EVENT_PICKUP;
      if (world.objectives.every((x) => x.taken) && !world.exitOpen) {
        world.exitOpen = true;
        world.audio.exitOpen();
        events |= EVENT_EXIT_OPEN;
      }
    }
  }

  // Click: throw a lure at the clicked point, when any are left.
  const click = input.takeClick();
  if (click !== null && world.luresLeft > 0 && world.lure === null) {
    world.lure = { x: click.x, y: click.y };
    world.lureTimer = LURE_LIFE;
    world.luresLeft -= 1;
    world.audio.lureClink();
  }
  if (world.lure !== null) {
    world.lureTimer -= dt;
    if (world.lureTimer <= 0) world.lure = null;
  }

  // Guards: a suspicion crossing 100 for the first time is the alarm.
  for (const guard of world.guards) {
    const was = guard.suspicion;
    const result = updateGuard(guard, world.level, player, world.lure, dt);
    if (was < 100 && guard.suspicion >= 100) {
      world.audio.alert();
      events |= EVENT_ALERT;
    }
    if (result === 'caught') {
      world.audio.lose();
      return events | EVENT_CAUGHT;
    }
  }

  // The exit, once open, ends the level on touch.
  if (world.exitOpen && atExit(player, world.level.exit)) {
    if (world.levelIndex + 1 >= levelCount()) {
      world.audio.win();
      return events | EVENT_WIN;
    }
    world.audio.win();
    return events | EVENT_LEVEL_CLEAR;
  }
  return events;
}

/** The next level's world, keeping the audio handle (and its mute state). */
export function nextLevel(world) {
  const next = createGame(world.levelIndex + 1);
  next.audio = world.audio;
  next.totalElapsed = (world.totalElapsed ?? 0) + world.elapsed;
  return next;
}
