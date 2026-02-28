import { Star } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ReviewSummaryProps {
  reviews: any[];
  totalCount: number;
}

export default function ReviewSummary({ reviews, totalCount }: ReviewSummaryProps) {
  const avg = totalCount > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalCount)
    : 0;

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  // Auto-generate tags from reviews
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
    count: reviews.filter((r) => r.comment && tag.match.test(r.comment)).length,
  })).filter((t) => t.count > 0);

  return (
    <div className="bg-card rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/50">
      <div className="flex items-start gap-5">
        {/* Big Rating */}
        <div className="text-center shrink-0">
          <div className="text-5xl font-black bg-gradient-to-b from-orange-500 to-orange-600 bg-clip-text text-transparent">
            {avg.toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-3.5 w-3.5 ${s <= Math.round(avg) ? 'fill-orange-400 text-orange-400' : 'text-muted-foreground/30'}`}
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
              <Star className="h-3 w-3 fill-orange-400 text-orange-400 shrink-0" />
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
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
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tags.map((tag) => (
            <button
              key={tag.label}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 transition whitespace-nowrap dark:bg-orange-500/10 dark:border-orange-500/20 dark:text-orange-400"
            >
              {tag.label} ({tag.count})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
