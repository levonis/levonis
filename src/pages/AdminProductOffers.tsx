import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowRight, Plus, Gift, Loader2, Trash2, Upload, X, Package, Eye, Edit } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";
import OptimizedImage from "@/components/OptimizedImage";

const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy') => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};

interface ProductOffer {
  id: string;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  ticket_price: number;
  gift_tickets_per_purchase: number;
  status: 'draft' | 'active' | 'completed';
  currency: string;
  created_at: string;
  product_id: string | null;
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
    image_url: '',
    images: [] as string[],
    price: '',
    gift_tickets: '1',
    status: 'draft' as 'draft' | 'active' | 'completed',
    product_id: ''
  });

  // Fetch product offers (competitions with is_product_based = true)
  const { data: productOffers, isLoading } = useQuery({
    queryKey: ['admin-product-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('is_product_based', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ProductOffer[];
    }
  });

  // Fetch products for linking
  const { data: products } = useQuery({
    queryKey: ['products-for-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, image_url, price')
        .order('name_ar');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = {
        title: data.title_ar,
        title_ar: data.title_ar,
        description: data.description_ar,
        description_ar: data.description_ar,
        prize_description: data.title_ar,
        prize_description_ar: data.title_ar,
        image_url: data.images.length > 0 ? data.images[0] : (data.image_url || null),
        images: data.images.length > 0 ? data.images : (data.image_url ? [data.image_url] : []),
        ticket_price: parseFloat(data.price) || 0,
        gift_tickets_per_purchase: parseInt(data.gift_tickets) || 1,
        status: data.status,
        competition_type: 'collect_letters' as const,
        is_product_based: true,
        product_id: data.product_id || null,
        required_tickets: 1,
        currency: 'دينار'
      };

      if (editingOffer) {
        const { error } = await supabase
          .from('competitions')
          .update(payload)
          .eq('id', editingOffer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('competitions')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      toast.success(editingOffer ? 'تم تحديث العرض' : 'تم إنشاء العرض');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('competitions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      toast.success('تم حذف العرض');
    }
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('competition-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('competition-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setFormData({ 
        ...formData, 
        images: [...formData.images, ...uploadedUrls],
        image_url: formData.images.length === 0 && uploadedUrls.length > 0 ? uploadedUrls[0] : formData.image_url
      });
      toast.success(`تم رفع ${uploadedUrls.length} صورة بنجاح`);
    } catch (error: any) {
      toast.error('خطأ في رفع الصور: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      images: newImages,
      image_url: newImages.length > 0 ? newImages[0] : ''
    });
  };

  const resetForm = () => {
    setFormData({
      title_ar: '',
      description_ar: '',
      image_url: '',
      images: [],
      price: '',
      gift_tickets: '1',
      status: 'draft',
      product_id: ''
    });
    setEditingOffer(null);
  };

  const handleEdit = (offer: ProductOffer) => {
    setEditingOffer(offer);
    setFormData({
      title_ar: offer.title_ar,
      description_ar: offer.description_ar || '',
      image_url: offer.image_url || '',
      images: offer.images || [],
      price: offer.ticket_price?.toString() || '',
      gift_tickets: offer.gift_tickets_per_purchase?.toString() || '1',
      status: offer.status,
      product_id: offer.product_id || ''
    });
    setIsDialogOpen(true);
  };

  const statusLabels: Record<string, string> = {
    draft: 'مسودة',
    active: 'نشط',
    completed: 'منتهي'
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-green-500/20 text-green-400',
    completed: 'bg-blue-500/20 text-blue-400'
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع
            </Button>
            <div>
              <h1 className="text-2xl font-bold">عروض المنتجات والهدايا</h1>
              <p className="text-muted-foreground">إدارة المنتجات مع تذاكر الهدية</p>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة عرض جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingOffer ? 'تعديل العرض' : 'إضافة عرض جديد'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* اسم المنتج */}
                <div className="space-y-2">
                  <Label>اسم المنتج *</Label>
                  <Input
                    value={formData.title_ar}
                    onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                    placeholder="مثال: آيفون 15 برو ماكس"
                  />
                </div>

                {/* الوصف */}
                <div className="space-y-2">
                  <Label>وصف المنتج</Label>
                  <Textarea
                    value={formData.description_ar}
                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    placeholder="وصف تفصيلي للمنتج..."
                    rows={3}
                  />
                </div>

                {/* السعر وعدد التذاكر */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>سعر المنتج (دينار) *</Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>عدد التذاكر الهدية *</Label>
                    <Input
                      type="number"
                      value={formData.gift_tickets}
                      onChange={(e) => setFormData({ ...formData, gift_tickets: e.target.value })}
                      placeholder="1"
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      تذاكر مجانية تُمنح عند شراء المنتج
                    </p>
                  </div>
                </div>

                {/* ربط بمنتج */}
                <div className="space-y-2">
                  <Label>ربط بمنتج (اختياري)</Label>
                  <Select
                    value={formData.product_id}
                    onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر منتج للربط" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون ربط</SelectItem>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name_ar}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* الحالة */}
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">مسودة</SelectItem>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="completed">منتهي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* رفع الصور */}
                <div className="space-y-2">
                  <Label>صور المنتج</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.images.map((img, index) => (
                      <div key={index} className="relative w-24 h-24">
                        <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <label className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                      {uploadingImage ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      )}
                    </label>
                  </div>
                </div>

                {/* أزرار الإجراء */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => createMutation.mutate(formData)}
                    disabled={createMutation.isPending || !formData.title_ar || !formData.price}
                    className="flex-1"
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                    {editingOffer ? 'حفظ التعديلات' : 'إنشاء العرض'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    إلغاء
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* قائمة العروض */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : productOffers && productOffers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {productOffers.map((offer) => (
              <Card key={offer.id} className="overflow-hidden">
                <div className="aspect-video relative bg-muted">
                  {offer.image_url ? (
                    <OptimizedImage
                      src={offer.image_url}
                      alt={offer.title_ar}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <Badge className={`absolute top-2 right-2 ${statusColors[offer.status]}`}>
                    {statusLabels[offer.status]}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2">{offer.title_ar}</h3>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xl font-bold text-primary">
                      {offer.ticket_price?.toLocaleString()} {offer.currency}
                    </div>
                    <div className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                      <Gift className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        +{offer.gift_tickets_per_purchase || 1} تذكرة هدية
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    {formatBaghdadTime(offer.created_at)}
                  </p>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(offer)}
                    >
                      <Edit className="h-4 w-4 ml-1" />
                      تعديل
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذا العرض؟')) {
                          deleteMutation.mutate(offer.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">لا توجد عروض</h3>
            <p className="text-muted-foreground mb-4">
              ابدأ بإضافة عرض منتج جديد مع تذاكر هدية
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة عرض جديد
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
