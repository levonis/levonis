import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, User, Mail, AtSign, Phone, MapPin, Instagram, MessageCircle, Facebook, Loader2, Sparkles } from 'lucide-react';
import { SignupStepProps } from './types';

interface Step5ReviewProps extends SignupStepProps {
  onSubmit: () => void;
  submitting: boolean;
}

export default function Step5Review({ data, onBack, onSubmit, loading, submitting }: Step5ReviewProps) {
  const hasAddress = data.address.governorate || data.address.city;
  const hasSocial = data.socialLinks.instagram || data.socialLinks.whatsapp || data.socialLinks.facebook;

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold">مراجعة البيانات</h2>
        <p className="text-sm text-muted-foreground mt-1">تأكد من صحة معلوماتك قبل إنشاء الحساب</p>
      </div>

      <div className="space-y-4">
        {/* Avatar & Name */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/30">
            <img src={data.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">{data.fullName}</h3>
            <p className="text-sm text-muted-foreground" dir="ltr">@{data.username}</p>
          </div>
        </div>

        {/* Account Info */}
        <div className="p-4 bg-muted/30 rounded-xl space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground mb-2">معلومات الحساب</h4>
          
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-sm" dir="ltr">{data.email}</span>
            <CheckCircle2 className="w-4 h-4 text-green-500 mr-auto" />
          </div>
        </div>

        {/* Optional Info */}
        {(data.phone || hasAddress || hasSocial) && (
          <div className="p-4 bg-muted/30 rounded-xl space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground mb-2">معلومات إضافية</h4>
            
            {data.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-sm" dir="ltr">{data.phone}</span>
              </div>
            )}

            {hasAddress && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary mt-0.5" />
                <span className="text-sm">
                  {[
                    data.address.governorate,
                    data.address.city,
                    data.address.area,
                    data.address.street
                  ].filter(Boolean).join('، ')}
                </span>
              </div>
            )}

            {data.socialLinks.instagram && (
              <div className="flex items-center gap-3">
                <Instagram className="w-4 h-4 text-pink-500" />
                <span className="text-sm" dir="ltr">@{data.socialLinks.instagram}</span>
              </div>
            )}

            {data.socialLinks.whatsapp && (
              <div className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm" dir="ltr">{data.socialLinks.whatsapp}</span>
              </div>
            )}

            {data.socialLinks.facebook && (
              <div className="flex items-center gap-3">
                <Facebook className="w-4 h-4 text-blue-500" />
                <span className="text-sm" dir="ltr">{data.socialLinks.facebook}</span>
              </div>
            )}
          </div>
        )}

        {/* Referral Code */}
        {data.referralCode && (
          <div className="p-4 bg-primary/10 rounded-xl">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">كود الدعوة: {data.referralCode}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading || submitting}
          className="flex-1"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          تعديل
        </Button>
        <Button
          onClick={onSubmit}
          disabled={loading || submitting}
          className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold h-12"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin ml-2" />
              جاري الإنشاء...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 ml-2" />
              إنشاء الحساب
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        بإنشاء حساب، فإنك توافق على{' '}
        <a href="/terms" className="text-primary hover:underline">شروط الاستخدام</a>
        {' '}و{' '}
        <a href="/privacy" className="text-primary hover:underline">سياسة الخصوصية</a>
      </p>
    </div>
  );
}
