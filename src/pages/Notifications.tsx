import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Bell, Check, Info, AlertCircle, CheckCircle, XCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { useLanguage } from '@/lib/i18n';

const Notifications = () => {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
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

  const { data: profile } = useQuery({
    queryKey: ['profile-telegram', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile?.telegram_chat_id) {
      setTelegramChatId(profile.telegram_chat_id);
    }
  }, [profile]);

  const saveTelegramChatId = async () => {
    if (!user?.id) return;
    setSavingTelegram(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: telegramChatId || null })
        .eq('id', user.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['profile-telegram'] });
      toast.success(telegramChatId ? t('notif_telegram_saved') : t('notif_telegram_removed'));
    } catch (error) {
      console.error('Error saving telegram chat ID:', error);
      toast.error(t('notif_telegram_save_error'));
    } finally {
      setSavingTelegram(false);
    }
  };

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications'] });
      toast.success(t('notif_marked_read'));
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications'] });
      toast.success(t('notif_all_marked_read'));
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-primary mb-2 flex items-center gap-3">
              <Bell className="h-8 w-8" />
              {t('notif_title')}
            </h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? t('notif_unread_count', { count: unreadCount }) : t('notif_all_read')}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsRead.mutate()}
              variant="outline"
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {t('notif_mark_all_read')}
            </Button>
          )}
        </div>

        {/* Telegram Notifications Card */}
        <Card className="glass-effect border-border/50 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Send className="h-5 w-5 text-[#0088cc]" />
              {t('notif_telegram_title')}
            </CardTitle>
            <CardDescription>
              {t('notif_telegram_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('notif_telegram_get_id')}
              </p>
              <Button
                variant="outline"
                className="w-full gap-2"
                asChild
              >
                <a 
                  href="https://t.me/Updatelevobot?start=getid" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Send className="h-4 w-4 text-[#0088cc]" />
                  {t('notif_telegram_open_bot')}
                </a>
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {t('notif_telegram_paste')}
              </p>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="telegram_chat_id" className="text-sm">
                  {t('notif_telegram_id_label')}
                </Label>
                <Input
                  id="telegram_chat_id"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="123456789"
                  dir="ltr"
                  className="font-mono"
                />
              </div>
              <Button
                onClick={saveTelegramChatId}
                disabled={savingTelegram}
                className="self-end"
              >
                {savingTelegram && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {profile?.telegram_chat_id ? t('common_update') : t('common_save')}
              </Button>
            </div>
            {profile?.telegram_chat_id && (
              <p className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {t('notif_telegram_active')}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!notifications || notifications.length === 0 ? (
            <Card className="glass-effect border-border/50">
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t('notif_empty')}</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`glass-effect border-border/50 ${
                  !notification.read ? 'bg-primary/5' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="relative">
                        {getNotificationIcon(notification.type)}
                        {!notification.read && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500"></span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">
                            {notification.title}
                          </CardTitle>
                          {!notification.read && (
                            <Badge variant="secondary" className="text-xs">
                              {t('common_new')}
                            </Badge>
                          )}
                          {notification.is_general && (
                            <Badge variant="outline" className="text-xs">
                              {t('common_general')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                    {!notification.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead.mutate(notification.id)}
                        disabled={markAsRead.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent
                  style={{
                    fontFamily: notification.font_family || 'Cairo',
                    color: notification.text_color || undefined,
                    backgroundColor: notification.background_color || undefined,
                    borderRadius: '0.5rem',
                    padding: '1rem',
                  }}
                >
                  <p>{notification.message}</p>
                  {notification.related_id && (
                    <Button
                      variant="link"
                      className="mt-2 p-0 h-auto"
                      onClick={() => {
                        const text = `${notification.title ?? ''} ${notification.message ?? ''}`;
                        const isWallet = text.includes('محفظة') || text.includes('تعبئة') || text.includes('سحب');
                        const isCustom = text.includes('المخصص');
                        const isCompetition = text.includes('مسابقة') || text.includes('تذكرة');
                        const isChat = text.includes('رسالة') || text.includes('محادثة');
                        const isOrder = text.includes('طلب') || text.includes('توصيل') || text.includes('شحن');
                        
                        if (isWallet) {
                          navigate(ADMIN_ROUTES.wallet);
                        } else if (isCustom) {
                          navigate('/my-requests');
                        } else if (isCompetition) {
                          navigate('/competitions');
                        } else if (isChat) {
                          navigate('/notifications');
                        } else if (isOrder && notification.related_id) {
                          navigate(`/order/${notification.related_id}`);
                        }
                      }}
                    >
                      {t('common_view_details')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Notifications;
