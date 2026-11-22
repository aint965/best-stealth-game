// Quiet Vault: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between six
// screens: title, play, paused, caught, level clear and win.
//
// ?shot=cover|patrol|alert|exit (with &seed=N, ignored: the scenes are
// posed, not random) stages that scene instead of running the loop, paints
// it twice and sets window.__shotReady for a screenshot.
//
// window.__game is the play-test handle: the current world and screen, so a
// headless driver can move the player, watch suspicion and confirm the win.
import { ACTION_CLICK, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RETRY, createInput } from './input.js';
import { EVENT_ALERT, EVENT_CAUGHT, EVENT_EXIT_OPEN, EVENT_LEVEL_CLEAR, EVENT_PICKUP, EVENT_WIN, createGame, nextLevel, stepWorld } from './game.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_LEVEL_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The simulation's fixed step, in seconds: 60 updates a second. */
const STEP = 1 / 60;
/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

// One session object, mutated in place, so window.__game always points at
// the world being played.
const session = { world: createGame(0), screen: SCREEN_TITLE };
window.__game = session;

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name);
  session.world = scene.world;
  session.screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(session.world, session.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  session.world.audio = audio;
  let accumulator = 0;
  let last = performance.now();

  function startLevel(index) {
    session.world = createGame(index);
    session.world.audio = audio;
    session.screen = SCREEN_PLAY;
    accumulator = 0;
    announce(`Level ${index + 1}. Find the three seed-cases, then leave unseen.`);
  }

  function handleActions() {
    const actions = input.takeScreenActions();
    if (actions === 0) return;
    audio.unlock();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (session.screen === SCREEN_TITLE && (actions & (ACTION_CONFIRM | ACTION_CLICK))) {
      startLevel(0);
    } else if (session.screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      session.screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (session.screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      session.screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (session.screen === SCREEN_CAUGHT && (actions & ACTION_RETRY)) {
      startLevel(session.world.levelIndex);
    } else if (session.screen === SCREEN_LEVEL_CLEAR && (actions & ACTION_CONFIRM)) {
      startLevel(session.world.levelIndex + 1);
    } else if (session.screen === SCREEN_WIN && (actions & ACTION_CONFIRM)) {
      startLevel(0);
    }
  }

  function step() {
    const events = stepWorld(session.world, input, STEP);
    if (events & EVENT_CAUGHT) {
      session.screen = SCREEN_CAUGHT;
      announce('Caught! Press R to retry the level.');
    } else if (events & EVENT_WIN) {
      session.screen = SCREEN_WIN;
      announce('All vaults cleared.');
    } else if (events & EVENT_LEVEL_CLEAR) {
      const cleared = session.world;
      session.world = nextLevel(cleared);
      session.world.audio = audio;
      session.screen = SCREEN_LEVEL_CLEAR;
      announce('Level clear. Press Enter for the next vault.');
    } else if (events & EVENT_PICKUP) {
      const got = session.world.objectives.filter((o) => o.taken).length;
      announce(`Seed-case ${got} of 3.`);
    } else if (events & EVENT_EXIT_OPEN) {
      announce('The service door is open. Leave unseen.');
    } else if (events & EVENT_ALERT) {
      announce('Alarm! Break line of sight and hide.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (session.screen === SCREEN_PLAY) {
      while (accumulator >= STEP && session.screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(session.world, session.screen);
  }

  // Leaving the tab pauses a running game rather than letting wardens walk unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session.screen === SCREEN_PLAY) {
      session.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Quiet Vault. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
