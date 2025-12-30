import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ListingCard } from './ListingCard';
import { AddListingDialog } from './AddListingDialog';
import { MyListings } from './MyListings';
import { ListingConversations } from './ListingConversations';
import { Store, Plus, Package, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export const MarketplaceSection = () => {
  const { user } = useAuth();

  const { data: listings, isLoading } = useQuery({
    queryKey: ['approved-listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_listings')
        .select(`
          *,
          categories(name_ar)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(8);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch seller profiles for all listings
  const { data: sellerProfiles } = useQuery({
    queryKey: ['seller-profiles', listings?.map(l => l.seller_id)],
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

  // Fetch count of unique users with unread messages
  const { data: unreadUsersCount } = useQuery({
    queryKey: ['marketplace-unread-users-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      // Get all conversations where user is buyer or seller
      const { data: conversations, error: convError } = await supabase
        .from('listing_conversations')
        .select('id, buyer_id, seller_id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (convError || !conversations?.length) return 0;

      const conversationIds = conversations.map(c => c.id);

      // Get unread messages not sent by the user with sender_id
      const { data: unreadMessages, error: msgError } = await supabase
        .from('listing_messages')
        .select('sender_id, conversation_id')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (msgError || !unreadMessages?.length) return 0;
      
      // Count unique senders
      const uniqueSenders = new Set(unreadMessages.map(m => m.sender_id));
      return uniqueSenders.size;
    },
    enabled: !!user,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const totalListings = listings?.length || 0;
  const showAllButton = totalListings > 8 || totalListings >= 30;

  return (
    <section className="container mx-auto px-4 py-10">
      {/* Separator from other sections */}
      <div className="border-t border-border mb-8" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-black text-primary">سوق المستعمل</h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs sm:text-sm text-muted-foreground">منتجات من أعضاء المجتمع</span>
          {showAllButton && (
            <Link to="/marketplace">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm h-8">
                عرض الكل
                <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Action Buttons - Ordered: Add, My Products, Conversations */}
      {user && (
        <div className="flex flex-wrap gap-2 mb-4">
          <AddListingDialog>
            <Button size="sm" className="gap-1.5 text-xs sm:text-sm h-8 px-2.5 sm:px-3">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">أضف منتج</span>
              <span className="xs:hidden">إضافة</span>
            </Button>
          </AddListingDialog>
          
          <MyListings>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm h-8 px-2.5 sm:px-3">
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">منتجاتي</span>
              <span className="xs:hidden">منتجاتي</span>
            </Button>
          </MyListings>
          
          <ListingConversations>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm h-8 px-2.5 sm:px-3 relative">
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">المحادثات</span>
              <span className="xs:hidden">محادثات</span>
              {unreadUsersCount && unreadUsersCount > 0 ? (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-[10px] sm:text-xs font-bold rounded-full"
                >
                  {unreadUsersCount > 9 ? '9+' : unreadUsersCount}
                </Badge>
              ) : null}
            </Button>
          </ListingConversations>
        </div>
      )}

      {/* Light separator before products */}
      <div className="border-t border-border/50 mb-4 sm:mb-6" />

      {/* Listings Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card rounded-xl p-3 border border-border animate-pulse">
              <div className="aspect-square bg-muted rounded-lg mb-3" />
              <div className="h-4 bg-muted rounded mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : listings?.length === 0 ? (
        <div className="text-center py-12 bg-card/50 rounded-xl border border-dashed border-border">
          <Store className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">لا توجد منتجات معروضة حالياً</p>
          {user && (
            <AddListingDialog>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                كن أول من يضيف منتج
              </Button>
            </AddListingDialog>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {listings?.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              sellerProfile={sellerProfiles?.[listing.seller_id]}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default MarketplaceSection;
