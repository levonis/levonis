import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Smartphone, Apple, Shield, Zap, RefreshCw, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const logoNew = '/logo-small.webp';

type AppVersion = {
  id: string;
  version: string;
  platform: string;
  download_url: string;
  file_size_mb: number | null;
  release_notes_ar: string | null;
  is_latest: boolean;
  created_at: string;
};

const detectPlatform = (): 'android' | 'ios' | 'desktop' | 'native' => {
  if (typeof window === 'undefined') return 'desktop';
  // @ts-ignore
  if (window.Capacitor?.isNativePlatform?.()) return 'native';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'desktop';
};

const DownloadApp = () => {
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | 'native'>('desktop');

  useEffect(() => {
    setPlatform(detectPlatform());
    document.title = 'حمّل تطبيق LEVONIS | متجرك بين يديك';
  }, []);

  const { data: androidVersion, isLoading } = useQuery({
    queryKey: ['latest-app-version', 'android'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('platform', 'android')
        .eq('is_active', true)
        .order('is_latest', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AppVersion | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Hide page if user is already inside the native app
  if (platform === 'native') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">أنت تستخدم التطبيق بالفعل ✨</h1>
          <p className="text-muted-foreground">آخر التحديثات تصلك تلقائياً.</p>
          <Button asChild>
            <Link to="/">العودة للرئيسية</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const handleDownload = () => {
    if (!androidVersion?.download_url) return;
    window.location.href = androidVersion.download_url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Hero */}
      <div className="container mx-auto px-4 pt-16 pb-12 max-w-3xl">
        <div className="text-center space-y-6">
          <div className="inline-block p-4 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm border border-primary/30 shadow-2xl">
            <img
              src={logoNew}
              alt="LEVONIS"
              className="h-24 w-24 object-contain"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-b from-primary to-accent bg-clip-text text-transparent">
              حمّل تطبيق LEVONIS
            </h1>
            <p className="text-lg text-muted-foreground">
              تجربة أسرع، إشعارات فورية، وصول بنقرة واحدة
            </p>
          </div>

          {androidVersion && (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Badge variant="secondary" className="text-sm">
                الإصدار {androidVersion.version}
              </Badge>
              {androidVersion.file_size_mb && (
                <Badge variant="outline" className="text-sm">
                  {androidVersion.file_size_mb} MB
                </Badge>
              )}
              <Badge variant="outline" className="text-sm">
                {new Date(androidVersion.created_at).toLocaleDateString('ar-IQ')}
              </Badge>
            </div>
          )}
        </div>

        {/* Download buttons */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {/* Android */}
          <Card className={`p-6 border-2 transition-all ${platform === 'android' ? 'border-primary shadow-lg shadow-primary/20' : 'border-border'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold">Android</h3>
                <p className="text-xs text-muted-foreground">ملف APK مباشر</p>
              </div>
            </div>

            {isLoading ? (
              <Button disabled className="w-full" size="lg">
                جاري التحميل...
              </Button>
            ) : androidVersion ? (
              <Button
                onClick={handleDownload}
                size="lg"
                className="w-full bg-gradient-to-b from-primary to-accent hover:opacity-90 text-primary-foreground font-bold"
              >
                <Download className="ml-2 h-5 w-5" />
                تحميل APK
              </Button>
            ) : (
              <Button disabled className="w-full" size="lg" variant="outline">
                لم يتم نشر إصدار بعد
              </Button>
            )}
          </Card>

          {/* iOS */}
          <Card className={`p-6 border-2 transition-all ${platform === 'ios' ? 'border-primary shadow-lg shadow-primary/20' : 'border-border'} opacity-70`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-muted">
                <Apple className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold">iPhone</h3>
                <p className="text-xs text-muted-foreground">App Store</p>
              </div>
            </div>
            <Button disabled className="w-full" size="lg" variant="outline">
              قريباً
            </Button>
          </Card>
        </div>

        {/* Features */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, title: 'سرعة فائقة', desc: 'فتح فوري وأداء سلس' },
            { icon: RefreshCw, title: 'تحديثات تلقائية', desc: 'بدون إعادة تحميل' },
            { icon: Shield, title: 'آمن 100%', desc: 'موقع رسمي معتمد' },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-4 text-center bg-card/50 backdrop-blur">
              <Icon className="h-8 w-8 text-primary mx-auto mb-2" />
              <h4 className="font-bold text-sm">{title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </Card>
          ))}
        </div>

        {/* Install instructions */}
        {(platform === 'android' || platform === 'desktop') && androidVersion && (
          <Card className="mt-8 p-6 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-3 flex-1">
                <h3 className="font-bold">طريقة التثبيت على Android</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>اضغط زر "تحميل APK" أعلاه</li>
                  <li>افتح الملف بعد اكتمال التحميل</li>
                  <li>قد يطلب الجهاز السماح بـ "التثبيت من مصادر غير معروفة" — اقبل</li>
                  <li>اضغط "تثبيت" وانتظر بضع ثواني</li>
                  <li>افتح التطبيق وسجّل دخولك كالمعتاد</li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  هذا التحذير طبيعي لكل التطبيقات خارج Google Play، والتطبيق آمن تماماً.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Release notes */}
        {androidVersion?.release_notes_ar && (
          <Card className="mt-6 p-6">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              ما الجديد في الإصدار {androidVersion.version}
            </h3>
            <div className="text-sm text-muted-foreground whitespace-pre-line">
              {androidVersion.release_notes_ar}
            </div>
          </Card>
        )}

        {/* Back link */}
        <div className="mt-8 text-center">
          <Button asChild variant="ghost">
            <Link to="/">
              العودة للرئيسية
              <ArrowRight className="mr-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DownloadApp;
