import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Eye, ShieldCheck, Clock } from 'lucide-react';
import { ListingDetailDialog } from './ListingDetailDialog';

// Format relative time in Arabic (Baghdad timezone UTC+3)
const formatRelativeTime = (dateString: string): string => {
  // Get Baghdad time
  const baghdadOffset = 3 * 60 * 60 * 1000; // UTC+3
  const now = new Date();
  const nowBaghdad = new Date(now.getTime() + baghdadOffset + now.getTimezoneOffset() * 60 * 1000);
  const date = new Date(dateString);
  const dateBaghdad = new Date(date.getTime() + baghdadOffset + date.getTimezoneOffset() * 60 * 1000);
  
  const diffMs = nowBaghdad.getTime() - dateBaghdad.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) {
    return `منذ ${diffSeconds} ثانية`;
  } else if (diffMinutes < 60) {
    return `منذ ${diffMinutes} دقيقة`;
  } else if (diffHours < 24) {
    return `منذ ${diffHours} ساعة`;
  } else if (diffDays < 7) {
    return `منذ ${diffDays} يوم`;
  } else {
    return `منذ ${diffWeeks} أسبوع`;
  }
};

interface Listing {
  id: string;
  title_ar: string;
  price: number;
  currency: string;
  condition: string;
  images: string[] | null;
  location: string | null;
  views_count: number | null;
  seller_id: string;
  shipping_method: string;
  categories?: { name_ar: string } | null;
  created_at?: string;
}

interface SellerProfile {
  average_rating: number | null;
  completed_orders: number | null;
  is_verified: boolean | null;
}

interface ListingCardProps {
  listing: Listing;
  sellerProfile?: SellerProfile | null;
  sellerName?: string;
}

const conditionLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'جديد', color: 'bg-green-500 text-white' },
  like_new: { label: 'شبه جديد', color: 'bg-emerald-500 text-white' },
  excellent: { label: 'ممتاز', color: 'bg-blue-500 text-white' },
  good: { label: 'جيد', color: 'bg-yellow-500 text-white' },
  used: { label: 'مستعمل', color: 'bg-orange-500 text-white' },
  for_parts: { label: 'للقطع', color: 'bg-red-500 text-white' },
};

export const ListingCard = ({ listing, sellerProfile, sellerName }: ListingCardProps) => {
  const [showDetail, setShowDetail] = useState(false);
  const condition = conditionLabels[listing.condition] || conditionLabels.used;

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-xl transition-all cursor-pointer group"
      >
        {/* Image with overlay */}
        <div className="aspect-[4/3] relative overflow-hidden bg-muted">
          {listing.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title_ar}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
              <span className="text-sm">لا توجد صورة</span>
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Condition Badge */}
          <Badge className={`absolute top-2 right-2 ${condition.color} border-0 shadow-md text-[10px] px-2 py-0.5`}>
            {condition.label}
          </Badge>

          {/* Time Badge */}
          {listing.created_at && (
            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(listing.created_at)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <h3 className="font-semibold text-sm line-clamp-1">
            {listing.title_ar}
          </h3>

          {/* Price */}
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-primary text-lg">
              {Number(listing.price).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">{listing.currency}</span>
          </div>

          {/* Info Row */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
            <div className="flex items-center gap-2">
              {listing.location && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />
                  {listing.location}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <Eye className="w-3 h-3" />
                {listing.views_count ?? 0}
              </span>
              {sellerProfile && (
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                  {(sellerProfile.average_rating ?? 0).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <ListingDetailDialog
        listing={listing}
        sellerProfile={sellerProfile}
        sellerName={sellerName}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
    </>
  );
};

export default ListingCard;
