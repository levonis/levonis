import { useState, useRef, useCallback, useEffect } from "react";
import { Volume2, VolumeX, Radio, Music } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Station = { name: string; notes: number[]; tempo: number; wave: OscillatorType };

const STATIONS: Station[] = [
  { name: "هادئ 🌙", notes: [262, 294, 330, 349, 330, 294, 262, 247], tempo: 320, wave: "triangle" },
  { name: "مغامرة ⚔️", notes: [330, 392, 440, 523, 440, 392, 330, 262], tempo: 200, wave: "square" },
  { name: "تشيبتون 🎵", notes: [523, 494, 440, 392, 349, 330, 294, 262], tempo: 160, wave: "square" },
];

export default function PixelMusicRadio() {
  const [isOn, setIsOn] = useState(false);
  const [station, setStation] = useState(0);
  const [volume, setVolume] = useState(30);
  const [expanded, setExpanded] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noteIndexRef = useRef(0);
  const gainRef = useRef<GainNode | null>(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
      gainRef.current = audioCtxRef.current.createGain();
      gainRef.current.connect(audioCtxRef.current.destination);
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const stopMusic = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startMusic = useCallback((stIdx: number) => {
    stopMusic();
    const ctx = getCtx();
    const st = STATIONS[stIdx];
    noteIndexRef.current = 0;

    if (gainRef.current) {
      gainRef.current.gain.setValueAtTime(volume / 400, ctx.currentTime);
    }

    intervalRef.current = setInterval(() => {
      try {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = st.wave;
        const freq = st.notes[noteIndexRef.current % st.notes.length];
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        const dur = st.tempo / 1000;
        noteGain.gain.setValueAtTime(volume / 400, ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur * 0.9);
        osc.connect(noteGain).connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
        noteIndexRef.current++;
      } catch {}
    }, STATIONS[stIdx].tempo);
  }, [volume, getCtx, stopMusic]);

  useEffect(() => {
    if (isOn) startMusic(station);
    else stopMusic();
    return stopMusic;
  }, [isOn, station, startMusic, stopMusic]);

  useEffect(() => {
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setValueAtTime(volume / 400, audioCtxRef.current.currentTime);
    }
  }, [volume]);

  useEffect(() => () => {
    stopMusic();
    audioCtxRef.current?.close();
  }, [stopMusic]);

  /* Pixel volume bar segments */
  const volSegments = 8;
  const volFilled = Math.round((volume / 100) * volSegments);

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {expanded && (
        <div className="pixel-frame p-3 font-mono text-xs animate-scale-in w-56">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-primary font-bold text-[10px] tracking-wider">📻 RADIO</span>
            <button
              onClick={() => setIsOn(!isOn)}
              className={cn("pixel-btn px-2 py-0.5 text-[10px] font-bold", isOn && "pixel-btn-active")}
            >
              {isOn ? "ON ●" : "OFF ○"}
            </button>
          </div>

          {/* Stations */}
          <div className="flex gap-1 mb-3">
            {STATIONS.map((st, i) => (
              <button
                key={i}
                onClick={() => { setStation(i); if (isOn) startMusic(i); }}
                className={cn(
                  "flex-1 py-1.5 text-[8px] font-bold transition-colors text-center leading-tight",
                  station === i ? "pixel-btn-active" : "pixel-btn"
                )}
              >
                {st.name}
              </button>
            ))}
          </div>

          {/* Volume - pixel scroll bar style */}
          <div className="flex items-center gap-2">
            <VolumeX className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="pixel-frame-inset flex-1 p-[2px]">
              <div className="flex gap-[1px] h-2.5">
                {Array.from({ length: volSegments }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setVolume(Math.round(((i + 1) / volSegments) * 100))}
                    className="flex-1 transition-all duration-100 hover:brightness-125"
                    style={{
                      background: i < volFilled ? "hsl(var(--primary))" : "hsl(var(--card))",
                      boxShadow: i < volFilled
                        ? "inset 0 -1px 0 hsl(var(--accent)), inset 0 1px 0 rgba(255,255,255,0.15)"
                        : "inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  />
                ))}
              </div>
            </div>
            <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
          </div>
        </div>
      )}

      {/* Toggle button - pixel style */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "h-12 w-12 flex items-center justify-center transition-all pixel-frame",
          isOn && "pixel-frame-active"
        )}
      >
        {isOn ? (
          <Music className="h-5 w-5 text-primary" />
        ) : (
          <Radio className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
