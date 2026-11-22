// Quiet Vault verification: level data, screenshots, play-test, hand-in.
// Run from the repo root: node checks-v1/shoot-and-test.mjs
// Writes checks-v1/results.json. Exits non-zero when any case fails.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLevel, isSolidTile, tileAt, levelCount } from '../game/src/level.js';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const KIT = '/home/hatch/workspace/makefun/best-stealth-game-20261121-1759-kit-xingchi/best-stealth-game-20261121-1759-kit';
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const PORT = 8091;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const results = {};
function record(name, pass, detail = '') {
  results[name] = { pass, detail };
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- levels
function bfsReachable(level, from, targets) {
  const seen = new Set([`${from[0]},${from[1]}`]);
  const queue = [from];
  while (queue.length > 0) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      if (nx < 0 || ny < 0 || nx >= 25 || ny >= 19) continue;
      if (isSolidTile(level.grid[ny][nx])) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return targets.map(([x, y]) => seen.has(`${x},${y}`));
}

{
  let ok = true;
  const notes = [];
  for (let i = 0; i < levelCount(); i++) {
    const level = buildLevel(i);
    const px = Math.floor(level.playerStart.x / 32);
    const py = Math.floor(level.playerStart.y / 32);
    const targets = [
      ...level.objectives.map((o) => [Math.floor(o.x / 32), Math.floor(o.y / 32)]),
      [Math.floor(level.exit.x / 32), Math.floor(level.exit.y / 32)],
    ];
    const reached = bfsReachable(level, [px, py], targets);
    if (reached.some((r) => !r)) {
      ok = false;
      notes.push(`level ${i + 1}: an objective or the exit is unreachable`);
    }
    for (const g of level.guards) {
      for (const w of [g.start, ...g.waypoints]) {
        if (isSolidTile(tileAt(level, w.x, w.y))) {
          ok = false;
          notes.push(`level ${i + 1}: a guard waypoint is on a solid tile (${w.x},${w.y})`);
        }
      }
    }
    for (const o of level.objectives) {
      if (isSolidTile(tileAt(level, o.x, o.y))) {
        ok = false;
        notes.push(`level ${i + 1}: an objective is on a solid tile`);
      }
    }
  }
  record('levels-reachable', ok, notes.join('; ') || 'all objectives and exits reachable, all patrol waypoints on open tiles');
}

// ---------------------------------------------------------------- server
const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: 'ignore' });
async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${ORIGIN}/index.html`);
      if (res.ok) return true;
    } catch {
      // Not up yet.
    }
    await sleep(200);
  }
  return false;
}
const serverUp = await waitForServer();
record('server-up', serverUp, serverUp ? `game/ on ${ORIGIN}` : 'serve.ts did not answer');
if (!serverUp) {
  server.kill();
  writeFileSync(join(REPO, 'checks-v1', 'results.json'), JSON.stringify({ cases: results }, null, 2));
  process.exit(1);
}

// ---------------------------------------------------------------- screenshots
const shots = JSON.parse(readFileSync(join(REPO, 'shots.json'), 'utf8'));
const shotsDir = join(REPO, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
const shotInfo = [];
for (const shot of shots) {
  const out = join(shotsDir, shot.name);
  const run = spawnSync(SHELL, [
    '--no-sandbox', '--disable-gpu', '--window-size=800,608',
    '--virtual-time-budget=5000', '--timeout=20000',
    `--screenshot=${out}`,
    `${ORIGIN}/${shot.query}`,
  ], { encoding: 'utf8', timeout: 60000 });
  const exists = existsSync(out);
  let detail = '';
  let pass = exists && run.status === 0;
  let width = 0;
  let height = 0;
  if (exists) {
    const bytes = readFileSync(out);
    const size = bytes.length;
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
    detail = `${width}x${height}, ${size} bytes`;
    if (size > 262144) { pass = false; detail += ' (over 256 KiB)'; }
    if (width > 1280 || height > 1280 || Math.min(width, height) < 480) { pass = false; detail += ' (bad dimensions)'; }
    shotInfo.push({ name: shot.name, bytes: size, width, height });
  } else {
    detail = `no file (exit ${run.status}): ${(run.stderr || '').slice(0, 200)}`;
  }
  record(`screenshot-${shot.name}`, pass, detail);
}

// ---------------------------------------------------------------- play-test (CDP)
const cdp = { errors: [], external: [], failed: null };
let playPass = false;
try {
  const browser = spawn(SHELL, ['--no-sandbox', '--disable-gpu', '--remote-debugging-port=9222', '--window-size=800,608', 'about:blank'], { stdio: 'ignore' });
  await sleep(2500);
  const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  const events = [];
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id !== undefined && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error !== undefined) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    } else if (data.method !== undefined) {
      events.push(data);
    }
  };
  function send(method, params = {}, sessionId = undefined) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  async function evaljs(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
    if (r.exceptionDetails !== undefined) throw new Error(`evaluate failed: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    return r.result.value;
  }
  async function key(type, code, keyName) {
    await send('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: code === 'Enter' ? 13 : code === 'KeyD' ? 68 : code === 'KeyR' ? 82 : 0 }, sessionId);
  }
  const target = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Page.navigate', { url: `${ORIGIN}/` }, sessionId);
  await sleep(2500);

  // Drain events into the error/external lists.
  function drain() {
    for (const e of events.splice(0)) {
      if (e.method === 'Runtime.exceptionThrown') cdp.errors.push(JSON.stringify(e.params.exceptionDetails).slice(0, 200));
      if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') cdp.errors.push(JSON.stringify(e.params.args).slice(0, 200));
      if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') cdp.errors.push(e.params.entry.text.slice(0, 200));
      if (e.method === 'Network.requestWillBeSent') {
        const url = e.params.request.url;
        if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
          cdp.external.push(url);
        }
      }
    }
  }

  const title = await evaljs(`window.__game && window.__game.screen`);
  record('play-title-screen', title === 'title', `screen=${title}`);
  await key('keyDown', 'Enter', 'Enter');
  await key('keyUp', 'Enter', 'Enter');
  await sleep(400);
  const playing = await evaljs(`window.__game.screen`);
  record('play-starts', playing === 'play', `screen=${playing}`);

  // Movement: hold D for a second; the courier must move right.
  const x0 = await evaljs(`window.__game.world.player.x`);
  await key('keyDown', 'KeyD', 'd');
  await sleep(1000);
  await key('keyUp', 'KeyD', 'd');
  const x1 = await evaljs(`window.__game.world.player.x`);
  record('play-movement', x1 - x0 > 50, `x ${Math.round(x0)} -> ${Math.round(x1)}`);

  // Vision: put the courier 80 px in front of warden 0, facing it; suspicion must rise.
  await evaljs(`(() => { const w = window.__game.world; const g = w.guards[0]; g.x = 400; g.y = 176; g.angle = 0; g.suspicion = 0; w.player.x = 480; w.player.y = 176; w.player.sneaking = false; return true; })()`);
  const s0 = await evaljs(`window.__game.world.guards[0].suspicion`);
  await sleep(3000);
  const s1 = await evaljs(`window.__game.world.guards[0].suspicion`);
  record('play-vision-reacts', s1 > s0 && s1 > 0, `suspicion ${s0.toFixed(1)} -> ${s1.toFixed(1)}`);

  // Caught: a chasing warden on top of the courier ends the run; R retries.
  await evaljs(`(() => { const w = window.__game.world; const g = w.guards[0]; g.x = w.player.x + 10; g.y = w.player.y; g.suspicion = 100; g.state = 'chase'; return true; })()`);
  await sleep(600);
  const caught = await evaljs(`window.__game.screen`);
  record('play-caught', caught === 'caught', `screen=${caught}`);
  await key('keyDown', 'KeyR', 'r');
  await key('keyUp', 'KeyR', 'r');
  await sleep(400);
  const retried = await evaljs(`window.__game.screen`);
  record('play-retry', retried === 'play', `screen=${retried}`);

  // Exit: all cases taken, door open, courier on the door -> level clear.
  await evaljs(`(() => { const w = window.__game.world; for (const o of w.objectives) o.taken = true; w.exitOpen = true; w.player.x = w.level.exit.x; w.player.y = w.level.exit.y; return true; })()`);
  await sleep(600);
  const cleared = await evaljs(`window.__game.screen`);
  record('play-exit-win', cleared === 'level-clear', `screen=${cleared}`);

  drain();
  record('play-no-console-errors', cdp.errors.length === 0, cdp.errors.slice(0, 3).join(' | ') || '0 errors');
  record('play-no-external-requests', cdp.external.length === 0, cdp.external.slice(0, 3).join(' | ') || '0 external');
  playPass = true;
  ws.close();
  browser.kill();
} catch (err) {
  cdp.failed = String(err).slice(0, 300);
  record('play-test', false, cdp.failed);
}

