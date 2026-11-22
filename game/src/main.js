// Starlight Archive — the game loop and its screens.
// Title, play, pause, caught, level-clear, failed and win. The world is
// exposed on window.__game so the game can be driven and inspected from
// outside: screen, world (level, player, guards, objectives, exitOpen)
// and timer, score, spotted and strikes.
import { VIEW_W, VIEW_H, WIN_RADIUS, LURE_RADIUS, LURE_COOLDOWN, SCORE_CHART, GHOST_BONUS, TIME_BONUS_MAX, TIME_BONUS_RATE, MAX_STRIKES, TRIPWIRE_ALARM } from './config.js';
import { buildLevel, levelCount } from './level.js';
import { makeGuard, updateGuard, lureGuards, convergeGuards } from './guards.js';
import { makeCamera, updateCameras } from './cameras.js';
import { makeTripwire, updateTripwires } from './tripwires.js';
import { makePlayer, updatePlayer } from './player.js';
import { makeInput } from './input.js';
import { SoundBank } from './audio.js';
import { draw } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sound = new SoundBank();

const game = {
  screen: 'title', // title | play | paused | caught | level-clear | failed | win
  levelIndex: 0,
  world: null,
  time: 0,
  timer: 0,
  muted: false,
  frozen: false,
  lureCooldown: 0,
  score: 0,
  bankedScore: 0, // charts banked by clearing earlier galleries
  spotted: 0, // times a sentry or a camera has fully spotted Wren
  strikes: 0, // times caught; MAX_STRIKES ends the heist
  finalScore: 0,
  labels: null,
};
window.__game = game;

function loadLevel(index) {
  const level = buildLevel(index);
  game.levelIndex = index;
  game.world = {
    level,
    player: makePlayer(level.playerStart),
    guards: level.guards.map(makeGuard),
    cameras: level.cameras.map(makeCamera),
    tripwires: level.tripwires.map(makeTripwire),
    noiseRings: [],
    objectives: level.objectives,
    exitOpen: false,
    caught: false,
    lure: null,
    onFootstep: (sneaking, sprinting) => sound.footstep(sneaking, sprinting),
    onPickup: () => {
      sound.pickup();
      const taken = game.world.objectives.filter((c) => c.taken).length;
      game.score = game.bankedScore + taken * SCORE_CHART;
    },
    onDoorOpen: () => sound.doorOpen(),
    onAlarm: () => sound.alertSting(),
    onSpotted: () => {
      game.spotted += 1;
    },
    onCameraSpot: (pos) => {
      game.spotted += 1;
      sound.alertSting();
      convergeGuards(game.world.guards, pos.x, pos.y, 420, 60);
    },
    onTripwire: (pos) => {
      sound.alertSting();
      convergeGuards(game.world.guards, pos.x, pos.y, 320, TRIPWIRE_ALARM);
    },
  };
}

/** A fresh heist from the title screen: everything resets. */
function resetRun() {
  game.score = 0;
  game.bankedScore = 0;
  game.spotted = 0;
  game.strikes = 0;
  game.finalScore = 0;
  game.timer = 0;
  game.labels = null;
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
  if (game.screen === 'title') {
    resetRun();
    startLevel(0);
  } else if (game.screen === 'level-clear') startLevel(game.levelIndex + 1);
  else if (game.screen === 'failed' || game.screen === 'win') game.screen = 'title';
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
      resetRun();
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
  if (game.screen === 'failed' || game.screen === 'win') {
    if (input.consume('confirm')) {
      game.screen = 'title';
      game.world = null;
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
  updateTripwires(game.world, dt, { x: game.world.player.px, y: game.world.player.py }, game.world.player);
  updateCameras(game.world, dt);
  for (const guard of game.world.guards) updateGuard(guard, dt, game.world);
  for (const ring of game.world.noiseRings) ring.t -= dt;
  game.world.noiseRings = game.world.noiseRings.filter((r) => r.t > 0);
  input.clearPressed();

  if (game.world.caught) {
    game.strikes += 1;
    game.screen = game.strikes >= MAX_STRIKES ? 'failed' : 'caught';
    sound.loseJingle();
    return;
  }
  const { player, level } = game.world;
  if (game.world.exitOpen && Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < WIN_RADIUS) {
    game.bankedScore += game.world.objectives.length * SCORE_CHART;
    game.score = game.bankedScore;
    if (game.levelIndex + 1 >= levelCount()) {
      const timeBonus = Math.max(0, TIME_BONUS_MAX - Math.floor(game.timer)) * TIME_BONUS_RATE;
      const ghostBonus = game.spotted === 0 ? GHOST_BONUS : 0;
      game.finalScore = game.score + timeBonus + ghostBonus;
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
