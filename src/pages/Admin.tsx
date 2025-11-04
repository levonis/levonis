import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';
import AdminMainSections from './AdminMainSections';
import AdminCustomRequests from './AdminCustomRequests';
import { formatPrice } from '@/lib/utils';

const productSchema = z.object({
  name_ar: z.string().min(1, 'الاسم مطلوب'),
  name: z.string().min(1, 'الاسم بالإنجليزية مطلوب'),
  slug: z.string().min(1, 'الرابط مطلوب'),
  description_ar: z.string().optional(),
  description: z.string().optional(),
  price: z.number().positive('السعر يجب أن يكون أكبر من صفر'),
  original_price: z.number().positive().optional(),
  currency: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  image_url: z.string().url('رابط الصورة غير صحيح').optional(),
  category_id: z.string().uuid('القسم غير صحيح'),
});

const categorySchema = z.object({
  name_ar: z.string().min(1, 'الاسم بالعربي مطلوب'),
  name: z.string().min(1, 'الاسم بالإنجليزي مطلوب'),
  slug: z.string().min(1, 'الرابط مطلوب'),
  icon: z.string().min(1, 'الأيقونة مطلوبة'),
  description_ar: z.string().optional(),
  description: z.string().optional(),
  main_section_id: z.string().uuid().optional(),
});

