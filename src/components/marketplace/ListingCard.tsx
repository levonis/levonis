import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, Eye, MessageSquare, ShieldCheck, Clock } from 'lucide-react';
import { ListingDetailDialog } from './ListingDetailDialog';

// Format relative time in Arabic
const formatRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
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
  new: { label: 'جديد', color: 'bg-green-500/20 text-green-600' },
  like_new: { label: 'شبه جديد', color: 'bg-blue-500/20 text-blue-600' },
  good: { label: 'جيد', color: 'bg-yellow-500/20 text-yellow-600' },
  used: { label: 'مستعمل', color: 'bg-orange-500/20 text-orange-600' },
  for_parts: { label: 'للقطع', color: 'bg-red-500/20 text-red-600' },
};

export const ListingCard = ({ listing, sellerProfile, sellerName }: ListingCardProps) => {
  const [showDetail, setShowDetail] = useState(false);
  const condition = conditionLabels[listing.condition] || conditionLabels.used;

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group"
      >
        {/* Image */}
        <div className="aspect-square relative overflow-hidden bg-muted">
          {listing.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title_ar}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              لا توجد صورة
            </div>
          )}
          
          {/* Condition Badge */}
          <Badge className={`absolute top-2 right-2 ${condition.color} border-0`}>
            {condition.label}
          </Badge>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
            {listing.title_ar}
          </h3>

          <div className="flex items-center justify-between">
            <span className="font-bold text-primary text-lg">
              {Number(listing.price).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">{listing.currency}</span>
          </div>

          {/* Seller Info */}
          {sellerProfile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              {sellerProfile.is_verified && (
                <ShieldCheck className="w-3 h-3 text-green-500" />
              )}
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                <span>{(sellerProfile.average_rating ?? 0).toFixed(1)}</span>
              </div>
              <span>•</span>
              <span>{sellerProfile.completed_orders ?? 0} طلب مكتمل</span>
            </div>
          )}

          {/* Location, Views & Time */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {listing.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {listing.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {listing.views_count ?? 0}
              </span>
            </div>
            {listing.created_at && (
              <span className="flex items-center gap-1 text-[10px]">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(listing.created_at)}
              </span>
            )}
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
