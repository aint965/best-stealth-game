// Starlight Archive — the three galleries of the observatory archive.
// Each level is a 25 x 19 tile map. Legend:
//   '#' stone wall (solid, blocks sight)   'C' archive crate (solid cover)
//   '.' open floor                          'S' shadow alcove (walkable, hides)
//   'P' the archivist's start               'E' the moon door (exit)
//   '1','2','3' star charts to recover
// Guard patrols are listed separately as tile coordinates; every waypoint
// sits on open floor and every patrol leg runs straight down an open lane.
import { TILE } from './config.js';

const LEVEL_DEFS = [
  {
    name: 'Reading Room',
    grid: [
      '#########################',
      '#......C......#.......E.#',
      '#.............#.........#',
      '#..1..........#....C....#',
      '#.......................#',
      '#.....C..........C......#',
      '#.......................#',
      '#..C........C...........#',
      '#.......................#',
      '#......S........S.......#',
      '#.......................#',
      '#..C......C.......C.....#',
      '#.......................#',
      '#....2..........S.......#',
      '#.......................#',
      '#..C......C.......C.....#',
      '#.......................#',
      '#P..........3...........#',
      '#########################',
    ],
    guards: [
      { start: [8, 5], waypoints: [[8, 5], [16, 5]] },
      { start: [11, 10], waypoints: [[11, 10], [11, 16]] },
    ],
  },
  {
    name: 'Map Gallery',
    grid: [
      '#########################',
      '#....#........#......E..#',
      '#....#........#.........#',
      '#.1..#...C....#....C....#',
      '#....#........#.........#',
      '#....#..................#',
      '#....#....C......C......#',
      '#.......................#',
      '#..C....#........#...C..#',
      '#.......#...S....#......#',
      '#.......#........#......#',
      '#..2....#........#...3..#',
      '#.......#........#......#',
      '#....C..#...C....#..C...#',
      '#.......#........#......#',
      '#..S....#........#..S...#',
      '#.......#........#......#',
      '#P......#...............#',
      '#########################',
    ],
    guards: [
      { start: [10, 5], waypoints: [[10, 5], [20, 5]] },
      { start: [12, 8], waypoints: [[12, 8], [12, 14]] },
      { start: [10, 16], waypoints: [[10, 16], [16, 16]] },
    ],
  },
  {
    name: 'The Vault of Charts',
    grid: [
      '#########################',
      '#..........C..........E.#',
      '#.......................#',
      '#..1....................#',
      '#......C........C.......#',
      '#.......................#',
      '#....C.............C....#',
      '#.......................#',
      '#........S..............#',
      '#.......................#',
      '#..C.................C..#',
      '#.......................#',
      '#......2........S.......#',
      '#.......................#',
      '#....C.............C....#',
      '#.......................#',
      '#.........S.............#',
      '#P............3.........#',
      '#########################',
    ],
    guards: [
      { start: [5, 5], waypoints: [[5, 5], [19, 5]] },
      { start: [19, 9], waypoints: [[19, 9], [5, 9]] },
      { start: [12, 2], waypoints: [[12, 2], [12, 16]] },
      { start: [4, 15], waypoints: [[4, 15], [20, 15]] },
    ],
  },
];

const tileCenter = ([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

/** How many levels the archive holds. */
export function levelCount() {
  return LEVEL_DEFS.length;
}

/** Whether a map character blocks movement and sight. */
export function isSolidTile(ch) {
  return ch === '#' || ch === 'C';
}

/** The map character at pixel coordinates (x, y); outside the map is wall. */
export function tileAt(level, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || ty >= level.grid.length || tx >= level.grid[ty].length) return '#';
  return level.grid[ty][tx];
}

/** Build a fresh, mutable level: player start, exit, charts and sentries. */
export function buildLevel(index) {
  const def = LEVEL_DEFS[index];
  const level = { name: def.name, grid: def.grid, playerStart: null, exit: null, objectives: [], guards: [] };
  for (let ty = 0; ty < def.grid.length; ty++) {
    for (let tx = 0; tx < def.grid[ty].length; tx++) {
      const ch = def.grid[ty][tx];
      const at = tileCenter([tx, ty]);
      if (ch === 'P') level.playerStart = at;
      else if (ch === 'E') level.exit = at;
      else if (ch === '1' || ch === '2' || ch === '3') level.objectives.push({ x: at.x, y: at.y, taken: false });
    }
  }
  level.guards = def.guards.map((g) => ({
    start: tileCenter(g.start),
    waypoints: g.waypoints.map(tileCenter),
  }));
  return level;
}

/** Slide a circle through the map: move on each axis only when it stays clear. */
export function moveCircle(entity, dx, dy, level, radius) {
  const hitsSolid = (x, y) => {
    for (const [cx, cy] of [[x - radius, y - radius], [x + radius, y - radius], [x - radius, y + radius], [x + radius, y + radius]]) {
      if (isSolidTile(tileAt(level, cx, cy))) return true;
    }
    return false;
  };
  const nx = entity.x + dx;
  if (!hitsSolid(nx, entity.y)) entity.x = nx;
  const ny = entity.y + dy;
  if (!hitsSolid(entity.x, ny)) entity.y = ny;
}
