import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, Plus, Trash2, Settings, Gift, Zap, Star, Target, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import ProductSearchSelect from "@/components/ProductSearchSelect";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free' | 'instant_winner' | 'everyone_wins' | 'escalating_price' | 'mystery_box' | 'hidden_winner' | 'team_battle' | 'flash_sale' | 'growing_prize' | 'collect_letters';
type CompetitionStatus = 'draft' | 'active' | 'completed' | 'cancelled';

interface Competition {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  prize_description: string;
  prize_description_ar: string;
  prize_value: number | null;
  ticket_price: number;
  max_tickets: number | null;
  target_participants: number | null;
  start_date: string;
  end_date: string | null;
  draw_date: string | null;
  competition_type: CompetitionType;
  status: CompetitionStatus;
  currency: string;
  created_at: string;
  required_tickets?: number;
  winners_count?: number;
  is_flash?: boolean;
  flash_badge_text?: string;
  theme_color?: string;
  legal_disclaimer?: string;
  is_product_based?: boolean;
  product_id?: string | null;
  gift_tickets_per_purchase?: number;
  hide_participants?: boolean;
  unlimited_winners?: boolean;
  is_featured?: boolean;
  instant_reveal?: boolean;
  win_probability?: number;
  hidden_winner_trigger_ticket?: number;
  remaining_prizes?: number;
  prize_tiers?: any[];
  price_tiers?: any[];
  mystery_boxes?: any[];
  letters_config?: any;
  growing_prize_config?: any;
  team_config?: any;
}

interface PrizeTier {
  id: string;
  name_ar: string;
  probability: number;
  quantity: number;
  remaining: number;
  image_url?: string;
  value?: number;
  is_better_luck?: boolean;
  is_ticket_reward?: boolean;
  tickets_reward?: number;
  product_id?: string;
}

interface PriceTier {
  min_sold: number;
  max_sold: number;
  price: number;
}

interface LetterConfig {
  letter: string;
  probability: number;
}

interface PrizeWord {
  word: string;
  prize_name: string;
  prize_value: number;
  stock?: number;
  product_id?: string;
}

interface GrowingPrizeConfig {
  base_prize: number;
  increment_per_interval: number;
  interval_minutes: number;
  decrease_mode?: boolean;
}

interface CompetitionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCompetition: Competition | null;
  onSuccess?: () => void;
}

const competitionTypeLabels: Record<CompetitionType, string> = {
  ticket_count: 'عند وصول المشاركين لعدد معين',
  all_tickets_sold: 'عند بيع جميع التذاكر',
  timed: 'مسابقة بوقت محدد',
  free: 'مسابقة مجانية',
  instant_winner: '⚡ فائز فوري',
  everyone_wins: '🎁 الكل رابح',
  escalating_price: '📈 السعر المتصاعد',
  mystery_box: '📦 اختر صندوقك',
  hidden_winner: '🎯 الرابح المخفي',
  team_battle: '⚔️ فريق ضد فريق',
  flash_sale: '🔥 مسابقة سريعة',
  growing_prize: '📊 الجائزة المتحولة',
  collect_letters: '🔤 اجمع أحرف واربح'
};

const competitionTypeDescriptions: Record<CompetitionType, string> = {
  ticket_count: 'يتم السحب عند وصول عدد معين من المشاركين',
  all_tickets_sold: 'يتم السحب عند بيع جميع التذاكر المتاحة',
  timed: 'يتم السحب تلقائياً عند انتهاء الوقت',
  free: 'مسابقة مجانية بدون تذاكر',
  instant_winner: 'يعرف المشترك نتيجته فوراً عند الشراء مع نسبة احتمال محددة',
  everyone_wins: 'كل مشارك يفوز بجائزة حسب مستويات الجوائز والاحتمالات',
  escalating_price: 'السعر يرتفع تلقائياً كلما قل عدد التذاكر المتبقية',
  mystery_box: 'صناديق غامضة بجوائز مختلفة مع نسب احتمالات',
  hidden_winner: 'تذكرة واحدة رابحة مخفية تظهر عند رقم معين',
  team_battle: 'المستخدمون يُقسمون عشوائياً لفريقين ويتنافسون',
  flash_sale: 'مسابقة سريعة بتصميم مميز وعروض محدودة',
  growing_prize: 'الجائزة تكبر أو تقل مع مرور الوقت',
  collect_letters: 'اجمع أحرف معينة لتفوز بجوائز'
};

