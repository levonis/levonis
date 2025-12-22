import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Plus, Trash2, Loader2, Save, Ticket, Gift, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface TicketBundle {
  id: string;
  quantity: number;
  bonus_tickets: number;
  price: number;
  label: string;
  highlight: boolean;
  active: boolean;
  competition_type?: string;
}

export default function AdminTicketBundles() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [bundles, setBundles] = useState<TicketBundle[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing bundles from settings
  const { isLoading } = useQuery({
    queryKey: ['ticket-bundles-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'ticket_bundles')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      const defaultBundles: TicketBundle[] = [
        { id: '1', quantity: 10, bonus_tickets: 0, price: 2500, label: 'عادي', highlight: false, active: true },
        { id: '2', quantity: 20, bonus_tickets: 2, price: 5000, label: 'مميز', highlight: false, active: true },
        { id: '3', quantity: 36, bonus_tickets: 4, price: 9000, label: 'العرض الذهبي', highlight: true, active: true },
        { id: '4', quantity: 50, bonus_tickets: 10, price: 12500, label: 'باقة VIP', highlight: false, active: true },
      ];
      
      const savedBundles = (data?.setting_value as unknown as TicketBundle[]) || defaultBundles;
      setBundles(savedBundles);
      return savedBundles;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (bundlesToSave: TicketBundle[]) => {
      const { data: existing } = await supabase
        .from('default_settings')
        .select('id')
        .eq('setting_key', 'ticket_bundles')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('default_settings')
          .update({ setting_value: JSON.parse(JSON.stringify(bundlesToSave)) })
          .eq('setting_key', 'ticket_bundles');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('default_settings')
          .insert([{ setting_key: 'ticket_bundles', setting_value: JSON.parse(JSON.stringify(bundlesToSave)) }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-bundles-settings'] });
      toast.success('تم حفظ عروض التذاكر بنجاح');
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error('خطأ في الحفظ: ' + error.message);
    }
  });

  const addBundle = () => {
    const newBundle: TicketBundle = {
      id: Date.now().toString(),
      quantity: 10,
      bonus_tickets: 0,
      price: 2500,
      label: 'عرض جديد',
      highlight: false,
      active: true
    };
    setBundles([...bundles, newBundle]);
    setHasChanges(true);
  };

  const updateBundle = (id: string, field: keyof TicketBundle, value: any) => {
    setBundles(bundles.map(b => b.id === id ? { ...b, [field]: value } : b));
    setHasChanges(true);
  };

  const removeBundle = (id: string) => {
    setBundles(bundles.filter(b => b.id !== id));
    setHasChanges(true);
  };

  const calculateSavings = (bundle: TicketBundle) => {
    const ticketPrice = 250; // Base price per ticket
    const regularCost = bundle.quantity * ticketPrice;
    const totalTickets = bundle.quantity + bundle.bonus_tickets;
    const effectivePrice = bundle.price / totalTickets;
    const savings = regularCost - bundle.price;
    const savingsPercent = (savings / regularCost) * 100;
    return { savings, savingsPercent, totalTickets, effectivePrice };
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Ticket className="h-6 w-6 text-primary" />
              إدارة عروض التذاكر
            </h1>
            <p className="text-sm text-muted-foreground">تحديد باقات التذاكر والأسعار والهدايا</p>
          </div>
          
          <Button
            onClick={() => saveMutation.mutate(bundles)}
            disabled={!hasChanges || saveMutation.isPending}
            className="gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ التغييرات
          </Button>
        </div>

        {/* Bundles Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const { savings, savingsPercent, totalTickets, effectivePrice } = calculateSavings(bundle);
            
            return (
              <Card 
                key={bundle.id} 
                className={`relative ${bundle.highlight ? 'border-primary ring-2 ring-primary/20' : ''} ${!bundle.active ? 'opacity-60' : ''}`}
              >
                {bundle.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1 bg-primary">
                      <Sparkles className="h-3 w-3" />
                      الأفضل
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Input
                        value={bundle.label}
                        onChange={(e) => updateBundle(bundle.id, 'label', e.target.value)}
                        className="font-bold text-lg h-8 w-40"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeBundle(bundle.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">عدد التذاكر</Label>
                      <Input
                        type="number"
                        value={bundle.quantity}
                        onChange={(e) => updateBundle(bundle.id, 'quantity', parseInt(e.target.value) || 0)}
                        min={1}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Gift className="h-3 w-3" />
                        تذاكر هدية
                      </Label>
                      <Input
                        type="number"
                        value={bundle.bonus_tickets}
                        onChange={(e) => updateBundle(bundle.id, 'bonus_tickets', parseInt(e.target.value) || 0)}
                        min={0}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">السعر (دينار)</Label>
                    <Input
                      type="number"
                      value={bundle.price}
                      onChange={(e) => updateBundle(bundle.id, 'price', parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  
                  {/* Stats */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي التذاكر:</span>
                      <span className="font-bold">{totalTickets}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">سعر التذكرة الفعلي:</span>
                      <span className="font-bold">{effectivePrice.toFixed(0)} دينار</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>التوفير:</span>
                        <span className="font-bold">{savings.toLocaleString()} ({savingsPercent.toFixed(0)}%)</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Toggles */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={bundle.highlight}
                        onCheckedChange={(checked) => updateBundle(bundle.id, 'highlight', checked)}
                      />
                      <Label className="text-xs">عرض مميز</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={bundle.active}
                        onCheckedChange={(checked) => updateBundle(bundle.id, 'active', checked)}
                      />
                      <Label className="text-xs">مفعّل</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Add New Bundle Card */}
          <Card 
            className="border-dashed border-2 flex items-center justify-center min-h-[300px] cursor-pointer hover:border-primary/50 transition-colors"
            onClick={addBundle}
          >
            <CardContent className="text-center">
              <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">إضافة باقة جديدة</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              ملخص العروض
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold text-primary">{bundles.filter(b => b.active).length}</p>
                <p className="text-sm text-muted-foreground">عروض نشطة</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold text-primary">
                  {bundles.reduce((sum, b) => sum + b.bonus_tickets, 0)}
                </p>
                <p className="text-sm text-muted-foreground">إجمالي التذاكر المجانية</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold text-primary">{bundles.filter(b => b.highlight).length}</p>
                <p className="text-sm text-muted-foreground">عروض مميزة</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold text-primary">
                  {Math.max(...bundles.map(b => calculateSavings(b).savingsPercent), 0).toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground">أعلى توفير</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
