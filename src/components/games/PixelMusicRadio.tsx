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

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {expanded && (
        <div
          className="border-2 border-primary/30 bg-card/95 backdrop-blur-sm p-3 font-mono text-xs animate-scale-in"
          style={{
            imageRendering: "pixelated",
            boxShadow: "4px 4px 0 hsl(var(--accent) / 0.3)",
          }}
        >
          <div className="flex items-center justify-between mb-2 gap-3">
            <span className="text-primary font-bold text-[10px] tracking-wider">📻 RADIO</span>
            <button
              onClick={() => setIsOn(!isOn)}
              className={cn(
                "px-2 py-0.5 border font-bold text-[10px] transition-colors",
                isOn
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-red-500/20 border-red-500/40 text-red-400"
              )}
            >
              {isOn ? "ON" : "OFF"}
            </button>
          </div>

          {/* Stations */}
          <div className="flex gap-1 mb-2">
            {STATIONS.map((st, i) => (
              <button
                key={i}
                onClick={() => { setStation(i); if (isOn) startMusic(i); }}
                className={cn(
                  "flex-1 px-1 py-1 border text-[9px] font-bold transition-colors text-center leading-tight",
                  station === i
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-card border-border/40 text-muted-foreground hover:border-primary/20"
                )}
              >
                {st.name}
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <VolumeX className="h-3 w-3 text-muted-foreground" />
            <Slider
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
              max={100}
              step={5}
              className="flex-1"
            />
            <Volume2 className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "h-12 w-12 flex items-center justify-center border-2 transition-all",
          "bg-card/90 backdrop-blur-sm hover:border-primary/50",
          expanded ? "border-primary/40" : "border-border/40",
          isOn && "animate-pulse-glow"
        )}
        style={{ boxShadow: "3px 3px 0 hsl(var(--accent) / 0.2)", imageRendering: "pixelated" }}
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
