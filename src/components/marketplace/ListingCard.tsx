import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Eye, Clock } from 'lucide-react';
import { ListingDetailDialog } from './ListingDetailDialog';

// Format relative time in Arabic (Baghdad timezone UTC+3)
const formatRelativeTime = (dateString: string): string => {
  const baghdadOffset = 3 * 60 * 60 * 1000;
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
    return `منذ ${diffSeconds} ث`;
  } else if (diffMinutes < 60) {
    return `منذ ${diffMinutes} د`;
  } else if (diffHours < 24) {
    return `منذ ${diffHours} س`;
  } else if (diffDays < 7) {
    return `منذ ${diffDays} ي`;
  } else {
    return `منذ ${diffWeeks} أ`;
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
        {/* Square Image */}
        <div className="aspect-square relative overflow-hidden bg-muted">
          {listing.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title_ar}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
              <span className="text-sm">لا توجد صورة</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-2.5 space-y-1.5">
          {/* Title */}
          <h3 className="font-medium text-sm line-clamp-1">
            {listing.title_ar}
          </h3>

          {/* Price & Condition */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-primary text-base">
                {Number(listing.price).toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">{listing.currency}</span>
            </div>
            <Badge className={`${condition.color} border-0 text-[9px] px-1.5 py-0`}>
              {condition.label}
            </Badge>
          </div>

          {/* Info Row */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              {listing.location && (
                <span className="flex items-center gap-0.5 truncate max-w-[60px]">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  {listing.location}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" />
                {listing.views_count ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {sellerProfile && (
                <span className="flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
                  {(sellerProfile.average_rating ?? 0).toFixed(1)}
                </span>
              )}
              {listing.created_at && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatRelativeTime(listing.created_at)}
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
