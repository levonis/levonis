import { memo, useId } from "react";
import { Link } from "react-router-dom";
import DirectSaleRibbon from "./ui/DirectSaleRibbon";

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
  mediaChromaKey?: 'none' | 'black' | 'white' | string | null;
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
  mediaChromaKey,
}: CategoryCardProps) => {
  const iconText = (icon ?? "").trim();
  const isLongIcon = iconText.length > 3;
  const showVideo = !!mediaUrl && (mediaType === "video" || (mediaType == null && isVideoUrl(mediaUrl)));
  const showImage = !!mediaUrl && !showVideo;
  const useFullMedia = !!mediaUrl && !!mediaTransparent;

  const filterId = useId().replace(/:/g, "");
  const chromaActive = mediaChromaKey === "black" || mediaChromaKey === "white";
  const filterStyle = chromaActive ? { filter: `url(#chroma-${filterId})` } : undefined;

  // SVG filter that converts a chosen color (black/white) to transparent.
  // Black-removal: alpha = max(R,G,B). White-removal: alpha = 1 - min(R,G,B).
  const chromaFilter = chromaActive ? (
    <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
      <defs>
        <filter id={`chroma-${filterId}`} x="0" y="0" width="1" height="1">
          {mediaChromaKey === "black" ? (
            <feColorMatrix
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                1 1 1 0 -0.15
              "
            />
          ) : (
            <feColorMatrix
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                -1 -1 -1 0 2.85
              "
            />
          )}
        </filter>
      </defs>
    </svg>
  ) : null;

  return (
    <Link
      to={`/category/${slug}`}
      className="group relative block rounded-2xl h-[160px] sm:h-[172px] p-3 sm:p-4 overflow-hidden
                 backdrop-blur-xl bg-card/40 border border-white/15
                 shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.15)]
                 hover:border-primary/55 hover:shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.35)]
                 hover:-translate-y-0.5 transition-all duration-300"
      aria-label={nameAr || name}
    >
      {chromaFilter}
      {hasDirectSale && <DirectSaleRibbon />}

      {useFullMedia && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          {showVideo ? (
            <video
              src={mediaUrl!}
              className="w-full h-full object-cover scale-[1.02]"
              style={filterStyle}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : showImage ? (
            <img
              src={mediaUrl!}
              alt=""
              className="w-full h-full object-cover scale-[1.02]"
              style={filterStyle}
              loading="lazy"
              draggable={false}
            />
          ) : null}
          {/* Subtle bottom fade for text legibility (skip when chroma so background card shows through) */}
          {!chromaActive && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, hsl(var(--background) / 0.12) 0%, hsl(var(--background) / 0.22) 40%, hsl(var(--background) / 0.58) 100%)",
              }}
            />
          )}
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
                ? { background: "transparent" }
                : {
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                    boxShadow: "0 6px 14px hsl(var(--primary) / 0.20)",
                    color: "hsl(var(--primary-foreground))",
                  }
            }
            aria-hidden="true"
          >
            {showVideo ? (
              <video
                src={mediaUrl!}
                className="w-full h-full object-cover"
                style={filterStyle}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : showImage ? (
              <img
                src={mediaUrl!}
                alt=""
                className="w-full h-full object-cover"
                style={filterStyle}
                loading="lazy"
                draggable={false}
              />
            ) : (
              <span
                className={
                  isLongIcon
                    ? "text-[10px] sm:text-[11px] font-extrabold leading-tight text-center px-1 line-clamp-2 break-all"
                    : "text-xl sm:text-2xl font-bold leading-none"
                }
              >
                {iconText}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <div className="w-full min-h-[36px] sm:min-h-[40px] flex items-start justify-center px-0.5 overflow-hidden">
          <h3 className="font-bold text-[12px] sm:text-[13px] text-foreground group-hover:text-primary transition-colors duration-200 text-center leading-snug line-clamp-2 break-words w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
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
