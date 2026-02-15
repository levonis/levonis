import { useState, useRef, useEffect, useCallback, TouchEvent as ReactTouchEvent } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Video {
  id: string;
  video_url: string;
  duration_seconds: number | null;
  display_order: number;
  created_at: string;
}

interface Section {
  id: string;
  title_ar: string;
  thumbnail_url: string | null;
  videos: Video[];
}

interface StoryViewerProps {
  sections: Section[];
  initialSectionIndex: number;
  onClose: () => void;
}

export default function StoryViewer({ sections, initialSectionIndex, onClose }: StoryViewerProps) {
  const [sectionIdx, setSectionIdx] = useState(initialSectionIndex);
  const [videoIdx, setVideoIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimer = useRef<number | null>(null);
  const touchStartX = useRef(0);
  const longPressTimer = useRef<number | null>(null);

  const currentSection = sections[sectionIdx];
  const currentVideos = currentSection?.videos || [];
  const currentVideo = currentVideos[videoIdx];

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const goNext = useCallback(() => {
    if (videoIdx < currentVideos.length - 1) {
      setVideoIdx((p) => p + 1);
      setProgress(0);
    } else if (sectionIdx < sections.length - 1) {
      setSectionIdx((p) => p + 1);
      setVideoIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [videoIdx, currentVideos.length, sectionIdx, sections.length, onClose]);

  const goPrev = useCallback(() => {
    if (videoIdx > 0) {
      setVideoIdx((p) => p - 1);
      setProgress(0);
    } else if (sectionIdx > 0) {
      setSectionIdx((p) => p - 1);
      const prevSection = sections[sectionIdx - 1];
      setVideoIdx(prevSection.videos.length - 1);
      setProgress(0);
    }
  }, [videoIdx, sectionIdx, sections]);

  // Play video when it changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !currentVideo) return;

    v.currentTime = 0;
    v.muted = isMuted;
    v.play().catch(() => {});

    const handleEnded = () => goNext();
    v.addEventListener('ended', handleEnded);

    return () => {
      v.removeEventListener('ended', handleEnded);
    };
  }, [currentVideo?.id, sectionIdx, videoIdx, goNext]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Progress bar
  useEffect(() => {
    if (progressTimer.current) cancelAnimationFrame(progressTimer.current);
    if (isPaused) return;

    const tick = () => {
      const v = videoRef.current;
      if (v && v.duration) {
        setProgress((v.currentTime / v.duration) * 100);
      }
      progressTimer.current = requestAnimationFrame(tick);
    };
    progressTimer.current = requestAnimationFrame(tick);

    return () => {
      if (progressTimer.current) cancelAnimationFrame(progressTimer.current);
    };
  }, [currentVideo?.id, isPaused]);

  // Pause/resume on long press
  const handlePauseStart = useCallback(() => {
    longPressTimer.current = window.setTimeout(() => {
      setIsPaused(true);
      videoRef.current?.pause();
    }, 200);
  }, []);

  const handlePauseEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (isPaused) {
      setIsPaused(false);
      videoRef.current?.play().catch(() => {});
    }
  }, [isPaused]);

  // Swipe handling
  const handleTouchStart = (e: ReactTouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    handlePauseStart();
  };

  const handleTouchEnd = (e: ReactTouchEvent) => {
    handlePauseEnd();
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      // RTL: swipe left = next, swipe right = prev (reversed for RTL)
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (!currentVideo) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" dir="ltr">
      {/* Video container - 9:16 locked */}
      <div
        className="relative w-full h-full max-w-[calc(100dvh*9/16)] bg-black"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handlePauseStart}
        onMouseUp={handlePauseEnd}
        onMouseLeave={handlePauseEnd}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-50 flex gap-1 px-3 pt-3" style={{ direction: 'ltr' }}>
          {currentVideos.map((v, i) => (
            <div key={v.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: i < videoIdx ? '100%' : i === videoIdx ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-50 flex items-center justify-between px-4" style={{ direction: 'rtl' }}>
          <div className="flex items-center gap-2">
            {/* Section thumbnail */}
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30 bg-muted flex-shrink-0">
              {currentSection.thumbnail_url ? (
                <img src={currentSection.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                  {currentSection.title_ar.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-white text-sm font-semibold">{currentSection.title_ar}</span>
              <span className="text-white/60 text-[10px]">
                {format(new Date(currentVideo.created_at), 'dd MMM yyyy', { locale: ar })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Video */}
        <video
          ref={videoRef}
          src={currentVideo.video_url}
          className="w-full h-full object-contain"
          playsInline
          muted={isMuted}
          preload="auto"
        />

        {/* Tap areas for navigation */}
        <div className="absolute inset-0 z-40 flex" style={{ direction: 'ltr' }}>
          <div className="w-1/3 h-full" onClick={goPrev} />
          <div className="w-1/3 h-full" />
          <div className="w-1/3 h-full" onClick={goNext} />
        </div>

        {/* Pause indicator */}
        {isPaused && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <div className="flex gap-1.5">
                <div className="w-2 h-6 bg-white rounded-sm" />
                <div className="w-2 h-6 bg-white rounded-sm" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
