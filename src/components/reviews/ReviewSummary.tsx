import { Star } from 'lucide-react';

interface ReviewSummaryProps {
  reviews: any[];
  totalCount: number;
}

export default function ReviewSummary({ reviews, totalCount }: ReviewSummaryProps) {
  const avg = totalCount > 0
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalCount)
    : 0;

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r: any) => r.rating === star).length,
  }));

  const tagKeywords = [
    { label: 'جودة ممتازة', match: /(جود|ممتاز|رائع|جيد)/i },
    { label: 'سعر مناسب', match: /(سعر|رخيص|مناسب|قيمة)/i },
    { label: 'توصيل سريع', match: /(توصيل|سريع|وصل)/i },
    { label: 'طباعة نظيفة', match: /(طباع|نظيف|واضح|دقيق)/i },
    { label: 'مادة قوية', match: /(قوي|متين|صلب|مادة)/i },
    { label: 'ألوان جميلة', match: /(لون|ألوان|جميل)/i },
  ];

  const tags = tagKeywords.map((tag) => ({
    ...tag,
    count: reviews.filter((r: any) => r.comment && tag.match.test(r.comment)).length,
  })).filter((t) => t.count > 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
      {/* Glow effects */}
      <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-accent/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex items-start gap-5">
        {/* Big Rating */}
        <div className="text-center shrink-0">
          <div className="text-5xl font-black bg-gradient-to-b from-primary-glow to-primary bg-clip-text text-transparent drop-shadow-sm">
            {avg.toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-3.5 w-3.5 ${s <= Math.round(avg) ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            {totalCount > 999 ? `${(totalCount / 1000).toFixed(1)}k+` : totalCount} تقييم
          </p>
        </div>

        {/* Distribution Bars */}
        <div className="flex-1 space-y-1.5">
          {distribution.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4 text-center font-medium">{star}</span>
              <Star className="h-3 w-3 fill-primary text-primary shrink-0" />
              <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary-glow rounded-full transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? (count / totalCount) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground w-6 text-left">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="relative mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tags.map((tag) => (
            <button
              key={tag.label}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition whitespace-nowrap backdrop-blur-sm"
            >
              {tag.label} ({tag.count})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
