import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Plus, Trash2, Edit, Coins, Gift, Package, Ticket, Tag, 
  Image as ImageIcon, Loader2, Eye, EyeOff, Percent, ShoppingBag
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminLoading, AdminEmptyState } from "@/components/admin/AdminLayout";
import OptimizedImage from "@/components/OptimizedImage";

// أنواع المنتجات
const PRODUCT_TYPES = [
  { value: 'coupon', label: 'كوبون خصم', icon: Tag, description: 'كوبون خصم يمكن استخدامه على المشتريات' },
  { value: 'free_shipping', label: 'توصيل مجاني', icon: Package, description: 'شحن مجاني للطلبات' },
  { value: 'discount', label: 'خصم مباشر', icon: Percent, description: 'خصم مباشر على سعر المنتج' },
  { value: 'physical', label: 'منتج مادي', icon: Gift, description: 'منتج يُضاف للمخزن ويمكن شحنه' },
  { value: 'tickets', label: 'تذاكر مسابقات', icon: Ticket, description: 'تذاكر للمشاركة في المسابقات' },
];

interface RedeemableProduct {
  id: string;
  title_ar: string;
  description_ar: string | null;
  product_type: string;
  value_amount: number;
  points_cost: number;
  stock_quantity: number | null;
  max_per_user: number | null;
  image_url: string | null;
  is_active: boolean | null;
  valid_days: number | null;
  created_at: string;
  updated_at: string;
}

