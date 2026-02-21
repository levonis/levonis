import { useState } from "react";
import { Truck, MapPin, Plus, X, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const IRAQ_GOVERNORATES = [
  "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "كربلاء", "ذي قار",
  "بابل", "ديالى", "الأنبار", "كركوك", "صلاح الدين", "واسط",
  "ميسان", "المثنى", "القادسية", "دهوك", "السليمانية",
];

interface DeliveryException {
  governorate: string;
  price: number;
}

interface DeliveryTier {
  min_order_amount: number;
  delivery_price: number;
}

interface DeliveryRules {
  exceptions: DeliveryException[];
  tiers: DeliveryTier[];
}

interface Props {
  deliveryPrice: number;
  deliveryRules: DeliveryRules;
  onUpdatePrice: (price: number) => void;
  onUpdateRules: (rules: DeliveryRules) => void;
}

export default function DeliverySettingsSection({ deliveryPrice, deliveryRules, onUpdatePrice, onUpdateRules }: Props) {
  const [newGov, setNewGov] = useState("");
  const [newGovPrice, setNewGovPrice] = useState("");
  const [newTierAmount, setNewTierAmount] = useState("");
  const [newTierPrice, setNewTierPrice] = useState("");

  const usedGovernorates = deliveryRules.exceptions.map(e => e.governorate);
  const availableGovernorates = IRAQ_GOVERNORATES.filter(g => !usedGovernorates.includes(g));

  const addException = () => {
    if (!newGov || newGovPrice === "") return;
    const updated = {
      ...deliveryRules,
      exceptions: [...deliveryRules.exceptions, { governorate: newGov, price: parseInt(newGovPrice) || 0 }],
    };
    onUpdateRules(updated);
    setNewGov("");
    setNewGovPrice("");
  };

  const removeException = (index: number) => {
    const updated = {
      ...deliveryRules,
      exceptions: deliveryRules.exceptions.filter((_, i) => i !== index),
    };
    onUpdateRules(updated);
  };

  const addTier = () => {
    if (!newTierAmount) return;
    const updated = {
      ...deliveryRules,
      tiers: [
        ...deliveryRules.tiers,
        { min_order_amount: parseInt(newTierAmount) || 0, delivery_price: parseInt(newTierPrice) || 0 },
      ].sort((a, b) => a.min_order_amount - b.min_order_amount),
    };
    onUpdateRules(updated);
    setNewTierAmount("");
    setNewTierPrice("");
  };

  const removeTier = (index: number) => {
    const updated = {
      ...deliveryRules,
      tiers: deliveryRules.tiers.filter((_, i) => i !== index),
    };
    onUpdateRules(updated);
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card p-3.5 space-y-4">
      {/* Default Delivery Price */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold">سعر التوصيل الافتراضي</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">السعر الذي يُطبّق على جميع المحافظات (لا يُحسب ضمن أرباحك)</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="1000"
            value={deliveryPrice || ''}
            placeholder="0"
            onChange={(e) => onUpdatePrice(parseInt(e.target.value) || 0)}
            className="flex-1 h-9 text-sm"
          />
          <span className="text-xs text-muted-foreground shrink-0">د.ع</span>
        </div>
      </div>

      {/* Governorate Exceptions */}
      <div className="space-y-2 pt-3 border-t border-border/30">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold">استثناءات المحافظات</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">حدد سعر توصيل مختلف لمحافظات معينة</p>

        {/* Existing exceptions */}
        {deliveryRules.exceptions.length > 0 && (
          <div className="space-y-1.5">
            {deliveryRules.exceptions.map((exc, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                <span className="text-xs font-medium flex-1">{exc.governorate}</span>
                <span className="text-xs text-primary font-bold">{exc.price.toLocaleString()} د.ع</span>
                <button onClick={() => removeException(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new exception */}
        {availableGovernorates.length > 0 && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select value={newGov} onValueChange={setNewGov}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="اختر محافظة" />
                </SelectTrigger>
                <SelectContent>
                  {availableGovernorates.map(g => (
                    <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              min="0"
              step="1000"
              value={newGovPrice}
              onChange={(e) => setNewGovPrice(e.target.value)}
              placeholder="السعر"
              className="w-24 h-9 text-xs"
            />
            <Button size="sm" variant="outline" onClick={addException} disabled={!newGov} className="h-9 px-2.5">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Amount-Based Tiers */}
      <div className="space-y-2 pt-3 border-t border-border/30">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold">تخفيض حسب مبلغ الطلب</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">عند وصول مبلغ الطلب لحد معين، يتغير سعر التوصيل (0 = مجاني)</p>

        {/* Existing tiers */}
        {deliveryRules.tiers.length > 0 && (
          <div className="space-y-1.5">
            {deliveryRules.tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                <span className="text-xs flex-1">
                  طلب ≥ <span className="font-bold">{tier.min_order_amount.toLocaleString()}</span> د.ع
                </span>
                <span className={`text-xs font-bold ${tier.delivery_price === 0 ? 'text-green-600' : 'text-primary'}`}>
                  {tier.delivery_price === 0 ? '🎉 مجاني' : `${tier.delivery_price.toLocaleString()} د.ع`}
                </span>
                <button onClick={() => removeTier(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new tier */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">الحد الأدنى للطلب</label>
            <Input
              type="number"
              min="0"
              step="5000"
              value={newTierAmount}
              onChange={(e) => setNewTierAmount(e.target.value)}
              placeholder="50000"
              className="h-9 text-xs"
            />
          </div>
          <div className="w-24">
            <label className="text-[10px] text-muted-foreground mb-1 block">سعر التوصيل</label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={newTierPrice}
              onChange={(e) => setNewTierPrice(e.target.value)}
              placeholder="0"
              className="h-9 text-xs"
            />
          </div>
          <Button size="sm" variant="outline" onClick={addTier} disabled={!newTierAmount} className="h-9 px-2.5">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
