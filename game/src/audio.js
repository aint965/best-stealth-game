// Quiet Vault: every sound is synthesized with WebAudio in code — no audio
// files. The context is created on the first user gesture (a browser only
// lets sound start after one), and M mutes everything. Each sound is one
// small function, so a mute or a missing AudioContext can never break play.
export function createAudio() {
  let context = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (Ctor === undefined) return null;
      context = new Ctor();
      const len = Math.floor(context.sampleRate * 0.1);
      noiseBuffer = context.createBuffer(1, len, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      context = null;
    }
    return context;
  }

  /** A tone: frequency, seconds, shape, gain. `slideTo` glides the pitch. */
  function tone(freq, seconds, type = 'sine', gain = 0.08, slideTo = null, delay = 0) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + seconds);
      amp.gain.setValueAtTime(gain, t0);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + seconds + 0.02);
    } catch {
      // Sound is decoration: never let it stop the game.
    }
  }

  /** A short burst of filtered noise, for footsteps and the lure's clink. */
  function noise(seconds, gain, filterFreq) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || noiseBuffer === null) return;
    try {
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(gain, t0);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
      src.connect(filter);
      filter.connect(amp);
      amp.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + seconds + 0.02);
    } catch {
      // Sound is decoration: never let it stop the game.
    }
  }

  return {
    /** Call on the first key or click so the context may start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    footstep(sneaking) {
      noise(0.05, sneaking ? 0.02 : 0.05, sneaking ? 300 : 500);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.09);
      tone(880, 0.12, 'sine', 0.09, null, 0.08);
      tone(1320, 0.16, 'sine', 0.07, null, 0.16);
    },
    lureClink() {
      tone(2400, 0.07, 'triangle', 0.08);
      tone(1800, 0.1, 'triangle', 0.06, null, 0.05);
      noise(0.06, 0.04, 3000);
    },
    alert() {
      tone(220, 0.16, 'square', 0.06, 330);
      tone(330, 0.2, 'square', 0.06, 220, 0.14);
    },
    exitOpen() {
      tone(523, 0.12, 'sine', 0.08);
      tone(784, 0.2, 'sine', 0.08, null, 0.1);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.09, null, i * 0.12));
    },
    lose() {
      tone(392, 0.25, 'sawtooth', 0.05, 196);
      tone(196, 0.4, 'sawtooth', 0.05, 98, 0.22);
    },
  };
}