export default function AdminRedeemableProducts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<RedeemableProduct | null>(null);
  const [editingProduct, setEditingProduct] = useState<RedeemableProduct | null>(null);

  // Form states
  const [titleAr, setTitleAr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [productType, setProductType] = useState("coupon");
  const [valueAmount, setValueAmount] = useState("0");
  const [pointsCost, setPointsCost] = useState("100");
  const [stockQuantity, setStockQuantity] = useState("10");
  const [maxPerUser, setMaxPerUser] = useState("1");
  const [validDays, setValidDays] = useState("30");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Check admin
  useQuery({
    queryKey: ['admin-check'],
    queryFn: async () => {
      if (!user) {
        navigate("/auth");
        return null;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();
      if (!data) {
        navigate("/");
        toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
        return null;
      }
      return data;
    },
    enabled: !!user,
  });

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-redeemable-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_redeemable_products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RedeemableProduct[];
    },
  });

  // Fetch redemption stats
  const { data: redemptionStats } = useQuery({
    queryKey: ['redemption-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_product_redemptions')
        .select('product_id, id');
      if (error) throw error;
      
      const stats: Record<string, number> = {};
      data?.forEach((r: any) => {
        stats[r.product_id] = (stats[r.product_id] || 0) + 1;
      });
      return stats;
    },
    staleTime: 60 * 1000,
  });

  // Upload image
  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `redeemable/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      setImageUrl(publicUrl);
      toast.success('تم رفع الصورة بنجاح');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('حدث خطأ في رفع الصورة');
    } finally {
      setUploadingImage(false);
    }
  };

  // Save product mutation
  const saveProduct = useMutation({
    mutationFn: async () => {
      const productData = {
        title_ar: titleAr,
        description_ar: descriptionAr || null,
        product_type: productType,
        value_amount: parseFloat(valueAmount),
        points_cost: parseInt(pointsCost),
        stock_quantity: parseInt(stockQuantity),
        max_per_user: parseInt(maxPerUser),
        valid_days: parseInt(validDays),
        is_active: isActive,
        image_url: imageUrl || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('points_redeemable_products')
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('points_redeemable_products')
          .insert(productData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-redeemable-products'] });
      toast.success(editingProduct ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // Delete product mutation
  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('points_redeemable_products')
        .delete()
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-redeemable-products'] });
      toast.success('تم حذف المنتج بنجاح');
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء الحذف');
    },
  });

  // Toggle active mutation
  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('points_redeemable_products')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-redeemable-products'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const handleOpenDialog = (product?: RedeemableProduct) => {
    if (product) {
      setEditingProduct(product);
      setTitleAr(product.title_ar);
      setDescriptionAr(product.description_ar || "");
      setProductType(product.product_type);
      setValueAmount(product.value_amount.toString());
      setPointsCost(product.points_cost.toString());
      setStockQuantity((product.stock_quantity || 10).toString());
      setMaxPerUser((product.max_per_user || 1).toString());
      setValidDays((product.valid_days || 30).toString());
      setIsActive(product.is_active ?? true);
      setImageUrl(product.image_url || "");
    } else {
      setEditingProduct(null);
      setTitleAr("");
      setDescriptionAr("");
      setProductType("coupon");
      setValueAmount("0");
      setPointsCost("100");
      setStockQuantity("10");
      setMaxPerUser("1");
      setValidDays("30");
      setIsActive(true);
      setImageUrl("");
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
  };

  const getProductTypeInfo = (type: string) => {
    return PRODUCT_TYPES.find(t => t.value === type) || PRODUCT_TYPES[0];
  };

  if (!user) return null;

  return (
    <AdminLayout
      title="إدارة منتجات استبدال النقاط"
      icon={<ShoppingBag className="h-5 w-5" />}
      description="إدارة المنتجات والكوبونات التي يمكن للمستخدمين استبدالها بالنقاط"
      actions={
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة منتج جديد
        </Button>
      }
    >
      {isLoading ? (
        <AdminLoading />
      ) : !products || products.length === 0 ? (
        <AdminEmptyState
          title="لا توجد منتجات"
          description="أضف منتجات جديدة ليتمكن المستخدمون من استبدالها بنقاطهم"
          icon={<Gift className="h-12 w-12" />}
          action={
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة منتج
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const typeInfo = getProductTypeInfo(product.product_type);
            const TypeIcon = typeInfo.icon;
            const redemptions = redemptionStats?.[product.id] || 0;
            
            return (
              <Card key={product.id} className={`overflow-hidden ${!product.is_active ? 'opacity-60' : ''}`}>
                {/* Product Image */}
                <div className="aspect-video bg-muted relative">
                  {product.image_url ? (
                    <OptimizedImage
                      src={product.image_url}
                      alt={product.title_ar}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <TypeIcon className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <Badge 
                    className={`absolute top-2 right-2 ${product.is_active ? 'bg-green-500' : 'bg-red-500'}`}
                  >
                    {product.is_active ? 'مفعّل' : 'معطّل'}
                  </Badge>
                  
                  {/* Type Badge */}
                  <Badge variant="secondary" className="absolute top-2 left-2 gap-1">
                    <TypeIcon className="h-3 w-3" />
                    {typeInfo.label}
                  </Badge>
                </div>

                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold line-clamp-1">{product.title_ar}</h3>
                    {product.description_ar && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {product.description_ar}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">{product.points_cost.toLocaleString()}</span>
                      <span className="text-muted-foreground">نقطة</span>
                    </div>
                    {product.value_amount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="h-4 w-4 text-green-500" />
                        <span className="font-medium">{product.value_amount.toLocaleString()}</span>
                        <span className="text-muted-foreground">د.ع</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{product.stock_quantity}</span>
                      <span className="text-muted-foreground">متبقي</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">{redemptions}</span>
                      <span className="text-muted-foreground">استبدال</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Switch
                      checked={product.is_active ?? false}
                      onCheckedChange={(checked) => toggleActive.mutate({ id: product.id, isActive: checked })}
                    />
                    <span className="text-xs text-muted-foreground flex-1">
                      {product.is_active ? 'مفعّل' : 'معطّل'}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(product)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedProduct(product);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? 'قم بتحديث بيانات المنتج' : 'أضف منتج جديد يمكن استبداله بالنقاط'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>صورة المنتج</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadImage}
                className="hidden"
              />
              {imageUrl ? (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <OptimizedImage
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => setImageUrl("")}
                  >
                    حذف
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-sm">اضغط لرفع صورة</span>
                    </div>
                  )}
                </Button>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">اسم المنتج *</Label>
              <Input
                id="title"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="مثال: كوبون خصم 5000 دينار"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea
                id="description"
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                placeholder="وصف مختصر للمنتج..."
                rows={2}
              />
            </div>

            {/* Product Type */}
            <div className="space-y-2">
              <Label>نوع المنتج</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getProductTypeInfo(productType).description}
              </p>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-2 gap-4">
              {/* Points Cost */}
              <div className="space-y-2">
                <Label htmlFor="points">تكلفة النقاط *</Label>
                <Input
                  id="points"
                  type="number"
                  value={pointsCost}
                  onChange={(e) => setPointsCost(e.target.value)}
                />
              </div>

              {/* Value Amount */}
              <div className="space-y-2">
                <Label htmlFor="value">القيمة (د.ع)</Label>
                <Input
                  id="value"
                  type="number"
                  value={valueAmount}
                  onChange={(e) => setValueAmount(e.target.value)}
                />
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <Label htmlFor="stock">الكمية المتاحة</Label>
                <Input
                  id="stock"
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                />
              </div>

              {/* Max Per User */}
              <div className="space-y-2">
                <Label htmlFor="maxPerUser">الحد لكل مستخدم</Label>
                <Input
                  id="maxPerUser"
                  type="number"
                  value={maxPerUser}
                  onChange={(e) => setMaxPerUser(e.target.value)}
                />
              </div>

              {/* Valid Days */}
              <div className="space-y-2">
                <Label htmlFor="validDays">صلاحية (أيام)</Label>
                <Input
                  id="validDays"
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                />
              </div>

              {/* Active */}
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label>مفعّل</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              إلغاء
            </Button>
            <Button 
              onClick={() => saveProduct.mutate()}
              disabled={saveProduct.isPending || !titleAr || !pointsCost}
            >
              {saveProduct.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {editingProduct ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المنتج "{selectedProduct?.title_ar}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedProduct && deleteProduct.mutate(selectedProduct.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProduct.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
