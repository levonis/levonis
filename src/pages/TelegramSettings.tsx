import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, Send, ArrowLeft, LinkIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import { motion } from 'framer-motion';

interface NotificationPrefs {
  orders: boolean;
  wallet: boolean;
  community: boolean;
  promotions: boolean;
  competitions: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  orders: true,
  wallet: true,
  community: true,
  promotions: true,
  competitions: true,
};

const NOTIF_CATEGORIES: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: 'orders', label: 'الطلبات', desc: 'تحديثات حالة الطلبات والشحن' },
  { key: 'wallet', label: 'المحفظة', desc: 'الإيداعات والسحوبات وتغييرات الرصيد' },
  { key: 'community', label: 'المجتمع', desc: 'إشعارات المجتمع والطلبات المخصصة' },
  { key: 'promotions', label: 'العروض', desc: 'عروض وخصومات حصرية' },
  { key: 'competitions', label: 'المسابقات', desc: 'إشعارات المسابقات والجوائز' },
];

export default function TelegramSettings() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramPrefs, setTelegramPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-telegram-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('telegram_chat_id, telegram_notifications')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      if (profile.telegram_chat_id) setTelegramChatId(profile.telegram_chat_id);
      if (profile.telegram_notifications) {
        setTelegramPrefs({ ...DEFAULT_PREFS, ...(profile.telegram_notifications as unknown as NotificationPrefs) });
      }
    }
  }, [profile]);

  const toggleTelegramPref = async (key: keyof NotificationPrefs) => {
    if (!user?.id) return;
    const updated = { ...telegramPrefs, [key]: !telegramPrefs[key] };
    setTelegramPrefs(updated);
    const { error } = await supabase
      .from('profiles')
      .update({ telegram_notifications: updated as any })
      .eq('id', user.id);
    if (error) {
      toast.error('حدث خطأ في حفظ الإعدادات');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['profile-telegram-settings'] });
    toast.success('تم تحديث الإعدادات');
  };

  const saveTelegramChatId = async () => {
    if (!user?.id) return;
    setSavingTelegram(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: telegramChatId || null })
        .eq('id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['profile-telegram-settings'] });
      toast.success(telegramChatId ? t('notif_telegram_saved') : t('notif_telegram_removed'));
    } catch {
      toast.error(t('notif_telegram_save_error'));
    } finally {
      setSavingTelegram(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0088cc]/30 to-[#0088cc]/10 backdrop-blur-xl flex items-center justify-center border border-[#0088cc]/20">
          <Loader2 className="h-7 w-7 animate-spin text-[#0088cc]" />
        </div>
      </div>
    );
  }

  const isLinked = !!profile?.telegram_chat_id;

  return (
    <div className="min-h-screen bg-background pt-6 pb-24" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0088cc]/8 via-[#0088cc]/3 to-transparent" />
        <div className="absolute top-6 right-12 h-32 w-32 rounded-full bg-[#0088cc]/5 blur-3xl" />

        <div className="relative container mx-auto px-4 py-6 max-w-lg">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            رجوع
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0088cc]/25 to-[#0088cc]/10 backdrop-blur-xl flex items-center justify-center border border-[#0088cc]/30 shadow-lg shadow-[#0088cc]/10">
                <Send className="h-7 w-7 text-[#0088cc]" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">ربط حساب تليجرام</h1>
              <p className="text-sm text-muted-foreground mt-0.5">اربط حسابك لتلقي الإشعارات عبر تليجرام</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 max-w-lg space-y-4 mt-4">
        {/* Status Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className={`rounded-2xl border p-4 flex items-center gap-3 ${isLinked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isLinked ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
              {isLinked ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <LinkIcon className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div>
              <p className={`text-sm font-bold ${isLinked ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isLinked ? 'الحساب مربوط بنجاح ✓' : 'الحساب غير مربوط'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isLinked ? 'ستتلقى الإشعارات عبر تليجرام' : 'اتبع الخطوات أدناه لربط حسابك'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Steps Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4">
            <h3 className="text-sm font-black text-foreground">خطوات الربط</h3>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[#0088cc]/15 flex items-center justify-center text-xs font-black text-[#0088cc]">1</div>
                <div className="flex-1">
                  <p className="text-sm text-foreground font-medium">افتح البوت في تليجرام</p>
                  <p className="text-xs text-muted-foreground mt-0.5">اضغط على الزر أدناه لفتح بوت ليفونيس</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 rounded-xl border-[#0088cc]/30 hover:bg-[#0088cc]/10 text-foreground font-bold"
                asChild
              >
                <a href="https://t.me/Updatelevobot?start=getid" target="_blank" rel="noopener noreferrer">
                  <Send className="h-4 w-4 text-[#0088cc]" />
                  فتح البوت في تليجرام
                  <ExternalLink className="h-3 w-3 mr-auto text-muted-foreground" />
                </a>
              </Button>

              {/* Step 2 */}
              <div className="flex gap-3 mt-2">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[#0088cc]/15 flex items-center justify-center text-xs font-black text-[#0088cc]">2</div>
                <div className="flex-1">
                  <p className="text-sm text-foreground font-medium">اضغط "Start" في البوت</p>
                  <p className="text-xs text-muted-foreground mt-0.5">سيرسل لك البوت رقم معرّف حسابك (Chat ID)</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[#0088cc]/15 flex items-center justify-center text-xs font-black text-[#0088cc]">3</div>
                <div className="flex-1">
                  <p className="text-sm text-foreground font-medium">الصق الرقم هنا</p>
                  <p className="text-xs text-muted-foreground mt-0.5">انسخ الرقم من البوت والصقه في الحقل أدناه</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/30 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="telegram_chat_id" className="text-xs font-bold">{t('notif_telegram_id_label')}</Label>
                <Input
                  id="telegram_chat_id"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="123456789"
                  dir="ltr"
                  className="font-mono rounded-xl bg-background/50 border-border/30 h-10"
                />
              </div>
              <Button
                onClick={saveTelegramChatId}
                disabled={savingTelegram}
                className="w-full rounded-xl h-10 font-bold gap-2"
              >
                {savingTelegram && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isLinked ? 'تحديث الربط' : 'ربط الحساب'}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Notification Preferences - only if linked */}
        {isLinked && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
            <div className="rounded-2xl border border-border/40 bg-card p-5">
              <h3 className="text-sm font-black text-foreground mb-1">إعدادات إشعارات تليجرام</h3>
              <p className="text-xs text-muted-foreground mb-3">اختر أنواع الإشعارات التي تريد استقبالها عبر تليجرام</p>
              <div className="space-y-2">
                {NOTIF_CATEGORIES.map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-xl bg-background/40 border border-border/20 p-3 cursor-pointer hover:bg-background/60 transition-colors"
                  >
                    <Checkbox
                      checked={telegramPrefs[key]}
                      onCheckedChange={() => toggleTelegramPref(key)}
                      className="data-[state=checked]:bg-[#0088cc] data-[state=checked]:border-[#0088cc]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
