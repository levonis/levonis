import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
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
  X,
  ExternalLink,
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
  likes_count?: number | null;
  seller_id: string;
  shipping_method: string;
  categories?: { name_ar: string } | null;
  created_at?: string;
  approved_at?: string | null;
}

interface SellerProfile {
  average_rating: number | null;
  completed_orders: number | null;
  is_verified: boolean | null;
  phone_number?: string | null;
}

interface ListingDetailDialogProps {
  listing: Listing;
  sellerProfile?: SellerProfile | null;
  sellerName?: string;
  sellerPhone?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const conditionLabels: Record<string, { label: string; bgClass: string }> = {
  new: { label: 'جديد', bgClass: 'bg-emerald-600' },
  like_new: { label: 'شبه جديد', bgClass: 'bg-teal-600' },
  excellent: { label: 'ممتاز', bgClass: 'bg-blue-600' },
  good: { label: 'جيد', bgClass: 'bg-amber-600' },
  used: { label: 'مستعمل', bgClass: 'bg-orange-600' },
  needs_repair: { label: 'يحتاج صيانة', bgClass: 'bg-red-600' },
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
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [buyFormData, setBuyFormData] = useState({
    shipping_address: '',
    phone_number: '',
    payment_method: '' as 'through_site' | 'direct' | '',
  });

  // Fetch user addresses
  const { data: userAddresses } = useQuery({
    queryKey: ['user-addresses-buy', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && open && showBuyForm,
  });

  // Set default address when addresses are loaded
  useEffect(() => {
    if (userAddresses?.length && !selectedAddressId) {
      const defaultAddr = userAddresses.find(a => a.is_default) || userAddresses[0];
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        const fullAddress = `${defaultAddr.governorate} - ${defaultAddr.area}${defaultAddr.neighborhood ? ` - ${defaultAddr.neighborhood}` : ''} - ${defaultAddr.nearest_landmark}${defaultAddr.additional_notes ? ` - ${defaultAddr.additional_notes}` : ''}`;
        setBuyFormData(prev => ({
          ...prev,
          shipping_address: fullAddress,
          phone_number: defaultAddr.phone_number,
        }));
      }
    }
  }, [userAddresses, selectedAddressId]);

  // Increment views count when dialog opens (throttled to once per 10 minutes per user)
  useEffect(() => {
    if (!open || !listing.id) return;

    const THROTTLE_MS = 10 * 60 * 1000;

    const record = async () => {
      try {
        // Logged-in users: backend throttling (per-user)
        if (user) {
          const { error } = await supabase.rpc('record_listing_view', {
            p_listing_id: listing.id,
          });
          if (error) throw error;
        } else {
          // Guests: simple local throttling
          const key = `listing:view:${listing.id}`;
          const last = Number(localStorage.getItem(key) || 0);
          if (!last || Date.now() - last > THROTTLE_MS) {
            await supabase
              .from('user_listings')
              .update({ views_count: (listing.views_count || 0) + 1 })
              .eq('id', listing.id);
            localStorage.setItem(key, String(Date.now()));
          }
        }

        queryClient.invalidateQueries({ queryKey: ['approved-listings'] });
      } catch {
        // ignore
      }
    };

    record();
  }, [open, listing.id, user?.id]);

  const images = listing.images?.length ? listing.images : ['/placeholder.svg'];

  // Check if listing is in favorites
  const { data: isFavorite } = useQuery({
    queryKey: ['listing-favorite', listing.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('listing_favorites')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && open,
  });

  // Check if user liked the listing
  const { data: isLiked } = useQuery({
    queryKey: ['listing-like', listing.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('listing_likes')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && open,
  });

  // Get likes count
  const { data: likesCount } = useQuery({
    queryKey: ['listing-likes-count', listing.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('listing_likes')
        .select('id', { count: 'exact', head: true })
        .eq('listing_id', listing.id);
      return count || 0;
    },
    enabled: open,
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
          .from('listing_favorites')
          .delete()
          .eq('listing_id', listing.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('listing_favorites')
          .insert({ listing_id: listing.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isFavorite ? 'تمت الإزالة من المفضلة' : 'تمت الإضافة للمفضلة');
      queryClient.invalidateQueries({ queryKey: ['listing-favorite', listing.id] });
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      if (isLiked) {
        const { error } = await supabase
          .from('listing_likes')
          .delete()
          .eq('listing_id', listing.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('listing_likes')
          .insert({ listing_id: listing.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-like', listing.id] });
      queryClient.invalidateQueries({ queryKey: ['listing-likes-count', listing.id] });
      queryClient.invalidateQueries({ queryKey: ['approved-listings'] });
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/marketplace/${listing.id}`;
    
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
      toast.success('تم نسخ الرابط');
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
      onOpenChange(false);
      navigate(`/marketplace?openChat=true&conversationId=${data.id}`);
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
      
      // Calculate actual amount based on payment method
      const isThroughSite = buyFormData.payment_method === 'through_site';
      const finalAmount = isThroughSite ? Number(listing.price) + 5000 : Number(listing.price);
      const finalPlatformFee = isThroughSite ? 5000 : 0;
      
      const { data: transaction, error: txError } = await supabase
        .from('listing_transactions')
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.seller_id,
          amount: finalAmount,
          platform_fee: finalPlatformFee,
          seller_amount: Number(listing.price),
          shipping_method: buyFormData.payment_method || 'direct',
          shipping_address: buyFormData.shipping_address,
          phone_number: buyFormData.phone_number,
        })
        .select()
        .single();
      
      if (txError) throw txError;

      // Create or get conversation
      const { data: existingConv } = await supabase
        .from('listing_conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', user.id)
        .single();
      
      let conversationId = existingConv?.id;
      
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('listing_conversations')
          .insert({
            listing_id: listing.id,
            buyer_id: user.id,
            seller_id: listing.seller_id,
          })
          .select()
          .single();
        
        if (convError) throw convError;
        conversationId = newConv.id;
      }

      // Get buyer name
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();
      
      const buyerName = buyerProfile?.full_name || buyerProfile?.username || 'مشتري';
      const paymentMethod = buyFormData.payment_method === 'through_site' ? 'عن طريق الوسيط' : 'دفع مباشر';

      // Insert system message about order
      await supabase.from('listing_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `🛒 تم إنشاء طلب شراء جديد\n\n📦 المنتج: ${listing.title_ar}\n💰 المبلغ: ${finalAmount.toLocaleString()} دينار\n💳 طريقة الدفع: ${paymentMethod}\n\n⏳ بانتظار موافقة البائع على البيع`,
      });

      // Notify seller via Telegram
      await supabase.functions.invoke('notify-marketplace-telegram', {
        body: {
          user_id: listing.seller_id,
          event_type: 'new_order',
          listing_title: listing.title_ar,
          sender_name: buyerName,
          message_content: `طلب شراء جديد بمبلغ ${finalAmount.toLocaleString()} دينار`,
          conversation_id: conversationId,
        },
      });

      return { transaction, conversationId };
    },
    onSuccess: (data) => {
      setShowBuyForm(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['listing-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
      navigate(`/marketplace?openChat=true&conversationId=${data.conversationId}`);
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
      <DialogContent hideClose className="max-w-3xl max-h-[90vh] p-0 overflow-hidden w-[95vw] sm:w-full">
        {/* Custom Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute left-2 top-2 sm:left-3 sm:top-3 z-50 bg-background/90 backdrop-blur-sm rounded-full p-1.5 sm:p-2 hover:bg-background shadow-lg border border-border transition-colors"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <ScrollArea className="max-h-[90vh]">
          <div className="flex flex-col lg:flex-row">
            {/* Image Gallery */}
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

                {images.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </div>
              
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
            <div className="lg:w-3/5 p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* Action Icons Row */}
              <div className="flex items-center justify-end gap-1 sm:gap-2">
                {/* Share Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 sm:h-8 px-2 sm:px-2.5 gap-1"
                  onClick={handleShare}
                  title="مشاركة"
                >
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
                
                {/* Like Button - Always visible */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-7 sm:h-8 px-2 sm:px-2.5 gap-1 ${isLiked ? 'text-blue-500 border-blue-500' : ''}`}
                  onClick={() => user ? toggleLikeMutation.mutate() : toast.error('يجب تسجيل الدخول')}
                  disabled={toggleLikeMutation.isPending}
                  title="إعجاب"
                >
                  <ThumbsUp className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span className="text-[10px] sm:text-xs font-medium">{likesCount || 0}</span>
                </Button>
                
                {/* Favorite Button - Always visible */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-7 sm:h-8 px-2 sm:px-2.5 gap-1 ${isFavorite ? 'text-red-500 border-red-500' : ''}`}
                  onClick={() => user ? toggleFavoriteMutation.mutate() : toast.error('يجب تسجيل الدخول')}
                  disabled={toggleFavoriteMutation.isPending}
                  title={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                >
                  <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </Button>
              </div>

              {/* Title & Condition */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                  <h2 className="text-base sm:text-lg font-bold leading-tight">{listing.title_ar}</h2>
                  <Badge className={`${condition.bgClass} text-white flex-shrink-0 text-[10px] sm:text-xs border-0`}>
                    {condition.label}
                  </Badge>
                </div>
                
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-xl sm:text-2xl font-bold text-primary">
                    {Number(listing.price).toLocaleString()}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground">{listing.currency}</span>
                </div>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 py-2 sm:py-3 border-y border-border text-xs sm:text-sm">
                {listing.location && (
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                    <span className="truncate">{listing.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                  <span>{listing.views_count ?? 0}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" />
                  <span className="text-[10px] sm:text-sm">توصيل مباشر</span>
                </div>
                {listing.categories?.name_ar && (
                  <div className="text-muted-foreground text-[10px] sm:text-xs">
                    القسم: {listing.categories.name_ar}
                  </div>
                )}
                {(listing.approved_at || listing.created_at) && (
                  <div className="flex items-center gap-1 sm:gap-1.5 col-span-2 text-[10px] sm:text-xs">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">الإضافة:</span>
                    <span>{formatArabicDateTime(listing.approved_at || listing.created_at!)}</span>
                  </div>
                )}
              </div>

              {listing.description_ar && (
                <div className="space-y-1 sm:space-y-1.5">
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">الوصف</h4>
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{listing.description_ar}</p>
                </div>
              )}

              {sellerProfile && (
                <button 
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/profile/${listing.seller_id}`);
                  }}
                  className="w-full bg-muted/50 rounded-lg p-3 hover:bg-muted/70 transition-colors cursor-pointer text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-base font-bold text-primary">
                      {sellerName?.charAt(0) || 'B'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{sellerName || 'بائع'}</span>
                        {sellerProfile.is_verified && (
                          <ShieldCheck className="w-4 h-4 text-green-600" />
                        )}
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
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
                </button>
              )}

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
                    <form onSubmit={handleBuy} className="space-y-3 bg-card border border-border rounded-lg p-4 shadow-sm">
                      <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                        <Receipt className="w-4 h-4 text-primary" />
                        اختر طريقة الدفع
                      </h4>
                      
                      {/* Payment Method Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-foreground">طريقة الدفع *</Label>
                        <div className="space-y-2">
                          <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${buyFormData.payment_method === 'through_site' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50 bg-card'}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="through_site"
                              checked={buyFormData.payment_method === 'through_site'}
                              onChange={() => setBuyFormData(prev => ({ ...prev, payment_method: 'through_site' }))}
                              className="mt-1 accent-primary"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm text-foreground">عن طريق الوسيط</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                تضاف رسوم 5,000 دينار على سعر المنتج. الموقع يضمن حقوقك.
                              </p>
                              <p className="text-xs font-bold text-primary mt-1">
                                المجموع: {(Number(listing.price) + 5000).toLocaleString()} دينار
                              </p>
                            </div>
                          </label>
                          
                          <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${buyFormData.payment_method === 'direct' ? 'border-amber-500 bg-amber-500/5' : 'border-border hover:border-muted-foreground/50 bg-card'}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="direct"
                              checked={buyFormData.payment_method === 'direct'}
                              onChange={() => setBuyFormData(prev => ({ ...prev, payment_method: 'direct' }))}
                              className="mt-1 accent-amber-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-amber-600" />
                                <span className="font-medium text-sm text-foreground">الدفع للبائع مباشرة</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                السعر: {Number(listing.price).toLocaleString()} دينار (بدون رسوم إضافية)
                              </p>
                            </div>
                          </label>
                        </div>
                        
                        {/* Warning for direct payment */}
                        {buyFormData.payment_method === 'direct' && (
                          <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 text-xs">
                            <p className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                              ⚠️ تنبيه مهم
                            </p>
                            <p className="text-amber-600 dark:text-amber-300 mt-1">
                              عملية الشراء تكون على مسؤوليتك الشخصية. الموقع غير مسؤول عن أي مشاكل قد تحدث عند الدفع المباشر للبائع.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Address Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-foreground">العنوان *</Label>
                        {userAddresses && userAddresses.length > 0 ? (
                          <div className="space-y-2">
                            {userAddresses.map((addr) => (
                              <label
                                key={addr.id}
                                className={`block p-3 border-2 rounded-lg cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50 bg-card'}`}
                              >
                                <div className="flex items-start gap-2">
                                  <input
                                    type="radio"
                                    name="addressSelection"
                                    checked={selectedAddressId === addr.id}
                                    onChange={() => {
                                      setSelectedAddressId(addr.id);
                                      const fullAddress = `${addr.governorate} - ${addr.area}${addr.neighborhood ? ` - ${addr.neighborhood}` : ''} - ${addr.nearest_landmark}${addr.additional_notes ? ` - ${addr.additional_notes}` : ''}`;
                                      setBuyFormData(prev => ({
                                        ...prev,
                                        shipping_address: fullAddress,
                                        phone_number: addr.phone_number,
                                      }));
                                    }}
                                    className="mt-1 accent-primary"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm text-foreground">{addr.full_name}</span>
                                      {addr.is_default && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">افتراضي</Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                      {addr.governorate} - {addr.area} - {addr.nearest_landmark}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{addr.phone_number}</p>
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <Textarea
                              value={buyFormData.shipping_address}
                              onChange={(e) => setBuyFormData(prev => ({ ...prev, shipping_address: e.target.value }))}
                              placeholder="المحافظة، المنطقة، الشارع"
                              required
                              className="resize-none text-sm bg-card border-border"
                              rows={2}
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Phone Number */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground">رقم الهاتف *</Label>
                        <Input
                          type="tel"
                          value={buyFormData.phone_number}
                          onChange={(e) => setBuyFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                          placeholder="07xxxxxxxxx"
                          required
                          className="text-sm bg-card border-border"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          type="submit" 
                          className="flex-1 h-9 text-sm" 
                          disabled={createTransactionMutation.isPending || !buyFormData.payment_method}
                        >
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