// ---------------------------------------------------------------- hand-in twice
function runMain(outName) {
  const outDir = join(REPO, outName);
  const run = spawnSync('node', ['main.ts'], {
    cwd: REPO,
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: outDir },
    encoding: 'utf8',
    timeout: 60000,
  });
  return { ok: run.status === 0, stdout: (run.stdout || '').trim(), stderr: (run.stderr || '').trim() };
}
const runA = runMain('checks-v1-a');
const runB = runMain('checks-v1-b');
record('main-ts-run-a', runA.ok, runA.stdout || runA.stderr);
record('main-ts-run-b', runB.ok, runB.stdout || runB.stderr);

// Byte-identical outputs, including a fresh buildDossier run.
let identical = false;
let dossierMatches = false;
try {
  const { readFileSync: read } = await import('node:fs');
  const aFiles = spawnSync('find', ['checks-v1-a', '-type', 'f'], { cwd: REPO, encoding: 'utf8' }).stdout.trim().split('\n');
  identical = runA.ok && runB.ok;
  for (const f of aFiles) {
    const a = read(join(REPO, f));
    const b = read(join(REPO, f.replace('checks-v1-a', 'checks-v1-b')));
    if (!a.equals(b)) { identical = false; break; }
  }
  const { buildDossier } = await import('../vendor/makefun-game.ts');
  const fresh = buildDossier(join(REPO, 'checks-v1-a'), {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  dossierMatches = Buffer.from(fresh).equals(read(join(REPO, 'checks-v1-a', 'dossier.json')));
} catch (err) {
  identical = false;
}
record('main-ts-deterministic', identical, identical ? 'checks-v1-a and checks-v1-b byte-identical' : 'outputs differ');
record('dossier-matches', dossierMatches, dossierMatches ? 'dossier.json equals a fresh buildDossier run' : 'dossier mismatch');

server.kill();
mkdirSync(join(REPO, 'checks-v1'), { recursive: true });
writeFileSync(join(REPO, 'checks-v1', 'results.json'), JSON.stringify({ cases: results, screenshots: shotInfo }, null, 2));
const failed = Object.values(results).filter((r) => !r.pass).length;
console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
