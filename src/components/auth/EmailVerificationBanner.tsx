import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Mail, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EmailVerificationDialog from './EmailVerificationDialog';

export default function EmailVerificationBanner() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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
      <div className="bg-amber-500/10 border-b border-amber-500/30 py-3 px-4">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                بريدك الإلكتروني غير مؤكد
              </p>
              <p className="text-xs text-amber-300/80">
                يرجى تأكيد بريدك للوصول الكامل للموقع
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSendVerificationCode}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 ml-2" />
                  تأكيد البريد
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="text-amber-300 hover:text-amber-100 hover:bg-amber-500/20"
            >
              <X className="h-4 w-4" />
            </Button>
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
