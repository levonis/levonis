import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout, { AdminSection, AdminCard, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Image, ExternalLink, Copy, FileText, GripVertical, Crop, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import BannerImageCropper, { CropSettings } from '@/components/admin/BannerImageCropper';

interface BannerFormData {
  title: string;
  title_ar: string;
  image_url: string;
  action_type: string;
  product_id: string | null;
  page_url: string | null;
  external_url: string | null;
  coupon_code: string | null;
  button_text: string | null;
  button_text_ar: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  display_order: number;
  crop_settings: CropSettings | null;
}

const initialFormData: BannerFormData = {
  title: '',
  title_ar: '',
  image_url: '',
  action_type: 'none',
  product_id: null,
  page_url: null,
  external_url: null,
  coupon_code: null,
  button_text: null,
  button_text_ar: null,
  is_active: true,
  start_date: null,
  end_date: null,
  display_order: 0,
  crop_settings: null,
};

const AdminBanners = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BannerFormData>(initialFormData);
  const [uploading, setUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string>('');

  const { data: banners, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async (data: BannerFormData) => {
      const { crop_settings, ...rest } = data;
      const insertData = {
        ...rest,
        crop_settings: crop_settings ? JSON.parse(JSON.stringify(crop_settings)) : null
      };
      const { error } = await supabase
        .from('banners')
        .insert([insertData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['active-banners'] });
      toast.success('تم إنشاء البانر بنجاح');
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('فشل في إنشاء البانر');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BannerFormData }) => {
      const { crop_settings, ...rest } = data;
      const updateData = {
        ...rest,
        crop_settings: crop_settings ? JSON.parse(JSON.stringify(crop_settings)) : null
      };
      const { error } = await supabase
        .from('banners')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['active-banners'] });
      toast.success('تم تحديث البانر بنجاح');
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('فشل في تحديث البانر');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['active-banners'] });
      toast.success('تم حذف البانر بنجاح');
    },
    onError: () => {
      toast.error('فشل في حذف البانر');
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleEdit = (banner: any) => {
    setFormData({
      title: banner.title || '',
      title_ar: banner.title_ar || '',
      image_url: banner.image_url || '',
      action_type: banner.action_type || 'none',
      product_id: banner.product_id,
      page_url: banner.page_url,
      external_url: banner.external_url,
      coupon_code: banner.coupon_code,
      button_text: banner.button_text,
      button_text_ar: banner.button_text_ar,
      is_active: banner.is_active,
      start_date: banner.start_date,
      end_date: banner.end_date,
      display_order: banner.display_order || 0,
      crop_settings: banner.crop_settings || null,
    });
    setEditingId(banner.id);
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      // Set temp image for cropping
      setTempImageUrl(data.publicUrl);
      setCropperOpen(true);
      toast.success('تم رفع الصورة - يمكنك الآن قصها');
    } catch (error) {
      toast.error('فشل في رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleCropComplete = (croppedImageUrl: string, cropSettings: CropSettings) => {
    // Upload cropped image
    fetch(croppedImageUrl)
      .then(res => res.blob())
      .then(async (blob) => {
        const fileExt = 'jpg';
        const fileName = `${Date.now()}_cropped.${fileExt}`;
        const filePath = `banners/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, blob, { contentType: 'image/jpeg' });

        if (uploadError) {
          // If upload fails, use the original image with crop settings
          setFormData({ 
            ...formData, 
            image_url: tempImageUrl,
            crop_settings: cropSettings 
          });
          toast.info('تم حفظ إعدادات القص');
          return;
        }

        const { data } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath);

        setFormData({ 
          ...formData, 
          image_url: data.publicUrl,
          crop_settings: cropSettings 
        });
        toast.success('تم قص الصورة بنجاح');
      })
      .catch(() => {
        // Fallback: use original image with crop settings
        setFormData({ 
          ...formData, 
          image_url: tempImageUrl,
          crop_settings: cropSettings 
        });
        toast.info('تم حفظ إعدادات القص');
      });
  };

  const handleSubmit = () => {
    if (!formData.image_url) {
      toast.error('الرجاء رفع صورة للبانر');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'product': return <FileText className="h-4 w-4" />;
      case 'page': return <ExternalLink className="h-4 w-4" />;
      case 'external': return <ExternalLink className="h-4 w-4" />;
      case 'coupon': return <Copy className="h-4 w-4" />;
      default: return null;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'product': return 'منتج';
      case 'page': return 'صفحة داخلية';
      case 'external': return 'رابط خارجي';
      case 'coupon': return 'كوبون';
      default: return 'بدون إجراء';
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="البانرات الإعلانية" icon={<Image className="h-6 w-6" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="البانرات الإعلانية"
      description="إدارة البانرات الإعلانية في الصفحة الرئيسية"
      icon={<Image className="h-6 w-6" />}
      actions={
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة بانر
        </Button>
      }
    >
      <AdminSection>
        <AdminCard>
          {!banners || banners.length === 0 ? (
            <AdminEmptyState
              icon={<Image className="h-12 w-12" />}
              title="لا توجد بانرات"
              description="أضف بانر جديد للبدء"
              action={
                <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة بانر
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-20">الصورة</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>نوع الإجراء</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banners.map((banner, index) => (
                  <TableRow key={banner.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        {index + 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <img
                        src={banner.image_url}
                        alt={banner.title_ar}
                        className="w-16 h-10 object-cover rounded"
                      />
                    </TableCell>
                    <TableCell>{banner.title_ar || banner.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(banner.action_type)}
                        {getActionLabel(banner.action_type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        banner.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                      }`}>
                        {banner.is_active ? 'مفعل' : 'معطل'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(banner)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('هل أنت متأكد من حذف هذا البانر؟')) {
                              deleteMutation.mutate(banner.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AdminCard>
      </AdminSection>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل البانر' : 'إضافة بانر جديد'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>صورة البانر</Label>
              {formData.image_url ? (
                <div className="relative">
                  <img
                    src={formData.image_url}
                    alt="Banner preview"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setFormData({ ...formData, image_url: '' })}
                  >
                    إزالة
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                    id="banner-image"
                  />
                  <Label htmlFor="banner-image" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Image className="h-10 w-10 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {uploading ? 'جاري الرفع...' : 'اضغط لرفع صورة'}
                      </span>
                    </div>
                  </Label>
                </div>
              )}
            </div>

            {/* Titles */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title_ar">العنوان (عربي)</Label>
                <Input
                  id="title_ar"
                  value={formData.title_ar}
                  onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                  placeholder="عنوان البانر بالعربية"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">العنوان (إنجليزي)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Banner title in English"
                />
              </div>
            </div>

            {/* Action Type */}
            <div className="space-y-2">
              <Label>نوع الإجراء عند الضغط</Label>
              <Select
                value={formData.action_type}
                onValueChange={(value) => setFormData({ ...formData, action_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الإجراء" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون إجراء</SelectItem>
                  <SelectItem value="product">الانتقال لمنتج</SelectItem>
                  <SelectItem value="page">الانتقال لصفحة داخلية</SelectItem>
                  <SelectItem value="external">رابط خارجي</SelectItem>
                  <SelectItem value="coupon">نسخ كوبون</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action-specific fields */}
            {formData.action_type === 'product' && (
              <div className="space-y-2">
                <Label htmlFor="product_id">معرف المنتج (Product ID)</Label>
                <Input
                  id="product_id"
                  value={formData.product_id || ''}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value || null })}
                  placeholder="أدخل معرف المنتج"
                  dir="ltr"
                />
              </div>
            )}

            {formData.action_type === 'page' && (
              <div className="space-y-2">
                <Label htmlFor="page_url">رابط الصفحة الداخلية</Label>
                <Input
                  id="page_url"
                  value={formData.page_url || ''}
                  onChange={(e) => setFormData({ ...formData, page_url: e.target.value })}
                  placeholder="/categories أو /products"
                  dir="ltr"
                />
              </div>
            )}

            {formData.action_type === 'external' && (
              <div className="space-y-2">
                <Label htmlFor="external_url">الرابط الخارجي</Label>
                <Input
                  id="external_url"
                  value={formData.external_url || ''}
                  onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                  placeholder="https://example.com"
                  dir="ltr"
                />
              </div>
            )}

            {formData.action_type === 'coupon' && (
              <div className="space-y-2">
                <Label htmlFor="coupon_code">كود الكوبون</Label>
                <Input
                  id="coupon_code"
                  value={formData.coupon_code || ''}
                  onChange={(e) => setFormData({ ...formData, coupon_code: e.target.value })}
                  placeholder="DISCOUNT20"
                  dir="ltr"
                />
              </div>
            )}

            {/* Button Text */}
            {formData.action_type !== 'none' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="button_text_ar">نص الزر (عربي)</Label>
                  <Input
                    id="button_text_ar"
                    value={formData.button_text_ar || ''}
                    onChange={(e) => setFormData({ ...formData, button_text_ar: e.target.value })}
                    placeholder="عرض المنتج"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="button_text">نص الزر (إنجليزي)</Label>
                  <Input
                    id="button_text"
                    value={formData.button_text || ''}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    placeholder="View Product"
                  />
                </div>
              </div>
            )}

            {/* Display Order */}
            <div className="space-y-2">
              <Label htmlFor="display_order">ترتيب العرض</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">تاريخ البدء (اختياري)</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value || null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">تاريخ الانتهاء (اختياري)</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value || null })}
                />
              </div>
            </div>

            {/* Active Switch */}
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>تفعيل البانر</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Cropper Dialog */}
      <BannerImageCropper
        imageUrl={tempImageUrl}
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        onCropComplete={handleCropComplete}
        initialCropSettings={formData.crop_settings}
      />
    </AdminLayout>
  );
};

export default AdminBanners;
