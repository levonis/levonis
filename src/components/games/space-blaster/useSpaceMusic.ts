import { useRef, useCallback } from 'react';

/** Stranger-Things-style C-minor synth loop */
export function useSpaceMusic() {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number>(0);
  const playingRef = useRef(false);

  const startMusic = useCallback(() => {
    if (playingRef.current) return;
    playingRef.current = true;
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.06;
      master.connect(ctx.destination);
      gainRef.current = master;

      // C minor arpeggio notes (Hz)
      const notes = [130.81, 155.56, 196.0, 233.08, 261.63, 233.08, 196.0, 155.56];
      let step = 0;

      const playNote = () => {
        if (!playingRef.current || !ctxRef.current) return;
        const c = ctxRef.current;
        const freq = notes[step % notes.length];

        // Main osc
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.12, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
        osc.connect(g).connect(master);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.45);

        // Sub bass
        const sub = c.createOscillator();
        const sg = c.createGain();
        sub.type = 'sine';
        sub.frequency.value = freq / 2;
        sg.gain.setValueAtTime(0.08, c.currentTime);
        sg.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
        sub.connect(sg).connect(master);
        sub.start(c.currentTime);
        sub.stop(c.currentTime + 0.55);

        step++;
      };

      playNote();
      intervalRef.current = window.setInterval(playNote, 350);
    } catch {}
  }, []);

  const stopMusic = useCallback(() => {
    playingRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (gainRef.current) {
      try { gainRef.current.gain.setValueAtTime(0, gainRef.current.context.currentTime); } catch {}
    }
    if (ctxRef.current) {
      try { ctxRef.current.close(); } catch {}
      ctxRef.current = null;
    }
  }, []);

  return { startMusic, stopMusic };
}
