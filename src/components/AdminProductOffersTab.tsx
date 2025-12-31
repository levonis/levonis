import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Gift, Loader2, Trash2, Upload, X, Edit, Package, DollarSign, Ticket } from "lucide-react";
import { toast } from "sonner";

interface ProductOffer {
  id: string;
  title: string;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  ticket_price: number; // This is the product price
  gift_tickets_per_purchase: number;
  status: 'draft' | 'active' | 'completed';
  is_product_based: boolean;
  created_at: string;
}

export default function AdminProductOffersTab() {
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
    status: 'active' as 'draft' | 'active' | 'completed',
  });

  // Fetch product offers (competitions with is_product_based = true)
  const { data: offers, isLoading } = useQuery({
    queryKey: ['admin-product-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('is_product_based', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ProductOffer[];
    },
  });

  const resetForm = () => {
    setFormData({
      title_ar: '',
      description_ar: '',
      image_url: '',
      images: [],
      price: '',
      gift_tickets: '1',
      status: 'active',
    });
    setEditingOffer(null);
  };

  const handleEdit = (offer: ProductOffer) => {
    setEditingOffer(offer);
    setFormData({
      title_ar: offer.title_ar,
      description_ar: offer.description_ar || '',
      image_url: offer.image_url || '',
      images: offer.images || (offer.image_url ? [offer.image_url] : []),
      price: offer.ticket_price.toString(),
      gift_tickets: ((offer as any).gift_tickets_per_purchase || 1).toString(),
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

      const { error } = await supabase.storage
        .from('competition-images')
        .upload(filePath, file);

      if (error) {
        toast.error(`خطأ في رفع الصورة: ${error.message}`);
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
      image_url: prev.images.length === 0 && newImages.length > 0 ? newImages[0] : prev.image_url
    }));
    setUploadingImage(false);
  };

  const removeImage = (index: number) => {
    setFormData(prev => {
      const newImages = [...prev.images];
      newImages.splice(index, 1);
      return {
        ...prev,
        images: newImages,
        image_url: newImages.length > 0 ? newImages[0] : ''
      };
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
        prize_description: 'منتج للشراء',
        prize_description_ar: 'منتج للشراء',
        ticket_price: parseFloat(data.price) || 0,
        gift_tickets_per_purchase: parseInt(data.gift_tickets) || 1,
        status: data.status as 'draft' | 'active' | 'completed',
        is_product_based: true,
        competition_type: 'free' as const, // Not a real competition
        required_tickets: 0, // No tickets required - direct purchase
        start_date: new Date().toISOString(),
      };

      const { data: result, error } = await supabase
        .from('competitions')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('تم إنشاء العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('خطأ في الإنشاء: ' + error.message);
    },
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
        ticket_price: parseFloat(data.price) || 0,
        gift_tickets_per_purchase: parseInt(data.gift_tickets) || 1,
        status: data.status,
      };

      const { error } = await supabase
        .from('competitions')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('خطأ في التحديث: ' + error.message);
    },
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
      toast.success('تم حذف العرض');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
    },
    onError: (error) => {
      toast.error('خطأ في الحذف: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!formData.title_ar || !formData.price) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (editingOffer) {
      updateMutation.mutate({ id: editingOffer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const statusLabels = {
    draft: { label: 'مسودة', color: 'bg-gray-500' },
    active: { label: 'نشط', color: 'bg-green-500' },
    completed: { label: 'متوقف', color: 'bg-red-500' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            عروض المنتجات والهدايا
          </h2>
          <p className="text-sm text-muted-foreground">منتجات للشراء مع تذاكر هدية مجانية</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          إضافة عرض
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-4 text-center">
            <Package className="h-6 w-6 mx-auto mb-1 text-green-600" />
            <p className="text-xl font-bold">{offers?.filter(o => o.status === 'active').length || 0}</p>
            <p className="text-xs text-muted-foreground">عروض نشطة</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-4 text-center">
            <Gift className="h-6 w-6 mx-auto mb-1 text-blue-600" />
            <p className="text-xl font-bold">{offers?.length || 0}</p>
            <p className="text-xs text-muted-foreground">إجمالي العروض</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="p-4 text-center">
            <Ticket className="h-6 w-6 mx-auto mb-1 text-purple-600" />
            <p className="text-xl font-bold">
              {offers?.reduce((sum, o) => sum + ((o as any).gift_tickets_per_purchase || 1), 0) || 0}
            </p>
            <p className="text-xs text-muted-foreground">تذاكر هدية</p>
          </CardContent>
        </Card>
      </div>

      {/* Offers List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : offers?.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد عروض منتجات حتى الآن</p>
            <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              إنشاء أول عرض
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offers?.map((offer) => (
            <Card key={offer.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {offer.image_url && (
                    <img 
                      src={offer.image_url} 
                      alt={offer.title_ar}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{offer.title_ar}</h3>
                      <Badge className={`${statusLabels[offer.status].color} text-white text-xs`}>
                        {statusLabels[offer.status].label}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {offer.description_ar || 'لا يوجد وصف'}
                    </p>
                    
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="font-bold">{offer.ticket_price.toLocaleString()} دينار</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Gift className="h-4 w-4 text-green-600" />
                        <span>{(offer as any).gift_tickets_per_purchase || 1} تذكرة هدية</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(offer)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (window.confirm('هل أنت متأكد من حذف هذا العرض؟')) {
                          deleteMutation.mutate(offer.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOffer ? 'تعديل العرض' : 'إضافة عرض منتج جديد'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المنتج *</Label>
              <Input
                value={formData.title_ar}
                onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                placeholder="مثال: ساعة ذكية سامسونج"
              />
            </div>

            <div className="space-y-2">
              <Label>وصف المنتج</Label>
              <Textarea
                value={formData.description_ar}
                onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                placeholder="وصف مختصر للمنتج..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>سعر المنتج (دينار) *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="25000"
                />
              </div>
              <div className="space-y-2">
                <Label>عدد التذاكر الهدية</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.gift_tickets}
                  onChange={(e) => setFormData({ ...formData, gift_tickets: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>صورة المنتج</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
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
                        اختر صورة
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {formData.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.images.map((url, index) => (
                    <div key={index} className="relative w-20 h-20 group">
                      <img
                        src={url}
                        alt={`صورة ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border"
                      />
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

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>حالة العرض</Label>
                <p className="text-xs text-muted-foreground">العرض النشط يظهر للمستخدمين</p>
              </div>
              <Switch
                checked={formData.status === 'active'}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'active' : 'draft' })}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              {editingOffer ? 'تحديث العرض' : 'إنشاء العرض'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
