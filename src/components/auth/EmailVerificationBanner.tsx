import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Mail, X } from 'lucide-react';
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
  const [dismissed, setDismissed] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      checkEmailVerification();
    } else {
      // No user = no banner
      onHeightChange?.(0);
    }
  }, [user]);

  // Report height changes
  useEffect(() => {
    const isVisible = showBanner && !emailVerified && !dismissed;
    if (!isVisible) {
      onHeightChange?.(0);
      return;
    }
    
    const updateHeight = () => {
      const height = bannerRef.current?.offsetHeight || 0;
      onHeightChange?.(height);
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [showBanner, emailVerified, dismissed, onHeightChange]);

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

  const handleOpenVerificationDialog = () => {
    if (!user?.email) return;
    // Just open the dialog - the dialog itself handles sending the code
    setShowVerificationDialog(true);
  };

  const handleVerified = () => {
    setEmailVerified(true);
    setShowBanner(false);
    toast.success('تم تأكيد بريدك الإلكتروني بنجاح! 🎉');
  };

  if (!showBanner || emailVerified || dismissed) return null;

  return (
    <>
      <div 
        ref={bannerRef}
        className="fixed top-0 left-0 right-0 z-[60] py-2.5 px-4 shadow-lg" 
        style={{ backgroundColor: '#f59e0b', color: '#000' }}
      >
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-bold">
                بريدك الإلكتروني غير مؤكد
              </p>
              <p className="text-xs opacity-80">
                يرجى تأكيد بريدك للوصول الكامل للموقع
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleOpenVerificationDialog}
              className="text-amber-950 hover:opacity-80"
              style={{ backgroundColor: '#000', color: '#f59e0b' }}
            >
              <Mail className="h-4 w-4 ml-2" />
              تأكيد البريد
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="hover:bg-warning-foreground/10"
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
