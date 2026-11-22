// Starlight Archive — everything the player sees, drawn in Canvas 2D.
// Textured floors per gallery (wood planks, stone tiles, dark slate),
// brick walls, archive shelves with books, warm lamps with real glow,
// carpets, plants and shadow pools. Vision cones change colour with
// suspicion: teal while calm, amber while curious, red while the alarm
// is up; cameras sweep violet cones. The HUD shows charts, score, timer,
// strikes, detection status and the alarm; a detection panel reports
// visibility and noise, and a legend strip explains every icon at the
// bottom of the frame. Title, pause, caught, level-clear, failed and win
// screens are drawn over the game.
import { TILE, VIEW_W, VIEW_H, CONE_HALF_ANGLE, NOISE_RADIUS, MAX_STRIKES, SCORE_CHART, GHOST_BONUS, TIME_BONUS_MAX, TIME_BONUS_RATE } from './config.js';
import { detectionRange, inLampLight } from './vision.js';
import { isSolidTile, tileAt } from './level.js';

const THEMES = {
  wood: {
    floorA: '#33291d', floorB: '#2e241a', floorLine: 'rgba(0,0,0,0.20)',
    wall: '#4a3430', wallTop: '#6b4a42', wallLine: 'rgba(0,0,0,0.32)',
    carpet: '#5d2e35', carpetBorder: '#c9a24d', carpetInner: '#6e3640',
    lamp: '255, 179, 71', seed: 11,
  },
  stone: {
    floorA: '#272b3c', floorB: '#232736', floorLine: 'rgba(0,0,0,0.24)',
    wall: '#3d4258', wallTop: '#5a6180', wallLine: 'rgba(0,0,0,0.32)',
    carpet: '#2e4a5d', carpetBorder: '#7fb3c9', carpetInner: '#35566b',
    lamp: '255, 210, 138', seed: 23,
  },
  slate: {
    floorA: '#1f2334', floorB: '#1b1e2e', floorLine: 'rgba(0,0,0,0.26)',
    wall: '#343a52', wallTop: '#4c5478', wallLine: 'rgba(0,0,0,0.34)',
    carpet: '#4a2f1e', carpetBorder: '#d8b25e', carpetInner: '#573a24',
    lamp: '255, 225, 160', seed: 37,
  },
};

const BOOK_COLORS = ['#a34d4d', '#4d7aa3', '#c9a24d', '#5d8a5d', '#8a5da3', '#b0703f'];

