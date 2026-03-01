import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, Info, AlertCircle, CheckCircle, XCircle, ArrowLeft, Sparkles, BellRing, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { useLanguage } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';

const GlassCard = ({ children, className = '', glow = false, ...props }: any) => (
  <div
    className={`relative rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${glow ? 'shadow-[0_8px_32px_rgba(199,180,108,0.15)]' : ''} ${className}`}
    {...props}
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent rounded-t-2xl" />
    {children}
  </div>
);

const NotificationIcon3D = ({ type }: { type: string }) => {
  const config: Record<string, { bg: string; icon: any; shadow: string }> = {
    success: { bg: 'from-emerald-500/30 to-emerald-600/10', icon: CheckCircle, shadow: 'shadow-emerald-500/20' },
    error: { bg: 'from-red-500/30 to-red-600/10', icon: XCircle, shadow: 'shadow-red-500/20' },
    warning: { bg: 'from-amber-500/30 to-amber-600/10', icon: AlertCircle, shadow: 'shadow-amber-500/20' },
    info: { bg: 'from-blue-500/30 to-blue-600/10', icon: Info, shadow: 'shadow-blue-500/20' },
  };
  const c = config[type] || config.info;
  const Icon = c.icon;

  return (
    <div className={`relative h-11 w-11 rounded-xl bg-gradient-to-br ${c.bg} backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg ${c.shadow}`}>
      <Icon className="h-5 w-5 text-foreground" />
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
    </div>
  );
};

const Notifications = () => {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Auto-mark all unread notifications as read when they load
  useEffect(() => {
    if (!notifications || !user?.id) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    const markAllRead = async () => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
    };
    // Small delay so user sees the "new" badges briefly
    const timer = setTimeout(markAllRead, 2000);
    return () => clearTimeout(timer);
  }, [notifications, user?.id, queryClient]);


  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 backdrop-blur-xl flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  return (
    <div className="min-h-screen bg-background pt-20 pb-24" dir="rtl">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent" />
        <div className="absolute top-6 right-12 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-10 left-8 h-24 w-24 rounded-full bg-accent/8 blur-2xl" />

        <div className="relative container mx-auto px-4 py-6 max-w-2xl">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            رجوع
          </button>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/15 backdrop-blur-xl flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/10">
                  <BellRing className="h-7 w-7 text-primary" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-black px-1.5 shadow-lg shadow-destructive/30 border-2 border-background">
                    {unreadCount}
                  </span>
                )}
                <Sparkles className="absolute -bottom-1 -right-1 h-4 w-4 text-primary/50" />
              </div>

              <div>
                <h1 className="text-2xl font-black text-foreground">{t('notif_title')}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {unreadCount > 0 ? t('notif_unread_count', { count: unreadCount }) : t('notif_all_read')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Settings button */}
              <Button
                onClick={() => navigate('/notification-settings')}
                size="sm"
                variant="ghost"
                className="rounded-xl h-9 w-9 p-0 bg-card/40 backdrop-blur-sm border border-border/30 hover:bg-card/60"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </Button>

            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 max-w-2xl space-y-4 mt-2">
        <AnimatePresence mode="popLayout">
          {!notifications || notifications.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="py-16 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-muted/20 to-muted/5 backdrop-blur-sm flex items-center justify-center border border-border/20">
                    <Bell className="h-9 w-9 text-muted-foreground/50" />
                  </div>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                </div>
                <p className="text-muted-foreground text-sm font-bold">{t('notif_empty')}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">ستظهر إشعاراتك هنا</p>
              </GlassCard>
            </motion.div>
          ) : (
            notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
                layout
              >
                <GlassCard
                  className={`p-4 transition-all duration-300 ${
                    !notification.read
                      ? 'border-primary/30 shadow-[0_8px_32px_rgba(199,180,108,0.1)]'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <NotificationIcon3D type={notification.type} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-black text-foreground truncate">{notification.title}</h3>
                        {!notification.read && (
                          <Badge className="text-[10px] px-2 py-0 h-5 rounded-full bg-primary/15 text-primary border-primary/20 font-bold">
                            {t('common_new')}
                          </Badge>
                        )}
                        {notification.is_general && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 rounded-full border-border/30 text-muted-foreground">
                            {t('common_general')}
                          </Badge>
                        )}
                      </div>

                      <div
                        className="rounded-xl bg-background/30 border border-border/10 p-3 mt-2"
                        style={{
                          fontFamily: notification.font_family || 'Cairo',
                          color: notification.text_color || undefined,
                          backgroundColor: notification.background_color || undefined,
                        }}
                      >
                        <p className="text-sm leading-relaxed">{notification.message}</p>
                      </div>

                      <div className="flex items-center justify-between mt-2.5">
                        <p className="text-[11px] text-muted-foreground/70">
                          {formatDate(notification.created_at)}
                        </p>

                        <div className="flex items-center gap-2">
                          {notification.related_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs rounded-lg text-primary hover:bg-primary/10 font-bold px-3"
                              onClick={() => {
                                const text = `${notification.title ?? ''} ${notification.message ?? ''}`;
                                const isWallet = text.includes('محفظة') || text.includes('تعبئة') || text.includes('سحب');
                                const isCustom = text.includes('المخصص');
                                const isCompetition = text.includes('مسابقة') || text.includes('تذكرة');
                                const isChat = text.includes('رسالة') || text.includes('محادثة');
                                const isOrder = text.includes('طلب') || text.includes('توصيل') || text.includes('شحن');
                                if (isWallet) navigate(ADMIN_ROUTES.wallet);
                                else if (isCustom) navigate('/my-requests');
                                else if (isCompetition) navigate('/competitions');
                                else if (isChat) navigate('/notifications');
                                else if (isOrder && notification.related_id) navigate(`/order/${notification.related_id}`);
                              }}
                            >
                              {t('common_view_details')}
                            </Button>
                          )}

                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Notifications;
