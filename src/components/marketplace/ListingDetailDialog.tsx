import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Clock,
  CheckCircle2,
  Receipt,
  Calendar,
} from 'lucide-react';

// Format date in Arabic with time
const formatArabicDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'مساءً' : 'صباحاً';
  hours = hours % 12 || 12;
  
  return `${year}-${month}-${day} ${hours}:${minutes} ${period}`;
};

interface Listing {
  id: string;
  title_ar: string;
  description_ar?: string | null;
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

interface ListingDetailDialogProps {
  listing: Listing;
  sellerProfile?: SellerProfile | null;
  sellerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const conditionLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'جديد', color: 'bg-green-500' },
  like_new: { label: 'شبه جديد', color: 'bg-emerald-500' },
  excellent: { label: 'ممتاز', color: 'bg-blue-500' },
  good: { label: 'جيد', color: 'bg-yellow-500' },
  used: { label: 'مستعمل', color: 'bg-orange-500' },
  needs_repair: { label: 'يحتاج صيانة', color: 'bg-red-500' },
};

const usageDurationLabels: Record<string, string> = {
  less_than_month: 'أقل من شهر',
  '1_3_months': '1-3 أشهر',
  '3_6_months': '3-6 أشهر',
  '6_12_months': '6-12 شهر',
  '1_2_years': '1-2 سنة',
  '2_3_years': '2-3 سنوات',
  more_than_3_years: 'أكثر من 3 سنوات',
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

  const images = listing.images?.length ? listing.images : ['/placeholder.svg'];

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
  const condition = conditionLabels[listing.condition] || conditionLabels.used;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] p-0 overflow-hidden">
        <ScrollArea className="h-[95vh]">
          <div className="flex flex-col lg:flex-row">
            {/* Image Gallery */}
            <div className="lg:w-1/2 bg-muted relative">
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={images[currentImageIndex]}
                  alt={listing.title_ar}
                  className="w-full h-full object-cover"
                />
                
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/90 rounded-full p-2 hover:bg-background transition-colors shadow-lg"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/90 rounded-full p-2 hover:bg-background transition-colors shadow-lg"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                        idx === currentImageIndex ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="lg:w-1/2 p-6 space-y-5">
              {/* Title & Condition */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-xl font-bold leading-tight">{listing.title_ar}</h2>
                  <Badge className={`${condition.color} text-white flex-shrink-0`}>
                    {condition.label}
                  </Badge>
                </div>
                
                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">
                    {Number(listing.price).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">{listing.currency}</span>
                </div>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-3 py-3 border-y border-border">
                {listing.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{listing.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span>{listing.views_count ?? 0} مشاهدة</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {listing.shipping_method === 'through_site' ? (
                    <>
                      <Truck className="w-4 h-4 text-green-500" />
                      <span>عن طريق الوسيط (عمولة 5 آلاف)</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 text-blue-500" />
                      <span>توصيل مباشر</span>
                    </>
                  )}
                </div>
                {listing.categories?.name_ar && (
                  <div className="text-sm text-muted-foreground">
                    القسم: {listing.categories.name_ar}
                  </div>
                )}
                {/* Date Added */}
                {listing.created_at && (
                  <div className="flex items-center gap-2 text-sm col-span-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">تاريخ الإضافة:</span>
                    <span>{formatArabicDateTime(listing.created_at)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {listing.description_ar && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">الوصف</h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{listing.description_ar}</p>
                </div>
              )}

              {/* Seller Info */}
              {sellerProfile && (
                <div className="bg-muted/50 rounded-xl p-4">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">البائع</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-lg font-bold text-primary">
                      {sellerName?.charAt(0) || 'B'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{sellerName || 'بائع'}</span>
                        {sellerProfile.is_verified && (
                          <ShieldCheck className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                          {(sellerProfile.average_rating ?? 0).toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {sellerProfile.completed_orders ?? 0} طلب
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {!isOwnListing && user && (
                <div className="space-y-3 pt-2">
                  {!showBuyForm ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        className="flex-1 gap-2 h-12 text-base"
                        onClick={() => setShowBuyForm(true)}
                      >
                        <ShoppingCart className="w-5 h-5" />
                        شراء الآن
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 h-12"
                        onClick={() => startConversationMutation.mutate()}
                        disabled={startConversationMutation.isPending}
                      >
                        {startConversationMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MessageSquare className="w-5 h-5" />
                        )}
                        تواصل مع البائع
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleBuy} className="space-y-4 bg-muted/50 rounded-xl p-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        معلومات الشحن
                      </h4>
                      <div className="space-y-2">
                        <Label>العنوان الكامل *</Label>
                        <Textarea
                          value={buyFormData.shipping_address}
                          onChange={(e) => setBuyFormData(prev => ({ ...prev, shipping_address: e.target.value }))}
                          placeholder="المحافظة، المنطقة، الشارع، أقرب نقطة دالة"
                          required
                          className="resize-none"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>رقم الهاتف *</Label>
                        <Input
                          type="tel"
                          value={buyFormData.phone_number}
                          onChange={(e) => setBuyFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                          placeholder="07xxxxxxxxx"
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1 h-11" disabled={createTransactionMutation.isPending}>
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
                <p className="text-center text-muted-foreground py-4 bg-muted/30 rounded-lg">
                  يجب تسجيل الدخول للشراء أو التواصل مع البائع
                </p>
              )}

              {isOwnListing && (
                <p className="text-center text-muted-foreground py-4 bg-muted/30 rounded-lg">
                  هذا منتجك
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ListingDetailDialog;