/** Deterministic 0..1 value for a tile, so every render agrees. */
function hash(tx, ty, seed) {
  let h = (tx * 73856093) ^ (ty * 19349663) ^ (seed * 83492791);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function coneColor(suspicion) {
  if (suspicion >= 100) return 'rgba(224, 62, 62, 0.34)';
  if (suspicion >= 55) return 'rgba(232, 150, 52, 0.30)';
  if (suspicion > 5) return 'rgba(94, 190, 178, 0.26)';
  return 'rgba(94, 190, 178, 0.20)';
}

function cameraConeColor(suspicion) {
  if (suspicion >= 100) return 'rgba(224, 62, 62, 0.30)';
  if (suspicion >= 55) return 'rgba(200, 120, 255, 0.30)';
  if (suspicion > 5) return 'rgba(150, 120, 255, 0.26)';
  return 'rgba(150, 120, 255, 0.18)';
}

function drawFloor(ctx, level) {
  const theme = THEMES[level.theme] || THEMES.wood;
  for (let ty = 0; ty < level.grid.length; ty++) {
    for (let tx = 0; tx < level.grid[ty].length; tx++) {
      const ch = level.grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      const h = hash(tx, ty, theme.seed);
      ctx.fillStyle = (tx + ty) % 2 === 0 ? theme.floorA : theme.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      if (h < 0.12) {
        ctx.fillStyle = 'rgba(255, 240, 200, 0.05)';
        ctx.fillRect(x, y, TILE, TILE);
      }
      // Wood planks run horizontal with staggered joints; stone gets a
      // grid line and the odd accent tile.
      ctx.strokeStyle = theme.floorLine;
      ctx.lineWidth = 1;
      if (level.theme === 'wood') {
        ctx.beginPath();
        ctx.moveTo(x, y + TILE - 0.5);
        ctx.lineTo(x + TILE, y + TILE - 0.5);
        ctx.stroke();
        const joint = (ty % 2 === 0 ? 10 : 22) + Math.floor(h * 6);
        ctx.beginPath();
        ctx.moveTo(x + joint, y);
        ctx.lineTo(x + joint, y + TILE);
        ctx.stroke();
      } else {
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (h < 0.05) {
          ctx.fillStyle = 'rgba(220, 200, 140, 0.16)';
          ctx.beginPath();
          ctx.moveTo(x + 16, y + 8);
          ctx.lineTo(x + 24, y + 16);
          ctx.lineTo(x + 16, y + 24);
          ctx.lineTo(x + 8, y + 16);
          ctx.closePath();
          ctx.fill();
        }
      }
      if (ch === 'S') {
        ctx.fillStyle = 'rgba(8, 6, 26, 0.85)';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 16, 15, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(140, 120, 220, 0.4)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 16, 15, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 4; i++) {
          const sx = x + 16 + (hash(tx, ty, 100 + i) - 0.5) * 22;
          const sy = y + 16 + (hash(tx, ty, 200 + i) - 0.5) * 18;
          ctx.fillStyle = 'rgba(180, 160, 255, 0.7)';
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      } else if (ch === '.' && hash(tx, ty, theme.seed + 5) < 0.035) {
        // A tuft of archive plant, decoration only.
        ctx.strokeStyle = '#4a7a5a';
        ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(x + 16 + i * 4, y + 26);
          ctx.quadraticCurveTo(x + 16 + i * 5, y + 18, x + 16 + i * 7, y + 13);
          ctx.stroke();
        }
      }
    }
  }
  // Carpets: walkable, drawn over the floor.
  for (const rug of level.rugs || []) {
    const rx = rug.x * TILE;
    const ry = rug.y * TILE;
    const rw = rug.w * TILE;
    const rh = rug.h * TILE;
    ctx.fillStyle = theme.carpet;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = theme.carpetBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + 3, ry + 3, rw - 6, rh - 6);
    ctx.strokeStyle = theme.carpetInner;
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 8, ry + 8, rw - 16, rh - 16);
    ctx.fillStyle = theme.carpetBorder;
    for (let gx = rx + 20; gx < rx + rw - 8; gx += 28) {
      for (let gy = ry + 20; gy < ry + rh - 8; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(gx, gy - 3);
        ctx.lineTo(gx + 3, gy);
        ctx.lineTo(gx, gy + 3);
        ctx.lineTo(gx - 3, gy);
        ctx.closePath();
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawLamps(ctx, level, time) {
  const theme = THEMES[level.theme] || THEMES.wood;
  for (const lamp of level.lamps || []) {
    const flicker = 0.16 + 0.03 * Math.sin(time * 2.3 + lamp.x);
    const grad = ctx.createRadialGradient(lamp.x, lamp.y, 6, lamp.x, lamp.y, 95);
    grad.addColorStop(0, `rgba(${theme.lamp}, ${flicker})`);
    grad.addColorStop(0.6, `rgba(${theme.lamp}, 0.07)`);
    grad.addColorStop(1, `rgba(${theme.lamp}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2f4a';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${theme.lamp}, 0.95)`;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCover(ctx, level) {
  const theme = THEMES[level.theme] || THEMES.wood;
  for (let ty = 0; ty < level.grid.length; ty++) {
    for (let tx = 0; tx < level.grid[ty].length; tx++) {
      const ch = level.grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') {
        ctx.fillStyle = theme.wall;
        ctx.fillRect(x, y, TILE, TILE);
        // Brick courses with staggered joints.
        ctx.strokeStyle = theme.wallLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + 10.5);
        ctx.lineTo(x + TILE, y + 10.5);
        ctx.moveTo(x, y + 21.5);
        ctx.lineTo(x + TILE, y + 21.5);
        const joint = ty % 2 === 0 ? 11 : 21;
        ctx.moveTo(x + joint, y);
        ctx.lineTo(x + joint, y + 10);
        ctx.moveTo(x + TILE - joint, y + 11);
        ctx.lineTo(x + TILE - joint, y + 21);
        ctx.moveTo(x + joint, y + 22);
        ctx.lineTo(x + joint, y + TILE);
        ctx.stroke();
        ctx.fillStyle = theme.wallTop;
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
      } else if (ch === 'C') {
        // An archive shelf: wooden frame, two shelves, coloured book spines.
        ctx.fillStyle = '#7a5a34';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = '#5d4126';
        ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.fillStyle = '#7a5a34';
        ctx.fillRect(x + 5, y + 14, TILE - 10, 2);
        for (let s = 0; s < 2; s++) {
          const top = s === 0 ? 6 : 17;
          let bx = x + 6;
          let k = 0;
          while (bx < x + TILE - 8) {
            const h = hash(tx, ty, 300 + s * 10 + k);
            const w = 3 + Math.floor(h * 4);
            ctx.fillStyle = BOOK_COLORS[Math.floor(h * BOOK_COLORS.length)];
            ctx.fillRect(bx, y + top, w, 8);
            bx += w + 1;
            k++;
          }
        }
        ctx.strokeStyle = '#8a6a3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      }
    }
  }
}

function drawExit(ctx, world, time) {
  const { exit } = world.level;
  const open = world.exitOpen;
  ctx.save();
  ctx.translate(exit.x, exit.y);
  ctx.fillStyle = open ? '#f7c948' : '#4a3a2a';
  ctx.fillRect(-14, -18, 28, 36);
  ctx.strokeStyle = open ? '#ffe9a3' : '#8a6a3c';
  ctx.lineWidth = 2;
  ctx.strokeRect(-14, -18, 28, 36);
  if (open) {
    const pulse = 0.5 + 0.3 * Math.sin(time * 3);
    ctx.fillStyle = `rgba(247, 201, 72, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + 4 * Math.sin(time * 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1430';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 0, 0);
  } else {
    ctx.fillStyle = '#e05252';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9c2a8';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKED', 0, 28);
  }
  ctx.restore();
}

function drawCharts(ctx, world, time) {
  for (const chart of world.objectives) {
    if (chart.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.save();
    ctx.translate(chart.x, chart.y);
    ctx.fillStyle = `rgba(247, 201, 72, ${0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * 4, Math.sin(a + Math.PI / 4) * 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Where one ray of a vision cone stops: the first wall or crate, or its range. */
function raycastEnd(level, x0, y0, angle, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const step = 6;
  for (let d = step; d <= maxDist; d += step) {
    if (isSolidTile(tileAt(level, x0 + dx * d, y0 + dy * d))) {
      return { x: x0 + dx * (d - step), y: y0 + dy * (d - step) };
    }
  }
  return { x: x0 + dx * maxDist, y: y0 + dy * maxDist };
}

/** Vision cones as a fan of short rays, so walls and crates cut the cone short. */
function drawCones(ctx, world) {
  const rays = 28;
  for (const guard of world.guards) {
    const range = detectionRange(world.player, world.level);
    ctx.fillStyle = coneColor(guard.suspicion);
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let i = 0; i <= rays; i++) {
      const a = guard.angle - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / rays;
      const end = raycastEnd(world.level, guard.x, guard.y, a, range);
      ctx.lineTo(end.x, end.y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/** Camera cones: violet, swept, clipped by walls the same way. */
function drawCameraCones(ctx, world) {
  const rays = 24;
  for (const camera of world.cameras || []) {
    ctx.fillStyle = cameraConeColor(camera.suspicion);
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    for (let i = 0; i <= rays; i++) {
      const a = camera.angle - 0.55 + (2 * 0.55 * i) / rays;
      const end = raycastEnd(world.level, camera.x, camera.y, a, 190);
      ctx.lineTo(end.x, end.y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawTripwires(ctx, world, time) {
  for (const wire of world.tripwires || []) {
    const alpha = wire.flash > 0 ? 1 : 0.45 + 0.3 * Math.sin(time * 6);
    ctx.save();
    ctx.strokeStyle = `rgba(224, 62, 62, ${alpha})`;
    ctx.lineWidth = wire.flash > 0 ? 4 : 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(wire.x1, wire.y1);
    ctx.lineTo(wire.x2, wire.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [px, py] of [[wire.x1, wire.y1], [wire.x2, wire.y2]]) {
      ctx.fillStyle = '#e03e3e';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd2d2';
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCameras(ctx, world) {
  for (const camera of world.cameras || []) {
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2f4a';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#565d84';
    ctx.lineWidth = 2;
    ctx.stroke();
    const lx = Math.cos(camera.angle) * 6;
    const ly = Math.sin(camera.angle) * 6;
    ctx.fillStyle = camera.suspicion >= 100 ? '#ff5a5a' : camera.suspicion >= 55 ? '#ffb347' : '#b78cff';
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
    if (camera.suspicion >= 55) {
      ctx.fillStyle = camera.suspicion >= 100 ? '#ff5a5a' : '#ffb347';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(camera.suspicion >= 100 ? '!' : '?', 0, -16);
    }
    ctx.restore();
  }
}

function drawGuards(ctx, world, time) {
  for (const guard of world.guards) {
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8e2f2f';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5d1d1d';
    ctx.lineWidth = 2;
    ctx.stroke();
    // The lantern: a warm dot carried toward the facing direction.
    const lx = Math.cos(guard.angle) * 10;
    const ly = Math.sin(guard.angle) * 10;
    const glow = 0.5 + 0.3 * Math.sin(time * 5);
    ctx.fillStyle = `rgba(255, 214, 120, ${glow})`;
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
    if (guard.suspicion >= 100) {
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -22);
    } else if (guard.suspicion > 25) {
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, -22);
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.inShadow ? '#2f6f6a' : '#3f8f88';
  ctx.beginPath();
  ctx.arc(0, 0, p.sneaking ? 11 : 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1d4a46';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e8f6f3';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 6, Math.sin(p.angle) * 6, 4, 0, Math.PI * 2);
  ctx.fill();
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(232, 246, 243, 0.6)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (p.sprinting) {
    ctx.strokeStyle = 'rgba(255, 180, 80, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(-20, -6);
    ctx.moveTo(-14, 0);
    ctx.lineTo(-21, 0);
    ctx.moveTo(-14, 6);
    ctx.lineTo(-20, 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLure(ctx, world) {
  const lure = world.lure;
  if (!lure) return;
  ctx.strokeStyle = `rgba(255, 240, 180, ${Math.max(0, lure.t)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lure.x, lure.y, 10 + (1.2 - lure.t) * 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a3';
  ctx.beginPath();
  ctx.arc(lure.x, lure.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawNoiseRings(ctx, world) {
  for (const ring of world.noiseRings || []) {
    const progress = 1 - ring.t / 0.6;
    ctx.strokeStyle = `rgba(255, 220, 160, ${(1 - progress) * 0.55})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, Math.max(1, progress * NOISE_RADIUS), 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** One text item in a flowing row; returns the x after the text. */
function rowText(ctx, text, x, y) {
  ctx.fillText(text, x, y);
  return x + ctx.measureText(text).width;
}

function drawHud(ctx, game) {
  const world = game.world;
  const taken = world.objectives.filter((c) => c.taken).length;
  const alarm = Math.max(0, ...world.guards.map((g) => g.suspicion), ...(world.cameras || []).map((c) => c.suspicion));
  const status = alarm >= 100 ? 'ALERT!' : alarm >= 55 ? 'SUSPICIOUS' : alarm >= 25 ? 'NOTICED' : 'HIDDEN';
  const statusColor = alarm >= 100 ? '#ff5a5a' : alarm >= 55 ? '#ffb347' : alarm >= 25 ? '#5ebeb2' : '#7ee0b8';
  ctx.fillStyle = 'rgba(10, 10, 26, 0.88)';
  ctx.fillRect(0, 0, VIEW_W, 30);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let x = 10;
  ctx.fillStyle = '#e8e4d4';
  ctx.font = 'bold 13px system-ui, sans-serif';
  x = rowText(ctx, `${world.level.name} · ${game.levelIndex + 1}/3`, x, 15) + 16;
  ctx.font = '12px system-ui, sans-serif';
  x = rowText(ctx, `Charts ${taken}/${world.objectives.length}`, x, 15) + 14;
  ctx.fillStyle = statusColor;
  ctx.font = 'bold 12px system-ui, sans-serif';
  x = rowText(ctx, status, x, 15) + 14;
  ctx.fillStyle = '#c9c2a8';
  ctx.font = '12px system-ui, sans-serif';
  x = rowText(ctx, 'Alarm', x, 15) + 6;
  ctx.fillStyle = '#2a2f4a';
  ctx.fillRect(x, 9, 90, 12);
  ctx.fillStyle = alarm >= 100 ? '#e03e3e' : alarm >= 55 ? '#e89634' : '#5ebeb2';
  ctx.fillRect(x, 9, Math.round(90 * (alarm / 100)), 12);
  ctx.fillStyle = '#c9c2a8';
  ctx.textAlign = 'right';
  ctx.fillText(game.muted ? 'Muted (M)' : 'Sound on (M)', VIEW_W - 10, 15);
  ctx.textAlign = 'left';
}

/** Detection panel: status, score, timer, strikes, visibility and noise. */
function drawDetection(ctx, game) {
  const world = game.world;
  const p = world.player;
  const alarm = Math.max(0, ...world.guards.map((g) => g.suspicion), ...(world.cameras || []).map((c) => c.suspicion));
  const status = alarm >= 100 ? 'ALERT!' : alarm >= 55 ? 'SUSPICIOUS' : alarm >= 25 ? 'NOTICED' : 'HIDDEN';
  const statusColor = alarm >= 100 ? '#ff5a5a' : alarm >= 55 ? '#ffb347' : alarm >= 25 ? '#5ebeb2' : '#7ee0b8';
  const mins = Math.floor(game.timer / 60);
  const secs = Math.floor(game.timer % 60);
  const visibility = p.inShadow ? 'IN SHADOW' : inLampLight(world.level, p.x, p.y) ? 'LAMP LIGHT' : 'VISIBLE';
  const noise = p.sprinting ? 'LOUD' : p.sneaking ? 'SILENT' : 'QUIET';
  ctx.fillStyle = 'rgba(10, 10, 26, 0.85)';
  ctx.fillRect(8, 36, 172, 72);
  ctx.strokeStyle = 'rgba(201, 194, 168, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(8.5, 36.5, 172, 72);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a8fa8';
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText('D E T E C T I O N', 16, 47);
  ctx.fillStyle = statusColor;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(status, 16, 63);
  ctx.fillStyle = '#e8e4d4';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`Score ${game.score}  ·  ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, 16, 78);
  ctx.fillStyle = game.spotted === 0 ? '#f7c948' : '#c9c2a8';
  ctx.fillText(game.spotted === 0 ? `Strikes ${game.strikes}/${MAX_STRIKES}  ·  GHOST +${GHOST_BONUS}` : `Strikes ${game.strikes}/${MAX_STRIKES}  ·  SPOTTED ${game.spotted}`, 16, 92);
  ctx.fillStyle = '#c9c2a8';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(`${visibility}  ·  ${noise}`, 16, 104);
}

/** Legend strip along the bottom: every icon explained, plus controls. */
function drawLegend(ctx) {
  ctx.fillStyle = 'rgba(10, 10, 26, 0.92)';
  ctx.fillRect(0, 572, VIEW_W, 36);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = '#c9c2a8';
  let x = 10;
  const gap = 12;
  const item = (drawIcon, label) => {
    drawIcon(x);
    x += 16;
    ctx.fillStyle = '#c9c2a8';
    x = rowText(ctx, label, x, 583) + gap;
  };
  item((ix) => {
    ctx.fillStyle = 'rgba(94, 190, 178, 0.55)';
    ctx.beginPath();
    ctx.moveTo(ix + 5, 583);
    ctx.lineTo(ix + 15, 578);
    ctx.lineTo(ix + 15, 588);
    ctx.closePath();
    ctx.fill();
  }, 'Sentry cone');
  item((ix) => {
    ctx.fillStyle = 'rgba(150, 120, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(ix + 5, 583);
    ctx.lineTo(ix + 15, 578);
    ctx.lineTo(ix + 15, 588);
    ctx.closePath();
    ctx.fill();
  }, 'Camera');
  item((ix) => {
    ctx.strokeStyle = '#e03e3e';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(ix + 2, 583);
    ctx.lineTo(ix + 14, 583);
    ctx.stroke();
    ctx.setLineDash([]);
  }, 'Tripwire');
  item((ix) => {
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(ix + 3, 577, 10, 11);
    ctx.strokeStyle = '#8a6a3c';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + 3, 577, 10, 11);
  }, 'Shelf blocks sight');
  item((ix) => {
    ctx.fillStyle = 'rgba(8, 6, 26, 0.9)';
    ctx.beginPath();
    ctx.ellipse(ix + 8, 583, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 120, 220, 0.6)';
    ctx.beginPath();
    ctx.ellipse(ix + 8, 583, 7, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }, 'Shadow hides');
  item((ix) => {
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(ix + 8, 583, 4, 0, Math.PI * 2);
    ctx.fill();
  }, 'Lamp: seen far');
  item((ix) => {
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    ctx.moveTo(ix + 8, 577);
    ctx.lineTo(ix + 11, 583);
    ctx.lineTo(ix + 8, 589);
    ctx.lineTo(ix + 5, 583);
    ctx.closePath();
    ctx.fill();
  }, 'Chart');
  item((ix) => {
    ctx.fillStyle = '#f7c948';
    ctx.fillRect(ix + 4, 577, 9, 12);
    ctx.strokeStyle = '#ffe9a3';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + 4, 577, 9, 12);
  }, 'Exit');
  ctx.fillStyle = '#e8e4d4';
  ctx.fillText('WASD move · Shift sneak · Space sprint (loud!) · E take chart · Click throw a lure · P pause', 10, 599);
}

/** Staged callout labels (screenshots only): a pill with a pointer. */
function drawLabels(ctx, game) {
  if (!game.labels) return;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const label of game.labels) {
    const ax = label.tile[0] * TILE + TILE / 2;
    const ay = label.tile[1] * TILE + TILE / 2;
    const w = ctx.measureText(label.text).width + 16;
    const h = 20;
    let px = Math.max(8, Math.min(VIEW_W - 8 - w, ax - w / 2));
    const py = label.side === 'below' ? ay + 22 : ay - 22 - h;
    ctx.fillStyle = 'rgba(8, 8, 22, 0.88)';
    ctx.strokeStyle = '#c9a24d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(px, py, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#c9a24d';
    ctx.beginPath();
    ctx.moveTo(ax, label.side === 'below' ? py : py + h);
    ctx.lineTo(ax, ay + (label.side === 'below' ? -12 : 12));
    ctx.stroke();
    ctx.fillStyle = '#ffe9a3';
    ctx.textAlign = 'left';
    ctx.fillText(label.text, px + 8, py + h / 2 + 0.5);
  }
  ctx.textAlign = 'left';
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8, 8, 22, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = accent;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 70);
  ctx.fillStyle = '#e8e4d4';
  ctx.font = '16px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 - 18 + i * 26));
  ctx.textAlign = 'left';
}

function drawTitle(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#141a38');
  grad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#f7c948';
  ctx.beginPath();
  ctx.arc(650, 110, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(247, 201, 72, 0.25)';
  ctx.beginPath();
  ctx.arc(650, 110, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e4d4';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STARLIGHT ARCHIVE', VIEW_W / 2, 150);
  ctx.fillStyle = '#f7c948';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('a quiet heist in the observatory archive', VIEW_W / 2, 192);
  ctx.fillStyle = '#c9c2a8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Wren, junior archivist, must recover three star charts and', VIEW_W / 2, 250);
  ctx.fillText('slip out through the moon door — unseen by the night sentries.', VIEW_W / 2, 274);
  ctx.fillStyle = '#e8e4d4';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move      Shift — sneak      Space — sprint (loud!)', VIEW_W / 2, 330);
  ctx.fillText('E — take a chart      Click — throw a lure      P — pause      M — mute', VIEW_W / 2, 356);
  ctx.fillStyle = '#b78cff';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Cameras sweep the halls. Tripwires guard the Vault. Never spotted: GHOST +500.', VIEW_W / 2, 396);
  ctx.fillStyle = '#f7c948';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press Enter or click to begin', VIEW_W / 2, 448);
  ctx.fillStyle = '#8a8fa8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('An original game for make.fun — three galleries, rising patrols, no two runs alike.', VIEW_W / 2, 506);
  ctx.textAlign = 'left';
}

/** Draw the whole game for the current screen. */
export function draw(ctx, game) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (game.screen === 'title') {
    drawTitle(ctx);
    return;
  }
  const world = game.world;
  drawFloor(ctx, world.level);
  drawLamps(ctx, world.level, game.time);
  drawExit(ctx, world, game.time);
  drawCharts(ctx, world, game.time);
  drawCones(ctx, world);
  drawCameraCones(ctx, world);
  drawTripwires(ctx, world, game.time);
  drawCover(ctx, world.level);
  drawGuards(ctx, world, game.time);
  drawCameras(ctx, world);
  drawPlayer(ctx, world);
  drawLure(ctx, world);
  drawNoiseRings(ctx, world);
  drawDetection(ctx, game);
  drawHud(ctx, game);
  drawLegend(ctx);
  drawLabels(ctx, game);
  const near = world.objectives.find((c) => !c.taken && Math.hypot(c.x - world.player.x, c.y - world.player.y) < 30);
  if (near && game.screen === 'play') {
    ctx.fillStyle = '#f7c948';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press E to take the star chart', VIEW_W / 2, 52);
    ctx.textAlign = 'left';
  }
  if (game.screen === 'paused') {
    overlay(ctx, 'PAUSED', ['Take a breath. The sentries wait.', 'Press P to carry on.'], '#e8e4d4');
  } else if (game.screen === 'caught') {
    overlay(ctx, 'CAUGHT!', ['A sentry caught Wren in the lamplight.', `Strike ${game.strikes} of ${MAX_STRIKES} — press R to try the gallery again.`], '#e03e3e');
  } else if (game.screen === 'failed') {
    overlay(ctx, 'HEIST FAILED', ['Three strikes — the archive woke up.', 'Press Enter to return to the title.'], '#e03e3e');
  } else if (game.screen === 'level-clear') {
    overlay(ctx, 'LEVEL CLEAR', [`Every chart in this gallery is yours. Score ${game.score}.`, 'Press Enter for the next gallery.'], '#f7c948');
  } else if (game.screen === 'win') {
    const timeBonus = Math.max(0, TIME_BONUS_MAX - Math.floor(game.timer)) * TIME_BONUS_RATE;
    const ghostBonus = game.spotted === 0 ? GHOST_BONUS : 0;
    overlay(
      ctx,
      'ALL CHARTS RECOVERED',
      [
        `Wren slips out under the stars — score ${game.finalScore}.`,
        `Charts ${game.score} · time bonus ${timeBonus} · GHOST +${ghostBonus}.`,
        'Press Enter to return to the title.',
      ],
      '#f7c948',
    );
  }
}
