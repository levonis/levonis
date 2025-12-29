import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Star,
  MapPin,
  Eye,
  MessageSquare,
  ShieldCheck,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Truck,
  Package,
  Loader2,
} from 'lucide-react';

interface Listing {
  id: string;
  title_ar: string;
  description_ar?: string | null;
  price: number;
  currency: string;
  condition: string;
  images: string[];
  location: string | null;
  views_count: number;
  seller_id: string;
  shipping_method: string;
  categories?: { name_ar: string } | null;
}

interface SellerProfile {
  average_rating: number;
  completed_orders: number;
  is_verified: boolean;
}

interface ListingDetailDialogProps {
  listing: Listing;
  sellerProfile?: SellerProfile | null;
  sellerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const conditionLabels: Record<string, string> = {
  new: 'جديد',
  like_new: 'شبه جديد',
  good: 'جيد',
  used: 'مستعمل',
  for_parts: 'للقطع',
};

export const ListingDetailDialog = ({
  listing,
  sellerProfile,
  sellerName,
  open,
  onOpenChange,
}: ListingDetailDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [buyFormData, setBuyFormData] = useState({
    shipping_address: '',
    phone_number: '',
  });

  const images = listing.images?.length > 0 ? listing.images : ['/placeholder.svg'];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const startConversationMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('listing_conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', user.id)
        .single();
      
      if (existing) {
        return existing;
      }
      
      const { data, error } = await supabase
        .from('listing_conversations')
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.seller_id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تم بدء المحادثة مع البائع');
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      // Calculate platform fee (we'll fetch settings)
      const { data: feeSettings } = await supabase
        .from('listing_fees_settings')
        .select('*')
        .eq('is_active', true)
        .single();
      
      let platformFee = 0;
      if (feeSettings) {
        if (feeSettings.fee_type === 'percentage') {
          platformFee = (Number(listing.price) * Number(feeSettings.fee_value)) / 100;
          if (feeSettings.min_fee && platformFee < Number(feeSettings.min_fee)) {
            platformFee = Number(feeSettings.min_fee);
          }
          if (feeSettings.max_fee && platformFee > Number(feeSettings.max_fee)) {
            platformFee = Number(feeSettings.max_fee);
          }
        } else {
          platformFee = Number(feeSettings.fee_value);
        }
      }
      
      const { data, error } = await supabase
        .from('listing_transactions')
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.seller_id,
          amount: listing.price,
          platform_fee: platformFee,
          seller_amount: Number(listing.price) - platformFee,
          shipping_method: listing.shipping_method,
          shipping_address: buyFormData.shipping_address,
          phone_number: buyFormData.phone_number,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تم إنشاء طلب الشراء بنجاح');
      setShowBuyForm(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['listing-transactions'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleBuy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyFormData.shipping_address || !buyFormData.phone_number) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    createTransactionMutation.mutate();
  };

  const isOwnListing = user?.id === listing.seller_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Image Gallery */}
        <div className="relative aspect-video bg-muted">
          <img
            src={images[currentImageIndex]}
            alt={listing.title_ar}
            className="w-full h-full object-contain"
          />
          
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 hover:bg-background transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 hover:bg-background transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentImageIndex ? 'bg-primary' : 'bg-background/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">{listing.title_ar}</DialogTitle>
          </DialogHeader>

          {/* Price & Condition */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-3xl font-bold text-primary">
                {Number(listing.price).toLocaleString()}
              </span>
              <span className="text-muted-foreground mr-2">{listing.currency}</span>
            </div>
            <Badge variant="secondary">{conditionLabels[listing.condition]}</Badge>
          </div>

          {/* Description */}
          {listing.description_ar && (
            <p className="text-muted-foreground">{listing.description_ar}</p>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {listing.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {listing.location}
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="w-4 h-4" />
              {listing.views_count} مشاهدة
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {listing.shipping_method === 'through_site' ? (
                <>
                  <Truck className="w-4 h-4" />
                  شحن عبر الموقع
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  توصيل مباشر
                </>
              )}
            </div>
            {listing.categories?.name_ar && (
              <div className="text-muted-foreground">
                القسم: {listing.categories.name_ar}
              </div>
            )}
          </div>

          {/* Seller Info */}
          {sellerProfile && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    {sellerName?.charAt(0) || 'B'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{sellerName || 'بائع'}</span>
                      {sellerProfile.is_verified && (
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      <span>{sellerProfile.average_rating.toFixed(1)}</span>
                      <span>•</span>
                      <span>{sellerProfile.completed_orders} طلب مكتمل</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isOwnListing && user && (
            <div className="space-y-3">
              {!showBuyForm ? (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => setShowBuyForm(true)}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    شراء الآن
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => startConversationMutation.mutate()}
                    disabled={startConversationMutation.isPending}
                  >
                    <MessageSquare className="w-4 h-4" />
                    تواصل مع البائع
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleBuy} className="space-y-3 bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold">معلومات الشحن</h4>
                  <div className="space-y-2">
                    <Label>العنوان الكامل</Label>
                    <Textarea
                      value={buyFormData.shipping_address}
                      onChange={(e) => setBuyFormData(prev => ({ ...prev, shipping_address: e.target.value }))}
                      placeholder="المحافظة، المنطقة، الشارع، أقرب نقطة دالة"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input
                      type="tel"
                      value={buyFormData.phone_number}
                      onChange={(e) => setBuyFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="07xxxxxxxxx"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={createTransactionMutation.isPending}>
                      {createTransactionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'تأكيد الشراء'
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowBuyForm(false)}>
                      إلغاء
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {!user && (
            <p className="text-center text-muted-foreground">
              يجب تسجيل الدخول للشراء أو التواصل مع البائع
            </p>
          )}

          {isOwnListing && (
            <p className="text-center text-muted-foreground">
              هذا منتجك
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ListingDetailDialog;
