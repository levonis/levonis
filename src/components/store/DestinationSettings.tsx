/**
 * Destination Settings - إعدادات الوجهة
 * 
 * يسمح للمستخدم بتحديد وجهة الشحن (للاستخدام في الحسابات)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Globe, Plane, Ship } from 'lucide-react';
import type { SourceCountry, ShippingType } from '@/hooks/useShippingCalculator';

interface DestinationSettingsProps {
  sourceCountry: SourceCountry;
  shippingType: ShippingType;
  onSourceCountryChange: (country: SourceCountry) => void;
  onShippingTypeChange: (type: ShippingType) => void;
  disabled?: boolean;
}

// Governorates in Iraq
const iraqGovernorates = [
  'بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'ذي قار', 
  'السليمانية', 'بابل', 'دهوك', 'ديالى', 'كربلاء', 'كركوك',
  'واسط', 'صلاح الدين', 'ميسان', 'القادسية', 'المثنى', 'الأنبار'
];

export default function DestinationSettings({
  sourceCountry,
  shippingType,
  onSourceCountryChange,
  onShippingTypeChange,
  disabled = false,
}: DestinationSettingsProps) {
  // Sea shipping only available from China
  const isSeaAvailable = sourceCountry === 'china';

  // Auto-switch to air if sea is selected but not available
  useEffect(() => {
    if (shippingType === 'sea' && !isSeaAvailable) {
      onShippingTypeChange('air');
    }
  }, [sourceCountry, shippingType, isSeaAvailable, onShippingTypeChange]);

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="w-4 h-4" />
          خيارات الشحن
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Source Country */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Globe className="h-3 w-3" />
              دولة المصدر
            </Label>
            <Select 
              value={sourceCountry} 
              onValueChange={(v) => onSourceCountryChange(v as SourceCountry)}
              disabled={disabled}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usa">🇺🇸 أمريكا</SelectItem>
                <SelectItem value="china">🇨🇳 الصين</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shipping Type */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              {shippingType === 'sea' ? <Ship className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
              نوع الشحن
            </Label>
            <Select 
              value={shippingType} 
              onValueChange={(v) => onShippingTypeChange(v as ShippingType)}
              disabled={disabled}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="air">
                  <span className="flex items-center gap-1">
                    <Plane className="w-3 h-3" />
                    جوي (سريع)
                  </span>
                </SelectItem>
                {isSeaAvailable && (
                  <SelectItem value="sea">
                    <span className="flex items-center gap-1">
                      <Ship className="w-3 h-3" />
                      بحري (اقتصادي)
                    </span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Info about shipping */}
        <p className="text-xs text-muted-foreground mt-3">
          {shippingType === 'air' 
            ? '✈️ الشحن الجوي: 7-14 يوم تقريباً' 
            : '🚢 الشحن البحري: 30-45 يوم تقريباً (متاح من الصين فقط)'}
        </p>
      </CardContent>
    </Card>
  );
}
