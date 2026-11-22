// Extra logic check (not part of the entry): the upgrade systems —
// cameras, tripwires, noise/sprint and lamp light — headless in Node.
// Run from the repo root: node checks-v1/systems-check.mjs
import { buildLevel } from '../game/src/level.js';
import { makeGuard, updateGuard, hearNoise } from '../game/src/guards.js';
import { makeCamera, updateCamera, cameraCanSee } from '../game/src/cameras.js';
import { makeTripwire, updateTripwires } from '../game/src/tripwires.js';
import { makePlayer, updatePlayer } from '../game/src/player.js';
import { detectionRange } from '../game/src/vision.js';
import { SCORE_CHART, GHOST_BONUS } from '../game/src/config.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// ---------------------------------------------------------------- structure
{
  const l0 = buildLevel(0);
  const l1 = buildLevel(1);
  const l2 = buildLevel(2);
  check('cameras-level-2', l1.cameras.length === 1, `${l1.cameras.length} camera(s)`);
  check('cameras-level-3', l2.cameras.length === 2, `${l2.cameras.length} camera(s)`);
  check('tripwires-level-3', l2.tripwires.length === 2, `${l2.tripwires.length} wire(s)`);
  check('lamps-every-level', l0.lamps.length > 0 && l1.lamps.length > 0 && l2.lamps.length > 0,
    `${l0.lamps.length}/${l1.lamps.length}/${l2.lamps.length} lamps`);
  check('score-constants', SCORE_CHART === 100 && GHOST_BONUS === 500, `chart ${SCORE_CHART}, ghost ${GHOST_BONUS}`);
}

// ---------------------------------------------------------------- cameras
{
  const level = buildLevel(1);
  const camera = makeCamera(level.cameras[0]);
  const a0 = camera.angle;
  const world = { level, player: makePlayer(level.playerStart), guards: [], onCameraSpot: () => {} };
  updateCamera(camera, 0.5, world);
  check('camera-sweeps', camera.angle !== a0, `angle ${a0.toFixed(2)} -> ${camera.angle.toFixed(2)}`);

  // Player due west of the camera, inside range and line of sight.
  world.player.x = camera.x - 96;
  world.player.y = camera.y;
  camera.angle = Math.PI;
  check('camera-sees-player', cameraCanSee(camera, world.player, level), 'in cone + LOS');
  // Reset the sweep phase so the cone still points at the player while it rises.
  camera.phase = 0;
  const s0 = camera.suspicion;
  updateCamera(camera, 1, world);
  check('camera-suspicion-rises', camera.suspicion > s0, `${s0.toFixed(1)} -> ${camera.suspicion.toFixed(1)}`);

  // A full spot sounds the alarm and sends sentries to the player.
  const guards = level.guards.map(makeGuard);
  let spotted = 0;
  const world2 = {
    level,
    player: world.player,
    guards,
    onCameraSpot: () => {
      spotted += 1;
      for (const g of guards) {
        if (g.state !== 'chase') {
          g.state = 'investigate';
          g.target = { x: world2.player.x, y: world2.player.y };
        }
      }
    },
  };
  camera.suspicion = 99;
  camera.phase = 0;
  updateCamera(camera, 0.1, world2);
  check('camera-spot-alarms', spotted === 1 && guards[0].state === 'investigate',
    `spots=${spotted}, guard 0=${guards[0].state}`);
}

// ---------------------------------------------------------------- tripwires
{
  const level = buildLevel(2);
  const wire = makeTripwire(level.tripwires[0]); // horizontal wire across row 8
  const player = makePlayer(level.playerStart);
  let trips = 0;
  const world = { level, tripwires: [wire], onTripwire: () => { trips += 1; } };

  // Sneaking across is safe.
  player.sneaking = true;
  player.x = 400;
  player.y = 260;
  updateTripwires(world, 1 / 60, { x: 400, y: 260 }, { x: 400, y: 284, sneaking: true });
  check('tripwire-sneak-safe', trips === 0, `trips=${trips}`);

  // Walking across trips it.
  player.sneaking = false;
  updateTripwires(world, 1 / 60, { x: 400, y: 260 }, { x: 400, y: 284, sneaking: false });
  check('tripwire-walk-trips', trips === 1, `trips=${trips}`);

  // Cooldown: crossing again at once does not re-trip.
  updateTripwires(world, 1 / 60, { x: 400, y: 260 }, { x: 400, y: 284, sneaking: false });
  check('tripwire-cooldown', trips === 1, `trips=${trips}`);
}

// ---------------------------------------------------------------- noise
{
  const level = buildLevel(0);
  const guards = level.guards.map(makeGuard);
  const near = guards[0];
  near.x = 300;
  near.y = 560;
  const far = guards[1];
  far.x = 700;
  far.y = 100;
  check('noise-near-hears', hearNoise(guards, 260, 560, 240) && near.state === 'investigate',
    `near=${near.state}`);
  check('noise-far-ignores', far.state === 'patrol', `far=${far.state}`);

  // Sprinting actually emits noise rings and draws guards in.
  const player = makePlayer(level.playerStart);
  const world = {
    level,
    guards: level.guards.map(makeGuard),
    noiseRings: [],
    onFootstep: () => {},
  };
  world.guards[0].x = 300;
  world.guards[0].y = 560;
  const input = {
    sneak: false, sprint: true, right: true, left: false, up: false, down: false,
    consume: () => false,
  };
  for (let t = 0; t < 1.2; t += 1 / 60) updatePlayer(player, 1 / 60, input, world);
  check('sprint-emits-noise', world.noiseRings.length > 0 && world.guards[0].state === 'investigate',
    `rings=${world.noiseRings.length}, guard 0=${world.guards[0].state}, sprinting=${player.sprinting}`);
}

// ---------------------------------------------------------------- lamp light
{
  const level = buildLevel(0);
  const lit = makePlayer(level.playerStart);
  lit.x = level.lamps[0].x;
  lit.y = level.lamps[0].y;
  const dark = makePlayer(level.playerStart);
  dark.x = 400;
  dark.y = 300;
  const rLit = detectionRange(lit, level);
  const rDark = detectionRange(dark, level);
  check('lamp-extends-range', rLit > rDark, `lit ${rLit.toFixed(0)} vs dark ${rDark.toFixed(0)}`);
}

// ---------------------------------------------------------------- pickup
{
  const level = buildLevel(0);
  const player = makePlayer(level.playerStart);
  let picked = 0;
  const world = {
    level,
    objectives: level.objectives,
    exitOpen: false,
    onPickup: () => { picked += 1; },
    onDoorOpen: () => {},
    onFootstep: () => {},
  };
  const chart = level.objectives[0];
  player.x = chart.x;
  player.y = chart.y;
  const input = {
    sneak: false, sprint: false, right: false, left: false, up: false, down: false,
    consume: (name) => name === 'interact',
  };
  updatePlayer(player, 1 / 60, input, world);
  check('pickup-chart', chart.taken && picked === 1, `taken=${chart.taken}, pickups=${picked}`);
}

console.log(failures === 0 ? 'ALL SYSTEMS CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
