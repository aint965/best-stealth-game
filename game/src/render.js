// Starlight Archive — everything the player sees, drawn in Canvas 2D.
// A readable floor, walls with a lit top edge, crates you can read as
// cover at a glance, shadow alcoves as dark pools, and vision cones that
// change colour with suspicion: teal while calm, amber while curious,
// red while the alarm is up. The HUD sits on top; the title, pause,
// caught, level-clear and win screens are drawn over the game.
import { TILE, VIEW_W, VIEW_H, CONE_HALF_ANGLE } from './config.js';
import { detectionRange } from './vision.js';
import { isSolidTile, tileAt } from './level.js';

function coneColor(suspicion) {
  if (suspicion >= 100) return 'rgba(224, 62, 62, 0.34)';
  if (suspicion >= 55) return 'rgba(232, 150, 52, 0.30)';
  if (suspicion > 5) return 'rgba(94, 190, 178, 0.26)';
  return 'rgba(94, 190, 178, 0.20)';
}

function drawFloor(ctx, level) {
  for (let ty = 0; ty < level.grid.length; ty++) {
    for (let tx = 0; tx < level.grid[ty].length; tx++) {
      const ch = level.grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#232743' : '#20233d';
      ctx.fillRect(x, y, TILE, TILE);
      if (ch === 'S') {
        ctx.fillStyle = 'rgba(12, 10, 34, 0.78)';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 16, 15, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(140, 120, 220, 0.35)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 16, 15, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

function drawCover(ctx, level) {
  for (let ty = 0; ty < level.grid.length; ty++) {
    for (let tx = 0; tx < level.grid[ty].length; tx++) {
      const ch = level.grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') {
        ctx.fillStyle = '#3a3f5c';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#565d84';
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
      } else if (ch === 'C') {
        ctx.fillStyle = '#6b4f2a';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = '#8a6a3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + TILE - 2, y + TILE - 2);
        ctx.moveTo(x + TILE - 2, y + 2);
        ctx.lineTo(x + 2, y + TILE - 2);
        ctx.stroke();
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
    const range = detectionRange(world.player);
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

function drawHud(ctx, game) {
  const world = game.world;
  const taken = world.objectives.filter((c) => c.taken).length;
  const alarm = Math.max(0, ...world.guards.map((g) => g.suspicion));
  ctx.fillStyle = 'rgba(10, 10, 26, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, 30);
  ctx.fillStyle = '#e8e4d4';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(world.level.name, 10, 15);
  ctx.fillText(`Charts ${taken}/${world.objectives.length}`, 200, 15);
  const mins = Math.floor(game.timer / 60);
  const secs = Math.floor(game.timer % 60);
  ctx.fillText(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, 330, 15);
  ctx.fillStyle = '#c9c2a8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Alarm', 420, 15);
  ctx.fillStyle = '#2a2f4a';
  ctx.fillRect(465, 9, 120, 12);
  ctx.fillStyle = alarm >= 100 ? '#e03e3e' : alarm >= 55 ? '#e89634' : '#5ebeb2';
  ctx.fillRect(465, 9, Math.round(120 * (alarm / 100)), 12);
  ctx.fillStyle = '#c9c2a8';
  ctx.textAlign = 'right';
  ctx.fillText(game.muted ? 'Muted (M)' : 'Sound on (M)', VIEW_W - 10, 15);
  ctx.textAlign = 'left';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(232, 228, 212, 0.75)';
  ctx.fillText('WASD move · Shift sneak · E take chart · Click throw a lure · P pause', 10, VIEW_H - 10);
  const near = world.objectives.find((c) => !c.taken && Math.hypot(c.x - world.player.x, c.y - world.player.y) < 30);
  if (near) {
    ctx.fillStyle = '#f7c948';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press E to take the star chart', VIEW_W / 2, 52);
    ctx.textAlign = 'left';
  }
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
  ctx.fillText('WASD / arrows — move      Shift — sneak      E — take a chart', VIEW_W / 2, 340);
  ctx.fillText('Click — throw a lure      P — pause      M — mute      R — retry', VIEW_W / 2, 366);
  ctx.fillStyle = '#f7c948';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press Enter or click to begin', VIEW_W / 2, 440);
  ctx.fillStyle = '#8a8fa8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('An original game for make.fun — three galleries, rising patrols, no two runs alike.', VIEW_W / 2, 500);
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
  drawExit(ctx, world, game.time);
  drawCharts(ctx, world, game.time);
  drawCones(ctx, world);
  drawCover(ctx, world.level);
  drawGuards(ctx, world, game.time);
  drawPlayer(ctx, world);
  drawLure(ctx, world);
  drawHud(ctx, game);
  if (game.screen === 'paused') {
    overlay(ctx, 'PAUSED', ['Take a breath. The sentries wait.', 'Press P to carry on.'], '#e8e4d4');
  } else if (game.screen === 'caught') {
    overlay(ctx, 'CAUGHT!', ['A sentry caught Wren in the lamplight.', 'Press R to try the gallery again.'], '#e03e3e');
  } else if (game.screen === 'level-clear') {
    overlay(ctx, 'LEVEL CLEAR', ['Every chart in this gallery is yours.', 'Press Enter for the next gallery.'], '#f7c948');
  } else if (game.screen === 'win') {
    const mins = Math.floor(game.timer / 60);
    const secs = Math.floor(game.timer % 60);
    overlay(
      ctx,
      'ALL CHARTS RECOVERED',
      [`Wren slips out under the stars in ${mins}:${String(secs).padStart(2, '0')}.`, 'The archive never knew she was there.', 'Press Enter to return to the title.'],
      '#f7c948',
    );
  }
}
