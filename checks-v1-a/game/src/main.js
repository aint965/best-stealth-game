// Starlight Archive — the game loop and its screens.
// Title, play, pause, caught, level-clear and win. The world is exposed
// on window.__game so the game can be driven and inspected from outside:
// screen, world (level, player, guards, objectives, exitOpen) and timer.
import { VIEW_W, VIEW_H, WIN_RADIUS, LURE_RADIUS, LURE_COOLDOWN } from './config.js';
import { buildLevel, levelCount } from './level.js';
import { makeGuard, updateGuard, lureGuards } from './guards.js';
import { makePlayer, updatePlayer } from './player.js';
import { makeInput } from './input.js';
import { SoundBank } from './audio.js';
import { draw } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sound = new SoundBank();

const game = {
  screen: 'title', // title | play | paused | caught | level-clear | win
  levelIndex: 0,
  world: null,
  time: 0,
  timer: 0,
  muted: false,
  frozen: false,
  lureCooldown: 0,
};
window.__game = game;

function loadLevel(index) {
  const level = buildLevel(index);
  game.levelIndex = index;
  game.world = {
    level,
    player: makePlayer(level.playerStart),
    guards: level.guards.map(makeGuard),
    objectives: level.objectives,
    exitOpen: false,
    caught: false,
    lure: null,
    onFootstep: (sneaking) => sound.footstep(sneaking),
    onPickup: () => sound.pickup(),
    onDoorOpen: () => sound.doorOpen(),
    onAlarm: () => sound.alertSting(),
  };
}

function startLevel(index) {
  loadLevel(index);
  game.screen = 'play';
  game.timer = index === 0 ? 0 : game.timer;
}

function throwLure(x, y) {
  if (game.screen !== 'play' || game.lureCooldown > 0) return;
  if (lureGuards(game.world.guards, x, y, LURE_RADIUS)) {
    game.world.lure = { x, y, t: 1.2 };
    game.lureCooldown = LURE_COOLDOWN;
    sound.lureClink();
  }
}

const input = makeInput(canvas, (x, y) => {
  sound.resume();
  if (game.screen === 'title') startLevel(0);
  else if (game.screen === 'level-clear') startLevel(game.levelIndex + 1);
  else if (game.screen === 'play') throwLure(x, y);
});

function update(dt) {
  game.time += dt;
  if (input.consume('mute')) {
    game.muted = !game.muted;
    sound.muted = game.muted;
  }
  if (game.screen === 'title') {
    if (input.consume('confirm')) {
      sound.resume();
      startLevel(0);
    }
    input.clearPressed();
    return;
  }
  if (game.screen === 'caught') {
    if (input.consume('retry')) {
      sound.resume();
      startLevel(game.levelIndex);
    }
    input.clearPressed();
    return;
  }
  if (game.screen === 'level-clear') {
    if (input.consume('confirm')) {
      sound.resume();
      startLevel(game.levelIndex + 1);
    }
    input.clearPressed();
    return;
  }
  if (game.screen === 'win') {
    if (input.consume('confirm')) {
      game.screen = 'title';
      game.world = null;
    }
    input.clearPressed();
    return;
  }
  if (game.screen === 'paused') {
    if (input.consume('pause')) game.screen = 'play';
    input.clearPressed();
    return;
  }

  // Playing.
  if (input.consume('pause')) {
    game.screen = 'paused';
    input.clearPressed();
    return;
  }
  input.sync();
  game.timer += dt;
  game.lureCooldown = Math.max(0, game.lureCooldown - dt);
  if (game.world.lure) {
    game.world.lure.t -= dt;
    if (game.world.lure.t <= 0) game.world.lure = null;
  }
  updatePlayer(game.world.player, dt, input, game.world);
  for (const guard of game.world.guards) updateGuard(guard, dt, game.world);
  input.clearPressed();

  if (game.world.caught) {
    game.screen = 'caught';
    sound.loseJingle();
    return;
  }
  const { player, level } = game.world;
  if (game.world.exitOpen && Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < WIN_RADIUS) {
    if (game.levelIndex + 1 >= levelCount()) {
      game.screen = 'win';
    } else {
      game.screen = 'level-clear';
    }
    sound.winJingle();
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!game.frozen) update(dt);
  draw(ctx, game);
  requestAnimationFrame(frame);
}

// A ?shot= name stages a screenshot scene and freezes the simulation.
const shotName = new URLSearchParams(location.search).get('shot');
if (shotName) {
  loadLevel(0);
  applyShot(game, shotName, loadLevel);
} else {
  loadLevel(0);
  game.screen = 'title';
}
requestAnimationFrame(frame);
