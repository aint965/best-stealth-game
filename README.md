[![Make.fun competition](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/aint965/best-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/aint965/best-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

[best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759)

# Quiet Vault

A top-down stealth game in a seed vault, after hours. You are the courier:
three heritage seed-cases sit behind patrolling wardens. Take them all, then
slip out the service door — unseen.

## How to play

- **Move** with WASD or the arrow keys. **Shift** sneaks: slower, quieter,
  harder to spot.
- **E** picks up a seed-case when you stand next to one. The service door
  stays locked until all three are in hand, then it glows gold and opens.
- **Click** throws a lure at that point (3 per level). A warden nearby hears
  the clink and walks over to look — use it to clear a patrol lane.
- **Walls and crates** block a warden's sight. **Shadow patches** (dark
  green floor) halve how fast suspicion rises while you stand in one.
- A warden's **vision cone** changes colour as suspicion rises: pale when
  calm, orange when suspicious, red on the alarm. Suspicion decays when you
  are hidden, so breaking line of sight and hiding drops the alarm back to
  a search, then to calm. There is never an instant unavoidable loss — but
  a chasing warden that touches you ends the run.
- **P** pauses, **M** mutes, **R** retries a level after being caught.
- Three levels, rising difficulty: more wardens, tighter patrols, less
  cover. The timer runs from the first step.

## The game

Static files under `game/` — no build step, no network. Open
`game/index.html` in a desktop browser (or `node serve.ts`, then
http://localhost:8080). All art is drawn in Canvas 2D and all sounds are
synthesized with WebAudio in code.

The source is split by job: `src/config.js` (tuning), `src/level.js`
(the three levels), `src/vision.js` (line of sight and cones),
`src/guards.js` (the wardens' patrol/investigate/chase/search), `src/player.js`
(movement, pickup, lure), `src/audio.js` (synthesized sounds),
`src/input.js` (keyboard and mouse), `src/render.js` (drawing and HUD),
`src/shots.js` (the staged screenshot scenes), `src/main.js` (boot and loop).

## Hand-in note

`main.ts` (Node 22, standard library only) runs its own pre-flight check
— game/index.html present, screenshots present and within their caps,
game/ within its file and byte caps — then copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` with the
vendored make.fun library, and prints a run summary. Run it with
`MAKEFUN_OUTPUT_DIR=out node main.ts`.
