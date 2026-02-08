import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, MapPin, ArrowLeft, ArrowRight, Instagram, MessageCircle, Facebook, ExternalLink, SkipForward } from 'lucide-react';
import { SignupStepProps, IRAQI_GOVERNORATES } from './types';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function Step4OptionalInfo({ data, updateData, onNext, onBack, loading }: SignupStepProps) {
  const [showAddress, setShowAddress] = useState(false);
  const [showSocial, setShowSocial] = useState(false);

  const updateAddress = (field: string, value: string) => {
    updateData({
      address: {
        ...data.address,
        [field]: value
      }
    });
  };

  const updateSocialLinks = (field: string, value: string) => {
    updateData({
      socialLinks: {
        ...data.socialLinks,
        [field]: value
      }
    });
  };

  const getSocialLink = (platform: string, handle: string) => {
    if (!handle) return '';
    switch (platform) {
      case 'instagram':
        return `https://instagram.com/${handle}`;
      case 'facebook':
        return `https://facebook.com/${handle}`;
      case 'whatsapp':
        return `https://wa.me/${handle.replace(/\D/g, '')}`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Phone className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">معلومات إضافية</h2>
        <p className="text-sm text-muted-foreground mt-1">هذه الخطوة اختيارية ويمكنك تجاوزها</p>
      </div>

      <div className="space-y-4">
        {/* Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            رقم الهاتف
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="07XX XXX XXXX"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            disabled={loading}
            dir="ltr"
          />
        </div>

        {/* Address Section */}
        <Collapsible open={showAddress} onOpenChange={setShowAddress}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>إضافة عنوان التوصيل</span>
              </div>
              <ArrowLeft className={cn("w-4 h-4 transition-transform", showAddress && "rotate-90")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 bg-muted/30 rounded-lg p-3">
            <div className="space-y-2">
              <Label>المحافظة</Label>
              <Select
                value={data.address.governorate}
                onValueChange={(value) => updateAddress('governorate', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المحافظة" />
                </SelectTrigger>
                <SelectContent>
                  {IRAQI_GOVERNORATES.map((gov) => (
                    <SelectItem key={gov} value={gov}>{gov}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المدينة/القضاء</Label>
              <Input
                placeholder="مثال: الكرادة"
                value={data.address.city}
                onChange={(e) => updateAddress('city', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>المنطقة/الحي</Label>
              <Input
                placeholder="مثال: زيونة"
                value={data.address.area}
                onChange={(e) => updateAddress('area', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>الشارع/الزقاق</Label>
              <Input
                placeholder="مثال: شارع 14 زقاق 5"
                value={data.address.street}
                onChange={(e) => updateAddress('street', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>أقرب نقطة دالة</Label>
              <Input
                placeholder="مثال: قرب جامع الحسين"
                value={data.address.nearestLandmark}
                onChange={(e) => updateAddress('nearestLandmark', e.target.value)}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Social Links Section */}
        <Collapsible open={showSocial} onOpenChange={setShowSocial}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                <span>إضافة روابط التواصل</span>
              </div>
              <ArrowLeft className={cn("w-4 h-4 transition-transform", showSocial && "rotate-90")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 bg-muted/30 rounded-lg p-3">
            {/* Instagram */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                انستغرام
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="اسم المستخدم فقط"
                  value={data.socialLinks.instagram}
                  onChange={(e) => updateSocialLinks('instagram', e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                {data.socialLinks.instagram && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(getSocialLink('instagram', data.socialLinks.instagram), '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {data.socialLinks.instagram && (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {getSocialLink('instagram', data.socialLinks.instagram)}
                </p>
              )}
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-500" />
                واتساب
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="رقم الهاتف مع مفتاح الدولة"
                  value={data.socialLinks.whatsapp}
                  onChange={(e) => updateSocialLinks('whatsapp', e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                {data.socialLinks.whatsapp && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(getSocialLink('whatsapp', data.socialLinks.whatsapp), '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {data.socialLinks.whatsapp && (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {getSocialLink('whatsapp', data.socialLinks.whatsapp)}
                </p>
              )}
            </div>

            {/* Facebook */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="w-4 h-4 text-blue-500" />
                فيسبوك
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="اسم المستخدم أو المعرف"
                  value={data.socialLinks.facebook}
                  onChange={(e) => updateSocialLinks('facebook', e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                {data.socialLinks.facebook && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(getSocialLink('facebook', data.socialLinks.facebook), '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {data.socialLinks.facebook && (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {getSocialLink('facebook', data.socialLinks.facebook)}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          السابق
        </Button>
        <Button
          onClick={onNext}
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
        >
          التالي
          <ArrowLeft className="w-4 h-4 mr-2" />
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onNext}
        disabled={loading}
        className="w-full text-muted-foreground"
      >
        <SkipForward className="w-4 h-4 ml-2" />
        تجاوز هذه الخطوة
      </Button>
    </div>
  );
}
