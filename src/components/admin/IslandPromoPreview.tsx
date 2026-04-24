import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface IslandPromoPreviewProps {
  messages: string[];
  color: string;
  speed: number;
  direction: 'left' | 'right';
  gap: number;
  autoRotate?: boolean;
  displayDuration?: number;
}

/**
 * Live preview of the news ticker inside the Dynamic Island.
 * All texts share the same (global) animation settings.
 */
export default function IslandPromoPreview({
  messages,
  color,
  speed,
  direction,
  gap,
  autoRotate = true,
  displayDuration = 5,
}: IslandPromoPreviewProps) {
  const cleanMessages = useMemo(
    () => messages.map((m) => m?.trim()).filter(Boolean) as string[],
    [messages],
  );
  const list = cleanMessages.length > 0 ? cleanMessages : ['نص الإعلان'];
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 20;
  const safeGap = Number.isFinite(gap) && gap >= 0 ? gap : 16;

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (list.length <= 1 || !autoRotate) {
      setIndex(0);
      return;
    }
    const ms = Math.max(2, displayDuration) * 1000;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [list.length, autoRotate, displayDuration]);

  const activeText = list[index] ?? list[0];
  const marqueeItems = useMemo(
    () => Array.from({ length: 6 }, () => activeText),
    [activeText],
  );

  return (
    <div
      className="island-surface relative flex items-center gap-2 overflow-hidden px-3"
      style={{
        width: 280,
        height: 40,
        borderRadius: 22,
        boxShadow: `0 0 24px ${color}33, 0 8px 24px hsl(0 0% 0% / 0.25)`,
      }}
    >
      <span
        className="pointer-events-none inline-flex shrink-0 items-center justify-center rounded-full p-0.5"
        style={{ color }}
        aria-hidden
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)',
          maskImage:
            'linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)',
        }}
      >
        <div
          key={`preview-${index}`}
          dir="ltr"
          data-direction={direction === 'right' ? 'right' : 'left'}
          className="marquee-track text-[12px] font-medium tracking-tight text-foreground/85"
          style={{
            ['--marquee-duration' as any]: `${Math.max(4, safeSpeed)}s`,
            ['--marquee-gap' as any]: `${safeGap}px`,
          }}
        >
          {[0, 1].map((group) => (
            <div key={group} className="marquee-group" aria-hidden={group === 1}>
              {marqueeItems.map((m, i) => (
                <span key={`${group}-${i}`} className="inline-flex items-center gap-3">
                  <span dir="auto" className="text-foreground/90">{m}</span>
                  <span aria-hidden="true" style={{ color }} className="opacity-70">•</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
