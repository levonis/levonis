import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Mail, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EmailVerificationDialog from './EmailVerificationDialog';

interface EmailVerificationBannerProps {
  onHeightChange?: (height: number) => void;
}

export default function EmailVerificationBanner({ onHeightChange }: EmailVerificationBannerProps) {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Report height changes
  useEffect(() => {
    if (!onHeightChange) return;
    
    const updateHeight = () => {
      const isVisible = showBanner && !emailVerified && !dismissed;
      const height = isVisible && bannerRef.current ? bannerRef.current.offsetHeight : 0;
      onHeightChange(height);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [showBanner, emailVerified, dismissed, onHeightChange]);

  useEffect(() => {
    if (user) {
      checkEmailVerification();
    }
  }, [user]);

  const checkEmailVerification = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified, email')
      .eq('id', user.id)
      .single();

    if (profile && !profile.email_verified) {
      setEmailVerified(false);
      setShowBanner(true);
    } else {
      setEmailVerified(true);
      setShowBanner(false);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!user?.email) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { 
          email: user.email, 
          type: 'signup',
          user_id: user.id 
        }
      });

      if (error) throw error;

      if (data.success) {
        setShowVerificationDialog(true);
        toast.success('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
      } else {
        toast.error(data.error || 'فشل في إرسال الرمز');
      }
    } catch (error: any) {
      console.error('Send code error:', error);
      toast.error(error.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleVerified = () => {
    setEmailVerified(true);
    setShowBanner(false);
    toast.success('تم تأكيد بريدك الإلكتروني بنجاح! 🎉');
  };

  if (!showBanner || emailVerified || dismissed) return null;

  return (
    <>
      <div ref={bannerRef} className="bg-amber-500 text-white py-2.5 px-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              بريدك الإلكتروني غير مؤكد - يرجى تأكيده للوصول الكامل
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSendVerificationCode}
              disabled={loading}
              className="bg-white hover:bg-white/90 text-amber-600 font-medium h-7 px-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin ml-1.5" />
                  جاري الإرسال
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5 ml-1.5" />
                  تأكيد الآن
                </>
              )}
            </Button>
            <button
              onClick={() => setDismissed(true)}
              className="hover:bg-white/20 rounded-full p-1 transition-colors"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {user?.email && (
        <EmailVerificationDialog
          open={showVerificationDialog}
          onOpenChange={setShowVerificationDialog}
          email={user.email}
          type="signup"
          userId={user.id}
          onVerified={handleVerified}
        />
      )}
    </>
  );
}
