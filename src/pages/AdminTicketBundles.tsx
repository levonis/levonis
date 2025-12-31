import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Save, Ticket, Gift, Sparkles, TrendingUp, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminStatsGrid, AdminStatCard, AdminLoading } from "@/components/admin/AdminLayout";

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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

  const moveBundle = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= bundles.length) return;
    const newBundles = [...bundles];
    const [removed] = newBundles.splice(fromIndex, 1);
    newBundles.splice(toIndex, 0, removed);
    setBundles(newBundles);
    setHasChanges(true);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveBundle(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const calculateSavings = (bundle: TicketBundle) => {
    const ticketPrice = 250;
    const regularCost = bundle.quantity * ticketPrice;
    const totalTickets = bundle.quantity + bundle.bonus_tickets;
    const effectivePrice = bundle.price / totalTickets;
    const savings = regularCost - bundle.price;
    const savingsPercent = (savings / regularCost) * 100;
    return { savings, savingsPercent, totalTickets, effectivePrice };
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="إدارة عروض التذاكر" icon={<Ticket className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <AdminLayout
      title="إدارة عروض التذاكر"
      description="تحديد باقات التذاكر والأسعار والهدايا - اسحب لتغيير الترتيب"
      icon={<Ticket className="h-5 w-5" />}
      actions={
        <Button
          onClick={() => saveMutation.mutate(bundles)}
          disabled={!hasChanges || saveMutation.isPending}
          size="sm"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
          ) : (
            <Save className="h-4 w-4 ml-2" />
          )}
          حفظ التغييرات
        </Button>
      }
    >
      {/* Bundles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {bundles.map((bundle, index) => {
          const { savings, savingsPercent, totalTickets, effectivePrice } = calculateSavings(bundle);
          
          return (
            <AdminCard 
              key={bundle.id}
              className={`relative cursor-move transition-all ${bundle.highlight ? 'border-primary ring-2 ring-primary/20' : ''} ${!bundle.active ? 'opacity-60' : ''} ${draggedIndex === index ? 'opacity-50 scale-95' : ''}`}
            >
              <div
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                {bundle.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="gap-1 bg-primary">
                      <Sparkles className="h-3 w-3" />
                      الأفضل
                    </Badge>
                  </div>
                )}
                
                <AdminCardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                      <Badge variant="secondary" className="text-xs">#{index + 1}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveBundle(index, index - 1)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveBundle(index, index + 1)}
                        disabled={index === bundles.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeBundle(bundle.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <Input
                    value={bundle.label}
                    onChange={(e) => updateBundle(bundle.id, 'label', e.target.value)}
                    className="font-bold text-lg h-8 w-full mb-4"
                  />
                  
                  <div className="space-y-4">
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
                  </div>
                </AdminCardContent>
              </div>
            </AdminCard>
          );
        })}
        
        {/* Add New Bundle Card */}
        <AdminCard 
          className="border-dashed border-2 flex items-center justify-center min-h-[300px] cursor-pointer hover:border-primary/50 transition-colors"
          hover={false}
        >
          <div className="text-center p-6" onClick={addBundle}>
            <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">إضافة باقة جديدة</p>
          </div>
        </AdminCard>
      </div>

      {/* Quick Stats */}
      <AdminCard>
        <AdminCardHeader 
          title="ملخص العروض"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <AdminCardContent>
          <AdminStatsGrid>
            <AdminStatCard
              icon={<Ticket className="h-5 w-5" />}
              value={bundles.filter(b => b.active).length}
              label="عروض نشطة"
            />
            <AdminStatCard
              icon={<Gift className="h-5 w-5" />}
              value={bundles.reduce((sum, b) => sum + b.bonus_tickets, 0)}
              label="إجمالي التذاكر المجانية"
              colorClass="text-green-600"
              bgClass="bg-green-500/10"
            />
            <AdminStatCard
              icon={<Sparkles className="h-5 w-5" />}
              value={bundles.filter(b => b.highlight).length}
              label="عروض مميزة"
              colorClass="text-amber-600"
              bgClass="bg-amber-500/10"
            />
            <AdminStatCard
              icon={<TrendingUp className="h-5 w-5" />}
              value={`${Math.max(...bundles.map(b => calculateSavings(b).savingsPercent), 0).toFixed(0)}%`}
              label="أعلى توفير"
              colorClass="text-blue-600"
              bgClass="bg-blue-500/10"
            />
          </AdminStatsGrid>
        </AdminCardContent>
      </AdminCard>
    </AdminLayout>
  );
}