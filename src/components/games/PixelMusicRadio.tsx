import { useState, useRef, useCallback, useEffect } from "react";
import { Volume2, VolumeX, Radio, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Station = { id: string; name_ar: string; file_url: string };

// Fallback procedural stations when no uploaded music exists
const FALLBACK_STATIONS = [
  { id: "f1", name_ar: "أركيد 👾", notes: [523, 587, 659, 784, 659, 587, 523, 440, 392, 440, 523, 587], tempo: 180, wave: "square" as OscillatorType },
  { id: "f2", name_ar: "فضاء 🚀", notes: [130.81, 155.56, 196, 233.08, 261.63, 233.08, 196, 155.56], tempo: 350, wave: "square" as OscillatorType },
  { id: "f3", name_ar: "بوس ⚔️", notes: [196, 233, 262, 294, 330, 294, 262, 196, 165, 196, 220, 262], tempo: 160, wave: "square" as OscillatorType },
  { id: "f4", name_ar: "ريترو 🎮", notes: [440, 494, 523, 587, 659, 587, 523, 494, 440, 392, 349, 392], tempo: 200, wave: "triangle" as OscillatorType },
];

export default function PixelMusicRadio() {
  const [isOn, setIsOn] = useState(false);
  const [stationIdx, setStationIdx] = useState(0);
  const [volume, setVolume] = useState(30);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fallback procedural audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noteIndexRef = useRef(0);
  const gainRef = useRef<GainNode | null>(null);

  // Fetch uploaded stations
  const { data: uploadedStations } = useQuery({
    queryKey: ["game-music-radio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_music_stations")
        .select("id, name_ar, file_url")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Station[];
    },
  });

  const hasUploaded = uploadedStations && uploadedStations.length > 0;
  const stations = hasUploaded ? uploadedStations : FALLBACK_STATIONS;
  const currentStation = stations[stationIdx % stations.length];

  // --- Uploaded music playback ---
  const playUploaded = useCallback((station: Station) => {
    stopAll();
    const audio = new Audio(station.file_url);
    audio.volume = volume / 100;
    audio.loop = true;
    audio.play().catch(() => {});
    audioRef.current = audio;
  }, [volume]);

  // --- Fallback procedural playback ---
  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
      gainRef.current = audioCtxRef.current.createGain();
      gainRef.current.connect(audioCtxRef.current.destination);
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const stopProcedural = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    // Stop uploaded audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Stop procedural
    stopProcedural();
  }, [stopProcedural]);

  const playProcedural = useCallback((fallbackIdx: number) => {
    stopAll();
    const ctx = getCtx();
    const fb = FALLBACK_STATIONS[fallbackIdx % FALLBACK_STATIONS.length];
    noteIndexRef.current = 0;

    intervalRef.current = setInterval(() => {
      try {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = fb.wave;
        const freq = fb.notes[noteIndexRef.current % fb.notes.length];
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        const dur = fb.tempo / 1000;
        noteGain.gain.setValueAtTime(volume / 400, ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur * 0.9);
        osc.connect(noteGain).connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
        noteIndexRef.current++;
      } catch {}
    }, fb.tempo);
  }, [volume, getCtx, stopAll]);

  // Play/stop based on isOn and station
  useEffect(() => {
    if (!isOn) {
      stopAll();
      return;
    }
    if (hasUploaded) {
      playUploaded(uploadedStations[stationIdx % uploadedStations.length]);
    } else {
      playProcedural(stationIdx);
    }
    return stopAll;
  }, [isOn, stationIdx, hasUploaded, uploadedStations, playUploaded, playProcedural, stopAll]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setValueAtTime(volume / 400, audioCtxRef.current.currentTime);
    }
  }, [volume]);

  // Cleanup
  useEffect(() => () => {
    stopAll();
    audioCtxRef.current?.close();
  }, [stopAll]);

  const volSegments = 8;
  const volFilled = Math.round((volume / 100) * volSegments);

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-2">
      {expanded && (
        <div className="pixel-frame p-3 font-mono text-xs animate-scale-in w-56">
          <div className="flex items-center justify-between mb-3">
            <span className="text-primary font-bold text-[10px] tracking-wider">📻 RADIO</span>
            <button
              onClick={() => setIsOn(!isOn)}
              className={cn("pixel-btn px-2 py-0.5 text-[10px] font-bold", isOn && "pixel-btn-active")}
            >
              {isOn ? "ON ●" : "OFF ○"}
            </button>
          </div>

          <div className="flex gap-1 mb-3 flex-wrap">
            {stations.map((st, i) => (
              <button
                key={st.id}
                onClick={() => { setStationIdx(i); }}
                className={cn(
                  "flex-1 min-w-0 py-1.5 text-[8px] font-bold transition-colors text-center leading-tight truncate px-1",
                  stationIdx === i ? "pixel-btn-active" : "pixel-btn"
                )}
              >
                {st.name_ar}
              </button>
            ))}
          </div>

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
