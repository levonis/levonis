import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, MapPin, ArrowLeft, ArrowRight, Instagram, MessageCircle, Facebook, ExternalLink, SkipForward } from 'lucide-react';
import { SignupStepProps, IRAQI_GOVERNORATES } from './types';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/lib/i18n';

export default function Step4OptionalInfo({ data, updateData, onNext, onBack, loading }: SignupStepProps) {
  const { t, isRtl } = useLanguage();
  const [showAddress, setShowAddress] = useState(false);
  const [showSocial, setShowSocial] = useState(false);

  const updateAddress = (field: string, value: string) => {
    updateData({ address: { ...data.address, [field]: value } });
  };

  const updateSocialLinks = (field: string, value: string) => {
    updateData({ socialLinks: { ...data.socialLinks, [field]: value } });
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
        <h2 className="text-xl font-bold">{t('signup_s4_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('signup_s4_subtitle')}</p>
      </div>

      <div className="space-y-4">
        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            {t('signup_phone_label')}
          </Label>
          <Input
            id="phone" type="tel" placeholder={t('signup_phone_placeholder')}
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            disabled={loading} dir="ltr"
          />
        </div>

        {/* Address */}
        <Collapsible open={showAddress} onOpenChange={setShowAddress}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{t('signup_address_add')}</span>
              </div>
              <ArrowLeft className={cn("w-4 h-4 transition-transform", showAddress && "rotate-90")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 bg-muted/30 rounded-lg p-3">
            <div className="space-y-2">
              <Label>{t('signup_address_governorate')}</Label>
              <Select value={data.address.governorate} onValueChange={(value) => updateAddress('governorate', value)}>
                <SelectTrigger><SelectValue placeholder={t('signup_address_select_gov')} /></SelectTrigger>
                <SelectContent>
                  {IRAQI_GOVERNORATES.map((gov) => (
                    <SelectItem key={gov} value={gov}>{gov}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('signup_address_city')}</Label>
              <Input placeholder={t('signup_address_city_placeholder')}
                value={data.address.city}
                onChange={(e) => updateAddress('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('signup_address_area')}</Label>
              <Input placeholder={t('signup_address_area_placeholder')}
                value={data.address.area}
                onChange={(e) => updateAddress('area', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('signup_address_street')}</Label>
              <Input placeholder={t('signup_address_street_placeholder')}
                value={data.address.street}
                onChange={(e) => updateAddress('street', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('signup_address_landmark')}</Label>
              <Input placeholder={t('signup_address_landmark_placeholder')}
                value={data.address.nearestLandmark}
                onChange={(e) => updateAddress('nearestLandmark', e.target.value)} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Social */}
        <Collapsible open={showSocial} onOpenChange={setShowSocial}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                <span>{t('signup_social_add')}</span>
              </div>
              <ArrowLeft className={cn("w-4 h-4 transition-transform", showSocial && "rotate-90")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 bg-muted/30 rounded-lg p-3">
            {/* Instagram */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                {t('signup_social_instagram')}
              </Label>
              <div className="flex gap-2">
                <Input placeholder={t('signup_social_instagram_placeholder')}
                  value={data.socialLinks.instagram}
                  onChange={(e) => updateSocialLinks('instagram', e.target.value)}
                  dir="ltr" className="flex-1" />
                {data.socialLinks.instagram && (
                  <Button type="button" variant="outline" size="icon"
                    onClick={() => window.open(getSocialLink('instagram', data.socialLinks.instagram), '_blank')}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {data.socialLinks.instagram && (
                <p className="text-xs text-muted-foreground" dir="ltr">{getSocialLink('instagram', data.socialLinks.instagram)}</p>
              )}
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-500" />
                {t('signup_social_whatsapp')}
              </Label>
              <div className="flex gap-2">
                <Input placeholder={t('signup_social_whatsapp_placeholder')}
                  value={data.socialLinks.whatsapp}
                  onChange={(e) => updateSocialLinks('whatsapp', e.target.value)}
                  dir="ltr" className="flex-1" />
                {data.socialLinks.whatsapp && (
                  <Button type="button" variant="outline" size="icon"
                    onClick={() => window.open(getSocialLink('whatsapp', data.socialLinks.whatsapp), '_blank')}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {data.socialLinks.whatsapp && (
                <p className="text-xs text-muted-foreground" dir="ltr">{getSocialLink('whatsapp', data.socialLinks.whatsapp)}</p>
              )}
            </div>

            {/* Facebook */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="w-4 h-4 text-blue-500" />
                {t('signup_social_facebook')}
              </Label>
              <div className="flex gap-2">
                <Input placeholder={t('signup_social_facebook_placeholder')}
                  value={data.socialLinks.facebook}
                  onChange={(e) => updateSocialLinks('facebook', e.target.value)}
                  dir="ltr" className="flex-1" />
                {data.socialLinks.facebook && (
                  <Button type="button" variant="outline" size="icon"
                    onClick={() => window.open(getSocialLink('facebook', data.socialLinks.facebook), '_blank')}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {data.socialLinks.facebook && (
                <p className="text-xs text-muted-foreground" dir="ltr">{getSocialLink('facebook', data.socialLinks.facebook)}</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading} className="flex-1">
          <ArrowRight className={cn("w-4 h-4", isRtl ? "ml-2" : "mr-2 rotate-180")} />
          {t('signup_prev')}
        </Button>
        <Button onClick={onNext} disabled={loading}
          className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold">
          {t('signup_next')}
          <ArrowLeft className={cn("w-4 h-4", isRtl ? "mr-2" : "ml-2 rotate-180")} />
        </Button>
      </div>

      <Button type="button" variant="ghost" onClick={onNext} disabled={loading}
        className="w-full text-muted-foreground">
        <SkipForward className={cn("w-4 h-4", isRtl ? "ml-2" : "mr-2")} />
        {t('signup_skip_step')}
      </Button>
    </div>
  );
}
