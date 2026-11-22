// Extra logic check (not part of the entry): the lure mechanic and a
// 60-second patrol simulation on every level, headless in Node.
// Run from the repo root: node checks-v1/lure-check.mjs
import { buildLevel } from '../game/src/level.js';
import { makeGuard, updateGuard, lureGuards } from '../game/src/guards.js';
import { makePlayer } from '../game/src/player.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// The lure: a sentry near the lure point walks over to investigate it,
// while a lure thrown far from every sentry draws nobody.
{
  const level = buildLevel(0);
  const guards = level.guards.map(makeGuard);
  const drawn = lureGuards(guards, 400, 176, 300);
  check('lure-nearby-guard', drawn && guards[0].state === 'investigate', `guard 0 state=${guards[0].state}`);
  const nobody = lureGuards(guards, 48, 560, 60);
  check('lure-far-guard-ignored', nobody === false, 'no sentry within 60 px of the lure');
}

// A 60-second simulation on every level with the archivist standing in
// the open: no exceptions, suspicion stays in range, sentries keep working.
for (let i = 0; i < 3; i++) {
  const level = buildLevel(i);
  const world = {
    level,
    player: makePlayer(level.playerStart),
    guards: level.guards.map(makeGuard),
    objectives: level.objectives,
    exitOpen: false,
    caught: false,
    onFootstep: () => {},
    onPickup: () => {},
    onDoorOpen: () => {},
    onAlarm: () => {},
  };
  world.player.x = 400;
  world.player.y = 300;
  let ok = true;
  let maxSuspicion = 0;
  try {
    for (let t = 0; t < 60; t += 1 / 60) {
      for (const g of world.guards) {
        updateGuard(g, 1 / 60, world);
        maxSuspicion = Math.max(maxSuspicion, g.suspicion);
        if (!(g.suspicion >= 0 && g.suspicion <= 100)) ok = false;
      }
      if (world.caught) break;
    }
  } catch (err) {
    ok = false;
    console.log('simulation error:', String(err).slice(0, 200));
  }
  check(`sim-level-${i + 1}`, ok, `max suspicion ${maxSuspicion.toFixed(0)}, caught=${world.caught}`);
}
process.exit(failures === 0 ? 0 : 1);
