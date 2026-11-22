// Starlight Archive — the hand-in program.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with the kit's buildDossier, exactly as the scorer will.
// Before copying anything it runs a pre-flight check that fails loudly
// (non-zero exit, clear message) when a required input is missing or a
// cap is broken, so a broken hand-in never pretends to succeed.
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Resolve the repo from this script's own location, NOT from the working
// directory: the grader runs `node /bot/main.ts` from elsewhere, and
// process.cwd() then points at the wrong place (pre-flight failed with
// "game/index.html is missing", exit 1). Same pattern as the kit starter.
const repo = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const INDEX_HTML_MAX_BYTES = 1024 * 1024;
const SCREENSHOT_MAX_BYTES = 262144;

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------- pre-flight
const gameDir = join(repo, 'game');
const indexHtml = join(gameDir, 'index.html');
if (!existsSync(indexHtml)) fail('game/index.html is missing');
if (statSync(indexHtml).size > INDEX_HTML_MAX_BYTES) {
  fail(`game/index.html is ${statSync(indexHtml).size} bytes, over the 1 MiB cap`);
}

let gameEntries = 0;
let gameBytes = 0;
function walkGame(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      gameEntries += 1;
      walkGame(path);
    } else if (entry.isFile()) {
      gameEntries += 1;
      gameBytes += statSync(path).size;
    } else {
      fail(`game/ holds a non-file entry: ${path}`);
    }
  }
}
walkGame(gameDir);
if (gameEntries > GAME_MAX_FILES) fail(`game/ holds ${gameEntries} entries, over the ${GAME_MAX_FILES} cap`);
if (gameBytes > GAME_MAX_BYTES) fail(`game/ is ${gameBytes} bytes, over the ${GAME_MAX_BYTES} cap`);

const shotsDir = join(repo, 'screenshots');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
let shots: { name: string }[];
try {
  shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));
} catch {
  fail('shots.json is missing or not valid JSON');
}
if (!Array.isArray(shots) || shots.length < 3 || shots.length > 4) {
  fail('shots.json must list 3 or 4 screenshots');
}
const shotNames: string[] = [];
for (const shot of shots) {
  const path = join(shotsDir, shot.name);
  if (!existsSync(path)) fail(`screenshot listed in shots.json is missing: ${shot.name}`);
  const size = statSync(path).size;
  if (size > SCREENSHOT_MAX_BYTES) fail(`screenshot ${shot.name} is ${size} bytes, over the 256 KiB cap`);
  shotNames.push(shot.name);
}

// ---------------------------------------------------------------- hand-in
mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
for (const name of shotNames) copyFileSync(join(shotsDir, name), join(outDir, 'screenshots', name));

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: SCREENSHOT_MAX_BYTES },
  game_max_files: GAME_MAX_FILES,
  game_max_bytes: GAME_MAX_BYTES,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// ---------------------------------------------------------------- summary
console.log(
  `hand-in complete: ${gameEntries} game entries (${gameBytes} bytes), ` +
    `${shotNames.length} screenshots (${shotNames.join(', ')}), dossier.json ${dossier.length} bytes`,
);
