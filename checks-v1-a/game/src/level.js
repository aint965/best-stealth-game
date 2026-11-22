// Quiet Vault: the three levels. Each level is data, not code: wall and
// crate rectangles, shadow patches, the objectives, the exit, the player
// start and the guards' patrols. Tiles are 32 px; the border is always
// wall. A patrol lane is kept clear of walls and crates by construction,
// so a guard never has to path around an obstacle: it walks its waypoints
// in straight lines and turns at each one.
import { COLS, ROWS } from './config.js';

const LEVELS = [
  {
    name: 'Seed Hall',
    subtitle: 'Two wardens, wide lanes, learn the cones',
    // Interior walls as [x, y, w, h] in tiles.
    walls: [
      [6, 4, 4, 1],
      [15, 4, 4, 1],
      [6, 14, 4, 1],
      [15, 14, 4, 1],
      [2, 8, 2, 1],
      [21, 8, 2, 1],
    ],
    // Crates block movement and sight, like low walls.
    crates: [
      [10, 6],
      [13, 6],
      [10, 12],
      [13, 12],
      [4, 11],
      [20, 7],
      [10, 7],
      [14, 11],
    ],
    // Shadow patches: standing in one halves how fast suspicion rises.
    shadows: [
      [2, 2, 3, 2],
      [20, 2, 3, 2],
      [2, 15, 3, 2],
      [20, 15, 3, 2],
      [11, 1, 3, 1],
    ],
    objectives: [
      [12, 2],
      [22, 9],
      [3, 16],
    ],
    exit: [23, 16],
    player: [2, 16],
    guards: [
      { start: [12, 5], waypoints: [[12, 3], [12, 15]], pause: 1.5 },
      { start: [20, 9], waypoints: [[4, 9], [21, 9]], pause: 1.0 },
    ],
  },
  {
    name: 'Cold Rooms',
    subtitle: 'Three wardens, rooms and a long middle lane',
    walls: [
      [5, 3, 1, 6],
      [5, 11, 1, 6],
      [12, 2, 1, 5],
      [12, 12, 1, 5],
      [19, 3, 1, 6],
      [19, 11, 1, 6],
      [8, 9, 3, 1],
      [14, 9, 3, 1],
    ],
    crates: [
      [10, 5],
      [15, 5],
      [10, 14],
      [15, 14],
      [7, 12],
      [17, 12],
    ],
    shadows: [
      [2, 5, 2, 3],
      [22, 5, 2, 3],
      [2, 12, 2, 3],
      [22, 12, 2, 3],
      [10, 16, 5, 1],
    ],
    objectives: [
      [6, 2],
      [18, 6],
      [9, 15],
    ],
    exit: [23, 2],
    player: [2, 2],
    guards: [
      { start: [3, 3], waypoints: [[3, 3], [3, 15]], pause: 1.2 },
      { start: [22, 15], waypoints: [[22, 3], [22, 15]], pause: 1.2 },
      { start: [3, 17], waypoints: [[3, 17], [21, 17]], pause: 0.8 },
    ],
  },
  {
    name: 'Deep Vault',
    subtitle: 'Four wardens, little shadow, one chokepoint',
    walls: [
      [4, 2, 6, 1],
      [15, 2, 6, 1],
      [4, 16, 6, 1],
      [15, 16, 6, 1],
      [8, 6, 2, 6],
      [15, 6, 2, 6],
      [11, 9, 3, 1],
    ],
    crates: [
      [10, 4],
      [14, 4],
      [10, 14],
      [14, 14],
    ],
    shadows: [
      [2, 8, 2, 2],
      [21, 8, 2, 2],
    ],
    objectives: [
      [12, 4],
      [6, 9],
      [18, 9],
    ],
    exit: [12, 17],
    player: [12, 1],
    guards: [
      { start: [2, 3], waypoints: [[2, 3], [2, 15]], pause: 1.0 },
      { start: [22, 15], waypoints: [[22, 3], [22, 15]], pause: 1.0 },
      { start: [6, 5], waypoints: [[6, 5], [18, 5]], pause: 0.9 },
      { start: [18, 13], waypoints: [[6, 13], [18, 13]], pause: 0.9 },
    ],
  },
];

/** A built level: a tile grid plus the markers in pixels. */
export function buildLevel(index) {
  const def = LEVELS[index];
  // grid[y][x]: 0 floor, 1 wall, 2 crate, 3 shadow.
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    const row = new Array(COLS).fill(0);
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) row[x] = 1;
    }
    grid.push(row);
  }
  for (const [x, y, w, h] of def.walls) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = 1;
  }
  for (const [x, y] of def.crates) grid[y][x] = 2;
  for (const [x, y, w, h] of def.shadows) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = 3;
  }
  const tileCenter = ([tx, ty]) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
  return {
    index,
    name: def.name,
    subtitle: def.subtitle,
    grid,
    objectives: def.objectives.map(tileCenter),
    exit: tileCenter(def.exit),
    playerStart: tileCenter(def.player),
    guards: def.guards.map((g) => ({
      start: tileCenter(g.start),
      waypoints: g.waypoints.map(tileCenter),
      pause: g.pause,
    })),
  };
}

export function levelCount() {
  return LEVELS.length;
}

/** The tile at pixel (x, y): 1 wall outside the grid too. */
export function tileAt(level, x, y) {
  const tx = Math.floor(x / 32);
  const ty = Math.floor(y / 32);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return 1;
  return level.grid[ty][tx];
}

/** Whether a tile blocks movement and sight. */
export function isSolidTile(tile) {
  return tile === 1 || tile === 2;
}

/** Whether pixel (x, y) is inside a shadow patch. */
export function isShadowAt(level, x, y) {
  return tileAt(level, x, y) === 3;
}