const mainSectionSchema = z.object({
  name_ar: z.string().min(1, 'الاسم بالعربي مطلوب'),
  name: z.string().min(1, 'الاسم بالإنجليزي مطلوب'),
  display_order: z.number().min(0, 'ترتيب العرض يجب أن يكون صفر أو أكبر'),
});

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [mainSectionDialogOpen, setMainSectionDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingMainSection, setEditingMainSection] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name_ar)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*, main_sections(name_ar)');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: mainSections } = useQuery({
    queryKey: ['main-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('main_sections')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: customRequests, isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['custom-requests', isAdmin],
    queryFn: async () => {
      console.log('Fetching custom requests, isAdmin:', isAdmin);
      const { data, error } = await supabase
        .from('custom_product_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching custom requests:', error);
        throw error;
      }
      console.log('Custom requests fetched:', data);
      return data;
    },
    enabled: !!isAdmin,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  const { data: pendingRequestsCount } = useQuery({
    queryKey: ['pending-requests-count', isAdmin],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('custom_product_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (error) {
        console.error('Error fetching pending count:', error);
        throw error;
      }
      console.log('Pending requests count:', count);
      return count || 0;
    },
    enabled: !!isAdmin,
    refetchInterval: 30000,
    refetchOnMount: true
  });

  // Refetch when isAdmin changes
  useEffect(() => {
    if (isAdmin) {
      console.log('Admin status confirmed, refetching data...');
      refetchRequests();
    }
  }, [isAdmin, refetchRequests]);

  const createProduct = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from('products')
        .insert([values]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      toast.success('تم إضافة المنتج بنجاح');
      setProductDialogOpen(false);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إضافة المنتج');
      console.error(error);
    }
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, values }: { id: string, values: any }) => {
      const { error } = await supabase
        .from('products')
        .update(values)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      toast.success('تم تحديث المنتج بنجاح');
      setProductDialogOpen(false);
      setEditingProduct(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث المنتج');
      console.error(error);
    }
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      toast.success('تم حذف المنتج بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء حذف المنتج');
      console.error(error);
    }
  });

  const createCategory = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from('categories')
        .insert([values]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('تم إضافة القسم بنجاح');
      setCategoryDialogOpen(false);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إضافة القسم');
      console.error(error);
    }
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, values }: { id: string, values: any }) => {
      const { error } = await supabase
        .from('categories')
        .update(values)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('تم تحديث القسم بنجاح');
      setCategoryDialogOpen(false);
      setEditingCategory(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث القسم');
      console.error(error);
    }
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('تم حذف القسم بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء حذف القسم');
      console.error(error);
    }
  });

  const createMainSection = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from('main_sections')
        .insert([values]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['main-sections'] });
      toast.success('تم إضافة القسم الرئيسي بنجاح');
      setMainSectionDialogOpen(false);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إضافة القسم الرئيسي');
      console.error(error);
    }
  });

  const updateMainSection = useMutation({
    mutationFn: async ({ id, values }: { id: string, values: any }) => {
      const { error } = await supabase
        .from('main_sections')
        .update(values)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['main-sections'] });
      toast.success('تم تحديث القسم الرئيسي بنجاح');
      setMainSectionDialogOpen(false);
      setEditingMainSection(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث القسم الرئيسي');
      console.error(error);
    }
  });

  const deleteMainSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('main_sections')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['main-sections'] });
      toast.success('تم حذف القسم الرئيسي بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء حذف القسم الرئيسي');
      console.error(error);
    }
  });

  const handleProductSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const imagesText = formData.get('images') as string;
      const imagesArray = imagesText 
        ? imagesText.split('\n').map(url => url.trim()).filter(url => url)
        : [];

      const values = productSchema.parse({
        name_ar: formData.get('name_ar') as string,
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description_ar: formData.get('description_ar') as string || undefined,
        description: formData.get('description') as string || undefined,
        price: Number(formData.get('price')),
        original_price: formData.get('original_price') ? Number(formData.get('original_price')) : undefined,
        currency: formData.get('currency') as string || 'دينار عراقي',
        images: imagesArray.length > 0 ? imagesArray : undefined,
        image_url: imagesArray[0] || (formData.get('image_url') as string) || undefined,
        category_id: formData.get('category_id') as string,
      });

      if (editingProduct) {
        updateProduct.mutate({ id: editingProduct.id, values });
      } else {
        createProduct.mutate(values);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    }
  };

  const handleCategorySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const values = categorySchema.parse({
        name_ar: formData.get('name_ar') as string,
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        icon: formData.get('icon') as string,
        description_ar: formData.get('description_ar') as string || undefined,
        description: formData.get('description') as string || undefined,
        main_section_id: formData.get('main_section_id') as string || undefined,
      });

      if (editingCategory) {
        updateCategory.mutate({ id: editingCategory.id, values });
      } else {
        createCategory.mutate(values);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    }
  };

  const handleMainSectionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const values = mainSectionSchema.parse({
        name_ar: formData.get('name_ar') as string,
        name: formData.get('name') as string,
        display_order: Number(formData.get('display_order')),
      });

      if (editingMainSection) {
        updateMainSection.mutate({ id: editingMainSection.id, values });
      } else {
        createMainSection.mutate(values);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Admin decorative accent */}
      <div className="fixed top-20 left-20 w-32 h-32 pointer-events-none opacity-8 animate-float">
        <div className="w-full h-full" style={{ 
          background: 'var(--gradient-radial-gold)',
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          filter: 'blur(20px)'
        }} />
      </div>
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2">لوحة التحكم</h1>
          <p className="text-muted-foreground">إدارة المنتجات والأقسام</p>
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="products" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              المنتجات
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              الأقسام
            </TabsTrigger>
            <TabsTrigger value="main-sections" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              الأقسام الرئيسية
            </TabsTrigger>
            <TabsTrigger value="custom-requests" className="gap-2 relative">
              <FolderOpen className="h-4 w-4" />
              الطلبات المخصصة
              {pendingRequestsCount && pendingRequestsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -left-2 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full"
                >
                  {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">إدارة المنتجات</h2>
              
              <Dialog open={productDialogOpen} onOpenChange={(open) => {
                setProductDialogOpen(open);
                if (!open) setEditingProduct(null);
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة منتج جديد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</DialogTitle>
                  </DialogHeader>
                  
                  <form key={editingProduct?.id || 'new'} onSubmit={handleProductSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name_ar">الاسم بالعربي *</Label>
                        <Input 
                          id="name_ar" 
                          name="name_ar" 
                          defaultValue={editingProduct?.name_ar}
                          required 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="name">الاسم بالإنجليزي *</Label>
                        <Input 
                          id="name" 
                          name="name"
                          defaultValue={editingProduct?.name}
                          required 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">الرابط (Slug) *</Label>
                      <Input 
                        id="slug" 
                        name="slug"
                        defaultValue={editingProduct?.slug}
                        placeholder="rtx-4080-16gb"
                        required 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="description_ar">الوصف بالعربي</Label>
                        <Textarea 
                          id="description_ar" 
                          name="description_ar"
                          defaultValue={editingProduct?.description_ar}
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="description">الوصف بالإنجليزي</Label>
                        <Textarea 
                          id="description" 
                          name="description"
                          defaultValue={editingProduct?.description}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">السعر *</Label>
                        <Input 
                          id="price" 
                          name="price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct?.price}
                          required 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="original_price">السعر الأصلي (قبل التخفيض)</Label>
                        <Input 
                          id="original_price" 
                          name="original_price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct?.original_price}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="currency">العملة</Label>
                        <Input 
                          id="currency" 
                          name="currency"
                          defaultValue={editingProduct?.currency || 'دينار عراقي'}
                          placeholder="دينار عراقي"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category_id">القسم *</Label>
                      <select
                        id="category_id"
                        name="category_id"
                        defaultValue={editingProduct?.category_id}
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">اختر القسم</option>
                        {categories?.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="images">روابط الصور (صورة واحدة في كل سطر)</Label>
                      <Textarea 
                        id="images" 
                        name="images"
                        defaultValue={editingProduct?.images?.join('\n') || ''}
                        placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">أضف رابط URL لكل صورة في سطر منفصل</p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                      disabled={createProduct.isPending || updateProduct.isPending}
                    >
                      {(createProduct.isPending || updateProduct.isPending) && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      )}
                      {editingProduct ? 'تحديث المنتج' : 'إضافة المنتج'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="glass-effect rounded-2xl border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصورة</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>القسم</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>السعر الأصلي</TableHead>
                      <TableHead className="text-left">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products?.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.image_url && (
                            <img 
                              src={product.image_url} 
                              alt={product.name_ar}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{product.name_ar}</TableCell>
                        <TableCell>{(product as any).categories?.name_ar}</TableCell>
                        <TableCell>{formatPrice(Number(product.price))} دينار عراقي</TableCell>
                        <TableCell>
                          {product.original_price 
                            ? `${formatPrice(Number(product.original_price))} دينار عراقي`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingProduct(product);
                                setProductDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                                  deleteProduct.mutate(product.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">إدارة الأقسام</h2>
              
              <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
                setCategoryDialogOpen(open);
                if (!open) setEditingCategory(null);
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة قسم جديد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingCategory ? 'تعديل القسم' : 'إضافة قسم جديد'}</DialogTitle>
                  </DialogHeader>
                  
                  <form key={editingCategory?.id || 'new'} onSubmit={handleCategorySubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cat_name_ar">الاسم بالعربي *</Label>
                        <Input 
                          id="cat_name_ar" 
                          name="name_ar" 
                          defaultValue={editingCategory?.name_ar}
                          required 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="cat_name">الاسم بالإنجليزي *</Label>
                        <Input 
                          id="cat_name" 
                          name="name"
                          defaultValue={editingCategory?.name}
                          required 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cat_slug">الرابط (Slug) *</Label>
                        <Input 
                          id="cat_slug" 
                          name="slug"
                          defaultValue={editingCategory?.slug}
                          placeholder="electronics"
                          required 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="cat_icon">الأيقونة *</Label>
                        <Input 
                          id="cat_icon" 
                          name="icon"
                          defaultValue={editingCategory?.icon}
                          placeholder="Laptop"
                          required 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cat_description_ar">الوصف بالعربي</Label>
                        <Textarea 
                          id="cat_description_ar" 
                          name="description_ar"
                          defaultValue={editingCategory?.description_ar}
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="cat_description">الوصف بالإنجليزي</Label>
                        <Textarea 
                          id="cat_description" 
                          name="description"
                          defaultValue={editingCategory?.description}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="main_section_id">القسم الرئيسي</Label>
                      <select
                        id="main_section_id"
                        name="main_section_id"
                        defaultValue={editingCategory?.main_section_id || ''}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">بدون قسم رئيسي</option>
                        {mainSections?.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      type="submit" 
                      className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                      disabled={createCategory.isPending || updateCategory.isPending}
                    >
                      {(createCategory.isPending || updateCategory.isPending) && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      )}
                      {editingCategory ? 'تحديث القسم' : 'إضافة القسم'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="glass-effect rounded-2xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الأيقونة</TableHead>
                    <TableHead>الاسم بالعربي</TableHead>
                    <TableHead>الاسم بالإنجليزي</TableHead>
                    <TableHead>الرابط</TableHead>
                    <TableHead>القسم الرئيسي</TableHead>
                    <TableHead className="text-left">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="text-primary font-bold">{category.icon}</TableCell>
                      <TableCell className="font-medium">{category.name_ar}</TableCell>
                      <TableCell>{category.name}</TableCell>
                      <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                      <TableCell>{(category as any).main_sections?.name_ar || '-'}</TableCell>
                      <TableCell className="text-left">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCategory(category);
                              setCategoryDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
                                deleteCategory.mutate(category.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="main-sections">
            <AdminMainSections
              mainSections={mainSections}
              mainSectionDialogOpen={mainSectionDialogOpen}
              setMainSectionDialogOpen={setMainSectionDialogOpen}
              editingMainSection={editingMainSection}
              setEditingMainSection={setEditingMainSection}
              handleMainSectionSubmit={handleMainSectionSubmit}
              createMainSection={createMainSection}
              updateMainSection={updateMainSection}
              deleteMainSection={deleteMainSection}
            />
          </TabsContent>

          <TabsContent value="custom-requests">
            <AdminCustomRequests
              requests={customRequests}
              isLoading={requestsLoading}
              refetch={refetchRequests}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;