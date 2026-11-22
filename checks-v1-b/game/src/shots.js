// Starlight Archive — staged scenes for the screenshots.
// Each screenshot is a real render of the game with its entities placed
// for the shot: the cover shows the first gallery mid-patrol, the patrol
// shot shows the second gallery, the alert shot freezes a sentry at high
// suspicion with its cone on the archivist, and the exit shot shows the
// moon door open on the third gallery. Staged shots freeze the simulation
// so the frame the browser captures is exactly the frame that was staged.
import { TILE } from './config.js';

const PRESETS = {
  cover: {
    level: 0,
    player: { tile: [3, 12], angle: -Math.PI / 2 },
    guards: [
      { tile: [12, 5], angle: 0, suspicion: 0 },
      { tile: [11, 13], angle: Math.PI / 2, suspicion: 0 },
    ],
    taken: 0,
    exitOpen: false,
  },
  patrol: {
    level: 1,
    player: { tile: [4, 15], angle: 0 },
    guards: [
      { tile: [15, 5], angle: 0, suspicion: 12 },
      { tile: [12, 11], angle: Math.PI, suspicion: 0 },
      { tile: [13, 16], angle: -Math.PI / 2, suspicion: 0 },
    ],
    taken: 1,
    exitOpen: false,
  },
  alert: {
    level: 0,
    player: { tile: [12, 5], angle: Math.PI },
    guards: [
      { tile: [9, 5], angle: 0, suspicion: 78 },
      { tile: [11, 13], angle: Math.PI / 2, suspicion: 0 },
    ],
    taken: 0,
    exitOpen: false,
  },
  exit: {
    level: 2,
    player: { tile: [20, 2], angle: -Math.PI / 4 },
    guards: [
      { tile: [10, 5], angle: 0, suspicion: 0 },
      { tile: [14, 9], angle: Math.PI, suspicion: 0 },
      { tile: [12, 8], angle: Math.PI / 2, suspicion: 0 },
      { tile: [10, 15], angle: 0, suspicion: 0 },
    ],
    taken: 3,
    exitOpen: true,
  },
};

/** Stage a named shot: load its gallery, place its pieces, freeze the game. */
export function applyShot(game, name, loadLevel) {
  const preset = PRESETS[name];
  if (!preset) return false;
  loadLevel(preset.level);
  const world = game.world;
  const at = ([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
  const p = at(preset.player.tile);
  world.player.x = p.x;
  world.player.y = p.y;
  world.player.angle = preset.player.angle;
  preset.guards.forEach((g, i) => {
    const guard = world.guards[i];
    if (!guard) return;
    const pos = at(g.tile);
    guard.x = pos.x;
    guard.y = pos.y;
    guard.angle = g.angle;
    guard.suspicion = g.suspicion;
  });
  world.objectives.forEach((chart, i) => {
    chart.taken = i < preset.taken;
  });
  world.exitOpen = preset.exitOpen;
  game.screen = 'play';
  game.frozen = true;
  return true;
}
