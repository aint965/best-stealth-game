// Quiet Vault, the hand-in program (Node 22, standard library only): the
// game is this directory's game/ folder, plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and
// no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// Before it copies anything it runs its own pre-flight check and fails
// loudly (a non-zero exit and a clear message) when a required input is
// missing: game/index.html, the screenshots/ directory, any screenshot
// shots.json names, a screenshot over 256 KiB, or game/ over its file or
// byte caps. After the hand-in succeeds it prints a short run summary:
// the game files copied, the screenshots copied, the dossier's byte size.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Fail loudly: a clear message on stderr and a non-zero exit. */
function fail(message) {
  console.error(`main.ts pre-flight: ${message}`);
  process.exit(1);
}

/** Walk a directory and count its files and their bytes, recursively. */
function walk(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = walk(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    } else {
      fail(`${path} is not a plain file or directory`);
    }
  }
  return { files, bytes };
}

// --- pre-flight: the game -----------------------------------------------
const gameDir = join(here, 'game');
const indexHtml = join(gameDir, 'index.html');
if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) {
  fail('game/index.html is missing: a game is a directory of static files, its index.html at its root');
}
const gameTree = walk(gameDir);
if (gameTree.files > 993) fail(`game/ holds ${gameTree.files} files, over the 993 allowed`);
if (gameTree.bytes > 50331648) fail(`game/ is ${gameTree.bytes} bytes, over the 48 MiB allowed`);
if (statSync(indexHtml).size > 1024 * 1024) fail('game/index.html is over the 1 MiB allowed');

// --- pre-flight: the screenshots ----------------------------------------
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
  fail('screenshots/ is missing: 3 or 4 PNG or JPEG renders of the game are required');
}
let shotNames;
try {
  shotNames = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8')).map((s) => s.name);
} catch {
  fail('shots.json cannot be read: it must list the screenshots by name');
}
if (shotNames.length < 3 || shotNames.length > 4) {
  fail(`shots.json lists ${shotNames.length} screenshots: 3 or 4 are required`);
}
for (const name of shotNames) {
  const path = join(shotsDir, name);
  if (!existsSync(path) || !statSync(path).isFile()) fail(`screenshots/${name} is missing (listed in shots.json)`);
  const size = statSync(path).size;
  if (size > 262144) fail(`screenshots/${name} is ${size} bytes, over the 256 KiB allowed`);
}

// --- hand-in ------------------------------------------------------------
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files, in
// all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// --- run summary ----------------------------------------------------------
const shotBytes = shotNames.reduce((n, name) => n + statSync(join(shotsDir, name)).size, 0);
console.log(`quiet-vault hand-in: game ${gameTree.files} files (${gameTree.bytes} bytes), screenshots ${shotNames.length} (${shotBytes} bytes), dossier ${dossier.length} bytes -> ${out}`);
