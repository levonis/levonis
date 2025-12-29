import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  CheckCircle2,
  Receipt,
  Calendar,
  Heart,
  ThumbsUp,
  Share2,
  Copy,
  Check,
} from 'lucide-react';

// Format date in Arabic with time (Baghdad timezone UTC+3)
const formatArabicDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const baghdadOffset = 3 * 60;
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const baghdadDate = new Date(utc + (baghdadOffset * 60000));
  
  const day = baghdadDate.getDate().toString().padStart(2, '0');
  const month = (baghdadDate.getMonth() + 1).toString().padStart(2, '0');
  const year = baghdadDate.getFullYear();
  let hours = baghdadDate.getHours();
  const minutes = baghdadDate.getMinutes().toString().padStart(2, '0');
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
  const [copied, setCopied] = useState(false);
  const [buyFormData, setBuyFormData] = useState({
    shipping_address: '',
    phone_number: '',
  });

  const images = listing.images?.length ? listing.images : ['/placeholder.svg'];

  // Check if listing is in favorites
  const { data: isFavorite } = useQuery({
    queryKey: ['listing-favorite', listing.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('product_id', listing.id)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && open,
  });

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('product_id', listing.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ product_id: listing.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isFavorite ? 'تمت الإزالة من المفضلة' : 'تمت الإضافة للمفضلة');
      queryClient.invalidateQueries({ queryKey: ['listing-favorite', listing.id] });
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/marketplace?listing=${listing.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing.title_ar,
          text: `${listing.title_ar} - ${Number(listing.price).toLocaleString()} ${listing.currency}`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('تم نسخ الرابط');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startConversationMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const { data: existing } = await supabase
        .from('listing_conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', user.id)
        .single();
      
      if (existing) return existing;
      
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
    onError: (error: Error) => toast.error(error.message),
  });

  const createTransactionMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
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
    onError: (error: Error) => toast.error(error.message),
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
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="flex flex-col lg:flex-row">
            {/* Image Gallery - Smaller on large screens */}
            <div className="lg:w-2/5 bg-black relative">
              <div className="aspect-square relative overflow-hidden flex items-center justify-center">
                <img
                  src={images[currentImageIndex]}
                  alt={listing.title_ar}
                  className="max-w-full max-h-full object-contain"
                />
                
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 hover:bg-white transition-colors shadow-lg"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 hover:bg-white transition-colors shadow-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </div>
              
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-1.5 p-2 bg-muted/50 overflow-x-auto">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                        idx === currentImageIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="lg:w-3/5 p-4 space-y-4">
              {/* Action Icons Row */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleShare}
                  title="مشاركة"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                </Button>
                {user && !isOwnListing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 ${isFavorite ? 'text-red-500' : ''}`}
                    onClick={() => toggleFavoriteMutation.mutate()}
                    disabled={toggleFavoriteMutation.isPending}
                    title={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                  >
                    <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                  </Button>
                )}
              </div>

              {/* Title & Condition */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-lg font-bold leading-tight">{listing.title_ar}</h2>
                  <Badge className={`${condition.color} text-white flex-shrink-0 text-xs`}>
                    {condition.label}
                  </Badge>
                </div>
                
                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">
                    {Number(listing.price).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">{listing.currency}</span>
                </div>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-2 py-3 border-y border-border text-sm">
                {listing.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{listing.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{listing.views_count ?? 0} مشاهدة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {listing.shipping_method === 'through_site' ? (
                    <>
                      <Truck className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs">عن طريق الوسيط (+5 آلاف)</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-3.5 h-3.5 text-blue-500" />
                      <span>توصيل مباشر</span>
                    </>
                  )}
                </div>
                {listing.categories?.name_ar && (
                  <div className="text-muted-foreground text-xs">
                    القسم: {listing.categories.name_ar}
                  </div>
                )}
                {listing.created_at && (
                  <div className="flex items-center gap-1.5 col-span-2 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">الإضافة:</span>
                    <span>{formatArabicDateTime(listing.created_at)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {listing.description_ar && (
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-sm text-muted-foreground">الوصف</h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{listing.description_ar}</p>
                </div>
              )}

              {/* Seller Info */}
              {sellerProfile && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-base font-bold text-primary">
                      {sellerName?.charAt(0) || 'B'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{sellerName || 'بائع'}</span>
                        {sellerProfile.is_verified && (
                          <ShieldCheck className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
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
                <div className="space-y-3 pt-1">
                  {!showBuyForm ? (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 gap-2 h-10"
                        onClick={() => setShowBuyForm(true)}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        شراء الآن
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 h-10"
                        onClick={() => startConversationMutation.mutate()}
                        disabled={startConversationMutation.isPending}
                      >
                        {startConversationMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}
                        تواصل
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleBuy} className="space-y-3 bg-muted/50 rounded-lg p-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        معلومات الشحن
                      </h4>
                      <div className="space-y-1.5">
                        <Label className="text-xs">العنوان الكامل *</Label>
                        <Textarea
                          value={buyFormData.shipping_address}
                          onChange={(e) => setBuyFormData(prev => ({ ...prev, shipping_address: e.target.value }))}
                          placeholder="المحافظة، المنطقة، الشارع"
                          required
                          className="resize-none text-sm"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">رقم الهاتف *</Label>
                        <Input
                          type="tel"
                          value={buyFormData.phone_number}
                          onChange={(e) => setBuyFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                          placeholder="07xxxxxxxxx"
                          required
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1 h-9 text-sm" disabled={createTransactionMutation.isPending}>
                          {createTransactionMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'تأكيد الشراء'
                          )}
                        </Button>
                        <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setShowBuyForm(false)}>
                          إلغاء
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {!user && (
                <p className="text-center text-sm text-muted-foreground py-3 bg-muted/30 rounded-lg">
                  يجب تسجيل الدخول للشراء أو التواصل مع البائع
                </p>
              )}

              {isOwnListing && (
                <p className="text-center text-sm text-muted-foreground py-3 bg-muted/30 rounded-lg">
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
