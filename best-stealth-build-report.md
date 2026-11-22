# Quiet Vault — build report

A top-down stealth game built for the best-stealth-game-20261121-1759
bounty, @aint965. The kit starter (Block Dodger, a dodge-and-collect game)
was replaced entirely: every game file, main.ts, the LICENSE, the README
and the screenshots were written fresh in this session. The starter's
random.js and world.js were deleted.

## What was built

**Quiet Vault.** A courier sneaks through a seed vault after hours, takes
three heritage seed-cases per level, then slips out the service door
unseen. Three levels (Seed Hall, Cold Rooms, Deep Vault) with rising
difficulty: more wardens, tighter patrols, less cover.

- Wardens patrol waypoints with pauses, and their vision cones react:
  suspicion rises while the courier is inside a cone with line of sight,
  the warden investigates the last-seen spot at 60, chases at 100, and
  gives up to a search, then calm, when sight is broken. No instant
  unavoidable loss.
- Cover: walls and crates block line of sight; shadow patches halve how
  fast suspicion rises; Shift sneaks slowly and quietly.
- Depth: 3 levels, a title screen, HUD (objectives, suspicion, timer,
  lures), win screen, caught screen with retry, pause, and a mouse lure
  (click throws a clink that draws a nearby warden to a point).
- All art is Canvas 2D in code; all sounds are synthesized WebAudio in
  code (footsteps, alert sting, pickup chime, lure clink, win/lose
  jingles). No audio files, no network.
- Source split by job: config, level, vision, guards, player, audio,
  input, render, shots, main. main.ts is written from scratch with a
  pre-flight check (fails loudly when a required input is missing) and a
  run summary.

## Revision rounds

1. **Write round.** The whole game, main.ts, LICENSE, README and
   shots.json written. While writing, I caught the input design flaw
   before any test: the loop consumed the one-shot action flags before
   stepWorld could see E, and a click set CONFIRM so a lure thrown
   mid-play could skip a later screen. Fixed by splitting the flags
   (takeScreenActions / takeInteract) and making a click its own action.
2. **Play-test round 1.** The game module failed to load: game.js
   imported `levelCount` from config.js, where it does not live (it is
   in level.js). All four screenshots came out blank and window.__game
   was undefined. Fixed the import; re-test passed.
3. **Play-test round 2.** Two real defects. (a) The patrol and exit
   screenshots were blank: stageShot posed levels 2 and 3 on a level-1
   world, so guards[2]/guards[3] were undefined and the staging threw.
   Fixed by having stageShot build the right level for each scene.
   (b) Suspicion rose too slowly — 0 to 1.4 in 3 seconds in a cone, so
   an alarm would take about a minute at point blank and the cones felt
   toothless. Raised SUSPICION_RISE from 1.7 to 9; re-test showed 0 to
   10.4 in 3 seconds.
4. **Visual round.** Viewing the cover shot showed the HUD word
   "SNEAKING" colliding with "Lures 3" at the top right. Removed the
   word (the ring around the courier already shows sneaking) and
   re-ran all checks.

## Verification (checks-v1/shoot-and-test.mjs, all 19 cases pass)

- Levels: every objective and exit reachable from the player start
  (BFS), every patrol waypoint on an open tile, all 3 levels.
- Server: game/ served on localhost, loads.
- Screenshots: 4 PNGs, 800x608, 26–30 KiB each, all real renders of the
  game (distinct bytes), first by name is the cover.
- Play-test (headless browser, CDP): title screen shows; Enter starts;
  holding D moves the courier (x 80 → 228); standing in a warden's cone
  raises suspicion (0.0 → 10.4); a chasing warden touching the courier
  shows the caught screen; R retries; all cases taken + door open +
  courier on the door shows level clear; 0 console errors; 0 external
  (non-localhost) requests.
- Hand-in: main.ts run twice into checks-v1-a/ and checks-v1-b/ —
  byte-identical outputs, and dossier.json equals a fresh buildDossier
  run byte-for-byte.

## Honest gaps

- The full three-level playthrough was not played end to end by hand:
  only level 1's exit flow was driven in the test; levels 2 and 3 were
  verified by BFS reachability, not by playing.
- The lure mechanic is implemented but was not exercised in the
  play-test (only movement, vision, caught, retry and exit were driven).
- The sounds were synthesized and the code paths ran without errors,
  but no one listened to them (headless has no audio out).
- The build was done in this parent session, not in an opencode session,
  because the Xingchi provider has been down since ~01:13 WIB. The
  bundle's transcript gate has not been proven for a parent-side build;
  the bundle and check below are the test of that.
