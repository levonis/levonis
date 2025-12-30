import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { ListingDetailDialog } from '@/components/marketplace/ListingDetailDialog';
import { AddListingDialog } from '@/components/marketplace/AddListingDialog';
import { MyListings } from '@/components/marketplace/MyListings';
import { ListingConversations } from '@/components/marketplace/ListingConversations';
import { Store, Plus, Package, MessageSquare, Search, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Footer from '@/components/Footer';

const conditionOptions = [
  { value: 'all', label: 'جميع الحالات' },
  { value: 'new', label: 'جديد' },
  { value: 'like_new', label: 'شبه جديد' },
  { value: 'good', label: 'جيد' },
  { value: 'used', label: 'مستعمل' },
];

const sortOptions = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'oldest', label: 'الأقدم' },
  { value: 'price_low', label: 'السعر: من الأقل للأعلى' },
  { value: 'price_high', label: 'السعر: من الأعلى للأقل' },
  { value: 'most_viewed', label: 'الأكثر مشاهدة' },
];

export default function Marketplace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { listingId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [directListingOpen, setDirectListingOpen] = useState(false);
  const [openConversations, setOpenConversations] = useState(false);
  const [autoOpenConversationId, setAutoOpenConversationId] = useState<string | null>(null);

  // Check for openChat query parameter
  useEffect(() => {
    if (searchParams.get('openChat') === 'true') {
      setOpenConversations(true);
      const convId = searchParams.get('conversationId');
      if (convId) {
        setAutoOpenConversationId(convId);
      }
      // Remove the query params after opening
      searchParams.delete('openChat');
      searchParams.delete('conversationId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Get listing ID from query param
  const queryListingId = searchParams.get('listing');

  // Fetch single listing for direct link (from params or query)
  const { data: queryListing } = useQuery({
    queryKey: ['query-listing', queryListingId],
    queryFn: async () => {
      if (!queryListingId) return null;
      const { data, error } = await supabase
        .from('user_listings')
        .select('*, categories(name_ar)')
        .eq('id', queryListingId)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!queryListingId,
  });

  // Open dialog when query listing is loaded
  useEffect(() => {
    if (queryListing) {
      setDirectListingOpen(true);
    }
  }, [queryListing]);

  // Fetch all approved listings
  const { data: listings, isLoading } = useQuery({
    queryKey: ['marketplace-listings-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_listings')
        .select('*, categories(name_ar)')
        .eq('status', 'approved')
        .order('approved_at', { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch single listing for direct link
  const { data: directListing } = useQuery({
    queryKey: ['direct-listing', listingId],
    queryFn: async () => {
      if (!listingId) return null;
      const { data, error } = await supabase
        .from('user_listings')
        .select('*, categories(name_ar)')
        .eq('id', listingId)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!listingId,
  });

  // Open dialog when direct listing is loaded
  useEffect(() => {
    if (directListing) {
      setDirectListingOpen(true);
    }
  }, [directListing]);

  // Fetch seller profiles
  const { data: sellerProfiles } = useQuery({
    queryKey: ['seller-profiles-all', listings?.map(l => l.seller_id)],
    queryFn: async () => {
      if (!listings?.length) return {};
      
      const sellerIds = [...new Set(listings.map(l => l.seller_id))];
      const { data, error } = await supabase
        .from('seller_profiles')
        .select('*')
        .in('user_id', sellerIds);
      
      if (error) throw error;
      
      return data?.reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {} as Record<string, typeof data[0]>) || {};
    },
    enabled: !!listings?.length,
  });

  // Fetch seller names and avatars
  const { data: sellerData } = useQuery({
    queryKey: ['seller-data-all', listings?.map(l => l.seller_id)],
    queryFn: async () => {
      if (!listings?.length) return { names: {}, avatars: {} };
      
      const sellerIds = [...new Set(listings.map(l => l.seller_id))];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', sellerIds);
      
      if (error) throw error;
      
      const names: Record<string, string> = {};
      const avatars: Record<string, string | null> = {};
      
      data?.forEach(profile => {
        names[profile.id] = profile.full_name || profile.username || 'بائع';
        avatars[profile.id] = profile.avatar_url;
      });
      
      return { names, avatars };
    },
    enabled: !!listings?.length,
  });

  const sellerNames = sellerData?.names || {};
  const sellerAvatars = sellerData?.avatars || {};

  // Filter and sort listings
  const filteredListings = useMemo(() => {
    if (!listings) return [];
    
    let result = [...listings];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.title_ar?.toLowerCase().includes(query) ||
        l.title?.toLowerCase().includes(query) ||
        l.description_ar?.toLowerCase().includes(query)
      );
    }

    // Condition filter
    if (conditionFilter !== 'all') {
      result = result.filter(l => l.condition === conditionFilter);
    }

    // Price filter
    if (priceMin) {
      result = result.filter(l => Number(l.price) >= Number(priceMin));
    }
    if (priceMax) {
      result = result.filter(l => Number(l.price) <= Number(priceMax));
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.approved_at || a.created_at).getTime() - new Date(b.approved_at || b.created_at).getTime());
        break;
      case 'price_low':
        result.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case 'price_high':
        result.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case 'most_viewed':
        result.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        break;
      default: // newest
        result.sort((a, b) => new Date(b.approved_at || b.created_at).getTime() - new Date(a.approved_at || a.created_at).getTime());
    }

    return result;
  }, [listings, searchQuery, conditionFilter, sortBy, priceMin, priceMax]);

  return (
    <div className="min-h-screen bg-background pt-20 sm:pt-24">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-9 w-9 sm:h-10 sm:w-10">
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <h1 className="text-lg sm:text-2xl font-black text-primary">سوق المستعمل</h1>
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">منتجات من أعضاء المجتمع</span>
        </div>

        {/* Action Buttons - Responsive */}
        {user && (
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
            <AddListingDialog>
              <Button size="sm" className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-4">
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">أضف منتج للبيع</span>
                <span className="xs:hidden">إضافة</span>
              </Button>
            </AddListingDialog>
            
            <MyListings>
              <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-4">
                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">منتجاتي</span>
                <span className="xs:hidden">منتجاتي</span>
              </Button>
            </MyListings>
            
            <ListingConversations 
              externalOpen={openConversations} 
              onExternalOpenChange={(open) => {
                setOpenConversations(open);
                if (!open) setAutoOpenConversationId(null);
              }}
              autoOpenConversationId={autoOpenConversationId}
            >
              <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-4">
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">المحادثات</span>
                <span className="xs:hidden">محادثات</span>
              </Button>
            </ListingConversations>
          </div>
        )}

        {/* Filters - Improved Responsiveness */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          {/* Search Bar - Full Width on Mobile */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-10 sm:h-11 text-sm sm:text-base"
            />
          </div>

          {/* Filter Row - Responsive Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* Condition */}
            <Select value={conditionFilter} onValueChange={setConditionFilter}>
              <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                {conditionOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="الترتيب" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Price Min */}
            <div className="relative">
              <Input
                type="number"
                placeholder="السعر من"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            {/* Price Max */}
            <div className="relative">
              <Input
                type="number"
                placeholder="السعر إلى"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(priceMin || priceMax || conditionFilter !== 'all' || searchQuery) && (
            <div className="flex justify-end">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-xs sm:text-sm h-8"
                onClick={() => {
                  setSearchQuery('');
                  setConditionFilter('all');
                  setPriceMin('');
                  setPriceMax('');
                }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 ml-1.5" />
                مسح الفلاتر
              </Button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {filteredListings.length} منتج
          </p>
        </div>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-card rounded-xl p-3 border border-border animate-pulse">
                <div className="aspect-square bg-muted rounded-lg mb-3" />
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-16 bg-card/50 rounded-xl border border-dashed border-border">
            <Store className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">لا توجد منتجات مطابقة</p>
            {user && (
              <AddListingDialog>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  أضف منتج للبيع
                </Button>
              </AddListingDialog>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredListings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                sellerProfile={sellerProfiles?.[listing.seller_id]}
                sellerName={sellerNames?.[listing.seller_id]}
              />
            ))}
          </div>
        )}

        {/* Direct listing dialog - from params or query */}
        {(directListing || queryListing) && (
          <ListingDetailDialog
            listing={directListing || queryListing}
            sellerProfile={sellerProfiles?.[(directListing || queryListing)?.seller_id]}
            sellerName={sellerNames?.[(directListing || queryListing)?.seller_id]}
            sellerAvatar={sellerAvatars?.[(directListing || queryListing)?.seller_id]}
            open={directListingOpen}
            onOpenChange={(open) => {
              setDirectListingOpen(open);
              if (!open) {
                // Clear query param if it exists
                if (queryListingId) {
                  searchParams.delete('listing');
                  setSearchParams(searchParams, { replace: true });
                } else {
                  navigate('/marketplace');
                }
              }
            }}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
