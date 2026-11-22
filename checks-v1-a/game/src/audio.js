// Starlight Archive — every sound is synthesized with WebAudio.
// No audio files: footsteps, the alert sting, the pickup chime, the lure
// clink and the win/lose jingles are all oscillators shaped in code.
// The context is created lazily on the first gesture, so loading the page
// never makes a sound and headless runs never touch audio.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
    } catch {
      return false;
    }
    return true;
  }

  resume() {
    if (this.ensure() && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  tone(freq, at, dur, type = 'sine', gain = 0.12, slideTo = null) {
    if (this.muted || !this.ensure()) return;
    try {
      const t0 = this.ctx.currentTime + at;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      amp.gain.setValueAtTime(0, t0);
      amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(amp);
      amp.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Audio is decoration; a failure must never break the game.
    }
  }

  footstep(sneaking) {
    this.tone(sneaking ? 70 : 95, 0, 0.07, 'triangle', sneaking ? 0.03 : 0.06, 55);
  }

  alertSting() {
    this.tone(660, 0, 0.14, 'square', 0.07);
    this.tone(880, 0.12, 0.2, 'square', 0.07);
  }

  pickup() {
    this.tone(523, 0, 0.12, 'sine', 0.1);
    this.tone(659, 0.08, 0.12, 'sine', 0.1);
    this.tone(784, 0.16, 0.2, 'sine', 0.1);
  }

  lureClink() {
    this.tone(1800, 0, 0.1, 'sine', 0.08);
    this.tone(2400, 0.05, 0.14, 'sine', 0.06);
  }

  doorOpen() {
    this.tone(180, 0, 0.5, 'sine', 0.1, 360);
    this.tone(90, 0.1, 0.5, 'triangle', 0.08, 140);
  }

  winJingle() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.12, 0.22, 'sine', 0.11));
  }

  loseJingle() {
    [400, 320, 220].forEach((f, i) => this.tone(f, i * 0.14, 0.24, 'sawtooth', 0.05));
  }
}
