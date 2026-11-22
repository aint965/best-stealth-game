# Starlight Archive — build report

A fresh rebuild of the best-stealth-game entry, written entirely in this
session from the brief (the earlier session's files were deleted without
being read). "Starlight Archive" is an original top-down stealth game:
Wren, junior archivist of a mountaintop observatory archive, recovers
three star charts per gallery and slips out through the moon door unseen
by the night sentries.

## What was built

- **Setting and levels** — three 25 x 19 galleries: Reading Room
  (2 sentries), Map Gallery (3 sentries, tighter patrols), Vault of Charts
  (4 sentries, sparse cover). Every objective and exit is reachable and
  every patrol waypoint sits on open floor (checked by BFS in the verifier).
- **Mechanics** — sentry patrols with pauses and scans; vision cones that
  react (teal calm, amber suspicious, red alarm) with a suspicion meter
  that rises on sight and decays when hidden; investigate the last-seen
  spot, chase on full suspicion, and cool back to search, then calm, when
  line of sight breaks — detection is always recoverable. Walls and
  crates block sight; shadow alcoves and sneaking (Shift) shrink the
  detection range. The moon door stays locked until all charts are taken
  (E to take one), then glows gold. Click throws a lure that draws a
  nearby sentry to the spot. Title, HUD (charts, alarm meter, timer,
  level), pause, caught screen with retry, level-clear and win screens.
- **Presentation** — all art drawn in Canvas 2D, all sounds synthesized
  with WebAudio (footsteps, alert sting, pickup chime, lure clink, door,
  win/lose jingles). No network requests, no external assets.
- **Structure** — one job per file under `game/src/`: `config.js`
  (tuning), `level.js` (maps, tiles, collision), `vision.js` (cones,
  line of sight), `guards.js` (sentry minds, lure), `player.js`
  (movement, hiding, pickup), `audio.js`, `input.js`, `render.js`,
  `shots.js` (staged screenshot scenes), `main.js` (loop and screens).
  `main.ts` pre-flights (missing files, screenshot and game caps) then
  copies `game/` + `screenshots/` and writes `dossier.json`.

## Revision rounds

1. **Round 1 — first build.** Wrote every file, then ran the full
   verifier (`node checks-v1/shoot-and-test.mjs`): **19/19 checks passed**
   on the first run — levels reachable, 4 screenshots, title/start,
   movement, vision reacting, caught, retry, exit/win, 0 console errors,
   0 external requests, two hand-in runs byte-identical, dossier matches
   a fresh `buildDossier`.
2. **Round 2 — visual review of the screenshots.** The renders showed a
   real defect: vision cones were plain wedges that shone *through* stone
   walls and crates (clearest in `2-patrol.png` and `4-exit.png`), which
   contradicts the sight rules and reads wrong to the judge. Fixed in
   `render.js` (second write to that file): cones are now a fan of 28
   rays, each clipped at the first solid tile, so walls and crates cut
   the cone short. Re-ran the verifier: **19/19 passed again**, and the
   re-taken patrol shot confirms cones now stop at walls.
3. **Round 3 — lure and simulation check.** The automated play-test does
   not exercise the lure, so I added `checks-v1/lure-check.mjs`: a lure
   near a sentry sends it to investigate, a lure far from every sentry
   draws nobody, and a 60-second patrol simulation on each level runs
   without exceptions with suspicion staying in range. **5/5 passed** —
   and the simulation confirms a player standing in the open is
   eventually spotted and caught on all three levels.

## Verification results

- `checks-v1/results.json`: 19/19 cases pass (final run after round 2).
  Screenshots 800x608, 32,907–39,796 bytes each (cap 256 KiB).
  Hand-in runs `checks-v1-a/` and `checks-v1-b/` byte-identical;
  `dossier.json` 231,225 bytes, equal to a fresh `buildDossier` run.
- `checks-v1/lure-check.mjs`: 5/5 pass.
- `game/` is 12 entries, 39,557 bytes (caps 993 entries / 48 MiB);
  `game/index.html` is 494 bytes (cap 1 MiB).

## Honest gaps

- No human has played all three galleries end to end; play-testing was
  headless and CDP-driven, covering level 1 flows programmatically
  (movement, vision, caught, retry, exit) plus logic simulations.
- The sounds are synthesized but were never listened to — headless
  Chrome has no audio output. The audio code is wrapped so a failure
  can never break the game.
- Difficulty balance (suspicion rates, patrol and chase speeds) is tuned
  by judgment, not by human playtesting.
- The lure's browser click wiring was verified through the logic check,
  not by a real mouse click in the play-test.
