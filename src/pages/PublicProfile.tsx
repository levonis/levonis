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

  // NOTE: تم حذف سوق المستعمل بالكامل، لذلك صفحة الملف العام تعرض بيانات المستخدم الأساسية فقط.

  const { data: rep } = useUserPrintReputation(userId);

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
        label: 'نسبة استلام الزبون',
        percent: receiveRate == null ? null : Number(receiveRate),
        hint: 'نسبة الطلبات التي استلمها الزبون من مجموع ما قدّمه.',
        rightText: submitted ? `${received} من ${submitted}` : '—',
      },
      {
        key: 'merchant_completion',
        label: 'نسبة إكمال التاجر',
        percent: completion == null ? null : Number(completion),
        hint: 'نسبة الأعمال المكتملة من الأعمال المقبولة للتاجر.',
        rightText: accepted ? `${completed} من ${accepted}` : '—',
      },
    ];
  }, [rep]);

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

        {userId && (
          <div className="mb-6">
            <ReputationBar
              overallStars={rep?.avg_stars ?? null}
              basisCount={rep?.ratings_count ?? null}
              basisLabel="تقييم"
              metrics={metrics}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicProfile;
