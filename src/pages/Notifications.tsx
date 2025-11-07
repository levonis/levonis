import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, Check, Info, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      toast.success('تم تعليم الإشعار كمقروء');
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
      toast.success('تم تعليم جميع الإشعارات كمقروءة');
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
      {/* Full page decorative border with animations */}
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-0 opacity-5 animate-float-decoration blur-sm"
        style={{
          backgroundImage: 'url(/images/decorative-border-new.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-primary mb-2 flex items-center gap-3">
              <Bell className="h-8 w-8" />
              الإشعارات
            </h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : 'جميع الإشعارات مقروءة'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsRead.mutate()}
              variant="outline"
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              تعليم الكل كمقروء
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {!notifications || notifications.length === 0 ? (
            <Card className="glass-effect border-border/50">
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">لا توجد إشعارات بعد</p>
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
                              جديد
                            </Badge>
                          )}
                          {notification.is_general && (
                            <Badge variant="outline" className="text-xs">
                              عام
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
                      onClick={() => navigate('/my-custom-requests')}
                    >
                      عرض التفاصيل
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