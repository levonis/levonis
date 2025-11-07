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
import { Loader2, Plus, Pencil, Trash2, FolderOpen, Upload, X, Copy, FileText, Bell, Megaphone, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  images: z.array(z.string()).optional(),
  image_url: z.string().optional(),
  category_id: z.string().uuid('القسم غير صحيح'),
  featured: z.boolean().optional(),
  in_stock: z.boolean().optional(),
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
  const [activeTab, setActiveTab] = useState('products');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [mainSectionDialogOpen, setMainSectionDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingMainSection, setEditingMainSection] = useState<any>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [productOptions, setProductOptions] = useState<Array<{
    name: string;
    name_ar: string;
    price_adjustment: number;
    in_stock: boolean;
  }>>([]);
  const [productColors, setProductColors] = useState<Array<{
    name: string;
    name_ar: string;
    hex_code: string;
    price?: number;
    image_url?: string;
  }>>([]);
  const [productFeatures, setProductFeatures] = useState<Array<{
    text_ar: string;
    text: string;
    icon?: string;
  }>>([]);
  
  // Search and filter states
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productStockFilter, setProductStockFilter] = useState<string>('all');
  const [productFeaturedFilter, setProductFeaturedFilter] = useState<string>('all');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryMainSectionFilter, setCategoryMainSectionFilter] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Ensure product options, colors, and features load reliably when opening the editor
  useEffect(() => {
    if (productDialogOpen && editingProduct) {
      // Initialize from the current product
      setProductColors(Array.isArray(editingProduct.colors) ? editingProduct.colors : []);
      setProductFeatures(Array.isArray(editingProduct.features) ? editingProduct.features : []);

      // Load options from the database ONLY if editing an existing product (has id)
      // For duplicated products (no id), options are already set by handleDuplicateProduct
      if (editingProduct.id) {
        supabase
          .from('product_options')
          .select('*')
          .eq('product_id', editingProduct.id)
          .then(({ data, error }) => {
            if (!error && data) {
              setProductOptions(
                data.map((opt) => ({
                  name: opt.name,
                  name_ar: opt.name_ar,
                  price_adjustment: Number(opt.price_adjustment),
                  in_stock: opt.in_stock,
                }))
              );
            }
          });
      }
    } else if (productDialogOpen && !editingProduct) {
      // New product: start clean
      setProductOptions([]);
      setProductColors([]);
      setProductFeatures([]);
    }
  }, [productDialogOpen, editingProduct]);

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

  // Statistics queries
  const { data: stats } = useQuery({
    queryKey: ['admin-stats', isAdmin],
    queryFn: async () => {
      const [productsResult, featuredResult, categoriesResult, outOfStockResult] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('featured', true),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('in_stock', false)
      ]);

      return {
        totalProducts: productsResult.count || 0,
        featuredProducts: featuredResult.count || 0,
        totalCategories: categoriesResult.count || 0,
        outOfStock: outOfStockResult.count || 0
      };
    },
    enabled: !!isAdmin,
    refetchInterval: 60000
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
      // Invalidate all product-related queries across the app
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'product-options'
          );
        },
      });
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
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'product-options'
          );
        },
      });
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
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products'
          );
        },
      });
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
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'categories' ||
            k[0] === 'category' ||
            k[0] === 'category-products'
          );
        },
      });
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
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'categories' ||
            k[0] === 'category' ||
            k[0] === 'category-products'
          );
        },
      });
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
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'categories' ||
            k[0] === 'category' ||
            k[0] === 'category-products'
          );
        },
      });
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    const newImageUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        newImageUrls.push(publicUrl);
      }

      setUploadedImages([...uploadedImages, ...newImageUrls]);
      toast.success('تم رفع الصور بنجاح');
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('حدث خطأ أثناء رفع الصور');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const handleDuplicateProduct = async (product: any) => {
    try {
      // 1) Load original product options
      const { data: options, error: optionsError } = await supabase
        .from('product_options')
        .select('*')
        .eq('product_id', product.id);
      if (optionsError) throw optionsError;

      // 2) Prepare new product payload (exclude id/created_at/updated_at/relations)
      const { id, created_at, updated_at, categories, ...productData } = product;
      const newValues = {
        ...productData,
        name_ar: `${product.name_ar} (نسخة)`,
        name: `${product.name} (Copy)`,
        slug: `${product.slug}-copy-${Date.now()}`,
        // Ensure image_url is consistent with images if available
        image_url: (Array.isArray(product.images) && product.images[0]) || product.image_url || null,
      };

      // 3) Insert duplicated product
      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert([newValues as any])
        .select()
        .single();
      if (insertError) throw insertError;

      const newProductId = inserted.id;

      // 4) Duplicate options to the new product
      if (options && options.length > 0) {
        const optionsToInsert = options.map((opt) => ({
          product_id: newProductId,
          name: opt.name,
          name_ar: opt.name_ar,
          price_adjustment: opt.price_adjustment,
          in_stock: opt.in_stock,
        }));

        const { error: insertOptionsError } = await supabase
          .from('product_options')
          .insert(optionsToInsert);
        if (insertOptionsError) throw insertOptionsError;
      }

      // 5) Refresh lists and notify
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'product-options'
          );
        },
      });

      toast.success('تم تكرار المنتج بنجاح');
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast.error('حدث خطأ أثناء تكرار المنتج');
    }
  };

  const addProductOption = () => {
    setProductOptions([...productOptions, {
      name: '',
      name_ar: '',
      price_adjustment: 0,
      in_stock: true
    }]);
  };

  const removeProductOption = (index: number) => {
    setProductOptions(productOptions.filter((_, i) => i !== index));
  };

  const updateProductOption = (index: number, field: string, value: any) => {
    const updated = [...productOptions];
    updated[index] = { ...updated[index], [field]: value };
    setProductOptions(updated);
  };

  const addProductColor = () => {
    setProductColors([...productColors, {
      name: '',
      name_ar: '',
      hex_code: '#000000',
      price: undefined,
      image_url: undefined
    }]);
  };

  const removeProductColor = (index: number) => {
    setProductColors(productColors.filter((_, i) => i !== index));
  };

  const updateProductColor = (index: number, field: string, value: any) => {
    const updated = [...productColors];
    updated[index] = { ...updated[index], [field]: value };
    setProductColors(updated);
  };

  const addProductFeature = () => {
    setProductFeatures([...productFeatures, {
      text_ar: '',
      text: '',
      icon: 'Package'
    }]);
  };

  const removeProductFeature = (index: number) => {
    setProductFeatures(productFeatures.filter((_, i) => i !== index));
  };

  const updateProductFeature = (index: number, field: string, value: any) => {
    const updated = [...productFeatures];
    updated[index] = { ...updated[index], [field]: value };
    setProductFeatures(updated);
  };

  const handleProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const allImages = editingProduct?.images || [];
      const finalImages = [...allImages, ...uploadedImages];

      const values = {
        name_ar: formData.get('name_ar') as string,
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description_ar: (formData.get('description_ar') as string) || undefined,
        description: (formData.get('description') as string) || undefined,
        price: Number(formData.get('price')),
        original_price: formData.get('original_price') ? Number(formData.get('original_price')) : undefined,
        currency: (formData.get('currency') as string) || 'دينار عراقي',
        images: finalImages.length > 0 ? finalImages : undefined,
        image_url: finalImages[0] || undefined,
        category_id: formData.get('category_id') as string,
        featured: (formData.get('featured') as string) === 'on',
        in_stock: (formData.get('in_stock') as string) === 'on',
        colors: productColors.length > 0 
          ? productColors.filter(c => c.name_ar.trim() && c.name.trim())
          : undefined,
        features: productFeatures.length > 0
          ? productFeatures.filter(f => f.text_ar.trim() && f.text.trim())
          : undefined,
      };

      // Validate with zod
      productSchema.parse(values);

      let productId = editingProduct?.id;

      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, values });
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([values as any])
          .select()
          .single();
        
        if (error) throw error;
        productId = data.id;
      }

      // Save product options
      if (productOptions.length > 0 && productId) {
        // Delete existing options if editing
        if (editingProduct) {
          await supabase
            .from('product_options')
            .delete()
            .eq('product_id', productId);
        }

        // Insert new options
        const optionsToInsert = productOptions
          .filter(opt => opt.name_ar.trim() && opt.name.trim())
          .map(opt => ({
            product_id: productId,
            name: opt.name,
            name_ar: opt.name_ar,
            price_adjustment: opt.price_adjustment,
            in_stock: opt.in_stock
          }));

        if (optionsToInsert.length > 0) {
          const { error: optionsError } = await supabase
            .from('product_options')
            .insert(optionsToInsert);
          
          if (optionsError) throw optionsError;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'product-options'
          );
        },
      });
      
      toast.success(editingProduct ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
      setProductDialogOpen(false);
      setEditingProduct(null);
      setUploadedImages([]);
      setProductOptions([]);
      setProductColors([]);
      setProductFeatures([]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('حدث خطأ أثناء حفظ المنتج');
        console.error(error);
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

  // Filter products based on search and filters
  const filteredProducts = products?.filter(product => {
    const matchesSearch = productSearch === '' || 
      product.name_ar.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.name.toLowerCase().includes(productSearch.toLowerCase());
    
    const matchesCategory = productCategoryFilter === 'all' || product.category_id === productCategoryFilter;
    const matchesStock = productStockFilter === 'all' || 
      (productStockFilter === 'in_stock' && product.in_stock) ||
      (productStockFilter === 'out_of_stock' && !product.in_stock);
    const matchesFeatured = productFeaturedFilter === 'all' ||
      (productFeaturedFilter === 'featured' && product.featured) ||
      (productFeaturedFilter === 'not_featured' && !product.featured);
    
    return matchesSearch && matchesCategory && matchesStock && matchesFeatured;
  });

  // Filter categories based on search and filters
  const filteredCategories = categories?.filter(category => {
    const matchesSearch = categorySearch === '' ||
      category.name_ar.toLowerCase().includes(categorySearch.toLowerCase()) ||
      category.name.toLowerCase().includes(categorySearch.toLowerCase());
    
    const matchesMainSection = categoryMainSectionFilter === 'all' || 
      category.main_section_id === categoryMainSectionFilter ||
      (categoryMainSectionFilter === 'no_section' && !category.main_section_id);
    
    return matchesSearch && matchesMainSection;
  });

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Full page decorative border with animations */}
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-0 opacity-5 animate-float-decoration blur-sm"
        style={{
          backgroundImage: 'url(/images/decorative-border-new.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.3))',
        }}
      />
      
      {/* Glow effect overlay */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-64 h-64 bg-ring/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Admin decorative accent */}
      <div className="fixed top-20 left-20 w-32 h-32 pointer-events-none opacity-8 animate-float">
        <div className="w-full h-full" style={{ 
          background: 'var(--gradient-radial-gold)',
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          filter: 'blur(20px)'
        }} />
      </div>
      
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2">لوحة التحكم</h1>
          <p className="text-muted-foreground">إدارة شاملة للمنتجات والأقسام والإعدادات</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-4xl font-black text-primary">{stats?.totalProducts || 0}</div>
                <div className="text-sm text-muted-foreground">إجمالي المنتجات</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-4xl font-black text-primary">{stats?.featuredProducts || 0}</div>
                <div className="text-sm text-muted-foreground">المنتجات المميزة</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-4xl font-black text-primary">{stats?.totalCategories || 0}</div>
                <div className="text-sm text-muted-foreground">الأقسام</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-4xl font-black text-destructive">{stats?.outOfStock || 0}</div>
                <div className="text-sm text-muted-foreground">غير متوفر</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-lg hover:shadow-xl transition-shadow relative">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-4xl font-black text-orange-500">{pendingRequestsCount || 0}</div>
                <div className="text-sm text-muted-foreground">طلبات معلقة</div>
              </div>
              {pendingRequestsCount && pendingRequestsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs rounded-full animate-pulse"
                >
                  !
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Settings & Management */}
        <Card className="mb-8 border-primary/20 shadow-lg">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-xl flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              الإعدادات والإدارة
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <Button
                onClick={() => navigate('/admin/notifications')}
                variant="outline"
                className="gap-3 h-auto py-8 flex-col hover:bg-primary/5 hover:border-primary/40 transition-all group"
              >
                <Bell className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">إدارة الإشعارات</span>
                <span className="text-xs text-muted-foreground">إرسال إشعارات للمستخدمين</span>
              </Button>
              
              <Button
                onClick={() => navigate('/admin/announcements')}
                variant="outline"
                className="gap-3 h-auto py-8 flex-col hover:bg-primary/5 hover:border-primary/40 transition-all group"
              >
                <Megaphone className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">الشريط الإخباري</span>
                <span className="text-xs text-muted-foreground">إدارة الإعلانات المتحركة</span>
              </Button>
              
              <Button
                onClick={() => navigate('/admin/coupons')}
                variant="outline"
                className="gap-3 h-auto py-8 flex-col hover:bg-primary/5 hover:border-primary/40 transition-all group"
              >
                <Ticket className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">إدارة الكوبونات</span>
                <span className="text-xs text-muted-foreground">إنشاء وإدارة الخصومات</span>
              </Button>
              
              <Button
                onClick={() => setActiveTab('custom-requests')}
                variant="outline"
                className="gap-3 h-auto py-8 flex-col relative hover:bg-primary/5 hover:border-primary/40 transition-all group"
              >
                <FileText className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">الطلبات المخصصة</span>
                <span className="text-xs text-muted-foreground">مراجعة طلبات العملاء</span>
                {pendingRequestsCount && pendingRequestsCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-7 w-7 flex items-center justify-center p-0 text-xs rounded-full animate-pulse"
                  >
                    {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                  </Badge>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions - Content Management */}
        <Card className="mb-8 border-primary/20 shadow-lg">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-xl flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              إضافة محتوى جديد
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Button
                onClick={() => {
                  setActiveTab('products');
                  setEditingProduct(null);
                  setUploadedImages([]);
                  setProductOptions([]);
                  setProductColors([]);
                  setProductFeatures([]);
                  setProductDialogOpen(true);
                }}
                className="gap-3 h-auto py-8 flex-col bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all group"
              >
                <Plus className="h-10 w-10 group-hover:rotate-90 transition-transform" />
                <span className="text-sm font-semibold">منتج جديد</span>
                <span className="text-xs opacity-90">إضافة منتج للمتجر</span>
              </Button>
              
              <Button
                onClick={() => {
                  setActiveTab('categories');
                  setEditingCategory(null);
                  setCategoryDialogOpen(true);
                }}
                className="gap-3 h-auto py-8 flex-col bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all group"
              >
                <FolderOpen className="h-10 w-10 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">قسم جديد</span>
                <span className="text-xs opacity-90">إضافة قسم للمنتجات</span>
              </Button>
              
              <Button
                onClick={() => {
                  setEditingMainSection(null);
                  setMainSectionDialogOpen(true);
                }}
                className="gap-3 h-auto py-8 flex-col bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all group"
              >
                <FolderOpen className="h-10 w-10 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">قسم رئيسي</span>
                <span className="text-xs opacity-90">إضافة قسم رئيسي</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 grid grid-cols-4 w-full max-w-3xl">
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
            {/* Search and Filters for Products */}
            <Card className="mb-6 border-primary/20">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2">
                    <Label className="text-xs mb-2 block">البحث</Label>
                    <Input
                      placeholder="ابحث بالاسم العربي أو الإنجليزي..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs mb-2 block">القسم</Label>
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="all">جميع الأقسام</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name_ar}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label className="text-xs mb-2 block">الحالة</Label>
                    <select
                      value={productStockFilter}
                      onChange={(e) => setProductStockFilter(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="all">الكل</option>
                      <option value="in_stock">متوفر</option>
                      <option value="out_of_stock">غير متوفر</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label className="text-xs mb-2 block">مميز</Label>
                    <select
                      value={productFeaturedFilter}
                      onChange={(e) => setProductFeaturedFilter(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="all">الكل</option>
                      <option value="featured">مميز</option>
                      <option value="not_featured">غير مميز</option>
                    </select>
                  </div>
                </div>
                
                {(productSearch || productCategoryFilter !== 'all' || productStockFilter !== 'all' || productFeaturedFilter !== 'all') && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {filteredProducts?.length || 0} منتج من أصل {products?.length || 0}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setProductSearch('');
                        setProductCategoryFilter('all');
                        setProductStockFilter('all');
                        setProductFeaturedFilter('all');
                      }}
                    >
                      إعادة تعيين
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">إدارة المنتجات</h2>
              
              <Dialog open={productDialogOpen} onOpenChange={(open) => {
                setProductDialogOpen(open);
                if (!open) {
                  setEditingProduct(null);
                  setUploadedImages([]);
                  setProductOptions([]);
                  setProductColors([]);
                  setProductFeatures([]);
                }
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <input id="featured" name="featured" type="checkbox" defaultChecked={editingProduct?.featured || false} />
                        <Label htmlFor="featured">مميز (يظهر في الرئيسية)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input id="in_stock" name="in_stock" type="checkbox" defaultChecked={editingProduct?.in_stock ?? true} />
                        <Label htmlFor="in_stock">متاح في المخزون</Label>
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
                      <Label>صور المنتج</Label>
                      
                      {/* Existing images from editing */}
                      {editingProduct?.images && editingProduct.images.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-muted-foreground mb-2">الصور الحالية:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {editingProduct.images.map((img: string, index: number) => (
                              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                                <img src={img} alt={`صورة ${index + 1}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedImages = editingProduct.images.filter((_: string, i: number) => i !== index);
                                    setEditingProduct({ ...editingProduct, images: updatedImages });
                                  }}
                                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Upload new images */}
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <Label 
                          htmlFor="image-upload" 
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          {uploadingImages ? (
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          ) : (
                            <Upload className="h-8 w-8 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {uploadingImages ? 'جاري الرفع...' : 'اضغط لرفع الصور'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            يمكنك اختيار عدة صور مرة واحدة
                          </span>
                        </Label>
                      </div>

                      {/* Uploaded images preview */}
                      {uploadedImages.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground mb-2">الصور الجديدة:</p>
                          <div className="grid grid-cols-4 gap-2">
                            {uploadedImages.map((img, index) => (
                              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                                <img src={img} alt={`صورة جديدة ${index + 1}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Product Options Section */}
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label>الخيارات (اختياري)</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addProductOption}
                        >
                          <Plus className="ml-1 h-3 w-3" />
                          إضافة خيار
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        أضف خيارات للمنتج مثل السعات المختلفة (2TB، 1TB) أو الألوان
                      </p>

                      {productOptions.length > 0 && (
                        <div className="space-y-3">
                          {productOptions.map((option, index) => (
                            <div key={index} className="p-3 border border-border rounded-lg bg-card/50 space-y-3">
                              <div className="flex justify-between items-start">
                                <span className="text-sm font-medium">خيار {index + 1}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeProductOption(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">الاسم بالعربي</Label>
                                  <Input
                                    value={option.name_ar}
                                    onChange={(e) => updateProductOption(index, 'name_ar', e.target.value)}
                                    placeholder="2 تيرابايت"
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">الاسم بالإنجليزي</Label>
                                  <Input
                                    value={option.name}
                                    onChange={(e) => updateProductOption(index, 'name', e.target.value)}
                                    placeholder="2TB"
                                    className="h-9"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">فرق السعر (+ أو -)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={option.price_adjustment}
                                    onChange={(e) => updateProductOption(index, 'price_adjustment', Number(e.target.value))}
                                    placeholder="0"
                                    className="h-9"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    أدخل رقم موجب للإضافة أو سالب للخصم
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">الحالة</Label>
                                  <div className="flex items-center gap-2 h-9">
                                    <input
                                      type="checkbox"
                                      checked={option.in_stock}
                                      onChange={(e) => updateProductOption(index, 'in_stock', e.target.checked)}
                                      className="rounded"
                                    />
                                    <span className="text-sm">متاح</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Product Colors Section */}
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label>الألوان (اختياري)</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addProductColor}
                        >
                          <Plus className="ml-1 h-3 w-3" />
                          إضافة لون
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        أضف الألوان المتاحة للمنتج
                      </p>

                      {productColors.length > 0 && (
                        <div className="space-y-3">
                          {productColors.map((color, index) => (
                            <div key={index} className="p-3 border border-border rounded-lg bg-card/50 space-y-3">
                              <div className="flex justify-between items-start">
                                <span className="text-sm font-medium">لون {index + 1}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeProductColor(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">الاسم بالعربي</Label>
                                    <Input
                                      type="text"
                                      value={color.name_ar}
                                      onChange={(e) => updateProductColor(index, 'name_ar', e.target.value)}
                                      placeholder="أحمر"
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">الاسم بالإنجليزي</Label>
                                    <Input
                                      type="text"
                                      value={color.name}
                                      onChange={(e) => updateProductColor(index, 'name', e.target.value)}
                                      placeholder="Red"
                                      className="h-9"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">الكود اللوني</Label>
                                    <div className="flex gap-2">
                                      <Input
                                        type="color"
                                        value={color.hex_code}
                                        onChange={(e) => updateProductColor(index, 'hex_code', e.target.value)}
                                        className="h-9 w-16 p-1"
                                      />
                                      <Input
                                        type="text"
                                        value={color.hex_code}
                                        onChange={(e) => updateProductColor(index, 'hex_code', e.target.value)}
                                        placeholder="#000000"
                                        className="h-9 flex-1"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">السعر (اختياري)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={color.price || ''}
                                      onChange={(e) => updateProductColor(index, 'price', e.target.value ? Number(e.target.value) : undefined)}
                                      placeholder="السعر الافتراضي للمنتج"
                                      className="h-9"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      اتركه فارغاً لاستخدام السعر الأساسي
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="space-y-1">
                                  <Label className="text-xs">صورة اللون (اختياري)</Label>
                                  <div className="flex gap-2 items-end">
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        
                                        const fileExt = file.name.split('.').pop();
                                        const fileName = `${Math.random()}.${fileExt}`;
                                        const { error: uploadError, data } = await supabase.storage
                                          .from('product-images')
                                          .upload(fileName, file);
                                        
                                        if (uploadError) {
                                          toast.error('حدث خطأ أثناء رفع الصورة');
                                          return;
                                        }
                                        
                                        const { data: { publicUrl } } = supabase.storage
                                          .from('product-images')
                                          .getPublicUrl(fileName);
                                        
                                        updateProductColor(index, 'image_url', publicUrl);
                                        toast.success('تم رفع صورة اللون بنجاح');
                                      }}
                                      className="h-9"
                                    />
                                    {color.image_url && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => updateProductColor(index, 'image_url', undefined)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                  {color.image_url && (
                                    <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                                      <img src={color.image_url} alt={color.name_ar} className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    صورة خاصة تظهر عند اختيار هذا اللون
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Product Features Section */}
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label>المميزات (اختياري)</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addProductFeature}
                        >
                          <Plus className="ml-1 h-3 w-3" />
                          إضافة ميزة
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        أضف مميزات ومواصفات المنتج
                      </p>

                      {productFeatures.length > 0 && (
                        <div className="space-y-3">
                          {productFeatures.map((feature, index) => (
                            <div key={index} className="p-3 border border-border rounded-lg bg-card/50 space-y-3">
                              <div className="flex justify-between items-start">
                                <span className="text-sm font-medium">ميزة {index + 1}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeProductFeature(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">الأيقونة</Label>
                                  <select
                                    value={feature.icon || 'Package'}
                                    onChange={(e) => updateProductFeature(index, 'icon', e.target.value)}
                                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                  >
                                    <option value="Package">📦 صندوق</option>
                                    <option value="Shield">🛡️ درع</option>
                                    <option value="Truck">🚚 شاحنة</option>
                                    <option value="Star">⭐ نجمة</option>
                                    <option value="Award">🏆 جائزة</option>
                                    <option value="Check">✅ علامة صح</option>
                                    <option value="CheckCircle">✓ دائرة صح</option>
                                    <option value="Zap">⚡ برق</option>
                                    <option value="Heart">❤️ قلب</option>
                                    <option value="Sparkles">✨ تألق</option>
                                    <option value="Cpu">💻 معالج</option>
                                    <option value="Battery">🔋 بطارية</option>
                                    <option value="Wifi">📶 واي فاي</option>
                                    <option value="Smartphone">📱 هاتف</option>
                                    <option value="Monitor">🖥️ شاشة</option>
                                    <option value="Headphones">🎧 سماعات</option>
                                    <option value="Camera">📷 كاميرا</option>
                                    <option value="Music">🎵 موسيقى</option>
                                    <option value="Video">🎥 فيديو</option>
                                    <option value="Image">🖼️ صورة</option>
                                    <option value="Disc">💿 قرص</option>
                                    <option value="Download">⬇️ تحميل</option>
                                    <option value="Upload">⬆️ رفع</option>
                                    <option value="Rocket">🚀 صاروخ</option>
                                    <option value="Flame">🔥 نار</option>
                                    <option value="Gift">🎁 هدية</option>
                                    <option value="Crown">👑 تاج</option>
                                    <option value="Gem">💎 جوهرة</option>
                                    <option value="Clock">⏰ ساعة</option>
                                    <option value="Timer">⏱️ مؤقت</option>
                                    <option value="Globe">🌍 كرة أرضية</option>
                                    <option value="Lock">🔒 قفل</option>
                                    <option value="Unlock">🔓 فتح</option>
                                    <option value="Key">🔑 مفتاح</option>
                                    <option value="Settings">⚙️ إعدادات</option>
                                    <option value="Hammer">🔨 مطرقة</option>
                                    <option value="Lightbulb">💡 مصباح</option>
                                    <option value="Sun">☀️ شمس</option>
                                    <option value="Moon">🌙 قمر</option>
                                    <option value="Cloud">☁️ سحابة</option>
                                    <option value="Droplet">💧 قطرة</option>
                                    <option value="Wind">💨 رياح</option>
                                    <option value="Leaf">🍃 ورقة</option>
                                    <option value="TreePine">🌲 شجرة</option>
                                    <option value="Feather">🪶 ريشة</option>
                                    <option value="Target">🎯 هدف</option>
                                    <option value="ThumbsUp">👍 إعجاب</option>
                                    <option value="Home">🏠 منزل</option>
                                    <option value="Building">🏢 مبنى</option>
                                    <option value="Store">🏪 متجر</option>
                                    <option value="ShoppingCart">🛒 عربة</option>
                                    <option value="ShoppingBag">🛍️ حقيبة تسوق</option>
                                    <option value="CreditCard">💳 بطاقة</option>
                                    <option value="Wallet">👛 محفظة</option>
                                    <option value="DollarSign">💵 دولار</option>
                                    <option value="Tag">🏷️ بطاقة سعر</option>
                                    <option value="BarChart">📊 رسم بياني</option>
                                    <option value="TrendingUp">📈 صاعد</option>
                                    <option value="Users">👥 مستخدمين</option>
                                    <option value="User">👤 مستخدم</option>
                                    <option value="Mail">✉️ بريد</option>
                                    <option value="Phone">📞 هاتف</option>
                                    <option value="MessageCircle">💬 رسالة</option>
                                    <option value="Send">📤 إرسال</option>
                                    <option value="Bell">🔔 جرس</option>
                                    <option value="Volume2">🔊 صوت</option>
                                    <option value="Mic">🎤 ميكروفون</option>
                                  </select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">النص بالعربي</Label>
                                    <Input
                                      type="text"
                                      value={feature.text_ar}
                                      onChange={(e) => updateProductFeature(index, 'text_ar', e.target.value)}
                                      placeholder="ذاكرة 16 جيجابايت"
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">النص بالإنجليزي</Label>
                                    <Input
                                      type="text"
                                      value={feature.text}
                                      onChange={(e) => updateProductFeature(index, 'text', e.target.value)}
                                      placeholder="16GB Memory"
                                      className="h-9"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
                    {filteredProducts?.map((product) => (
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
                              title="تعديل"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDuplicateProduct(product)}
                              title="تكرار المنتج"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                                  deleteProduct.mutate(product.id);
                                }
                              }}
                              title="حذف"
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
            {/* Search and Filters for Categories */}
            <Card className="mb-6 border-primary/20">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-2 block">البحث</Label>
                    <Input
                      placeholder="ابحث بالاسم العربي أو الإنجليزي..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs mb-2 block">القسم الرئيسي</Label>
                    <select
                      value={categoryMainSectionFilter}
                      onChange={(e) => setCategoryMainSectionFilter(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="all">جميع الأقسام الرئيسية</option>
                      <option value="no_section">بدون قسم رئيسي</option>
                      {mainSections?.map((section) => (
                        <option key={section.id} value={section.id}>{section.name_ar}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {(categorySearch || categoryMainSectionFilter !== 'all') && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {filteredCategories?.length || 0} قسم من أصل {categories?.length || 0}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCategorySearch('');
                        setCategoryMainSectionFilter('all');
                      }}
                    >
                      إعادة تعيين
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

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
                  {filteredCategories?.map((category) => (
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