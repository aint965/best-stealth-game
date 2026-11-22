// Quiet Vault: drawing only. The game's state and the current screen in,
// pixels out. The canvas is the 800x608 playfield, scaled by CSS to the
// window. Vision cones are visibility polygons: each edge ray stops at the
// first solid tile, so a cone never shines through a wall. The HUD and the
// title, pause, caught and win panels are drawn here too.
import { COLS, FONT, GUARD_VISION_HALF_ANGLE, GUARD_VISION_RANGE, PALETTE, ROWS, TILE, VIEW_H, VIEW_W } from './config.js';
import { GUARD_CHASE, GUARD_INVESTIGATE, GUARD_SEARCH } from './guards.js';
import { isSolidTile, tileAt } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL_CLEAR = 'level-clear';
export const SCREEN_WIN = 'win';

/** Where one edge ray of a cone stops: the first solid tile, or the range. */
function rayEnd(level, x, y, angle, range) {
  const step = 8;
  for (let d = step; d <= range; d += step) {
    const px = x + Math.cos(angle) * d;
    const py = y + Math.sin(angle) * d;
    if (isSolidTile(tileAt(level, px, py))) return { x: px, y: py };
  }
  return { x: x + Math.cos(angle) * range, y: y + Math.sin(angle) * range };
}

