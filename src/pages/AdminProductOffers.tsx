import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Gift, Loader2, Trash2, Upload, X, Package, Edit, DollarSign, ShoppingBag, Ticket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminStatsGrid, AdminStatCard, AdminEmptyState, AdminLoading } from "@/components/admin/AdminLayout";

interface ProductOffer {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  price: number;
  currency: string;
  gift_tickets: number;
  status: 'draft' | 'active' | 'inactive';
  stock_quantity: number | null;
  total_sold: number;
  created_at: string;
}

export default function AdminProductOffers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<ProductOffer | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    title_ar: '',
    description_ar: '',
    images: [] as string[],
    price: '',
    gift_tickets: '1',
    stock_quantity: '',
    status: 'active' as 'draft' | 'active' | 'inactive',
  });

  const { data: productOffers, isLoading } = useQuery({
    queryKey: ['admin-product-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProductOffer[];
    }
  });

  const resetForm = () => {
    setFormData({ title_ar: '', description_ar: '', images: [], price: '', gift_tickets: '1', stock_quantity: '', status: 'active' });
    setEditingOffer(null);
  };

  const handleEdit = (offer: ProductOffer) => {
    setEditingOffer(offer);
    setFormData({
      title_ar: offer.title_ar,
      description_ar: offer.description_ar || '',
      images: offer.images || (offer.image_url ? [offer.image_url] : []),
      price: offer.price.toString(),
      gift_tickets: offer.gift_tickets.toString(),
      stock_quantity: offer.stock_quantity?.toString() || '',
      status: offer.status,
    });
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    const newImages: string[] = [];
    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `product-offers/${fileName}`;
      const { error } = await supabase.storage.from('competition-images').upload(filePath, file);
      if (error) { toast.error(`خطأ في رفع الصورة`); continue; }
      const { data: publicUrl } = supabase.storage.from('competition-images').getPublicUrl(filePath);
      newImages.push(publicUrl.publicUrl);
    }
    setFormData(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
    setUploadingImage(false);
  };

  const removeImage = (index: number) => {
    setFormData(prev => {
      const newImages = [...prev.images];
      newImages.splice(index, 1);
      return { ...prev, images: newImages };
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title_ar,
        title_ar: data.title_ar,
        description: data.description_ar,
        description_ar: data.description_ar,
        image_url: data.images.length > 0 ? data.images[0] : null,
        images: data.images,
        price: parseFloat(data.price) || 0,
        gift_tickets: parseInt(data.gift_tickets) || 1,
        stock_quantity: data.stock_quantity ? parseInt(data.stock_quantity) : null,
        status: data.status,
      };
      const { data: result, error } = await supabase.from('product_offers').insert([payload]).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('تم إنشاء العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const payload = {
        title: data.title_ar,
        title_ar: data.title_ar,
        description: data.description_ar,
        description_ar: data.description_ar,
        image_url: data.images.length > 0 ? data.images[0] : null,
        images: data.images,
        price: parseFloat(data.price) || 0,
        gift_tickets: parseInt(data.gift_tickets) || 1,
        stock_quantity: data.stock_quantity ? parseInt(data.stock_quantity) : null,
        status: data.status,
      };
      const { error } = await supabase.from('product_offers').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث العرض');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_offers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف العرض');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const handleSubmit = () => {
    if (!formData.title_ar || !formData.price) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }
    if (editingOffer) {
      updateMutation.mutate({ id: editingOffer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const statusLabels: Record<string, { label: string; className: string }> = {
    draft: { label: 'مسودة', className: 'admin-badge admin-badge-muted' },
    active: { label: 'نشط', className: 'admin-badge admin-badge-success' },
    inactive: { label: 'متوقف', className: 'admin-badge admin-badge-danger' },
  };

  if (isLoading) {
    return (
      <AdminLayout title="إدارة عروض المنتجات" icon={<Package className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="إدارة عروض المنتجات"
      description="منتجات للشراء مع تذاكر هدية مجانية"
      icon={<Package className="h-5 w-5" />}
      maxWidth="6xl"
      actions={
        <Button onClick={() => setIsDialogOpen(true)} className="admin-btn-primary gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">إضافة عرض</span>
        </Button>
      }
    >
      {/* Stats */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<Package className="h-5 w-5" />}
          value={productOffers?.filter(o => o.status === 'active').length || 0}
          label="عروض نشطة"
          colorClass="text-green-600"
          bgClass="bg-green-500/10"
        />
        <AdminStatCard
          icon={<Gift className="h-5 w-5" />}
          value={productOffers?.length || 0}
          label="إجمالي العروض"
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
        <AdminStatCard
          icon={<ShoppingBag className="h-5 w-5" />}
          value={productOffers?.reduce((sum, o) => sum + (o.total_sold || 0), 0) || 0}
          label="إجمالي المبيعات"
          colorClass="text-purple-600"
          bgClass="bg-purple-500/10"
        />
        <AdminStatCard
          icon={<Ticket className="h-5 w-5" />}
          value={productOffers?.reduce((sum, o) => sum + (o.gift_tickets * (o.total_sold || 0)), 0) || 0}
          label="تذاكر موزعة"
          colorClass="text-amber-600"
          bgClass="bg-amber-500/10"
        />
      </AdminStatsGrid>

      {/* Product Offers List */}
      <div className="mt-6 space-y-3">
        {productOffers?.length === 0 ? (
          <AdminCard>
            <AdminEmptyState
              icon={<Package className="h-16 w-16" />}
              title="لا توجد عروض منتجات"
              description="ابدأ بإنشاء أول عرض منتج"
              action={
                <Button className="admin-btn-primary gap-2" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  إنشاء أول عرض
                </Button>
              }
            />
          </AdminCard>
        ) : (
          productOffers?.map((offer) => (
            <div key={offer.id} className="admin-list-item">
              {offer.image_url ? (
                <img src={offer.image_url} alt={offer.title_ar} className="admin-list-item-image" />
              ) : (
                <div className="admin-list-item-image flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="admin-list-item-content">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="admin-list-item-title">{offer.title_ar}</h3>
                  <Badge className={statusLabels[offer.status]?.className || 'admin-badge admin-badge-muted'}>
                    {statusLabels[offer.status]?.label || offer.status}
                  </Badge>
                </div>
                <p className="admin-list-item-desc">{offer.description_ar || 'لا يوجد وصف'}</p>
                <div className="admin-list-item-meta">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                    <strong>{offer.price.toLocaleString()}</strong> {offer.currency}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5 text-green-600" />
                    {offer.gift_tickets} تذكرة
                  </span>
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="h-3.5 w-3.5 text-blue-600" />
                    {offer.total_sold || 0} مبيعات
                  </span>
                  {offer.stock_quantity !== null && (
                    <Badge variant="outline" className="text-xs">متبقي: {offer.stock_quantity}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(offer.created_at), 'dd MMM yyyy', { locale: ar })}
                </p>
              </div>
              <div className="admin-list-item-actions">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(offer)} className="admin-btn-icon-sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { if (window.confirm('هل أنت متأكد؟')) deleteMutation.mutate(offer.id); }} 
                  disabled={deleteMutation.isPending}
                  className="admin-btn-icon-sm text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOffer ? 'تعديل العرض' : 'إضافة عرض منتج جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="admin-form-group">
              <Label className="admin-form-label">اسم المنتج *</Label>
              <Input 
                value={formData.title_ar} 
                onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })} 
                placeholder="مثال: ساعة ذكية" 
                className="admin-input"
              />
            </div>
            
            <div className="admin-form-group">
              <Label className="admin-form-label">وصف المنتج</Label>
              <Textarea 
                value={formData.description_ar} 
                onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })} 
                placeholder="وصف مختصر..." 
                className="admin-textarea"
              />
            </div>
            
            <div className="admin-form-row-2">
              <div className="admin-form-group">
                <Label className="admin-form-label">سعر المنتج (دينار) *</Label>
                <Input 
                  type="number" 
                  value={formData.price} 
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })} 
                  placeholder="25000" 
                  className="admin-input"
                />
              </div>
              <div className="admin-form-group">
                <Label className="admin-form-label">عدد التذاكر الهدية *</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={formData.gift_tickets} 
                  onChange={(e) => setFormData({ ...formData, gift_tickets: e.target.value })} 
                  placeholder="1" 
                  className="admin-input"
                />
              </div>
            </div>
            
            <div className="admin-form-group">
              <Label className="admin-form-label">الكمية المتاحة</Label>
              <Input 
                type="number" 
                value={formData.stock_quantity} 
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })} 
                placeholder="غير محدود" 
                className="admin-input"
              />
              <p className="admin-form-hint">اتركه فارغ لكمية غير محدودة</p>
            </div>
            
            <div className="admin-form-group">
              <Label className="admin-form-label">حالة العرض</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
                <SelectTrigger className="admin-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">متوقف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="admin-form-group">
              <Label className="admin-form-label">صور المنتج</Label>
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  onChange={handleImageUpload} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  disabled={uploadingImage} 
                />
                <Button type="button" variant="outline" className="w-full gap-2" disabled={uploadingImage}>
                  {uploadingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري الرفع...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      اختر صور
                    </>
                  )}
                </Button>
              </div>
              {formData.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.images.map((url, index) => (
                    <div key={index} className="relative w-16 h-16 group">
                      <img src={url} alt={`صورة ${index + 1}`} className="w-full h-full object-cover rounded-lg border" />
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon" 
                        className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" 
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button className="admin-btn-primary flex-1" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                {editingOffer ? 'حفظ التعديلات' : 'إنشاء العرض'}
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
