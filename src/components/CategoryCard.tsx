import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DirectSaleRibbon from "./ui/DirectSaleRibbon";
import { resizeSupabaseImage } from "@/lib/imageUtils";
import { shouldSkipHeavyMedia, isLowEndDevice, isMobileViewport } from "@/lib/networkQuality";

interface CategoryCardProps {
  name: string;
  nameAr: string;
  slug: string;
  icon: string;
  description?: string;
  descriptionAr?: string;
  hasDirectSale?: boolean;
  mediaUrl?: string | null;
  mediaType?: string | null; // 'image' | 'gif' | 'video'
  mediaTransparent?: boolean;
}

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url);

const CategoryCard = ({
  name,
  nameAr,
  slug,
  icon,
  description,
  descriptionAr,
  hasDirectSale,
  mediaUrl,
  mediaType,
  mediaTransparent,
}: CategoryCardProps) => {
  const iconText = (icon ?? "").trim();
  const isLongIcon = iconText.length > 3;
  const showVideo = !!mediaUrl && (mediaType === "video" || (mediaType == null && isVideoUrl(mediaUrl)));
  const showImage = !!mediaUrl && !showVideo;
  const useFullMedia = !!mediaUrl && !!mediaTransparent;
  const optimizedImageSrc = useMemo(
    () => (showImage ? resizeSupabaseImage(mediaUrl!, useFullMedia ? 400 : 200, 70) || mediaUrl! : mediaUrl),
    [mediaUrl, showImage, useFullMedia]
  );

  const linkRef = useRef<HTMLAnchorElement>(null);
  const [inView, setInView] = useState(false);
  // Defer video activation: image/poster appears first, real <video> mounts only
  // after the card has been in viewport for ~1.2s. Saves 3-10 MB of autoplaying
  // category videos from the LCP critical path.
  const [activateVideo, setActivateVideo] = useState(false);
  // Poster derived from the video's first frame via Supabase image render endpoint.
  // For non-supabase URLs we fall back to no poster (still better than autoplay).
  const videoPoster = useMemo(() => {
    if (!showVideo || !mediaUrl) return undefined;
    return resizeSupabaseImage(mediaUrl, useFullMedia ? 400 : 200, 60) || undefined;
  }, [showVideo, mediaUrl, useFullMedia]);

  useEffect(() => {
    if (!mediaUrl) return;
    const el = linkRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: "200px", threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mediaUrl]);

  useEffect(() => {
    if (!inView || !showVideo || activateVideo) return;
    // Skip video only on Data Saver / 2G connections (keep on mobile by default).
    if (shouldSkipHeavyMedia()) return;
    const idle = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 1200));
    const cancel = (window as any).cancelIdleCallback || clearTimeout;
    const id = idle(() => setActivateVideo(true), { timeout: 2500 });
    return () => cancel(id);
  }, [inView, showVideo, activateVideo]);

  return (
    <Link
      ref={linkRef}
      to={`/category/${slug}`}
      className="group relative block rounded-2xl h-[160px] sm:h-[172px] p-3 sm:p-4 overflow-hidden
                 backdrop-blur-xl bg-card/40 border border-white/15
                 shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.15)]
                 hover:border-primary/55 hover:shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.35)]
                 hover:-translate-y-0.5 transition-all duration-300"
      aria-label={[nameAr || name, descriptionAr || description].filter(Boolean).join(' — ')}
    >
      {hasDirectSale && <DirectSaleRibbon />}

      {useFullMedia && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          {inView && showVideo && activateVideo ? (
            <video
              src={mediaUrl!}
              poster={videoPoster}
              className="w-full h-full object-cover scale-[1.02]"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
            />
          ) : inView && showVideo && videoPoster ? (
            <img
              src={videoPoster}
              alt=""
              className="w-full h-full object-cover scale-[1.02]"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ) : inView && showImage ? (
            <img
              src={optimizedImageSrc!}
              alt=""
              className="w-full h-full object-cover scale-[1.02]"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ) : null}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--background) / 0.12) 0%, hsl(var(--background) / 0.22) 40%, hsl(var(--background) / 0.58) 100%)",
            }}
          />
        </div>
      )}

      {/* Glass sheen */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)/0.10) 0%, transparent 45%, hsl(var(--accent)/0.10) 100%)",
        }}
      />
      <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary/15 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10 flex flex-col items-center h-full">
        {/* Media / Icon */}
        {!useFullMedia && (
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mb-2 flex items-center justify-center shrink-0
                       overflow-hidden border border-white/20 backdrop-blur-md
                       group-hover:scale-105 transition-transform duration-300"
            style={
              showVideo || showImage
                ? { background: "hsl(var(--muted) / 0.3)" }
                : {
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                    boxShadow: "0 6px 14px hsl(var(--primary) / 0.20)",
                    color: "hsl(var(--primary-foreground))",
                  }
            }
            aria-hidden="true"
          >
            {inView && showVideo && activateVideo ? (
              <video
                src={mediaUrl!}
                poster={videoPoster}
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="none"
              />
            ) : inView && showVideo && videoPoster ? (
              <img
                src={videoPoster}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : inView && showImage ? (
              <img
                src={optimizedImageSrc!}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : !showVideo && !showImage ? (
              <span
                className={
                  isLongIcon
                    ? "text-[10px] sm:text-[11px] font-extrabold leading-tight text-center px-1 line-clamp-2 break-all"
                    : "text-xl sm:text-2xl font-bold leading-none"
                }
              >
                {iconText}
              </span>
            ) : null}
          </div>
        )}

        {/* Title */}
        <div className="w-full min-h-[36px] sm:min-h-[40px] flex items-start justify-center px-0.5 overflow-hidden">
          <h3 className="font-bold text-[12px] sm:text-[13px] text-foreground group-hover:text-primary transition-colors duration-200 text-center leading-snug line-clamp-2 break-words w-full">
            {nameAr}
          </h3>
        </div>

        {/* Description */}
        <div className="w-full flex-1 flex items-start justify-center px-0.5 overflow-hidden">
          {descriptionAr ? (
            <p className="text-[10px] sm:text-[11px] font-medium text-foreground/75 text-center leading-relaxed line-clamp-2 break-words w-full">
              {descriptionAr}
            </p>
          ) : (
            <p className="text-[10px] sm:text-[11px] text-foreground/0 select-none">{description || "_"}</p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default memo(CategoryCard);
