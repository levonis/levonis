/**
 * Professional Tower Audio System
 * Layered sounds with reverb, filters, and musical progression
 */

class TowerAudioPro {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private ambientTimer: number | null = null;
  private ambientPlaying = false;
  private currentNote = 0;

  // Musical scales for progression
  private readonly PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
  private readonly CHORDS = [
    [261.63, 329.63, 392.00], // C
    [293.66, 369.99, 440.00], // D
    [329.63, 415.30, 493.88], // E
    [349.23, 440.00, 523.25], // F
    [392.00, 493.88, 587.33], // G
    [440.00, 554.37, 659.25], // A
  ];

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);
      this.createReverb();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getMaster(): GainNode {
    this.getCtx();
    return this.masterGain!;
  }

  private async createReverb() {
    if (!this.ctx) return;
    try {
      const convolver = this.ctx.createConvolver();
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 1.5;
      const impulse = this.ctx.createBuffer(2, length, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
        }
      }
      convolver.buffer = impulse;
      this.reverbNode = convolver;
      this.reverbNode.connect(this.getMaster());
    } catch {}
  }

  private connectWithReverb(node: AudioNode, dryAmount: number, wetAmount: number) {
    const ctx = this.getCtx();
    const dry = ctx.createGain();
    dry.gain.value = dryAmount;
    node.connect(dry).connect(this.getMaster());

    if (this.reverbNode) {
      const wet = ctx.createGain();
      wet.gain.value = wetAmount;
      node.connect(wet).connect(this.reverbNode);
    }
  }

  /**
   * Block placement sound - layered and musical
   */
  playPlace(perfect: boolean, combo: number) {
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      this.currentNote++;

      if (perfect) {
        this.playPerfectPlace(ctx, now, combo);
      } else {
        this.playNormalPlace(ctx, now);
      }
    } catch {}
  }

  private playNormalPlace(ctx: AudioContext, now: number) {
    // Layer 1: Impact thud (low)
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    const thudFilter = ctx.createBiquadFilter();
    thud.type = "sine";
    thud.frequency.setValueAtTime(120, now);
    thud.frequency.exponentialRampToValueAtTime(50, now + 0.12);
    thudFilter.type = "lowpass";
    thudFilter.frequency.setValueAtTime(300, now);
    thudGain.gain.setValueAtTime(0.15, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thud.connect(thudFilter).connect(thudGain);
    this.connectWithReverb(thudGain, 0.8, 0.2);
    thud.start(now);
    thud.stop(now + 0.25);

    // Layer 2: Click (high transient)
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "square";
    click.frequency.setValueAtTime(1800, now);
    click.frequency.exponentialRampToValueAtTime(600, now + 0.03);
    clickGain.gain.setValueAtTime(0.04, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    click.connect(clickGain);
    this.connectWithReverb(clickGain, 1, 0.15);
    click.start(now);
    click.stop(now + 0.06);

    // Layer 3: Musical note (pentatonic, ascending with tower)
    const noteFreq = this.PENTATONIC[this.currentNote % this.PENTATONIC.length];
    const note = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const noteFilter = ctx.createBiquadFilter();
    note.type = "triangle";
    note.frequency.setValueAtTime(noteFreq, now);
    noteFilter.type = "bandpass";
    noteFilter.frequency.setValueAtTime(noteFreq * 2, now);
    noteFilter.Q.setValueAtTime(2, now);
    noteGain.gain.setValueAtTime(0.06, now);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    note.connect(noteFilter).connect(noteGain);
    this.connectWithReverb(noteGain, 0.5, 0.5);
    note.start(now);
    note.stop(now + 0.35);
  }

  private playPerfectPlace(ctx: AudioContext, now: number, combo: number) {
    // Chord based on combo
    const chordIdx = Math.min(combo, this.CHORDS.length - 1);
    const chord = this.CHORDS[chordIdx];

    // Layer 1: Rich chord (with harmonics)
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * (combo >= 5 ? 2 : 1), now + i * 0.02);
      gain.gain.setValueAtTime(0.07, now + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      this.connectWithReverb(gain, 0.4, 0.6);
      osc.start(now + i * 0.02);
      osc.stop(now + 0.7);

      // Octave harmonic
      const harm = ctx.createOscillator();
      const hGain = ctx.createGain();
      harm.type = "sine";
      harm.frequency.setValueAtTime(freq * 2, now + i * 0.02);
      hGain.gain.setValueAtTime(0.03, now + i * 0.02);
      hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      harm.connect(hGain);
      this.connectWithReverb(hGain, 0.3, 0.7);
      harm.start(now + i * 0.02);
      harm.stop(now + 0.55);
    });

    // Layer 2: Sparkle sweep
    const sparkleCount = Math.min(3 + combo, 8);
    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = ctx.createOscillator();
      const sGain = ctx.createGain();
      sparkle.type = "sine";
      const startFreq = 2000 + Math.random() * 2000;
      const t = now + i * 0.04;
      sparkle.frequency.setValueAtTime(startFreq, t);
      sparkle.frequency.exponentialRampToValueAtTime(startFreq * 1.5, t + 0.08);
      sGain.gain.setValueAtTime(0.025, t);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      sparkle.connect(sGain);
      this.connectWithReverb(sGain, 0.3, 0.7);
      sparkle.start(t);
      sparkle.stop(t + 0.15);
    }

    // Layer 3: Deep resonant hit
    const hit = ctx.createOscillator();
    const hitGain = ctx.createGain();
    hit.type = "sine";
    hit.frequency.setValueAtTime(chord[0] * 0.5, now);
    hit.frequency.exponentialRampToValueAtTime(chord[0] * 0.25, now + 0.15);
    hitGain.gain.setValueAtTime(0.12, now);
    hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    hit.connect(hitGain);
    this.connectWithReverb(hitGain, 0.7, 0.3);
    hit.start(now);
    hit.stop(now + 0.3);

    // Layer 4: High combo celebration arpeggio
    if (combo >= 4) {
      const arpNotes = [chord[0] * 2, chord[1] * 2, chord[2] * 2, chord[0] * 4];
      arpNotes.forEach((freq, i) => {
        const arp = ctx.createOscillator();
        const aGain = ctx.createGain();
        arp.type = "sine";
        arp.frequency.setValueAtTime(freq, now + 0.1 + i * 0.06);
        aGain.gain.setValueAtTime(0.04, now + 0.1 + i * 0.06);
        aGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + i * 0.06);
        arp.connect(aGain);
        this.connectWithReverb(aGain, 0.2, 0.8);
        arp.start(now + 0.1 + i * 0.06);
        arp.stop(now + 0.4 + i * 0.06);
      });
    }
  }

  /**
   * Game over - dramatic descending sequence
   */
  playGameOver() {
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;

      // Layer 1: Deep impact boom
      const boom = ctx.createOscillator();
      const boomGain = ctx.createGain();
      const boomFilter = ctx.createBiquadFilter();
      boom.type = "sawtooth";
      boom.frequency.setValueAtTime(80, now);
      boom.frequency.exponentialRampToValueAtTime(20, now + 0.8);
      boomFilter.type = "lowpass";
      boomFilter.frequency.setValueAtTime(200, now);
      boomFilter.frequency.exponentialRampToValueAtTime(40, now + 0.8);
      boomGain.gain.setValueAtTime(0.2, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1);
      boom.connect(boomFilter).connect(boomGain);
      this.connectWithReverb(boomGain, 0.6, 0.4);
      boom.start(now);
      boom.stop(now + 1.1);

      // Layer 2: Descending minor chord (sad)
      const sadNotes = [392, 349.23, 311.13, 261.63, 233.08];
      sadNotes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const t = now + 0.2 + i * 0.18;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.5);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        this.connectWithReverb(gain, 0.3, 0.7);
        osc.start(t);
        osc.stop(t + 0.65);
      });

      // Layer 3: Crumble noise
      for (let i = 0; i < 5; i++) {
        const noise = ctx.createOscillator();
        const nGain = ctx.createGain();
        noise.type = "sawtooth";
        const t = now + 0.05 + i * 0.08;
        noise.frequency.setValueAtTime(300 + Math.random() * 500, t);
        noise.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        nGain.gain.setValueAtTime(0.03, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        noise.connect(nGain);
        this.connectWithReverb(nGain, 0.8, 0.2);
        noise.start(t);
        noise.stop(t + 0.15);
      }
    } catch {}
  }

  /**
   * Ambient music - evolving pad with gentle melody
   */
  startAmbient() {
    if (this.ambientPlaying) return;
    this.ambientPlaying = true;
    this.playAmbientLoop();
  }

  private playAmbientLoop() {
    if (!this.ambientPlaying) return;
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;

      // Warm pad chord
      const chordIdx = Math.floor(Math.random() * this.CHORDS.length);
      const chord = this.CHORDS[chordIdx];

      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * 0.25, now); // Low octave
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.linearRampToValueAtTime(300, now + 4);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.012, now + 1.5);
        gain.gain.linearRampToValueAtTime(0, now + 4);
        osc.connect(filter).connect(gain);
        this.connectWithReverb(gain, 0.2, 0.8);
        osc.start(now);
        osc.stop(now + 4.5);
      });

      // Subtle high melody note
      if (Math.random() > 0.4) {
        const melodyFreq = this.PENTATONIC[Math.floor(Math.random() * this.PENTATONIC.length)];
        const mel = ctx.createOscillator();
        const mGain = ctx.createGain();
        mel.type = "sine";
        mel.frequency.setValueAtTime(melodyFreq, now + 2);
        mGain.gain.setValueAtTime(0, now + 2);
        mGain.gain.linearRampToValueAtTime(0.008, now + 2.3);
        mGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
        mel.connect(mGain);
        this.connectWithReverb(mGain, 0.2, 0.8);
        mel.start(now + 2);
        mel.stop(now + 3.6);
      }

      this.ambientTimer = window.setTimeout(() => this.playAmbientLoop(), 3500);
    } catch {}
  }

  stopAmbient() {
    this.ambientPlaying = false;
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  resetNoteCounter() {
    this.currentNote = 0;
  }

  dispose() {
    this.stopAmbient();
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
  }
}

// Singleton
let instance: TowerAudioPro | null = null;

export function getTowerAudio(): TowerAudioPro {
  if (!instance) {
    instance = new TowerAudioPro();
  }
  return instance;
}

export function disposeTowerAudio() {
  instance?.dispose();
  instance = null;
}