const baghdadToUTC = (localDateString: string): string => {
  if (!localDateString) return '';
  const localDate = new Date(localDateString);
  const utcDate = addHours(localDate, -3);
  return utcDate.toISOString();
};

const utcToBaghdadLocal = (utcDateString: string | null): string => {
  if (!utcDateString) return '';
  const utcDate = new Date(utcDateString);
  const baghdadDate = addHours(utcDate, 3);
  return format(baghdadDate, "yyyy-MM-dd'T'HH:mm");
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function CompetitionFormDialog({
  open,
  onOpenChange,
  editingCompetition,
  onSuccess
}: CompetitionFormDialogProps) {
  const queryClient = useQueryClient();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const getInitialFormData = () => ({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    image_url: '',
    images: [] as string[],
    prize_description: '',
    prize_description_ar: '',
    prize_value: '',
    ticket_price: '0',
    max_tickets: '',
    target_participants: '',
    start_date: '',
    end_date: '',
    draw_date: '',
    required_tickets: '1',
    winners_count: '1',
    competition_type: 'ticket_count' as CompetitionType,
    status: 'draft' as CompetitionStatus,
    // Prize Tiers (for everyone_wins, mystery_box)
    prize_tiers: [] as PrizeTier[],
    // Price Tiers (for escalating_price)
    price_tiers: [] as PriceTier[],
    // Flash settings
    is_flash: false,
    flash_badge_text: '',
    theme_color: '#d4af37',
    // Instant winner settings
    instant_reveal: false,
    win_probability: '',
    remaining_prizes: '',
    // Hidden winner settings
    hidden_winner_trigger_ticket: '',
    // Letters config (for collect_letters)
    letters_config: [] as LetterConfig[],
    prize_words: [] as PrizeWord[],
    display_word: '',
    // Growing prize config
    growing_prize_config: {
      base_prize: 0,
      increment_per_interval: 0,
      interval_minutes: 60,
      decrease_mode: false
    } as GrowingPrizeConfig,
    // Display settings
    hide_participants: false,
    unlimited_winners: false,
    is_featured: false,
    // Product based settings
    is_product_based: false,
    product_id: '' as string,
    gift_tickets_per_purchase: '1',
    // Legal
    legal_disclaimer: 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مرفقة.'
  });

  const [formData, setFormData] = useState(getInitialFormData());

  const { data: products } = useQuery({
    queryKey: ['products-for-competition-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, image_url, price')
        .order('name_ar');
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (open && editingCompetition) {
      setFormData({
        title: editingCompetition.title || '',
        title_ar: editingCompetition.title_ar || '',
        description: editingCompetition.description || '',
        description_ar: editingCompetition.description_ar || '',
        image_url: editingCompetition.image_url || '',
        images: editingCompetition.images || [],
        prize_description: editingCompetition.prize_description || '',
        prize_description_ar: editingCompetition.prize_description_ar || '',
        prize_value: editingCompetition.prize_value?.toString() || '',
        ticket_price: editingCompetition.ticket_price?.toString() || '0',
        max_tickets: editingCompetition.max_tickets?.toString() || '',
        target_participants: editingCompetition.target_participants?.toString() || '',
        start_date: utcToBaghdadLocal(editingCompetition.start_date),
        end_date: utcToBaghdadLocal(editingCompetition.end_date),
        draw_date: utcToBaghdadLocal(editingCompetition.draw_date),
        required_tickets: editingCompetition.required_tickets?.toString() || '1',
        winners_count: editingCompetition.winners_count?.toString() || '1',
        competition_type: editingCompetition.competition_type,
        status: editingCompetition.status,
        prize_tiers: editingCompetition.prize_tiers || [],
        price_tiers: editingCompetition.price_tiers || [],
        is_flash: editingCompetition.is_flash || false,
        flash_badge_text: editingCompetition.flash_badge_text || '',
        theme_color: editingCompetition.theme_color || '#d4af37',
        instant_reveal: editingCompetition.instant_reveal || false,
        win_probability: editingCompetition.win_probability?.toString() || '',
        remaining_prizes: editingCompetition.remaining_prizes?.toString() || '',
        hidden_winner_trigger_ticket: editingCompetition.hidden_winner_trigger_ticket?.toString() || '',
        letters_config: editingCompetition.letters_config?.letters || [],
        prize_words: editingCompetition.letters_config?.prize_words || [],
        display_word: editingCompetition.letters_config?.display_word || '',
        growing_prize_config: editingCompetition.growing_prize_config || { base_prize: 0, increment_per_interval: 0, interval_minutes: 60, decrease_mode: false },
        hide_participants: editingCompetition.hide_participants || false,
        unlimited_winners: editingCompetition.unlimited_winners || false,
        is_featured: editingCompetition.is_featured || false,
        is_product_based: editingCompetition.is_product_based || false,
        product_id: editingCompetition.product_id || '',
        gift_tickets_per_purchase: editingCompetition.gift_tickets_per_purchase?.toString() || '1',
        legal_disclaimer: editingCompetition.legal_disclaimer || 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مرفقة.'
      });
      setActiveTab("basic");
    } else if (open) {
      setFormData(getInitialFormData());
      setActiveTab("basic");
    }
  }, [open, editingCompetition]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    const newImages: string[] = [];

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `competitions/${fileName}`;

      const { error } = await supabase.storage.from('competition-images').upload(filePath, file);
      if (error) { toast.error('خطأ في رفع الصورة'); continue; }

      const { data: publicUrl } = supabase.storage.from('competition-images').getPublicUrl(filePath);
      newImages.push(publicUrl.publicUrl);
    }

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newImages],
      image_url: prev.image_url || newImages[0] || ''
    }));
    setUploadingImage(false);
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      image_url: index === 0 ? (prev.images[1] || '') : prev.image_url
    }));
  };

  // Prize Tier Management
  const addPrizeTier = () => {
    setFormData(prev => ({
      ...prev,
      prize_tiers: [...prev.prize_tiers, {
        id: generateId(),
        name_ar: '',
        probability: 0,
        quantity: 1,
        remaining: 1,
        value: 0
      }]
    }));
  };

  const updatePrizeTier = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      prize_tiers: prev.prize_tiers.map((tier, i) => 
        i === index ? { ...tier, [field]: value } : tier
      )
    }));
  };

  const removePrizeTier = (index: number) => {
    setFormData(prev => ({
      ...prev,
      prize_tiers: prev.prize_tiers.filter((_, i) => i !== index)
    }));
  };

  // Price Tier Management
  const addPriceTier = () => {
    setFormData(prev => ({
      ...prev,
      price_tiers: [...prev.price_tiers, { min_sold: 0, max_sold: 0, price: 0 }]
    }));
  };

  const updatePriceTier = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      price_tiers: prev.price_tiers.map((tier, i) => 
        i === index ? { ...tier, [field]: value } : tier
      )
    }));
  };

  const removePriceTier = (index: number) => {
    setFormData(prev => ({
      ...prev,
      price_tiers: prev.price_tiers.filter((_, i) => i !== index)
    }));
  };

  // Letter Config Management
  const addLetter = () => {
    setFormData(prev => ({
      ...prev,
      letters_config: [...prev.letters_config, { letter: '', probability: 0 }]
    }));
  };

  const updateLetter = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      letters_config: prev.letters_config.map((letter, i) => 
        i === index ? { ...letter, [field]: value } : letter
      )
    }));
  };

  const removeLetter = (index: number) => {
    setFormData(prev => ({
      ...prev,
      letters_config: prev.letters_config.filter((_, i) => i !== index)
    }));
  };

  // Prize Word Management
  const addPrizeWord = () => {
    setFormData(prev => ({
      ...prev,
      prize_words: [...prev.prize_words, { word: '', prize_name: '', prize_value: 0, stock: 1 }]
    }));
  };

  const updatePrizeWord = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      prize_words: prev.prize_words.map((word, i) => 
        i === index ? { ...word, [field]: value } : word
      )
    }));
  };

  const removePrizeWord = (index: number) => {
    setFormData(prev => ({
      ...prev,
      prize_words: prev.prize_words.filter((_, i) => i !== index)
    }));
  };

  const createCompetitionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const competitionData: any = {
        title: data.title_ar,
        title_ar: data.title_ar,
        description: data.description_ar,
        description_ar: data.description_ar,
        image_url: data.images[0] || null,
        images: data.images,
        prize_description: data.prize_description_ar,
        prize_description_ar: data.prize_description_ar,
        prize_value: data.prize_value ? parseFloat(data.prize_value) : null,
        ticket_price: parseFloat(data.ticket_price) || 0,
        max_tickets: data.max_tickets ? parseInt(data.max_tickets) : null,
        target_participants: data.target_participants ? parseInt(data.target_participants) : null,
        start_date: data.start_date ? baghdadToUTC(data.start_date) : new Date().toISOString(),
        end_date: data.end_date ? baghdadToUTC(data.end_date) : null,
        draw_date: data.draw_date ? baghdadToUTC(data.draw_date) : null,
        competition_type: data.competition_type,
        status: data.status,
        required_tickets: parseInt(data.required_tickets) || 1,
        winners_count: parseInt(data.winners_count) || 1,
        is_flash: data.is_flash,
        flash_badge_text: data.flash_badge_text || null,
        theme_color: data.theme_color,
        is_product_based: data.is_product_based,
        product_id: data.is_product_based && data.product_id ? data.product_id : null,
        gift_tickets_per_purchase: parseInt(data.gift_tickets_per_purchase) || 1,
        legal_disclaimer: data.legal_disclaimer,
        hide_participants: data.hide_participants,
        unlimited_winners: data.unlimited_winners,
        is_featured: data.is_featured,
        instant_reveal: data.instant_reveal,
        win_probability: data.win_probability ? parseFloat(data.win_probability) : null,
        remaining_prizes: data.remaining_prizes ? parseInt(data.remaining_prizes) : null,
        hidden_winner_trigger_ticket: data.hidden_winner_trigger_ticket ? parseInt(data.hidden_winner_trigger_ticket) : null,
        prize_tiers: data.prize_tiers,
        price_tiers: data.price_tiers,
        letters_config: {
          letters: data.letters_config,
          prize_words: data.prize_words,
          display_word: data.display_word
        },
        growing_prize_config: data.growing_prize_config
      };

      if (editingCompetition) {
        const { error } = await supabase.from('competitions').update(competitionData).eq('id', editingCompetition.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('competitions').insert(competitionData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-competitions'] });
      toast.success(editingCompetition ? 'تم تحديث المسابقة بنجاح' : 'تم إنشاء المسابقة بنجاح');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Error saving competition:', error);
      toast.error('حدث خطأ أثناء حفظ المسابقة');
    }
  });

  const handleSubmit = () => {
    if (!formData.title_ar.trim()) { toast.error('يرجى إدخال عنوان المسابقة'); return; }
    if (!formData.prize_description_ar.trim()) { toast.error('يرجى إدخال وصف الجائزة'); return; }
    createCompetitionMutation.mutate(formData);
  };

  const needsPrizeTiers = ['everyone_wins', 'mystery_box'].includes(formData.competition_type);
  const needsPriceTiers = formData.competition_type === 'escalating_price';
  const needsInstantSettings = ['instant_winner', 'everyone_wins'].includes(formData.competition_type);
  const needsHiddenWinnerSettings = formData.competition_type === 'hidden_winner';
  const needsLettersConfig = formData.competition_type === 'collect_letters';
  const needsGrowingPrize = formData.competition_type === 'growing_prize';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-right text-xl">
            {editingCompetition ? 'تعديل المسابقة' : 'إنشاء مسابقة جديدة'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden px-6">
          <TabsList className="grid w-full grid-cols-4 mb-4 shrink-0">
            <TabsTrigger value="basic" className="gap-1 text-xs"><Settings className="h-3 w-3" />أساسي</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs"><Zap className="h-3 w-3" />إعدادات</TabsTrigger>
            <TabsTrigger value="prizes" className="gap-1 text-xs"><Gift className="h-3 w-3" />الجوائز</TabsTrigger>
            <TabsTrigger value="display" className="gap-1 text-xs"><Star className="h-3 w-3" />العرض</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pb-4" style={{ minHeight: 0 }}>
            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>عنوان المسابقة *</Label>
                  <Input value={formData.title_ar} onChange={(e) => setFormData(prev => ({ ...prev, title_ar: e.target.value }))} placeholder="أدخل عنوان المسابقة" />
                </div>
                <div className="col-span-2">
                  <Label>وصف المسابقة</Label>
                  <Textarea value={formData.description_ar} onChange={(e) => setFormData(prev => ({ ...prev, description_ar: e.target.value }))} placeholder="أدخل وصف المسابقة" className="min-h-[60px]" />
                </div>
                <div className="col-span-2">
                  <Label>وصف الجائزة *</Label>
                  <Textarea value={formData.prize_description_ar} onChange={(e) => setFormData(prev => ({ ...prev, prize_description_ar: e.target.value }))} placeholder="أدخل وصف الجائزة" className="min-h-[60px]" />
                </div>
              </div>

              {/* Images */}
              <div>
                <Label>صور المسابقة</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.images.map((img, index) => (
                    <div key={index} className="relative group">
                      <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                      <button type="button" onClick={() => removeImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
              </div>

              {/* Type & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>نوع المسابقة</Label>
                  <Select value={formData.competition_type} onValueChange={(v: CompetitionType) => setFormData(prev => ({ ...prev, competition_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(competitionTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">{competitionTypeDescriptions[formData.competition_type]}</p>
                </div>
                <div>
                  <Label>الحالة</Label>
                  <Select value={formData.status} onValueChange={(v: CompetitionStatus) => setFormData(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">مسودة</SelectItem>
                      <SelectItem value="active">نشطة</SelectItem>
                      <SelectItem value="completed">مكتملة</SelectItem>
                      <SelectItem value="cancelled">ملغاة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Competition Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>قيمة الجائزة</Label>
                  <Input type="number" value={formData.prize_value} onChange={(e) => setFormData(prev => ({ ...prev, prize_value: e.target.value }))} min="0" />
                </div>
                {formData.competition_type !== 'free' && (
                  <div>
                    <Label>التذاكر المطلوبة للمشاركة</Label>
                    <Input type="number" value={formData.required_tickets} onChange={(e) => setFormData(prev => ({ ...prev, required_tickets: e.target.value }))} min="1" />
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>تاريخ البدء</Label>
                  <Input type="datetime-local" value={formData.start_date} onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>تاريخ الانتهاء</Label>
                  <Input type="datetime-local" value={formData.end_date} onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))} />
                </div>
                <div>
                  <Label>تاريخ السحب</Label>
                  <Input type="datetime-local" value={formData.draw_date} onChange={(e) => setFormData(prev => ({ ...prev, draw_date: e.target.value }))} />
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الحد الأقصى للتذاكر</Label>
                  <Input type="number" value={formData.max_tickets} onChange={(e) => setFormData(prev => ({ ...prev, max_tickets: e.target.value }))} placeholder="غير محدود" min="1" />
                </div>
                <div>
                  <Label>المشاركين المستهدف</Label>
                  <Input type="number" value={formData.target_participants} onChange={(e) => setFormData(prev => ({ ...prev, target_participants: e.target.value }))} placeholder="غير محدود" min="1" />
                </div>
                <div>
                  <Label>عدد الفائزين</Label>
                  <Input type="number" value={formData.winners_count} onChange={(e) => setFormData(prev => ({ ...prev, winners_count: e.target.value }))} min="1" />
                </div>
              </div>

              {/* Product Based */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">مسابقة مبنية على منتج</CardTitle>
                    <Switch checked={formData.is_product_based} onCheckedChange={(c) => setFormData(prev => ({ ...prev, is_product_based: c }))} />
                  </div>
                </CardHeader>
                {formData.is_product_based && (
                  <CardContent className="pt-0 space-y-3">
                    <div>
                      <Label>اختر المنتج</Label>
                      <ProductSearchSelect value={formData.product_id} onChange={(v) => setFormData(prev => ({ ...prev, product_id: v }))} products={products || []} />
                    </div>
                    <div>
                      <Label>تذاكر هدية لكل شراء</Label>
                      <Input type="number" value={formData.gift_tickets_per_purchase} onChange={(e) => setFormData(prev => ({ ...prev, gift_tickets_per_purchase: e.target.value }))} min="1" />
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Instant Winner Settings */}
              {needsInstantSettings && (
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" />إعدادات الفوز الفوري</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>كشف فوري للنتيجة</Label>
                      <Switch checked={formData.instant_reveal} onCheckedChange={(c) => setFormData(prev => ({ ...prev, instant_reveal: c }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>نسبة الفوز (%)</Label>
                        <Input type="number" value={formData.win_probability} onChange={(e) => setFormData(prev => ({ ...prev, win_probability: e.target.value }))} min="0" max="100" />
                      </div>
                      <div>
                        <Label>الجوائز المتبقية</Label>
                        <Input type="number" value={formData.remaining_prizes} onChange={(e) => setFormData(prev => ({ ...prev, remaining_prizes: e.target.value }))} min="0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Hidden Winner Settings */}
              {needsHiddenWinnerSettings && (
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />الرابح المخفي</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <Label>رقم التذكرة المحفزة</Label>
                    <Input type="number" value={formData.hidden_winner_trigger_ticket} onChange={(e) => setFormData(prev => ({ ...prev, hidden_winner_trigger_ticket: e.target.value }))} placeholder="عند وصول هذا الرقم يظهر الفائز" min="1" />
                  </CardContent>
                </Card>
              )}

              {/* Growing Prize Settings */}
              {needsGrowingPrize && (
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">الجائزة المتحولة</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>الجائزة الأساسية</Label>
                        <Input type="number" value={formData.growing_prize_config.base_prize} onChange={(e) => setFormData(prev => ({ ...prev, growing_prize_config: { ...prev.growing_prize_config, base_prize: parseFloat(e.target.value) || 0 } }))} />
                      </div>
                      <div>
                        <Label>الزيادة لكل فترة</Label>
                        <Input type="number" value={formData.growing_prize_config.increment_per_interval} onChange={(e) => setFormData(prev => ({ ...prev, growing_prize_config: { ...prev.growing_prize_config, increment_per_interval: parseFloat(e.target.value) || 0 } }))} />
                      </div>
                      <div>
                        <Label>الفترة (دقائق)</Label>
                        <Input type="number" value={formData.growing_prize_config.interval_minutes} onChange={(e) => setFormData(prev => ({ ...prev, growing_prize_config: { ...prev.growing_prize_config, interval_minutes: parseInt(e.target.value) || 60 } }))} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>وضع التناقص (الجائزة تقل)</Label>
                      <Switch checked={formData.growing_prize_config.decrease_mode} onCheckedChange={(c) => setFormData(prev => ({ ...prev, growing_prize_config: { ...prev.growing_prize_config, decrease_mode: c } }))} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Prizes Tab */}
            <TabsContent value="prizes" className="space-y-4 mt-0">
              {/* Prize Tiers */}
              {needsPrizeTiers && (
                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">مستويات الجوائز</CardTitle>
                    <Button size="sm" variant="outline" onClick={addPrizeTier}><Plus className="h-3 w-3 ml-1" />إضافة</Button>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {formData.prize_tiers.map((tier, index) => (
                      <div key={tier.id || index} className="grid grid-cols-5 gap-2 items-end p-2 bg-muted/30 rounded">
                        <div>
                          <Label className="text-xs">الاسم</Label>
                          <Input value={tier.name_ar} onChange={(e) => updatePrizeTier(index, 'name_ar', e.target.value)} placeholder="اسم الجائزة" />
                        </div>
                        <div>
                          <Label className="text-xs">الاحتمال %</Label>
                          <Input type="number" value={tier.probability} onChange={(e) => updatePrizeTier(index, 'probability', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <Label className="text-xs">الكمية</Label>
                          <Input type="number" value={tier.quantity} onChange={(e) => updatePrizeTier(index, 'quantity', parseInt(e.target.value) || 1)} />
                        </div>
                        <div>
                          <Label className="text-xs">القيمة</Label>
                          <Input type="number" value={tier.value || ''} onChange={(e) => updatePrizeTier(index, 'value', parseFloat(e.target.value) || 0)} />
                        </div>
                        <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removePrizeTier(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {formData.prize_tiers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد مستويات جوائز</p>}
                  </CardContent>
                </Card>
              )}

              {/* Price Tiers */}
              {needsPriceTiers && (
                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">مستويات الأسعار</CardTitle>
                    <Button size="sm" variant="outline" onClick={addPriceTier}><Plus className="h-3 w-3 ml-1" />إضافة</Button>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {formData.price_tiers.map((tier, index) => (
                      <div key={index} className="grid grid-cols-4 gap-2 items-end p-2 bg-muted/30 rounded">
                        <div>
                          <Label className="text-xs">من تذكرة</Label>
                          <Input type="number" value={tier.min_sold} onChange={(e) => updatePriceTier(index, 'min_sold', parseInt(e.target.value) || 0)} />
                        </div>
                        <div>
                          <Label className="text-xs">إلى تذكرة</Label>
                          <Input type="number" value={tier.max_sold} onChange={(e) => updatePriceTier(index, 'max_sold', parseInt(e.target.value) || 0)} />
                        </div>
                        <div>
                          <Label className="text-xs">السعر</Label>
                          <Input type="number" value={tier.price} onChange={(e) => updatePriceTier(index, 'price', parseFloat(e.target.value) || 0)} />
                        </div>
                        <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removePriceTier(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Letters Config */}
              {needsLettersConfig && (
                <>
                  <Card>
                    <CardHeader className="py-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">الأحرف</CardTitle>
                      <Button size="sm" variant="outline" onClick={addLetter}><Plus className="h-3 w-3 ml-1" />إضافة</Button>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div>
                        <Label className="text-xs">الكلمة المعروضة</Label>
                        <Input value={formData.display_word} onChange={(e) => setFormData(prev => ({ ...prev, display_word: e.target.value }))} placeholder="مثال: ليفونس" />
                      </div>
                      {formData.letters_config.map((letter, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2 items-end p-2 bg-muted/30 rounded">
                          <div>
                            <Label className="text-xs">الحرف</Label>
                            <Input value={letter.letter} onChange={(e) => updateLetter(index, 'letter', e.target.value)} maxLength={1} />
                          </div>
                          <div>
                            <Label className="text-xs">الاحتمال %</Label>
                            <Input type="number" value={letter.probability} onChange={(e) => updateLetter(index, 'probability', parseFloat(e.target.value) || 0)} />
                          </div>
                          <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeLetter(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">كلمات الجوائز</CardTitle>
                      <Button size="sm" variant="outline" onClick={addPrizeWord}><Plus className="h-3 w-3 ml-1" />إضافة</Button>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {formData.prize_words.map((word, index) => (
                        <div key={index} className="grid grid-cols-5 gap-2 items-end p-2 bg-muted/30 rounded">
                          <div>
                            <Label className="text-xs">الكلمة</Label>
                            <Input value={word.word} onChange={(e) => updatePrizeWord(index, 'word', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">اسم الجائزة</Label>
                            <Input value={word.prize_name} onChange={(e) => updatePrizeWord(index, 'prize_name', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">القيمة</Label>
                            <Input type="number" value={word.prize_value} onChange={(e) => updatePrizeWord(index, 'prize_value', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <Label className="text-xs">المخزون</Label>
                            <Input type="number" value={word.stock || ''} onChange={(e) => updatePrizeWord(index, 'stock', parseInt(e.target.value) || 1)} />
                          </div>
                          <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removePrizeWord(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {!needsPrizeTiers && !needsPriceTiers && !needsLettersConfig && (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>نوع المسابقة المحدد لا يتطلب إعدادات جوائز إضافية</p>
                </div>
              )}
            </TabsContent>

            {/* Display Tab */}
            <TabsContent value="display" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">إعدادات العرض</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>مسابقة مميزة</Label>
                      <p className="text-xs text-muted-foreground">ستظهر في قسم المسابقات المميزة</p>
                    </div>
                    <Switch checked={formData.is_featured} onCheckedChange={(c) => setFormData(prev => ({ ...prev, is_featured: c }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>إخفاء المشاركين</Label>
                      <p className="text-xs text-muted-foreground">لن يظهر عدد المشاركين</p>
                    </div>
                    <Switch checked={formData.hide_participants} onCheckedChange={(c) => setFormData(prev => ({ ...prev, hide_participants: c }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>فائزون غير محدودين</Label>
                      <p className="text-xs text-muted-foreground">لا حد لعدد الفائزين</p>
                    </div>
                    <Switch checked={formData.unlimited_winners} onCheckedChange={(c) => setFormData(prev => ({ ...prev, unlimited_winners: c }))} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">مسابقة فلاش</CardTitle>
                    <Switch checked={formData.is_flash} onCheckedChange={(c) => setFormData(prev => ({ ...prev, is_flash: c }))} />
                  </div>
                </CardHeader>
                {formData.is_flash && (
                  <CardContent className="pt-0 space-y-3">
                    <div>
                      <Label>نص الشارة</Label>
                      <Input value={formData.flash_badge_text} onChange={(e) => setFormData(prev => ({ ...prev, flash_badge_text: e.target.value }))} placeholder="مثال: عرض محدود!" />
                    </div>
                    <div>
                      <Label>لون الثيم</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={formData.theme_color} onChange={(e) => setFormData(prev => ({ ...prev, theme_color: e.target.value }))} className="w-16 h-10 p-1" />
                        <Input value={formData.theme_color} onChange={(e) => setFormData(prev => ({ ...prev, theme_color: e.target.value }))} className="flex-1" />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              <div>
                <Label>إخلاء المسؤولية القانوني</Label>
                <Textarea value={formData.legal_disclaimer} onChange={(e) => setFormData(prev => ({ ...prev, legal_disclaimer: e.target.value }))} className="min-h-[80px]" />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 p-6 pt-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={createCompetitionMutation.isPending} className="admin-btn-primary">
            {createCompetitionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {editingCompetition ? 'تحديث المسابقة' : 'إنشاء المسابقة'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
