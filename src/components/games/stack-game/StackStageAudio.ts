import { useRef, useEffect, useCallback } from "react";
import { StageName } from "./StackEnvironment";

// Ambient sound system for each environment stage
class StageAudioSystem {
  private ctx: AudioContext | null = null;
  private activeNodes: AudioNode[] = [];
  private currentStage: StageName | null = null;
  private loopTimer: number | null = null;
  private isPlaying = false;

  private getCtx() {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private stopAll() {
    this.isPlaying = false;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.activeNodes.forEach((n) => {
      try {
        if (n instanceof OscillatorNode) n.stop();
        n.disconnect();
      } catch {}
    });
    this.activeNodes = [];
  }

  setStage(stage: StageName) {
    if (stage === this.currentStage) return;
    this.stopAll();
    this.currentStage = stage;
    this.isPlaying = true;
    this.playStageAmbient(stage);
  }

  private playStageAmbient(stage: StageName) {
    if (!this.isPlaying) return;
    try {
      const ctx = this.getCtx();

      switch (stage) {
        case "city":
          this.playCityAmbient(ctx);
          break;
        case "clouds":
          this.playCloudsAmbient(ctx);
          break;
        case "atmosphere":
          this.playAtmosphereAmbient(ctx);
          break;
        case "space":
        case "moon":
          this.playSpaceAmbient(ctx);
          break;
        case "jupiter":
        case "sun":
          this.playDeepSpaceAmbient(ctx);
          break;
        case "galaxy":
          this.playGalaxyAmbient(ctx);
          break;
      }
    } catch {}
  }

  // City: traffic hum + crowd murmur
  private playCityAmbient(ctx: AudioContext) {
    const loop = () => {
      if (!this.isPlaying || this.currentStage !== "city") return;
      const now = ctx.currentTime;

      // Low traffic rumble
      const noise = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      noise.type = "sawtooth";
      noise.frequency.setValueAtTime(55 + Math.random() * 20, now);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(200, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.015, now + 0.5);
      gain.gain.linearRampToValueAtTime(0, now + 3);
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 3.5);

      // Random honk
      if (Math.random() > 0.6) {
        const honk = ctx.createOscillator();
        const hGain = ctx.createGain();
        honk.type = "square";
        honk.frequency.setValueAtTime(300 + Math.random() * 200, now + 1);
        hGain.gain.setValueAtTime(0, now + 1);
        hGain.gain.linearRampToValueAtTime(0.008, now + 1.1);
        hGain.gain.linearRampToValueAtTime(0, now + 1.4);
        honk.connect(hGain).connect(ctx.destination);
        honk.start(now + 1);
        honk.stop(now + 1.5);
      }

      // Crowd murmur
      [180, 220, 260].forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq + Math.random() * 40, now);
        f.type = "bandpass";
        f.frequency.setValueAtTime(freq, now);
        f.Q.setValueAtTime(5, now);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.004, now + 0.8);
        g.gain.linearRampToValueAtTime(0, now + 2.5);
        osc.connect(f).connect(g).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 3);
      });

      this.loopTimer = window.setTimeout(loop, 2500);
    };
    loop();
  }

  // Clouds: wind + bird chirps
  private playCloudsAmbient(ctx: AudioContext) {
    const loop = () => {
      if (!this.isPlaying || this.currentStage !== "clouds") return;
      const now = ctx.currentTime;

      // Wind
      const wind = ctx.createOscillator();
      const wGain = ctx.createGain();
      const wFilter = ctx.createBiquadFilter();
      wind.type = "sawtooth";
      wind.frequency.setValueAtTime(80 + Math.random() * 30, now);
      wFilter.type = "lowpass";
      wFilter.frequency.setValueAtTime(300, now);
      wFilter.frequency.linearRampToValueAtTime(150, now + 3);
      wGain.gain.setValueAtTime(0, now);
      wGain.gain.linearRampToValueAtTime(0.012, now + 1);
      wGain.gain.linearRampToValueAtTime(0, now + 4);
      wind.connect(wFilter).connect(wGain).connect(ctx.destination);
      wind.start(now);
      wind.stop(now + 4.5);

      // Bird chirp
      if (Math.random() > 0.5) {
        const delay = Math.random() * 2;
        [1800, 2200, 1600].forEach((freq, i) => {
          const chirp = ctx.createOscillator();
          const cGain = ctx.createGain();
          chirp.type = "sine";
          chirp.frequency.setValueAtTime(freq, now + delay + i * 0.08);
          chirp.frequency.exponentialRampToValueAtTime(freq * 1.2, now + delay + i * 0.08 + 0.05);
          cGain.gain.setValueAtTime(0.006, now + delay + i * 0.08);
          cGain.gain.exponentialRampToValueAtTime(0.001, now + delay + i * 0.08 + 0.1);
          chirp.connect(cGain).connect(ctx.destination);
          chirp.start(now + delay + i * 0.08);
          chirp.stop(now + delay + i * 0.08 + 0.15);
        });
      }

      // Airplane hum (distant)
      if (Math.random() > 0.7) {
        const plane = ctx.createOscillator();
        const pGain = ctx.createGain();
        plane.type = "sawtooth";
        plane.frequency.setValueAtTime(120, now + 1);
        pGain.gain.setValueAtTime(0, now + 1);
        pGain.gain.linearRampToValueAtTime(0.005, now + 2);
        pGain.gain.linearRampToValueAtTime(0, now + 4);
        plane.connect(pGain).connect(ctx.destination);
        plane.start(now + 1);
        plane.stop(now + 4.5);
      }

      this.loopTimer = window.setTimeout(loop, 3000);
    };
    loop();
  }

  // Atmosphere: thin wind + radio static
  private playAtmosphereAmbient(ctx: AudioContext) {
    const loop = () => {
      if (!this.isPlaying || this.currentStage !== "atmosphere") return;
      const now = ctx.currentTime;

      // Thin whistling wind
      const wind = ctx.createOscillator();
      const wGain = ctx.createGain();
      const wFilter = ctx.createBiquadFilter();
      wind.type = "sine";
      wind.frequency.setValueAtTime(400 + Math.random() * 200, now);
      wind.frequency.linearRampToValueAtTime(300, now + 4);
      wFilter.type = "bandpass";
      wFilter.frequency.setValueAtTime(500, now);
      wFilter.Q.setValueAtTime(8, now);
      wGain.gain.setValueAtTime(0, now);
      wGain.gain.linearRampToValueAtTime(0.006, now + 1);
      wGain.gain.linearRampToValueAtTime(0, now + 4);
      wind.connect(wFilter).connect(wGain).connect(ctx.destination);
      wind.start(now);
      wind.stop(now + 4.5);

      // Radio beep
      if (Math.random() > 0.5) {
        const beep = ctx.createOscillator();
        const bGain = ctx.createGain();
        beep.type = "sine";
        beep.frequency.setValueAtTime(1200, now + 2);
        bGain.gain.setValueAtTime(0.004, now + 2);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 2.3);
        beep.connect(bGain).connect(ctx.destination);
        beep.start(now + 2);
        beep.stop(now + 2.4);
      }

      this.loopTimer = window.setTimeout(loop, 3500);
    };
    loop();
  }

  // Space: deep drone + silence
  private playSpaceAmbient(ctx: AudioContext) {
    const loop = () => {
      if (!this.isPlaying || (this.currentStage !== "space" && this.currentStage !== "moon")) return;
      const now = ctx.currentTime;

      // Deep space drone
      [40, 60, 80].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.008, now + 2);
        gain.gain.linearRampToValueAtTime(0, now + 5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 5.5);
      });

      // Occasional cosmic ping
      if (Math.random() > 0.6) {
        const ping = ctx.createOscillator();
        const pGain = ctx.createGain();
        ping.type = "sine";
        ping.frequency.setValueAtTime(800 + Math.random() * 600, now + 3);
        ping.frequency.exponentialRampToValueAtTime(200, now + 3.5);
        pGain.gain.setValueAtTime(0.005, now + 3);
        pGain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);
        ping.connect(pGain).connect(ctx.destination);
        ping.start(now + 3);
        ping.stop(now + 4);
      }

      this.loopTimer = window.setTimeout(loop, 4000);
    };
    loop();
  }

  // Jupiter/Sun: ominous rumble
  private playDeepSpaceAmbient(ctx: AudioContext) {
    const loop = () => {
      if (!this.isPlaying || (this.currentStage !== "jupiter" && this.currentStage !== "sun")) return;
      const now = ctx.currentTime;

      // Deep rumble
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(30, now);
      osc.frequency.linearRampToValueAtTime(25, now + 5);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(100, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.012, now + 2);
      gain.gain.linearRampToValueAtTime(0, now + 5);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 5.5);

      // Solar wind crackle (for sun)
      if (this.currentStage === "sun" && Math.random() > 0.4) {
        for (let i = 0; i < 3; i++) {
          const crackle = ctx.createOscillator();
          const cGain = ctx.createGain();
          crackle.type = "square";
          crackle.frequency.setValueAtTime(2000 + Math.random() * 3000, now + 1 + i * 0.3);
          cGain.gain.setValueAtTime(0.003, now + 1 + i * 0.3);
          cGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1 + i * 0.3);
          crackle.connect(cGain).connect(ctx.destination);
          crackle.start(now + 1 + i * 0.3);
          crackle.stop(now + 1.15 + i * 0.3);
        }
      }

      this.loopTimer = window.setTimeout(loop, 4500);
    };
    loop();
  }

  // Galaxy: ethereal choir pad
  private playGalaxyAmbient(ctx: AudioContext) {
    const loop = () => {
      if (!this.isPlaying || this.currentStage !== "galaxy") return;
      const now = ctx.currentTime;

      // Ethereal choir
      const chords = [
        [130.81, 164.81, 196.00, 261.63],
        [146.83, 174.61, 220.00, 293.66],
        [123.47, 155.56, 185.00, 246.94],
      ];
      const chord = chords[Math.floor(Math.random() * chords.length)];

      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.007, now + 2);
        gain.gain.linearRampToValueAtTime(0, now + 5);
        osc.connect(filter).connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 5.5);
      });

      // Cosmic shimmer
      const shimmer = ctx.createOscillator();
      const sGain = ctx.createGain();
      shimmer.type = "sine";
      shimmer.frequency.setValueAtTime(1500 + Math.random() * 500, now + 2);
      shimmer.frequency.exponentialRampToValueAtTime(800, now + 4);
      sGain.gain.setValueAtTime(0, now + 2);
      sGain.gain.linearRampToValueAtTime(0.003, now + 2.5);
      sGain.gain.linearRampToValueAtTime(0, now + 4);
      shimmer.connect(sGain).connect(ctx.destination);
      shimmer.start(now + 2);
      shimmer.stop(now + 4.5);

      this.loopTimer = window.setTimeout(loop, 4000);
    };
    loop();
  }

  dispose() {
    this.stopAll();
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }
}

// Hook for use in StackScene
export function useStageAudio() {
  const system = useRef<StageAudioSystem | null>(null);

  useEffect(() => {
    system.current = new StageAudioSystem();
    return () => {
      system.current?.dispose();
      system.current = null;
    };
  }, []);

  const setStage = useCallback((stage: StageName) => {
    system.current?.setStage(stage);
  }, []);

  return { setStage };
}
