import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowRight, Calendar, Gamepad2, Users, MessageCircle, Trophy, Target, Swords, CreditCard } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import LevelBadge from '@/components/LevelBadge';
import ReputationBar from '@/components/reputation/ReputationBar';
import { useUserPrintReputation } from '@/hooks/useUserPrintReputation';
import { useUserCardFrame } from '@/hooks/useUserCardFrame';
import AvatarWithFrame from '@/components/merchant/AvatarWithFrame';
import type { FrameAnimationType } from '@/components/merchant/AvatarWithFrame';
import { useLanguage } from '@/lib/i18n';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PublicProfile = () => {
  const { userId: paramId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'games' ? 'games' : 'community';
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const isUuid = paramId ? UUID_REGEX.test(paramId) : false;

  // Resolve username to user ID if needed
  const { data: resolvedUserId, isLoading: loadingResolve } = useQuery({
    queryKey: ['resolve-username', paramId],
    queryFn: async () => {
      if (!paramId) return null;
      if (isUuid) return paramId;
      // Look up by username
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id')
        .eq('username', paramId)
        .maybeSingle();
      if (error || !data) return null;
      return data.id;
    },
    enabled: !!paramId,
  });

  const userId = resolvedUserId;
  const isOwnProfile = user?.id === userId;

  // Fetch profile data
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, full_name, username, avatar_url, created_at, cover_image_url')
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

  // User's active card
  const { data: userCard } = useQuery({
    queryKey: ['public-profile-card', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('user_cards')
        .select('id, card_id, membership_cards:card_id(name_ar, card_color)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  // Game enabled settings
  const { data: gameSettings } = useQuery({
    queryKey: ['game-enabled-settings'],
    queryFn: async () => {
      const [stackRes, knifeRes, crossyRes] = await Promise.all([
        supabase.from('stack_game_settings' as any).select('game_enabled').limit(1).single(),
        supabase.from('knife_rain_settings' as any).select('game_enabled').limit(1).single(),
        supabase.from('crossy_road_settings').select('game_enabled').limit(1).single(),
      ]);
      return {
        stack: (stackRes.data as any)?.game_enabled ?? true,
        knife: (knifeRes.data as any)?.game_enabled ?? true,
        crossy: (crossyRes.data as any)?.game_enabled ?? true,
      };
    },
  });

  // Game stats - stack game
  const { data: stackStats } = useQuery({
    queryKey: ['public-stack-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('stack_game_high_scores')
        .select('high_score')
        .eq('user_id', userId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!userId && (gameSettings?.stack !== false),
  });

  // Game stats - knife rain
  const { data: knifeStats } = useQuery({
    queryKey: ['public-knife-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('knife_rain_high_scores')
        .select('high_score')
        .eq('user_id', userId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!userId && (gameSettings?.knife !== false),
  });

  // Game stats - crossy road
  const { data: crossyStats } = useQuery({
    queryKey: ['public-crossy-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('crossy_road_high_scores' as any)
        .select('high_score, all_time_high_score')
        .eq('user_id', userId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!userId && (gameSettings?.crossy !== false),
  });

  const { data: rep } = useUserPrintReputation(userId);
  const { data: cardFrame } = useUserCardFrame(userId);

  // Community profile
  const { data: communityProfile } = useQuery({
    queryKey: ['public-community-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('community_customer_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

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

  const cardLevelName = (userCard?.membership_cards as any)?.name_ar;
  const cardColor = (userCard?.membership_cards as any)?.card_color;

  const hasAnyGame = (gameSettings?.stack !== false && stackStats) || 
                     (gameSettings?.knife !== false && knifeStats) || 
                     (gameSettings?.crossy !== false && crossyStats);

  if (loadingProfile || loadingResolve) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-6">
        <div className="container mx-auto px-4 max-w-2xl py-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-32 rounded bg-muted animate-pulse" />
              <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i=><div key={i} className="rounded-lg border bg-card p-4"><div className="h-3 w-16 rounded bg-muted animate-pulse mb-2" /><div className="h-7 w-20 rounded bg-muted animate-pulse" /></div>)}</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-6">
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

  const coverUrl = (profile as any).cover_image_url;

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-4 gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          {t('profile_back')}
        </Button>

        {/* Profile Card */}
        <div className="rounded-2xl border border-border/30 bg-card overflow-hidden mb-4">
          {/* Cover Image */}
          <div className="relative h-28 overflow-hidden">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-bl from-primary/20 via-primary/10 to-accent/5" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
          </div>

          {/* Avatar + Info */}
          <div className="relative px-5 -mt-10">
            <div className="flex items-end gap-4">
              <div className="relative">
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
                  <Avatar className="h-20 w-20 ring-4 ring-card">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                      {profile.username?.[0] || profile.full_name?.[0] || 'م'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div className="pb-2 flex-1 min-w-0">
                <h1 className="font-black text-base text-foreground truncate">
                  {profile.full_name || profile.username || t('profile_user')}
                </h1>
                {profile.username && (
                  <span className="text-[10px] text-muted-foreground">@{profile.username}</span>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {userId && <LevelBadge userId={userId} size="sm" />}
                  {cardLevelName && (
                    <span 
                      className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        borderColor: cardColor || 'hsl(var(--primary))',
                        color: cardColor || 'hsl(var(--primary))',
                        backgroundColor: `${cardColor || 'hsl(var(--primary))'}15`,
                      }}
                    >
                      <CreditCard className="h-2.5 w-2.5" />
                      {cardLevelName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{t('profile_member_since')} {profile.created_at ? formatDate(profile.created_at) : '-'}</span>
            </div>

            {isOwnProfile && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 w-full text-xs"
                onClick={() => navigate('/user-info')}
              >
                {t('profile_edit')}
              </Button>
            )}
          </div>

          <div className="h-4" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full bg-card border border-border/30 rounded-xl p-1 h-auto">
            <TabsTrigger value="games" className="flex-1 text-xs gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2">
              <Gamepad2 className="h-3.5 w-3.5" />
              الألعاب
            </TabsTrigger>
            <TabsTrigger value="community" className="flex-1 text-xs gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2">
              <Users className="h-3.5 w-3.5" />
              المجتمع
            </TabsTrigger>
          </TabsList>

          {/* Games Tab */}
          <TabsContent value="games" className="mt-4 space-y-3">
            {/* Stack Game Stats */}
            {gameSettings?.stack !== false && (
              <div className="rounded-xl border border-border/30 bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">لعبة البرج</h3>
                    <p className="text-[9px] text-muted-foreground">Stack Game</p>
                  </div>
                </div>
                {stackStats ? (
                  <div className="grid grid-cols-1 gap-2">
                    <StatBox label="أعلى سكور" value={stackStats.high_score?.toLocaleString() || '0'} icon="🏆" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">لم يلعب بعد</p>
                )}
              </div>
            )}

            {/* Knife Rain Stats */}
            {gameSettings?.knife !== false && (
              <div className="rounded-xl border border-border/30 bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Swords className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">مطر السكاكين</h3>
                    <p className="text-[9px] text-muted-foreground">Knife Rain</p>
                  </div>
                </div>
                {knifeStats ? (
                  <div className="grid grid-cols-1 gap-2">
                    <StatBox label="أعلى سكور" value={knifeStats.high_score?.toLocaleString() || '0'} icon="🏆" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">لم يلعب بعد</p>
                )}
              </div>
            )}

            {/* Crossy Road Stats */}
            {gameSettings?.crossy !== false && (
              <div className="rounded-xl border border-border/30 bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Gamepad2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">اعبر الطريق</h3>
                    <p className="text-[9px] text-muted-foreground">Crossy Road</p>
                  </div>
                </div>
                {crossyStats ? (
                  <div className="grid grid-cols-2 gap-2">
                    <StatBox label="سكور الموسم" value={crossyStats.high_score?.toLocaleString() || '0'} icon="🏆" />
                    <StatBox label="أعلى سكور" value={crossyStats.all_time_high_score?.toLocaleString() || '0'} icon="🌟" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">لم يلعب بعد</p>
                )}
              </div>
            )}

            {!hasAnyGame && gameSettings?.stack === false && gameSettings?.knife === false && gameSettings?.crossy === false && (
              <p className="text-xs text-muted-foreground text-center py-8">لا توجد ألعاب متاحة حالياً</p>
            )}
          </TabsContent>

          {/* Community Tab */}
          <TabsContent value="community" className="mt-4 space-y-3">
            {/* Reputation */}
            {userId && (
              <ReputationBar
                overallStars={rep?.avg_stars ?? null}
                basisCount={rep?.ratings_count ?? null}
                basisLabel={t('profile_rating')}
                metrics={metrics}
              />
            )}

            {/* Community Info */}
            {communityProfile && (
              <div className="rounded-xl border border-border/30 bg-card p-4 space-y-3">
                {communityProfile.bio && (
                  <p className="text-xs text-muted-foreground">{communityProfile.bio}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="طلبات مقدمة" value={communityProfile.total_requests_made?.toString() || '0'} icon="📋" />
                  <StatBox label="طلبات مستلمة" value={communityProfile.total_requests_received?.toString() || '0'} icon="📦" />
                </div>
              </div>
            )}

            {/* Contact Button */}
            {!isOwnProfile && userId && (
              <Button
                className="w-full rounded-xl gap-2"
                onClick={() => navigate(`/community/chat/${userId}`)}
              >
                <MessageCircle className="h-4 w-4" />
                تواصل مع المستخدم
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

function StatBox({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg bg-muted/10 border border-border/20 p-2.5 text-center">
      <span className="text-base">{icon}</span>
      <div className="text-sm font-black text-foreground mt-0.5">{value}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

export default PublicProfile;
