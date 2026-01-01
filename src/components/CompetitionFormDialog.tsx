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
import { Loader2, Upload, X, Plus, Trash2 } from "lucide-react";
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
  is_flash?: boolean;
  theme_color?: string;
  legal_disclaimer?: string;
  is_product_based?: boolean;
  product_id?: string | null;
  gift_tickets_per_purchase?: number;
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

// Helper function to convert Baghdad local time to UTC for storage
const baghdadToUTC = (localDateString: string): string => {
  if (!localDateString) return '';
  const localDate = new Date(localDateString);
  const utcDate = addHours(localDate, -3);
  return utcDate.toISOString();
};

// Helper function to convert UTC to Baghdad local time for form display
const utcToBaghdadLocal = (utcDateString: string | null): string => {
  if (!utcDateString) return '';
  const utcDate = new Date(utcDateString);
  const baghdadDate = addHours(utcDate, 3);
  return format(baghdadDate, "yyyy-MM-dd'T'HH:mm");
};

export default function CompetitionFormDialog({
  open,
  onOpenChange,
  editingCompetition,
  onSuccess
}: CompetitionFormDialogProps) {
  const queryClient = useQueryClient();
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
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
    prize_tiers: [] as PrizeTier[],
    is_flash: false,
    flash_badge_text: '',
    theme_color: '#d4af37',
    is_product_based: false,
    product_id: '' as string,
    gift_tickets_per_purchase: '1',
    legal_disclaimer: 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مرفقة.'
  });

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

  // Reset form when dialog opens/closes or editing competition changes
  useEffect(() => {
    if (open && editingCompetition) {
      // Populate form with existing competition data
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
        winners_count: '1',
        competition_type: editingCompetition.competition_type,
        status: editingCompetition.status,
        prize_tiers: [],
        is_flash: editingCompetition.is_flash || false,
        flash_badge_text: '',
        theme_color: editingCompetition.theme_color || '#d4af37',
        is_product_based: editingCompetition.is_product_based || false,
        product_id: editingCompetition.product_id || '',
        gift_tickets_per_purchase: editingCompetition.gift_tickets_per_purchase?.toString() || '1',
        legal_disclaimer: editingCompetition.legal_disclaimer || 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مرفقة.'
      });
    } else if (open) {
      // Reset to defaults for new competition
      setFormData({
        title: '',
        title_ar: '',
        description: '',
        description_ar: '',
        image_url: '',
        images: [],
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
        competition_type: 'ticket_count',
        status: 'draft',
        prize_tiers: [],
        is_flash: false,
        flash_badge_text: '',
        theme_color: '#d4af37',
        is_product_based: false,
        product_id: '',
        gift_tickets_per_purchase: '1',
        legal_disclaimer: 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مرفقة.'
      });
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

      const { error } = await supabase.storage
        .from('competition-images')
        .upload(filePath, file);

      if (error) {
        toast.error('خطأ في رفع الصورة');
        continue;
      }

      const { data: publicUrl } = supabase.storage
        .from('competition-images')
        .getPublicUrl(filePath);

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

  const createCompetitionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const competitionData = {
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
        is_flash: data.is_flash,
        theme_color: data.theme_color,
        is_product_based: data.is_product_based,
        product_id: data.is_product_based && data.product_id ? data.product_id : null,
        gift_tickets_per_purchase: parseInt(data.gift_tickets_per_purchase) || 1,
        legal_disclaimer: data.legal_disclaimer
      };

      if (editingCompetition) {
        const { error } = await supabase
          .from('competitions')
          .update(competitionData)
          .eq('id', editingCompetition.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('competitions')
          .insert(competitionData);
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
    if (!formData.title_ar.trim()) {
      toast.error('يرجى إدخال عنوان المسابقة');
      return;
    }
    if (!formData.prize_description_ar.trim()) {
      toast.error('يرجى إدخال وصف الجائزة');
      return;
    }
    createCompetitionMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {editingCompetition ? 'تعديل المسابقة' : 'إنشاء مسابقة جديدة'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label>عنوان المسابقة *</Label>
              <Input
                value={formData.title_ar}
                onChange={(e) => setFormData(prev => ({ ...prev, title_ar: e.target.value }))}
                placeholder="أدخل عنوان المسابقة"
                className="text-right"
              />
            </div>

            <div>
              <Label>وصف المسابقة</Label>
              <Textarea
                value={formData.description_ar}
                onChange={(e) => setFormData(prev => ({ ...prev, description_ar: e.target.value }))}
                placeholder="أدخل وصف المسابقة"
                className="text-right min-h-[80px]"
              />
            </div>

            <div>
              <Label>وصف الجائزة *</Label>
              <Textarea
                value={formData.prize_description_ar}
                onChange={(e) => setFormData(prev => ({ ...prev, prize_description_ar: e.target.value }))}
                placeholder="أدخل وصف الجائزة"
                className="text-right min-h-[80px]"
              />
            </div>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>صور المسابقة</Label>
            <div className="flex flex-wrap gap-2">
              {formData.images.map((img, index) => (
                <div key={index} className="relative group">
                  <img src={img} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                {uploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
              </label>
            </div>
          </div>

          {/* Competition Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>نوع المسابقة</Label>
              <Select
                value={formData.competition_type}
                onValueChange={(value: CompetitionType) => setFormData(prev => ({ ...prev, competition_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(competitionTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>الحالة</Label>
              <Select
                value={formData.status}
                onValueChange={(value: CompetitionStatus) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                  <SelectItem value="cancelled">ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>سعر التذكرة</Label>
              <Input
                type="number"
                value={formData.ticket_price}
                onChange={(e) => setFormData(prev => ({ ...prev, ticket_price: e.target.value }))}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <Label>قيمة الجائزة</Label>
              <Input
                type="number"
                value={formData.prize_value}
                onChange={(e) => setFormData(prev => ({ ...prev, prize_value: e.target.value }))}
                placeholder="قيمة تقديرية"
                min="0"
              />
            </div>
          </div>

          {/* Tickets Config */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>الحد الأقصى للتذاكر</Label>
              <Input
                type="number"
                value={formData.max_tickets}
                onChange={(e) => setFormData(prev => ({ ...prev, max_tickets: e.target.value }))}
                placeholder="غير محدود"
                min="1"
              />
            </div>
            <div>
              <Label>عدد المشاركين المستهدف</Label>
              <Input
                type="number"
                value={formData.target_participants}
                onChange={(e) => setFormData(prev => ({ ...prev, target_participants: e.target.value }))}
                placeholder="غير محدود"
                min="1"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>تاريخ البدء</Label>
              <Input
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>تاريخ الانتهاء</Label>
              <Input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>تاريخ السحب</Label>
            <Input
              type="datetime-local"
              value={formData.draw_date}
              onChange={(e) => setFormData(prev => ({ ...prev, draw_date: e.target.value }))}
            />
          </div>

          {/* Product Based Competition */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <Label>مسابقة مبنية على منتج</Label>
              <p className="text-xs text-muted-foreground">ربط المسابقة بمنتج محدد</p>
            </div>
            <Switch
              checked={formData.is_product_based}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_product_based: checked }))}
            />
          </div>

          {formData.is_product_based && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <Label>اختر المنتج</Label>
                <ProductSearchSelect
                  value={formData.product_id}
                  onChange={(value) => setFormData(prev => ({ ...prev, product_id: value }))}
                  products={products || []}
                />
              </div>
              <div>
                <Label>عدد التذاكر الهدية لكل عملية شراء</Label>
                <Input
                  type="number"
                  value={formData.gift_tickets_per_purchase}
                  onChange={(e) => setFormData(prev => ({ ...prev, gift_tickets_per_purchase: e.target.value }))}
                  min="1"
                />
              </div>
            </div>
          )}

          {/* Flash Sale */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <Label>مسابقة سريعة (فلاش)</Label>
              <p className="text-xs text-muted-foreground">تصميم مميز وعروض محدودة</p>
            </div>
            <Switch
              checked={formData.is_flash}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_flash: checked }))}
            />
          </div>

          {/* Legal Disclaimer */}
          <div>
            <Label>إخلاء المسؤولية القانوني</Label>
            <Textarea
              value={formData.legal_disclaimer}
              onChange={(e) => setFormData(prev => ({ ...prev, legal_disclaimer: e.target.value }))}
              placeholder="النص القانوني"
              className="text-right min-h-[60px]"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createCompetitionMutation.isPending}
              className="admin-btn-primary"
            >
              {createCompetitionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {editingCompetition ? 'تحديث المسابقة' : 'إنشاء المسابقة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
