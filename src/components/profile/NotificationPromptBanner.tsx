import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const DISMISS_KEY = 'notif_prompt_dismissed';

export default function NotificationPromptBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permission, requestPermission } = useNotificationPermission();
  const [dismissed, setDismissed] = useState(true);

  const { data: profile } = useQuery({
    queryKey: ['profile-telegram-check', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const siteEnabled = permission === 'granted';
  const telegramLinked = !!profile?.telegram_chat_id;

  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISS_KEY);
    if (!wasDismissed) setDismissed(false);
  }, []);

  // Don't show if both are enabled or dismissed
  if (dismissed || (siteEnabled && telegramLinked)) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleEnableSite = async () => {
    await requestPermission();
  };

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/5 via-card to-card p-4 space-y-3">
      <button
        onClick={handleDismiss}
        className="absolute top-2 left-2 p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground"
        title="عدم الإظهار مرة أخرى"
      >
        <X className="h-4 w-4" />
      </button>

      <div>
        <h3 className="text-sm font-black text-foreground">🔔 فعّل الإشعارات</h3>
        <p className="text-xs text-muted-foreground mt-0.5">لا تفوّت أي تحديث مهم على طلباتك وحسابك</p>
      </div>

      <div className="flex flex-col gap-2">
        {!siteEnabled && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 rounded-xl text-xs font-bold h-9"
            onClick={handleEnableSite}
          >
            <Bell className="h-4 w-4 text-primary" />
            تفعيل إشعارات الموقع
            {permission === 'denied' && (
              <span className="mr-auto text-[10px] text-destructive">محظورة - فعّلها من إعدادات المتصفح</span>
            )}
          </Button>
        )}

        {!telegramLinked && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 rounded-xl text-xs font-bold h-9"
            onClick={() => navigate('/telegram-settings')}
          >
            <Send className="h-4 w-4 text-[#0088cc]" />
            ربط حساب تليجرام
          </Button>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        عدم الإظهار مرة أخرى
      </button>
    </div>
  );
}
