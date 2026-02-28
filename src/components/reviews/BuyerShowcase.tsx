import { useState } from 'react';
import { Camera } from 'lucide-react';
import ReviewImageViewer from './ReviewImageViewer';

interface BuyerShowcaseProps {
  reviews: any[];
}

export default function BuyerShowcase({ reviews }: BuyerShowcaseProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const allMedia: { url: string; reviewId: string }[] = [];
  reviews.forEach((r) => {
    (r.media_files || []).forEach((url: string) => allMedia.push({ url, reviewId: r.id }));
    if (r.video_url) allMedia.push({ url: r.video_url, reviewId: r.id });
  });

  if (allMedia.length === 0) return null;

  const urls = allMedia.map((m) => m.url);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
      <div className="absolute -top-8 -left-8 w-20 h-20 bg-primary/8 rounded-full blur-2xl pointer-events-none" />
      <div className="relative flex items-center gap-2 mb-3">
        <Camera className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">معرض صور المشترين ({allMedia.length})</h3>
      </div>
      <div className="relative flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {allMedia.slice(0, 20).map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              setViewerIndex(idx);
              setViewerOpen(true);
            }}
            className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-background/50 group border border-border/20"
          >
            {/\.(mp4|webm|mov)$/i.test(item.url) ? (
              <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
            ) : (
              <img
                src={item.url}
                alt=""
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>

      <ReviewImageViewer
        images={urls.slice(0, 20)}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  );
}
