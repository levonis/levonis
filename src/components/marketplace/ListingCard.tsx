import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, Eye, MessageSquare, ShieldCheck } from 'lucide-react';
import { ListingDetailDialog } from './ListingDetailDialog';

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

          {/* Location & Views */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
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
