import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowRight, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import LevelBadge from '@/components/LevelBadge';
import ReputationBar from '@/components/reputation/ReputationBar';
import { useUserPrintReputation } from '@/hooks/useUserPrintReputation';
import { useUserCardFrame } from '@/hooks/useUserCardFrame';
import AvatarWithFrame from '@/components/merchant/AvatarWithFrame';
import type { FrameAnimationType } from '@/components/merchant/AvatarWithFrame';
import { useLanguage } from '@/lib/i18n';

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
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

  // Check if user is a merchant and get their frame
  const { data: merchantData } = useQuery({
    queryKey: ['public-profile-merchant', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('merchant_public_profiles')
        .select('id, display_name, store_image_url, selected_frame_id, is_verified, badge_tier')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch frame if merchant has one
  const { data: selectedFrame } = useQuery({
    queryKey: ['profile-frame', merchantData?.selected_frame_id],
    enabled: !!merchantData?.selected_frame_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_frames')
        .select('id, image_url')
        .eq('id', merchantData!.selected_frame_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rep } = useUserPrintReputation(userId);
  
  // Get user's active card frame
  const { data: cardFrame } = useUserCardFrame(userId);

  const metrics = useMemo(() => {
    const submitted = rep?.customer_requests_made ?? 0;
    const received = rep?.customer_requests_received ?? 0;
    const receiveRate = rep?.customer_receive_rate_percent ?? (submitted > 0 ? (received / submitted) * 100 : null);

    const accepted = rep?.merchant_accepted_jobs ?? 0;
    const completed = rep?.merchant_completed_jobs ?? 0;
    const completion = rep?.merchant_completion_percent ?? (accepted > 0 ? (completed / accepted) * 100 : null);

    return [
      {
        key: 'customer_receive',
        label: t('profile_customer_rate'),
        percent: receiveRate == null ? null : Number(receiveRate),
        hint: t('profile_customer_rate_hint'),
        rightText: submitted ? `${received} ${t('profile_of')} ${submitted}` : '—',
      },
      {
        key: 'merchant_completion',
        label: t('profile_merchant_rate'),
        percent: completion == null ? null : Number(completion),
        hint: t('profile_merchant_rate_hint'),
        rightText: accepted ? `${completed} ${t('profile_of')} ${accepted}` : '—',
      },
    ];
  }, [rep, t]);

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
          <h1 className="text-2xl font-bold text-foreground mb-4">{t('profile_not_found')}</h1>
          <Button onClick={() => navigate(-1)}>
            <ArrowRight className="w-4 h-4 ml-2" />
            {t('profile_back')}
          </Button>
        </div>
      </div>
    );
  }

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
          {t('profile_back')}
        </Button>

        {/* Profile Header */}
        <Card className="glass-effect border-border/50 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              {/* Use AvatarWithFrame for all users - merchants get their frame, card holders get card frame */}
              {merchantData ? (
                <AvatarWithFrame
                  imageUrl={merchantData.store_image_url || profile.avatar_url}
                  frameUrl={selectedFrame?.image_url}
                  size="lg"
                  animated
                />
              ) : cardFrame?.frame_url ? (
                <AvatarWithFrame
                  imageUrl={profile.avatar_url}
                  frameUrl={cardFrame.frame_url}
                  size="lg"
                  animated
                  animationType={cardFrame.frame_animation as FrameAnimationType}
                  badgeColor={cardFrame.card_color}
                  isUser
                />
              ) : (
                <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {profile.username?.[0] || profile.full_name?.[0] || t('profile_user')[0]}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="flex-1 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {profile.username || profile.full_name || t('profile_user')}
                  </h1>
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t('profile_member_since')} {profile.created_at ? formatDate(profile.created_at) : '-'}</span>
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
                    {t('profile_edit')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {userId && (
          <div className="mb-6">
            <ReputationBar
              overallStars={rep?.avg_stars ?? null}
              basisCount={rep?.ratings_count ?? null}
              basisLabel={t('profile_rating')}
              metrics={metrics}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicProfile;