function coneColor(guard) {
  if (guard.state === GUARD_CHASE) return PALETTE.coneAlarm;
  if (guard.suspicion >= 60 || guard.state === GUARD_INVESTIGATE || guard.state === GUARD_SEARCH) return PALETTE.coneSuspicious;
  return PALETTE.coneCalm;
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = `${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(value, x, y);
  }

  function drawFloor(level) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = level.grid[y][x];
        ctx.fillStyle = tile === 3 ? PALETTE.shadow : (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (tile === 1) {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x * TILE, y * TILE, TILE, 4);
        } else if (tile === 2) {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
          ctx.strokeStyle = PALETTE.crateEdge;
          ctx.lineWidth = 2;
          ctx.strokeRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
          ctx.beginPath();
          ctx.moveTo(x * TILE + 3, y * TILE + 3);
          ctx.lineTo(x * TILE + TILE - 3, y * TILE + TILE - 3);
          ctx.moveTo(x * TILE + TILE - 3, y * TILE + 3);
          ctx.lineTo(x * TILE + 3, y * TILE + TILE - 3);
          ctx.stroke();
        }
      }
    }
  }

  function drawExit(state) {
    const { x, y } = state.level.exit;
    const open = state.exitOpen;
    ctx.fillStyle = open ? PALETTE.exitOpen : PALETTE.exit;
    ctx.fillRect(x - 13, y - 13, 26, 26);
    ctx.strokeStyle = open ? '#fff3c4' : '#1d5c40';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 13, y - 13, 26, 26);
    if (open) {
      ctx.fillStyle = 'rgba(242, 201, 76, 0.25)';
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    text('EXIT', x, y + 4, 9, '#0b0e13', 'center', 'middle');
  }

  function drawObjectives(state) {
    for (const o of state.objectives) {
      if (o.taken) continue;
      ctx.fillStyle = PALETTE.objective;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y - 10);
      ctx.lineTo(o.x + 8, o.y);
      ctx.lineTo(o.x, o.y + 10);
      ctx.lineTo(o.x - 8, o.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7a5c00';
      ctx.fillRect(o.x - 3, o.y - 3, 6, 6);
    }
  }

  function drawLure(state) {
    if (state.lure === null) return;
    ctx.fillStyle = PALETTE.lure;
    ctx.beginPath();
    ctx.arc(state.lure.x, state.lure.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 232, 232, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.lure.x, state.lure.y, 11, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawGuard(state, guard) {
    const rays = 20;
    ctx.fillStyle = coneColor(guard);
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let i = 0; i <= rays; i++) {
      const a = guard.angle - GUARD_VISION_HALF_ANGLE + (2 * GUARD_VISION_HALF_ANGLE * i) / rays;
      const p = rayEnd(state.level, guard.x, guard.y, a, GUARD_VISION_RANGE);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    // The warden: a dark-red disc with a pale facing wedge.
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardEye;
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.angle) * 5, guard.y + Math.sin(guard.angle) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
    // Suspicion arc over the guard's head.
    if (guard.suspicion > 1) {
      ctx.strokeStyle = guard.suspicion >= 100 ? '#ff5a4d' : '#f28c3c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 18, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e3d33';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
    ctx.stroke();
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(79, 195, 165, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(state) {
    const maxSuspicion = state.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
    ctx.fillStyle = 'rgba(11, 14, 19, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, 34);
    text(`${state.levelIndex + 1}. ${state.level.name}`, 12, 22, 15, PALETTE.text);
    const got = state.objectives.filter((o) => o.taken).length;
    text(`Seed-cases ${got}/3`, 250, 22, 15, got === 3 ? PALETTE.exitOpen : PALETTE.text);
    text('Suspicion', 400, 22, 15, PALETTE.muted);
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(480, 10, 120, 14);
    ctx.fillStyle = maxSuspicion >= 100 ? '#ff5a4d' : maxSuspicion >= 60 ? '#f28c3c' : '#f2c94c';
    ctx.fillRect(480, 10, (120 * maxSuspicion) / 100, 14);
    text(fmtTime(state.elapsed), 640, 22, 15, PALETTE.text);
    text(`Lures ${state.luresLeft}`, 700, 22, 15, PALETTE.text);
    // Sneaking is shown by the ring around the courier, not by a HUD word:
    // a word at the right edge collided with the lures count.
    ctx.fillStyle = 'rgba(11, 14, 19, 0.72)';
    ctx.fillRect(0, VIEW_H - 26, VIEW_W, 26);
    text('WASD move · Shift sneak · E pick up · Click throw a lure · P pause · M mute', 12, VIEW_H - 8, 13, PALETTE.muted);
  }

  function drawPanel(title, lines, prompt) {
    const width = 560;
    const height = 150 + lines.length * 30;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    ctx.fillStyle = 'rgba(11, 14, 19, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PALETTE.wallTop;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW_W / 2, y + 58, 40, PALETTE.text, 'center');
    lines.forEach((line, i) => text(line, VIEW_W / 2, y + 104 + i * 30, 17, PALETTE.muted, 'center'));
    text(prompt, VIEW_W / 2, y + height - 28, 17, PALETTE.objective, 'center');
  }

  /** Paint one frame: the level, the actors, the HUD, then a panel for the screen. */
  function draw(state, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawFloor(state.level);
    drawExit(state);
    drawObjectives(state);
    drawLure(state);
    for (const guard of state.guards) drawGuard(state, guard);
    drawPlayer(state);
    drawHud(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('QUIET VAULT', [
        'A seed vault, after hours. Three heritage seed-cases',
        'sit behind patrolling wardens. Take them all, then',
        'slip out the service door — unseen.',
        '',
        'Cones are what a warden can see. Walls and crates',
        'block sight; shadows hide you. Sneak to stay quiet.',
      ], 'Press Enter or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The wardens will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('Caught!', ['A warden laid hands on the courier.', 'The vault keeps its seeds — this time.'], 'Press R to retry the level');
    } else if (screen === SCREEN_LEVEL_CLEAR) {
      drawPanel('Level clear', [`${state.level.name} — out clean in ${fmtTime(state.elapsed)}.`], 'Press Enter for the next vault');
    } else if (screen === SCREEN_WIN) {
      drawPanel('All vaults cleared', [`Three seed-cases per vault, no alarm raised that stuck.`, `Total time ${fmtTime(state.elapsed)}.`], 'Press Enter to play again');
    }
  }

  return { draw };
}
