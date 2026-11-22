[![Make.fun competition](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/aint965/best-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/aint965/best-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

# Starlight Archive

A top-down stealth game for the [make.fun best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759).

Wren, junior archivist of a mountaintop observatory archive, must recover
three star charts from each gallery and slip out through the moon door —
unseen by the night sentries. Sentries patrol with lantern-lit vision
cones; step into a cone and suspicion rises, the cone turning amber, then
red. Break line of sight and the alarm cools back to a search, then to
calm — detection is always recoverable. Crates and walls block sight,
shadow alcoves shrink how far a sentry can spot you, sneaking moves slowly
and quietly, and a thrown lure draws a sentry away to investigate.

Three galleries, rising difficulty: the Reading Room (2 sentries), the Map
Gallery (3 sentries, tighter patrols), and the Vault of Charts (4 sentries,
sparse cover). Every gallery has a title screen, HUD (charts, alarm meter,
timer, level), pause, caught screen with retry, and a win screen.

## How to play

Serve `game/` with any static server (`node serve.ts`) and open
`game/index.html` in a desktop browser. No network is needed; all art is
drawn in Canvas 2D and all sounds are synthesized with WebAudio.

- **WASD / arrows** — move
- **Shift** — sneak (slower, quieter, harder to spot)
- **E** — take a star chart when standing close to one
- **Click** — throw a lure that draws a nearby sentry to that spot
- **P** — pause, **M** — mute, **R** — retry after being caught, **Enter** — confirm

The moon door stays locked until every chart in the gallery is taken, then
it glows gold. Reach it unseen to clear the gallery.

## Hand-in

`main.ts` (Node 22, standard library only) pre-flights the entry — it
fails loudly when `game/index.html`, `screenshots/` or any screenshot
listed in `shots.json` is missing, or when a screenshot or `game/` breaks
its size cap — then copies `game/` and `screenshots/` to the output
directory and writes `dossier.json` with the kit's `buildDossier`.
Verification lives in `checks-v1/` (run `node checks-v1/shoot-and-test.mjs`
from the repo root); its results are in `checks-v1/results.json`, and the
build story — including every revision round — is in
`best-stealth-build-report.md`.
