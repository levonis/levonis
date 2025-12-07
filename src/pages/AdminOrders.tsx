import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Truck, ExternalLink, Calendar, Pencil, Search, Trash2, Plus, Upload, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import LevelBadge from '@/components/LevelBadge';

const AdminOrders = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchParams] = useSearchParams();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [serialImageFile, setSerialImageFile] = useState<File | null>(null);
  const [adminImageFiles, setAdminImageFiles] = useState<File[]>([]);
  const [adminFilesArray, setAdminFilesArray] = useState<File[]>([]);
  const [adminImagePreviews, setAdminImagePreviews] = useState<string[]>([]);
  const [existingAdminImages, setExistingAdminImages] = useState<string[]>([]);
  const [existingAdminFiles, setExistingAdminFiles] = useState<string[]>([]);
  const [serialImagePreview, setSerialImagePreview] = useState<string>('');
  
  // Financial fields state for live calculation
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [adminProductCost, setAdminProductCost] = useState<number>(0);
  const [adminShippingCost, setAdminShippingCost] = useState<number>(0);
  const [adminOtherCosts, setAdminOtherCosts] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  
  // Calculate profit dynamically: المبلغ الإجمالي - تكلفة المنتج - تكلفة الشحن - التكاليف الأخرى + الضريبة
  const calculatedProfit = totalAmount - adminProductCost - adminShippingCost - adminOtherCosts + taxAmount;
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) setStatusFilter(status);
  }, [searchParams]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders', isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles(full_name, email, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      const { error } = await supabase
        .from('orders')
        .update(values)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم تحديث الطلب بنجاح');
      setDialogOpen(false);
      setEditingOrder(null);
      setSerialImageFile(null);
      setSerialImagePreview('');
      setAdminImageFiles([]);
      setAdminFilesArray([]);
      setAdminImagePreviews([]);
      setExistingAdminImages([]);
      setExistingAdminFiles([]);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث الطلب');
      console.error(error);
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async (values: any) => {
      // Generate order number
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      const { data, error } = await supabase
        .from('orders')
        .insert([{
          ...values,
          order_number: orderNumber,
          status: values.status || 'pending',
          currency: values.currency || 'دينار عراقي',
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم إنشاء الطلب بنجاح');
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إنشاء الطلب');
      console.error(error);
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // حذف عناصر الطلب أولاً
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // ثم حذف الطلب
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم حذف الطلب بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء حذف الطلب');
      console.error(error);
    }
  });

  const handleCreateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const values: any = {
      user_id: formData.get('user_id') as string,
      total_amount: Number(formData.get('total_amount')),
      shipping_address: formData.get('shipping_address') as string,
      phone_number: formData.get('phone_number') as string,
      governorate: formData.get('governorate') as string,
      status: formData.get('status') as string || 'pending',
      currency: formData.get('currency') as string || 'دينار عراقي',
      shipping_notes: formData.get('shipping_notes') as string || null,
    };

    createOrderMutation.mutate(values);
  };

  const handleSerialImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
        return;
      }
      setSerialImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSerialImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdminImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`الملف ${file.name} أكبر من 10 ميجابايت`);
        return false;
      }
      return true;
    });
    
    setAdminImageFiles(prev => [...prev, ...validFiles]);
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAdminImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAdminFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`الملف ${file.name} أكبر من 20 ميجابايت`);
        return false;
      }
      return true;
    });
    setAdminFilesArray(prev => [...prev, ...validFiles]);
  };

  const removeAdminImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingAdminImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setAdminImageFiles(prev => prev.filter((_, i) => i !== index));
      setAdminImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const removeAdminFile = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingAdminFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setAdminFilesArray(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadSerialImage = async (file: File, orderId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${orderId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('serial-number-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('serial-number-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const uploadOrderFile = async (file: File, orderId: string, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${orderId}/${folder}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('order-files')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('order-files')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleUpdateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (uploadingImage) return;
    
    const formData = new FormData(e.currentTarget);

    let serialImageUrl = serialImagePreview === 'deleted' ? null : editingOrder.serial_number_image_url;

    setUploadingImage(true);

    try {
      // رفع صورة Serial Number إذا تم اختيار ملف
      if (serialImageFile) {
        serialImageUrl = await uploadSerialImage(serialImageFile, editingOrder.id);
      }

      // رفع الصور الإضافية
      const uploadedImageUrls: string[] = [...existingAdminImages];
      for (const file of adminImageFiles) {
        const url = await uploadOrderFile(file, editingOrder.id, 'images');
        uploadedImageUrls.push(url);
      }

      // رفع الملفات الإضافية
      const uploadedFileUrls: string[] = [...existingAdminFiles];
      for (const file of adminFilesArray) {
        const url = await uploadOrderFile(file, editingOrder.id, 'files');
        uploadedFileUrls.push(url);
      }

      const values: any = {
        order_number: formData.get('order_number') as string,
        status: formData.get('status') as string,
        shipping_notes: formData.get('shipping_notes') as string || null,
        serial_number_image_url: serialImageUrl,
        admin_images: uploadedImageUrls,
        admin_files: uploadedFileUrls,
        estimated_delivery_date: formData.get('estimated_delivery_date') as string || null,
        actual_weight: formData.get('actual_weight') ? Number(formData.get('actual_weight')) : null,
        package_dimensions: formData.get('package_dimensions') as string || null,
        customs_declaration_number: formData.get('customs_declaration_number') as string || null,
        internal_notes: formData.get('internal_notes') as string || null,
        priority: formData.get('priority') as string || 'normal',
        payment_status: formData.get('payment_status') as string || 'pending',
        payment_method: formData.get('payment_method') as string || null,
        subtotal: formData.get('subtotal') ? Number(formData.get('subtotal')) : 0,
        tax_percentage: formData.get('tax_percentage') ? Number(formData.get('tax_percentage')) : 0,
        tax_amount: formData.get('tax_amount') ? Number(formData.get('tax_amount')) : 0,
        discount_amount: formData.get('discount_amount') ? Number(formData.get('discount_amount')) : 0,
        paid_amount: formData.get('paid_amount') ? Number(formData.get('paid_amount')) : 0,
        remaining_amount: formData.get('remaining_amount') ? Number(formData.get('remaining_amount')) : 0,
        admin_product_cost: formData.get('admin_product_cost') ? Number(formData.get('admin_product_cost')) : 0,
        admin_shipping_cost: formData.get('admin_shipping_cost') ? Number(formData.get('admin_shipping_cost')) : 0,
        admin_other_costs: formData.get('admin_other_costs') ? Number(formData.get('admin_other_costs')) : 0,
        profit_amount: formData.get('profit_amount') ? Number(formData.get('profit_amount')) : 0,
        financial_notes: formData.get('financial_notes') as string || null,
      };

      // تحديث تاريخ الشحن
      if (values.status === 'shipped' && editingOrder?.status !== 'shipped') {
        values.shipped_at = new Date().toISOString();
      }

      // تحديث تاريخ الوصول للمخزن
      if (values.status === 'arrived_warehouse' && editingOrder?.status !== 'arrived_warehouse') {
        values.arrived_warehouse_at = new Date().toISOString();
      }

      // تحديث تاريخ الوصول للعراق
      if (values.status === 'arrived_iraq' && editingOrder?.status !== 'arrived_iraq') {
        values.arrived_iraq_at = new Date().toISOString();
      }

      // تحديث تاريخ التوصيل
      if (values.status === 'delivered' && editingOrder?.status !== 'delivered') {
        values.delivered_at = new Date().toISOString();
      }

      updateOrderMutation.mutate({ id: editingOrder.id, values });
    } catch (error) {
      toast.error('فشل رفع الملفات');
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'outline', label: 'قيد الانتظار' },
      confirmed: { variant: 'secondary', label: 'مؤكد' },
      processing: { variant: 'default', label: 'قيد التجهيز' },
      arrived_warehouse: { variant: 'default', label: 'وصل المخزن' },
      shipped: { variant: 'default', label: 'تم الشحن' },
      arrived_iraq: { variant: 'default', label: 'وصل العراق' },
      delivered: { variant: 'secondary', label: 'تم التوصيل' },
      cancelled: { variant: 'destructive', label: 'ملغي' },
    };

    const statusInfo = statusMap[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  // تصفية الطلبات
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = searchTerm === '' ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.profiles as any)?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.profiles as any)?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.profiles as any)?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!authLoading && !isAdmin) {
    navigate('/');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-primary mb-2">إدارة الطلبات</h1>
            <p className="text-muted-foreground">تتبع وإدارة جميع الطلبات ومعلومات الشحن</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                <Package className="ml-2 h-4 w-4" />
                إنشاء طلب جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إنشاء طلب جديد</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user_id">معرف المستخدم *</Label>
                  <Input
                    id="user_id"
                    name="user_id"
                    placeholder="UUID للمستخدم"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    يجب إدخال معرف المستخدم من جدول المستخدمين
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total_amount">المبلغ الإجمالي *</Label>
                  <Input
                    id="total_amount"
                    name="total_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">العملة</Label>
                  <Input
                    id="currency"
                    name="currency"
                    defaultValue="دينار عراقي"
                    placeholder="دينار عراقي"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">رقم الهاتف *</Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    placeholder="07XXXXXXXXX"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="governorate">المحافظة *</Label>
                  <Input
                    id="governorate"
                    name="governorate"
                    placeholder="بغداد"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shipping_address">عنوان الشحن *</Label>
                  <Textarea
                    id="shipping_address"
                    name="shipping_address"
                    placeholder="العنوان الكامل"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">الحالة *</Label>
                  <select
                    id="status"
                    name="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="pending">قيد الانتظار</option>
                    <option value="confirmed">مؤكد</option>
                    <option value="processing">قيد التجهيز</option>
                    <option value="shipped">تم الشحن</option>
                    <option value="delivered">تم التوصيل</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shipping_notes">ملاحظات الشحن</Label>
                  <Textarea
                    id="shipping_notes"
                    name="shipping_notes"
                    placeholder="أي ملاحظات إضافية..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={createOrderMutation.isPending}
                  >
                    {createOrderMutation.isPending ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري الإنشاء...
                      </>
                    ) : (
                      'إنشاء الطلب'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* البحث والتصفية */}
        <Card className="mb-6 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">البحث والتصفية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-2 block">البحث</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="رقم الطلب، اسم المستخدم، الاسم، رقم التتبع، أو البريد..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">الحالة</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="confirmed">مؤكد</option>
                  <option value="processing">قيد التجهيز</option>
                  <option value="shipped">تم الشحن</option>
                  <option value="delivered">تم التوصيل</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>
            </div>

            {(searchTerm || statusFilter !== 'all') && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {filteredOrders?.length || 0} طلب من أصل {orders?.length || 0}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                >
                  إعادة تعيين
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* جدول الطلبات */}
        <Card className="border-primary/20 shadow-lg">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم الطلب</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الدفع</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders && filteredOrders.length > 0 ? (
                  filteredOrders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-bold">{order.order_number}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {order.profiles?.username && `@${order.profiles.username}`}
                              {order.profiles?.username && order.profiles?.full_name && ' - '}
                              {order.profiles?.full_name || 'غير محدد'}
                            </span>
                            {order.user_id && <LevelBadge userId={order.user_id} size="sm" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{order.profiles?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {formatPrice(Number(order.total_amount))} {order.currency}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <Badge variant={order.payment_status === 'paid' ? 'secondary' : order.payment_status === 'partial' ? 'outline' : 'destructive'}>
                          {order.payment_status === 'paid' ? 'مدفوع' : 
                           order.payment_status === 'partial' ? 'جزئي' :
                           order.payment_status === 'refunded' ? 'مسترجع' : 'معلق'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/order/${order.id}`)}
                          >
                            <Package className="h-4 w-4 ml-2" />
                            عرض التفاصيل
                          </Button>
                          <Dialog open={dialogOpen && editingOrder?.id === order.id} onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (!open) {
                              setEditingOrder(null);
                              setSerialImageFile(null);
                              setSerialImagePreview('');
                              setAdminImageFiles([]);
                              setAdminFilesArray([]);
                              setAdminImagePreviews([]);
                              setExistingAdminImages([]);
                              setExistingAdminFiles([]);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingOrder(order);
                                  setSerialImagePreview(order.serial_number_image_url || '');
                                  setExistingAdminImages(order.admin_images || []);
                                  setExistingAdminFiles(order.admin_files || []);
                                  setAdminImageFiles([]);
                                  setAdminFilesArray([]);
                                  setAdminImagePreviews([]);
                                  // Initialize financial fields for live calculation
                                  setTotalAmount(parseFloat(order.total_amount) || 0);
                                  setAdminProductCost(parseFloat(order.admin_product_cost) || 0);
                                  setAdminShippingCost(parseFloat(order.admin_shipping_cost) || 0);
                                  setAdminOtherCosts(parseFloat(order.admin_other_costs) || 0);
                                  setTaxAmount(parseFloat(order.tax_amount) || 0);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 ml-2" />
                                تحديث
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>تحديث الطلب {order.order_number}</DialogTitle>
                              </DialogHeader>

                              <form onSubmit={handleUpdateOrder} className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="order_number">رقم الطلب *</Label>
                                  <Input
                                    id="order_number"
                                    name="order_number"
                                    defaultValue={order.order_number}
                                    placeholder="ORD-20250107-1234"
                                    required
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    يمكنك تعديل رقم الطلب أو إضافته يدوياً
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="status">الحالة *</Label>
                                  <select
                                    id="status"
                                    name="status"
                                    defaultValue={order.status}
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <option value="pending">قيد الانتظار</option>
                                    <option value="purchased">تم الشراء</option>
                                    <option value="confirmed">مؤكد</option>
                                    <option value="processing">قيد التجهيز</option>
                                    <option value="arrived_warehouse">وصل المخزن</option>
                                    <option value="shipped">تم الشحن</option>
                                    <option value="arrived_iraq">وصل العراق</option>
                                    <option value="delivered">تم التوصيل</option>
                                    <option value="cancelled">ملغي</option>
                                  </select>
                                </div>



                                <div className="space-y-2">
                                  <Label htmlFor="serial_image">صورة Serial Number</Label>
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => document.getElementById('serial_image')?.click()}
                                        disabled={uploadingImage}
                                      >
                                        <Upload className="ml-2 h-4 w-4" />
                                        {serialImageFile ? 'تغيير الصورة' : 'رفع صورة'}
                                      </Button>
                                      {(serialImagePreview || (order.serial_number_image_url && serialImagePreview !== 'deleted')) && (
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => {
                                            setSerialImageFile(null);
                                            setSerialImagePreview('deleted');
                                          }}
                                        >
                                          <X className="h-4 w-4 ml-1" />
                                          حذف الصورة
                                        </Button>
                                      )}
                                    </div>
                                    <Input
                                      id="serial_image"
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={handleSerialImageChange}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      صورة Serial Number عند وصول المنتج للمخزن (الحد الأقصى: 5 ميجابايت)
                                    </p>
                                    {serialImagePreview === 'deleted' ? (
                                      <div className="text-sm text-destructive p-3 bg-destructive/10 rounded">
                                        سيتم حذف الصورة عند الحفظ
                                      </div>
                                    ) : (serialImagePreview || order.serial_number_image_url) && (
                                      <img 
                                        src={serialImagePreview || order.serial_number_image_url} 
                                        alt="Serial Number Preview" 
                                        className="mt-2 max-w-xs rounded border"
                                      />
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="shipping_notes">ملاحظات</Label>
                                  <Textarea
                                    id="shipping_notes"
                                    name="shipping_notes"
                                    defaultValue={order.shipping_notes || ''}
                                    placeholder="أي ملاحظات إضافية..."
                                    rows={3}
                                  />
                                </div>

                                {/* تفاصيل الفاتورة */}
                                <div className="border-t pt-4 mt-4">
                                  <h4 className="font-semibold mb-4 text-primary">تفاصيل الفاتورة</h4>
                                  
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="subtotal">المبلغ الفرعي</Label>
                                      <Input
                                        id="subtotal"
                                        name="subtotal"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.subtotal || order.total_amount || ''}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="tax_percentage">نسبة الضريبة (%)</Label>
                                      <Input
                                        id="tax_percentage"
                                        name="tax_percentage"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.tax_percentage || '0'}
                                        placeholder="0"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="tax_amount">مبلغ الضريبة</Label>
                                      <Input
                                        id="tax_amount"
                                        name="tax_amount"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.tax_amount || '0'}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="discount_amount">مبلغ الخصم</Label>
                                      <Input
                                        id="discount_amount"
                                        name="discount_amount"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.discount_amount || '0'}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="paid_amount">المبلغ المدفوع</Label>
                                      <Input
                                        id="paid_amount"
                                        name="paid_amount"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.paid_amount || '0'}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="remaining_amount">المبلغ المتبقي</Label>
                                      <Input
                                        id="remaining_amount"
                                        name="remaining_amount"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.remaining_amount || '0'}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* حقول إضافية */}
                                <div className="border-t pt-4 mt-4">
                                  <h4 className="font-semibold mb-4 text-primary">معلومات إضافية</h4>
                                  
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="priority">الأولوية</Label>
                                      <select
                                        id="priority"
                                        name="priority"
                                        defaultValue={order.priority || 'normal'}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      >
                                        <option value="low">منخفضة</option>
                                        <option value="normal">عادية</option>
                                        <option value="high">عالية</option>
                                        <option value="urgent">عاجلة</option>
                                      </select>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="payment_status">حالة الدفع</Label>
                                      <select
                                        id="payment_status"
                                        name="payment_status"
                                        defaultValue={order.payment_status || 'pending'}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      >
                                        <option value="pending">قيد الانتظار</option>
                                        <option value="paid">مدفوع</option>
                                        <option value="partial">مدفوع جزئياً</option>
                                        <option value="refunded">مسترجع</option>
                                      </select>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="payment_method">طريقة الدفع</Label>
                                      <select
                                        id="payment_method"
                                        name="payment_method"
                                        defaultValue={order.payment_method || ''}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      >
                                        <option value="">غير محدد</option>
                                        <option value="cash">نقدي</option>
                                        <option value="wallet">المحفظة</option>
                                        <option value="bank_transfer">تحويل بنكي</option>
                                        <option value="card">بطاقة</option>
                                      </select>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="estimated_delivery_date">تاريخ التوصيل المتوقع</Label>
                                      <Input
                                        id="estimated_delivery_date"
                                        name="estimated_delivery_date"
                                        type="date"
                                        defaultValue={order.estimated_delivery_date ? new Date(order.estimated_delivery_date).toISOString().split('T')[0] : ''}
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="actual_weight">الوزن الفعلي (كغ)</Label>
                                      <Input
                                        id="actual_weight"
                                        name="actual_weight"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.actual_weight || ''}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="package_dimensions">أبعاد الطرد</Label>
                                      <Input
                                        id="package_dimensions"
                                        name="package_dimensions"
                                        defaultValue={order.package_dimensions || ''}
                                        placeholder="الطول × العرض × الارتفاع"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2 mt-4">
                                    <Label htmlFor="customs_declaration_number">رقم البيان الجمركي</Label>
                                    <Input
                                      id="customs_declaration_number"
                                      name="customs_declaration_number"
                                      defaultValue={order.customs_declaration_number || ''}
                                      placeholder="رقم البيان الجمركي"
                                    />
                                  </div>

                                  <div className="space-y-2 mt-4">
                                    <Label htmlFor="internal_notes">ملاحظات داخلية (للأدمن فقط)</Label>
                                    <Textarea
                                      id="internal_notes"
                                      name="internal_notes"
                                      defaultValue={order.internal_notes || ''}
                                      placeholder="ملاحظات داخلية لا تظهر للعميل..."
                                      rows={2}
                                    />
                                  </div>
                                </div>

                                {/* التكاليف المالية - للإدارة فقط */}
                                <div className="border-t pt-4 mt-4">
                                  <h4 className="font-semibold mb-4 text-primary flex items-center gap-2">
                                    💰 التكاليف المالية (للإدارة فقط - لا يظهر للزبون)
                                  </h4>
                                  
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="total_amount_display">المبلغ الإجمالي</Label>
                                      <Input
                                        id="total_amount_display"
                                        type="number"
                                        step="0.01"
                                        value={totalAmount}
                                        onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="bg-primary/5"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="tax_amount_calc">الضريبة (تُضاف للربح)</Label>
                                      <Input
                                        id="tax_amount_calc"
                                        type="number"
                                        step="0.01"
                                        value={taxAmount}
                                        onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="bg-green-50 dark:bg-green-950/20"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="admin_product_cost">تكلفة المنتج</Label>
                                      <Input
                                        id="admin_product_cost"
                                        name="admin_product_cost"
                                        type="number"
                                        step="0.01"
                                        value={adminProductCost}
                                        onChange={(e) => setAdminProductCost(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="admin_shipping_cost">تكلفة الشحن</Label>
                                      <Input
                                        id="admin_shipping_cost"
                                        name="admin_shipping_cost"
                                        type="number"
                                        step="0.01"
                                        value={adminShippingCost}
                                        onChange={(e) => setAdminShippingCost(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="admin_other_costs">تكاليف أخرى</Label>
                                      <Input
                                        id="admin_other_costs"
                                        name="admin_other_costs"
                                        type="number"
                                        step="0.01"
                                        value={adminOtherCosts}
                                        onChange={(e) => setAdminOtherCosts(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="profit_amount">الربح الصافي (محسوب تلقائياً)</Label>
                                      <Input
                                        id="profit_amount"
                                        name="profit_amount"
                                        type="number"
                                        step="0.01"
                                        value={calculatedProfit.toFixed(2)}
                                        readOnly
                                        className={`bg-muted font-bold ${calculatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                                      />
                                      <p className="text-xs text-muted-foreground">= المبلغ الإجمالي - تكلفة المنتج - تكلفة الشحن - تكاليف أخرى + الضريبة</p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="customer_paid_amount">المبلغ الذي دفعه الزبون</Label>
                                      <Input
                                        id="customer_paid_amount"
                                        name="customer_paid_amount"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.customer_paid_amount || '0'}
                                        placeholder="0.00"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="admin_paid_amount">المبلغ الذي دفعناه (تكلفتنا)</Label>
                                      <Input
                                        id="admin_paid_amount"
                                        name="admin_paid_amount"
                                        type="number"
                                        step="0.01"
                                        defaultValue={order.admin_paid_amount || '0'}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2 mt-4">
                                    <Label htmlFor="financial_notes">ملاحظات مالية</Label>
                                    <Textarea
                                      id="financial_notes"
                                      name="financial_notes"
                                      defaultValue={order.financial_notes || ''}
                                      placeholder="ملاحظات مالية خاصة بالإدارة..."
                                      rows={2}
                                    />
                                  </div>
                                </div>

                                {/* صور إضافية */}
                                <div className="border-t pt-4 mt-4">
                                  <h4 className="font-semibold mb-4 text-primary">صور إضافية</h4>
                                  <div className="space-y-3">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => document.getElementById('admin_images')?.click()}
                                    >
                                      <Upload className="ml-2 h-4 w-4" />
                                      إضافة صور
                                    </Button>
                                    <Input
                                      id="admin_images"
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="hidden"
                                      onChange={handleAdminImagesChange}
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {existingAdminImages.map((url, idx) => (
                                        <div key={`existing-${idx}`} className="relative">
                                          <img src={url} alt={`صورة ${idx + 1}`} className="w-20 h-20 object-cover rounded border" />
                                          <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-5 w-5"
                                            onClick={() => removeAdminImage(idx, true)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                      {adminImagePreviews.map((url, idx) => (
                                        <div key={`new-${idx}`} className="relative">
                                          <img src={url} alt={`صورة جديدة ${idx + 1}`} className="w-20 h-20 object-cover rounded border border-primary" />
                                          <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-5 w-5"
                                            onClick={() => removeAdminImage(idx, false)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* ملفات إضافية */}
                                <div className="border-t pt-4 mt-4">
                                  <h4 className="font-semibold mb-4 text-primary">ملفات إضافية</h4>
                                  <div className="space-y-3">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => document.getElementById('admin_files')?.click()}
                                    >
                                      <Upload className="ml-2 h-4 w-4" />
                                      إضافة ملفات
                                    </Button>
                                    <Input
                                      id="admin_files"
                                      type="file"
                                      multiple
                                      className="hidden"
                                      onChange={handleAdminFilesChange}
                                    />
                                    <p className="text-xs text-muted-foreground">PDF, Word, Excel وغيرها (الحد الأقصى: 20 ميجابايت)</p>
                                    <div className="space-y-2 mt-2">
                                      {existingAdminFiles.map((url, idx) => (
                                        <div key={`existing-file-${idx}`} className="flex items-center gap-2 p-2 bg-muted rounded">
                                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                                            ملف {idx + 1}
                                          </a>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => removeAdminFile(idx, true)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                      {adminFilesArray.map((file, idx) => (
                                        <div key={`new-file-${idx}`} className="flex items-center gap-2 p-2 bg-primary/10 rounded border border-primary/20">
                                          <span className="text-sm truncate flex-1">{file.name}</span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => removeAdminFile(idx, false)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>


                                <div className="flex gap-3 justify-end pt-4">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setDialogOpen(false);
                                      setEditingOrder(null);
                                      setSerialImageFile(null);
                                      setSerialImagePreview('');
                                      setAdminImageFiles([]);
                                      setAdminFilesArray([]);
                                      setAdminImagePreviews([]);
                                      setExistingAdminImages([]);
                                      setExistingAdminFiles([]);
                                    }}
                                  >
                                    إلغاء
                                  </Button>
                                  <Button type="submit" disabled={updateOrderMutation.isPending || uploadingImage}>
                                    {(updateOrderMutation.isPending || uploadingImage) && (
                                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    )}
                                    {uploadingImage ? 'جاري رفع الصورة...' : 'حفظ التغييرات'}
                                  </Button>
                                </div>
                              </form>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="h-4 w-4 ml-2" />
                                حذف
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف الطلب {order.order_number} نهائياً من قاعدة البيانات. هذا الإجراء لا يمكن التراجع عنه.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteOrderMutation.mutate(order.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleteOrderMutation.isPending && (
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                  )}
                                  حذف نهائياً
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد طلبات
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default AdminOrders;
