import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star, ShoppingBag, ShieldCheck, Package, ArrowRight, Calendar, Store } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import LevelBadge from '@/components/LevelBadge';

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwnProfile = user?.id === userId;

  // Fetch profile data
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, created_at')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch seller profile
  const { data: sellerProfile } = useQuery({
    queryKey: ['seller-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  // Fetch user listings
  const { data: listings, isLoading: loadingListings } = useQuery({
    queryKey: ['user-public-listings', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('user_listings')
        .select('id, title_ar, price, currency, images, status, created_at, condition')
        .eq('seller_id', userId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch seller reviews
  const { data: reviews } = useQuery({
    queryKey: ['seller-reviews', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('seller_reviews')
        .select(`
          *,
          buyer:profiles!seller_reviews_buyer_id_fkey(username, avatar_url)
        `)
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!userId,
  });

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">المستخدم غير موجود</h1>
          <Button onClick={() => navigate(-1)}>
            <ArrowRight className="w-4 h-4 ml-2" />
            رجوع
          </Button>
        </div>
      </div>
    );
  }

  const conditionLabels: Record<string, string> = {
    new: 'جديد',
    like_new: 'شبه جديد',
    used: 'مستعمل',
    damaged: 'به عيب',
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-6 gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>

        {/* Profile Header */}
        <Card className="glass-effect border-border/50 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {profile.username?.[0] || profile.full_name?.[0] || 'م'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {profile.username || profile.full_name || 'مستخدم'}
                  </h1>
                  {sellerProfile?.is_verified && (
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  )}
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground mb-3">
                  {sellerProfile && (
                    <>
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        {(sellerProfile.average_rating ?? 0).toFixed(1)} ({sellerProfile.total_reviews ?? 0} تقييم)
                      </span>
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="w-4 h-4" />
                        {sellerProfile.completed_orders ?? 0} طلب مكتمل
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>عضو منذ {profile.created_at ? formatDate(profile.created_at) : '-'}</span>
                </div>

                {userId && (
                  <div className="mt-3">
                    <LevelBadge userId={userId} size="md" />
                  </div>
                )}

                {isOwnProfile && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => navigate('/user-info')}
                  >
                    تعديل الملف الشخصي
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Listings */}
        <Card className="glass-effect border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="w-5 h-5 text-primary" />
              المنتجات المعروضة ({listings?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingListings ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : listings?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد منتجات معروضة</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {listings?.map((listing) => (
                  <Link 
                    key={listing.id} 
                    to={`/marketplace/${listing.id}`}
                    className="group block"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={listing.images?.[0] || '/placeholder.svg'}
                        alt={listing.title_ar}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 right-2 text-[10px]"
                      >
                        {conditionLabels[listing.condition] || listing.condition}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium truncate">{listing.title_ar}</p>
                      <p className="text-primary font-bold text-sm">
                        {Number(listing.price).toLocaleString()} {listing.currency}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reviews */}
        {reviews && reviews.length > 0 && (
          <Card className="glass-effect border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="w-5 h-5 text-primary" />
                التقييمات ({reviews.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reviews.map((review: any) => (
                  <div key={review.id} className="flex gap-3 pb-4 border-b border-border/30 last:border-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={review.buyer?.avatar_url} />
                      <AvatarFallback className="text-sm">
                        {review.buyer?.username?.[0] || 'م'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {review.buyer?.username || 'مستخدم'}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < review.rating
                                  ? 'fill-yellow-500 text-yellow-500'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default PublicProfile;
