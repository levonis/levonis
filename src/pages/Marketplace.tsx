import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [directListingOpen, setDirectListingOpen] = useState(false);

  // Fetch all approved listings
  const { data: listings, isLoading } = useQuery({
    queryKey: ['marketplace-listings-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_listings')
        .select('*, categories(name_ar)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
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
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [listings, searchQuery, conditionFilter, sortBy, priceMin, priceMax]);

  return (
    <div className="min-h-screen bg-background pt-24">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-black text-primary">سوق المستعمل</h1>
          </div>
          <span className="text-sm text-muted-foreground">منتجات من أعضاء المجتمع</span>
        </div>

        {/* Action Buttons */}
        {user && (
          <div className="flex flex-wrap gap-3 mb-6">
            <AddListingDialog>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                أضف منتج للبيع
              </Button>
            </AddListingDialog>
            
            <MyListings>
              <Button variant="outline" size="sm" className="gap-2">
                <Package className="w-4 h-4" />
                منتجاتي
              </Button>
            </MyListings>
            
            <ListingConversations>
              <Button variant="outline" size="sm" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                المحادثات
              </Button>
            </ListingConversations>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="w-4 h-4" />
            <span>تصفية وبحث</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن منتج..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>

            {/* Condition */}
            <Select value={conditionFilter} onValueChange={setConditionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                {conditionOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="ترتيب حسب" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">السعر:</span>
            <Input
              type="number"
              placeholder="من"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="w-32"
            />
            <span>-</span>
            <Input
              type="number"
              placeholder="إلى"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="w-32"
            />
            {(priceMin || priceMax || conditionFilter !== 'all' || searchQuery) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setConditionFilter('all');
                  setPriceMin('');
                  setPriceMax('');
                }}
              >
                مسح الفلاتر
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
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
              />
            ))}
          </div>
        )}

        {/* Direct listing dialog */}
        {directListing && (
          <ListingDetailDialog
            listing={directListing}
            sellerProfile={sellerProfiles?.[directListing.seller_id]}
            open={directListingOpen}
            onOpenChange={(open) => {
              setDirectListingOpen(open);
              if (!open) navigate('/marketplace');
            }}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
