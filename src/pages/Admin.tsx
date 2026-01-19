import { useEffect, useState, memo, useCallback, useMemo } from 'react';
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
import { Loader2, Plus, Pencil, Trash2, FolderOpen, Upload, X, Copy, FileText, Bell, Megaphone, Ticket, Package, Truck, Zap, Sparkles, Coins, Award, Wallet, MessageCircle, Receipt, TrendingUp, Percent, ImageIcon, GripVertical, Trophy, Gift, Check, AlertCircle, RefreshCw, ExternalLink, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { z } from 'zod';
import AdminMainSections from './AdminMainSections';
import AdminCustomRequests from './AdminCustomRequests';
import { formatPrice } from '@/lib/utils';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { extractUrlFromText, ExtractedUrlInfo } from '@/lib/extractTaobaoUrl';

const productSchema = z.object({
  name_ar: z.string().min(1, 'الاسم مطلوب'),
  name: z.string().min(1, 'الاسم بالإنجليزية مطلوب'),
  slug: z.string().min(1, 'الرابط مطلوب'),
  description_ar: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  // Allow 0 or positive price - validation will show warning but not block save
  price: z.number().nonnegative('السعر يجب أن يكون صفر أو أكبر'),
  original_price: z.number().positive().nullable().optional(),
  cost_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().optional(),
  images: z.array(z.string()).optional(),
  image_url: z.string().nullable().optional(),
  category_id: z.string().uuid('القسم غير صحيح'),
  featured: z.boolean().optional(),
  in_stock: z.boolean().optional(),
  availability_type: z.enum(['in_stock', 'pre_order']).optional(),
  has_in_stock: z.boolean().optional(),
  has_pre_order: z.boolean().optional(),
  pre_order_free_shipping_price: z.number().nullable().optional(),
  pre_order_fast_shipping_price: z.number().nullable().optional(),
  colors: z.array(z.any()).optional(),
  features: z.array(z.any()).optional(),
  pre_order_shipping_options: z.array(z.any()).optional(),
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
    stock_quantity?: number;
    image_url?: string;
    available_for_direct_sale?: boolean;
    available_for_pre_order?: boolean;
    taobao_linked_name?: string | null;
  }>>([]);
  const [productColors, setProductColors] = useState<Array<{
    name: string;
    name_ar: string;
    hex_code: string;
    price?: number;
    stock_quantity?: number;
    image_url?: string;
    in_stock?: boolean;
    available_for_direct_sale?: boolean;
    available_for_pre_order?: boolean;
    taobao_linked_name?: string | null;
  }>>([]);
  const [productFeatures, setProductFeatures] = useState<Array<{
    text_ar: string;
    text: string;
    icon?: string;
  }>>([]);
  const [productCardDiscounts, setProductCardDiscounts] = useState<Array<{
    level_id: string;
    discount_amount: number; // Amount in IQD
  }>>([]);
  const [preOrderShippingOptions, setPreOrderShippingOptions] = useState<Array<{
    name: string;
    name_ar: string;
    price_adjustment: number;
  }>>([]);
  
  // AI extraction states
  const [productUrl, setProductUrl] = useState('');
  const [extractingInfo, setExtractingInfo] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [extractionItemId, setExtractionItemId] = useState<string>('');
  const [extractionPlatform, setExtractionPlatform] = useState<string>('');
  const [reExtractingImages, setReExtractingImages] = useState<string | null>(null); // product id being re-extracted
  const [pastedText, setPastedText] = useState<string>('');
  const [extractedUrlInfo, setExtractedUrlInfo] = useState<ExtractedUrlInfo | null>(null);
  
  // Search and filter states
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productStockFilter, setProductStockFilter] = useState<string>('all');
  const [productFeaturedFilter, setProductFeaturedFilter] = useState<string>('all');
  const [productAvailabilityTypeFilter, setProductAvailabilityTypeFilter] = useState<string>('all');
  const [productOptionsStockFilter, setProductOptionsStockFilter] = useState<string>('all');
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryMainSectionFilter, setCategoryMainSectionFilter] = useState<string>('all');
  const [formKey, setFormKey] = useState(0); // Key to force form re-render with correct defaults

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Fetch default settings
  const { data: defaultSettings } = useQuery({
    queryKey: ['default-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('*')
        .eq('setting_key', 'product_defaults')
        .single();
      
      if (error) {
        console.error('Error fetching default settings:', error);
        return null;
      }
      return data?.setting_value as any;
    }
  });

  // Fetch loyalty levels for card discount selection
  const { data: loyaltyLevels } = useQuery({
    queryKey: ['loyalty-levels-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('id, name_ar, level_key, color')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  // Ensure product options, colors, and features load reliably when opening the editor
  useEffect(() => {
    if (productDialogOpen && editingProduct) {
      // Initialize from the current product - include stock_quantity from colors
      const colorsWithStock = Array.isArray(editingProduct.colors) 
        ? editingProduct.colors.map((c: any) => ({ ...c, stock_quantity: c.stock_quantity ?? undefined }))
        : [];
      setProductColors(colorsWithStock);
      setProductFeatures(Array.isArray(editingProduct.features) ? editingProduct.features : []);
      setPreOrderShippingOptions(Array.isArray(editingProduct.pre_order_shipping_options) ? editingProduct.pre_order_shipping_options : []);
      
      // Load card discounts from product
      const cardDiscounts = Array.isArray(editingProduct.card_discounts) ? editingProduct.card_discounts : [];
      setProductCardDiscounts(cardDiscounts);

      // Load options from the database ONLY if editing an existing product (has id)
      // For duplicated products (no id), options are already set by handleDuplicateProduct
      if (editingProduct.id) {
        supabase
          .from('product_options')
          .select('*')
          .eq('product_id', editingProduct.id)
          .then(({ data, error }) => {
            if (!error && data) {
              console.log('[Admin] Loaded product options:', data);
              setProductOptions(
                data.map((opt) => ({
                  name: opt.name,
                  name_ar: opt.name_ar,
                  price_adjustment: Number(opt.price_adjustment),
                  in_stock: opt.in_stock ?? true,
                  image_url: opt.image_url || undefined,
                  available_for_direct_sale: opt.available_for_direct_sale ?? true,
                  available_for_pre_order: opt.available_for_pre_order ?? false
                }))
              );
            }
          });
      }
    } else if (productDialogOpen && !editingProduct) {
      // New product: use default settings from database
      setProductOptions([]);
      setProductColors([]);
      setProductFeatures([]);
      setProductCardDiscounts([]);
      setProductUrl(''); // Clear URL when opening for new product
      setFormKey(prev => prev + 1); // Force form to re-render with correct defaults
      
      // Load default shipping options from settings
      if (defaultSettings && Array.isArray(defaultSettings.pre_order_shipping_options)) {
        setPreOrderShippingOptions(defaultSettings.pre_order_shipping_options);
      } else {
        setPreOrderShippingOptions([{
          name: 'Free Shipping (45 days)',
          name_ar: 'شحن مجاني (45 يومًا)',
          price_adjustment: 0
        }]);
      }
    } else if (!productDialogOpen) {
      // Clear URL when closing dialog
      setProductUrl('');
      setFormKey(prev => prev + 1); // Reset form key when closing
    }
  }, [productDialogOpen, editingProduct, defaultSettings]);

  const { data: products, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['admin-products-with-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name_ar), product_options(id, in_stock, taobao_available, taobao_sku_id)')
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
      
      // جلب الطلبات أولاً
      const { data: requests, error } = await supabase
        .from('custom_product_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching custom requests:', error);
        throw error;
      }
      
      if (!requests || requests.length === 0) {
        return [];
      }
      
      // جلب بيانات المستخدمين
      const userIds = [...new Set(requests.map(r => r.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone_number, email')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }
      
      // دمج البيانات
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const result = requests.map(r => ({
        ...r,
        profiles: profilesMap.get(r.user_id) || null,
      }));
      
      console.log('Custom requests fetched:', result);
      return result;
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
      const [productsResult, featuredResult, categoriesResult, outOfStockResult, pendingOrdersResult] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('featured', true),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('in_stock', false),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      return {
        totalProducts: productsResult.count || 0,
        featuredProducts: featuredResult.count || 0,
        totalCategories: categoriesResult.count || 0,
        outOfStock: outOfStockResult.count || 0,
        pendingOrders: pendingOrdersResult.count || 0
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
      queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'product-options' ||
            k[0] === 'admin-products'
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
      queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'product-options' ||
            k[0] === 'admin-products'
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
      queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'admin-products'
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
    const failedUploads: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const timestamp = Date.now();
        const random = Math.random().toString().substring(2, 10);
        const fileName = `manual-${timestamp}-${random}.${fileExt}`;

        console.log(`[ImageUpload] Uploading: ${fileName} (${file.size} bytes)`);

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file);

        if (uploadError) {
          console.error(`[ImageUpload] Upload error for ${file.name}:`, uploadError);
          failedUploads.push(file.name);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        // Verify the upload was successful
        try {
          const verifyResponse = await fetch(publicUrl, { method: 'HEAD' });
          if (!verifyResponse.ok) {
            console.error(`[ImageUpload] Verification failed for ${fileName}`);
            failedUploads.push(file.name);
            // Clean up failed upload
            await supabase.storage.from('product-images').remove([fileName]);
            continue;
          }
          console.log(`[ImageUpload] Verified: ${fileName}`);
        } catch (verifyErr) {
          console.warn(`[ImageUpload] Could not verify ${fileName}, but proceeding`);
        }

        newImageUrls.push(publicUrl);
      }

      if (newImageUrls.length > 0) {
        setUploadedImages([...uploadedImages, ...newImageUrls]);
        toast.success(`تم رفع ${newImageUrls.length} صورة بنجاح`);
      }
      
      if (failedUploads.length > 0) {
        toast.error(`فشل رفع ${failedUploads.length} صورة: ${failedUploads.join(', ')}`);
      }
    } catch (error) {
      console.error('[ImageUpload] Error:', error);
      toast.error('حدث خطأ أثناء رفع الصور');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const handleExtractProductInfo = async () => {
    if (!productUrl.trim()) {
      toast.error('يرجى إدخال رابط المنتج');
      return;
    }

    setExtractingInfo(true);
    toast.info('جاري فحص إمكانية الاستخراج...');
    
    try {
      const response = await supabase.functions.invoke('extract-product-info', {
        body: { url: productUrl }
      });

      if (response.error) {
        throw new Error(response.error.message || 'فشل في استخراج المعلومات');
      }

      const { productInfo, success, error: extractError, requiresManualInput, item_id, platform, message } = response.data;
      
      // If requires manual input, show the manual input form
      if (requiresManualInput) {
        setExtractionItemId(item_id || '');
        setExtractionPlatform(platform || 'taobao');
        setShowManualInput(true);
        toast.info(message || 'يرجى إدخال البيانات يدوياً', { duration: 5000 });
        return;
      }

      if (!success || extractError) {
        // Show manual input option
        setShowManualInput(true);
        toast.error(extractError || 'فشل في استخراج المعلومات - استخدم الإدخال اليدوي');
        return;
      }
      
      if (!productInfo) {
        setShowManualInput(true);
        toast.error('لم يتم العثور على معلومات المنتج - استخدم الإدخال اليدوي');
        return;
      }

      // Fill form with extracted data
      console.log('[AI Extract] Product info received:', {
        dimensions: productInfo.dimensions,
        weight_kg: productInfo.weight_kg,
        name: productInfo.name
      });
      applyProductInfo(productInfo);
      
    } catch (error) {
      console.error('Error extracting product info:', error);
      setShowManualInput(true);
      toast.error('Taobao يحظر الوصول. استخدم الإدخال اليدوي.');
    } finally {
      setExtractingInfo(false);
    }
  };

  // Handle extracting URL from pasted messy text
  const handleExtractFromPastedText = () => {
    if (!pastedText.trim()) {
      toast.error('الرجاء لصق النص أولاً');
      return;
    }

    const result = extractUrlFromText(pastedText);
    setExtractedUrlInfo(result);

    if (result.url) {
      toast.success(`تم استخراج الرابط من ${result.platform || 'المنصة'}`);
    } else {
      toast.error('لم يتم العثور على رابط منتج في النص');
    }
  };

  // Apply product info to form (shared between auto and manual extraction)
  const applyProductInfo = (productInfo: any) => {
    const form = document.querySelector('form') as HTMLFormElement;
    if (!form) return;

    // Fill text inputs
    if (productInfo.name_ar) {
      const input = form.querySelector('#name_ar') as HTMLInputElement;
      if (input) input.value = productInfo.name_ar;
    }
    if (productInfo.name) {
      const input = form.querySelector('#name') as HTMLInputElement;
      if (input) input.value = productInfo.name;
    }
    if (productInfo.name_ar && productInfo.name) {
      const slug = productInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const input = form.querySelector('#slug') as HTMLInputElement;
      if (input) input.value = slug;
    }
    if (productInfo.description_ar) {
      const textarea = form.querySelector('#description_ar') as HTMLTextAreaElement;
      if (textarea) textarea.value = productInfo.description_ar;
    }
    if (productInfo.description) {
      const textarea = form.querySelector('#description') as HTMLTextAreaElement;
      if (textarea) textarea.value = productInfo.description;
    }

    // Set price (current price after discount)
    if (productInfo.price && productInfo.price > 0) {
      const priceInput = form.querySelector('#price') as HTMLInputElement;
      if (priceInput) priceInput.value = String(productInfo.price);
    }

    // Set original price (before discount)
    if (productInfo.original_price && productInfo.original_price > 0) {
      const originalPriceInput = form.querySelector('#original_price') as HTMLInputElement;
      if (originalPriceInput) originalPriceInput.value = String(productInfo.original_price);
    }

    // Collect option/color image URLs to exclude from main product images
    const optionColorImageUrls = new Set<string>();
    const optionsData = productInfo.options || productInfo.sizes || [];
    if (Array.isArray(optionsData)) {
      for (const opt of optionsData) {
        if (opt.image_url) {
          try {
            const urlObj = new URL(opt.image_url);
            optionColorImageUrls.add(urlObj.origin + urlObj.pathname);
          } catch {
            optionColorImageUrls.add(opt.image_url);
          }
        }
      }
    }
    if (Array.isArray(productInfo.colors)) {
      for (const color of productInfo.colors) {
        if (color.image_url) {
          try {
            const urlObj = new URL(color.image_url);
            optionColorImageUrls.add(urlObj.origin + urlObj.pathname);
          } catch {
            optionColorImageUrls.add(color.image_url);
          }
        }
      }
    }

    // Set images - remove duplicates by base URL and exclude option/color images
    if (productInfo.images && Array.isArray(productInfo.images) && productInfo.images.length > 0) {
      const seenBases = new Set<string>();
      const uniqueImages: string[] = [];
      for (const img of productInfo.images as string[]) {
        // Get base URL without query params for comparison
        let base = img;
        try {
          const urlObj = new URL(img);
          base = urlObj.origin + urlObj.pathname;
        } catch {}
        // Skip if this image belongs to an option or color
        if (optionColorImageUrls.has(base)) {
          continue;
        }
        if (!seenBases.has(base)) {
          seenBases.add(base);
          uniqueImages.push(img);
        }
      }
      // When extracting new product info, clear editing product images and use only new ones
      if (editingProduct) {
        setEditingProduct({ ...editingProduct, images: [] });
      }
      setUploadedImages(uniqueImages);
    }

    // Get default settings for options and colors
    const defaultOptionInStock = defaultSettings?.default_option_in_stock !== false;
    const defaultOptionDirectSale = defaultSettings?.default_option_available_for_direct_sale !== false;
    const defaultOptionPreOrder = defaultSettings?.default_option_available_for_pre_order || false;
    const defaultColorInStock = defaultSettings?.default_color_in_stock !== false;
    const defaultColorDirectSale = defaultSettings?.default_color_available_for_direct_sale !== false;
    const defaultColorPreOrder = defaultSettings?.default_color_available_for_pre_order || false;

    // Set sizes/options - check both 'options' and 'sizes' keys, apply default settings
    if (Array.isArray(optionsData) && optionsData.length > 0) {
      setProductOptions(optionsData.map((opt: any) => ({
        name: opt.name || '',
        name_ar: opt.name_ar || '',
        price_adjustment: opt.price_adjustment || 0,
        in_stock: opt.in_stock ?? defaultOptionInStock,
        stock_quantity: opt.stock_quantity ?? undefined,
        image_url: opt.image_url || undefined,
        available_for_direct_sale: opt.available_for_direct_sale ?? defaultOptionDirectSale,
        available_for_pre_order: opt.available_for_pre_order ?? defaultOptionPreOrder
      })));
    }

    // Set colors with default settings
    if (productInfo.colors && Array.isArray(productInfo.colors) && productInfo.colors.length > 0) {
      setProductColors(productInfo.colors.map((color: any) => ({
        name: color.name || '',
        name_ar: color.name_ar || '',
        hex_code: color.hex_code || '#000000',
        price: undefined,
        stock_quantity: color.stock_quantity ?? undefined,
        image_url: color.image_url || undefined,
        in_stock: color.in_stock ?? defaultColorInStock,
        available_for_direct_sale: color.available_for_direct_sale ?? defaultColorDirectSale,
        available_for_pre_order: color.available_for_pre_order ?? defaultColorPreOrder
      })));
    }

    // Set features with icon
    if (productInfo.features && Array.isArray(productInfo.features) && productInfo.features.length > 0) {
      setProductFeatures(productInfo.features.map((feature: any) => ({
        text: feature.text || '',
        text_ar: feature.text_ar || '',
        icon: feature.icon || 'Check'
      })));
    }

    // Set points_reward if extracted
    if (productInfo.points_reward && productInfo.points_reward > 0) {
      const pointsInput = form.querySelector('#points_reward') as HTMLInputElement;
      if (pointsInput) pointsInput.value = String(productInfo.points_reward);
    }

    // Apply estimated air shipping cost if calculated by AI, or calculate locally
    if (productInfo.estimated_air_shipping_cost && productInfo.estimated_air_shipping_cost > 0) {
      // Use the pre-calculated shipping cost from AI
      console.log('[AI Shipping] Using pre-calculated air shipping cost:', productInfo.estimated_air_shipping_cost);
      applyAirShippingCost(productInfo.estimated_air_shipping_cost);
    } else if (productInfo.dimensions || productInfo.weight_kg) {
      // Fall back to local calculation
      calculateAndApplyAirShipping(productInfo.dimensions, productInfo.weight_kg);
    }

    // Hide manual input if it was shown
    setShowManualInput(false);

    const colorsCount = productInfo.colors?.length || 0;
    const optionsCount = optionsData.length || 0;
    const featuresCount = productInfo.features?.length || 0;
    const pointsReward = productInfo.points_reward || 0;
    const hasShippingCalc = productInfo.dimensions || productInfo.weight_kg;
    toast.success(`تم استخراج المعلومات! (${colorsCount} ألوان، ${optionsCount} خيارات، ${featuresCount} مميزات${hasShippingCalc ? '، + سعر الشحن' : ''})`);
  };

  // Apply air shipping cost directly (when calculated by AI)
  const applyAirShippingCost = (shippingCost: number) => {
    console.log('[AI Shipping] Applying pre-calculated air shipping cost:', shippingCost);
    
    // Update the fast shipping option in preOrderShippingOptions
    setPreOrderShippingOptions(prevOptions => {
      // Find fast shipping option (usually the second one with "سريع" in name)
      const updatedOptions = prevOptions.map((opt, index) => {
        if (opt.name_ar?.includes('سريع') || opt.name?.toLowerCase().includes('fast') || index === 1) {
          return { ...opt, price_adjustment: shippingCost };
        }
        return opt;
      });
      
      // If no fast shipping option found, add one
      const hasFastShipping = updatedOptions.some(
        opt => opt.name_ar?.includes('سريع') || opt.name?.toLowerCase().includes('fast')
      );
      
      if (!hasFastShipping && shippingCost > 0) {
        updatedOptions.push({
          name: 'Fast shipping (15 days)',
          name_ar: 'شحن سريع (15 يومًا)',
          price_adjustment: shippingCost
        });
      }
      
      return updatedOptions;
    });
    
    toast.info(`تم حساب سعر الشحن السريع: ${shippingCost.toLocaleString()} دينار`);
  };

  // Calculate air shipping cost from China and apply to fast shipping option
  const calculateAndApplyAirShipping = async (dimensions: any, weightKg: number | null) => {
    try {
      // Fetch shipping settings
      const { data: settingsData, error } = await supabase
        .from('shipping_settings')
        .select('setting_key, setting_value');
      
      if (error) {
        console.error('Error fetching shipping settings:', error);
        return;
      }

      // Build settings object
      const settings: Record<string, number> = {
        sea_padding_cm: 5,
        air_china_volumetric_price: 15000,
        air_china_volumetric_divider: 5000,
        air_china_weight_safety_margin: 20,
      };

      settingsData?.forEach((item) => {
        settings[item.setting_key] = Number(item.setting_value);
      });

      let shippingCost = 0;
      const padding = settings.sea_padding_cm;
      
      // Calculate volumetric weight if dimensions provided
      let volumetricWeight = 0;
      if (dimensions && dimensions.length_cm && dimensions.width_cm && dimensions.height_cm) {
        const length = (dimensions.length_cm || 0) + padding;
        const width = (dimensions.width_cm || 0) + padding;
        const height = (dimensions.height_cm || 0) + padding;
        volumetricWeight = (length * width * height) / settings.air_china_volumetric_divider;
      }
      
      // Use the greater weight (volumetric or actual)
      const actualWeight = weightKg || 0;
      const usedWeight = Math.max(volumetricWeight, actualWeight);
      
      if (usedWeight > 0) {
        // Add safety margin
        const safetyMargin = settings.air_china_weight_safety_margin / 100;
        const weightWithSafety = usedWeight * (1 + safetyMargin);
        
        // Calculate cost
        shippingCost = Math.round(weightWithSafety * settings.air_china_volumetric_price);
        
        console.log('[AI Shipping] Calculated air shipping:', {
          dimensions,
          weightKg,
          volumetricWeight,
          actualWeight,
          usedWeight,
          weightWithSafety,
          shippingCost
        });
        
        // Update the fast shipping option in preOrderShippingOptions
        setPreOrderShippingOptions(prevOptions => {
          // Find fast shipping option (usually the second one with "سريع" in name)
          const updatedOptions = prevOptions.map((opt, index) => {
            if (opt.name_ar?.includes('سريع') || opt.name?.toLowerCase().includes('fast') || index === 1) {
              return { ...opt, price_adjustment: shippingCost };
            }
            return opt;
          });
          
          // If no fast shipping option found, add one
          const hasFastShipping = updatedOptions.some(
            opt => opt.name_ar?.includes('سريع') || opt.name?.toLowerCase().includes('fast')
          );
          
          if (!hasFastShipping && shippingCost > 0) {
            updatedOptions.push({
              name: 'Fast shipping (15 days)',
              name_ar: 'شحن سريع (15 يومًا)',
              price_adjustment: shippingCost
            });
          }
          
          return updatedOptions;
        });
        
        toast.info(`تم حساب سعر الشحن السريع: ${shippingCost.toLocaleString()} دينار`);
      }
    } catch (err) {
      console.error('Error calculating air shipping:', err);
    }
  };

  // Re-extract images only for a product using AI
  const handleReExtractImages = async (product: any) => {
    // Product must have a source URL stored - we'll try to extract from description or prompt user
    const productUrl = prompt('أدخل رابط المنتج الأصلي لإعادة استخراج الصور:');
    if (!productUrl || !productUrl.trim()) {
      return;
    }

    setReExtractingImages(product.id);
    try {
      const response = await supabase.functions.invoke('extract-product-info', {
        body: { url: productUrl.trim() }
      });

      if (response.error) {
        throw new Error(response.error.message || 'فشل في استخراج الصور');
      }

      const { productInfo } = response.data;
      
      if (!productInfo || !productInfo.images || productInfo.images.length === 0) {
        throw new Error('لم يتم العثور على صور للمنتج');
      }

      // Update the product with new images
      const newImages = productInfo.images;
      const { error: updateError } = await supabase
        .from('products')
        .update({
          images: newImages,
          image_url: newImages[0] || product.image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'admin-products'
          );
        },
      });

      toast.success(`تم تحديث صور المنتج بنجاح! (${newImages.length} صور)`);
    } catch (error) {
      console.error('Error re-extracting images:', error);
      toast.error(error instanceof Error ? error.message : 'حدث خطأ أثناء استخراج الصور');
    } finally {
      setReExtractingImages(null);
    }
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
          image_url: opt.image_url || null,
          available_for_direct_sale: opt.available_for_direct_sale ?? true,
          available_for_pre_order: opt.available_for_pre_order ?? false
        }));

        const { error: insertOptionsError } = await supabase
          .from('product_options')
          .insert(optionsToInsert);
        if (insertOptionsError) throw insertOptionsError;
      }

      // 5) Refresh lists and notify
      queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'product-options' ||
            k[0] === 'admin-products'
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
      available_for_direct_sale: defaultSettings?.default_option_available_for_direct_sale !== false,
      available_for_pre_order: defaultSettings?.default_option_available_for_pre_order || false,
      price_adjustment: 0,
      in_stock: defaultSettings?.default_option_in_stock !== false,
      stock_quantity: undefined,
      image_url: undefined
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
      available_for_direct_sale: defaultSettings?.default_color_available_for_direct_sale !== false,
      available_for_pre_order: defaultSettings?.default_color_available_for_pre_order || false,
      hex_code: '#000000',
      price: undefined,
      stock_quantity: undefined,
      image_url: undefined,
      in_stock: defaultSettings?.default_color_in_stock !== false
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

  const addPreOrderShippingOption = () => {
    setPreOrderShippingOptions([...preOrderShippingOptions, {
      name: '',
      name_ar: '',
      price_adjustment: 0
    }]);
  };

  const removePreOrderShippingOption = (index: number) => {
    setPreOrderShippingOptions(preOrderShippingOptions.filter((_, i) => i !== index));
  };

  const updatePreOrderShippingOption = (index: number, field: string, value: any) => {
    const updated = [...preOrderShippingOptions];
    updated[index] = { ...updated[index], [field]: value };
    setPreOrderShippingOptions(updated);
  };

  const handleProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const allImages = editingProduct?.images || [];
      const finalImages = [...allImages, ...uploadedImages];

      const hasInStock = (formData.get('has_in_stock') as string) === 'on';
      const hasPreOrder = (formData.get('has_pre_order') as string) === 'on';
      
      // Determine availability_type based on selected options (for backward compatibility)
      let availabilityType = 'in_stock';
      if (hasPreOrder && !hasInStock) {
        availabilityType = 'pre_order';
      } else if (hasInStock && !hasPreOrder) {
        availabilityType = 'in_stock';
      } else if (hasInStock && hasPreOrder) {
        availabilityType = 'in_stock'; // Default to in_stock if both are selected
      }
      
      // Filter valid colors and features - include stock_quantity
      const validColors = productColors.filter(c => c.name_ar.trim() && c.name.trim()).map(c => ({
        ...c,
        stock_quantity: c.stock_quantity ?? undefined
      }));
      const validFeatures = productFeatures.filter(f => f.text_ar.trim() && f.text.trim());
      
      const values = {
        name_ar: formData.get('name_ar') as string,
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description_ar: (formData.get('description_ar') as string) || null,
        description: (formData.get('description') as string) || null,
        price: Number(formData.get('price')),
        // Use null to clear the value, not undefined
        original_price: formData.get('original_price') && formData.get('original_price') !== '' 
          ? Number(formData.get('original_price')) 
          : null,
        cost_price: formData.get('cost_price') && formData.get('cost_price') !== '' 
          ? Number(formData.get('cost_price')) 
          : null,
        currency: (formData.get('currency') as string) || 'دينار عراقي',
        images: finalImages.length > 0 ? finalImages : [],
        image_url: finalImages[0] || null,
        category_id: formData.get('category_id') as string,
        featured: (formData.get('featured') as string) === 'on',
        in_stock: (formData.get('in_stock') as string) === 'on',
        availability_type: availabilityType,
        has_in_stock: hasInStock,
        has_pre_order: hasPreOrder,
        pre_order_shipping_options: hasPreOrder 
          ? preOrderShippingOptions.filter(opt => opt.name_ar.trim() !== '' && opt.name.trim() !== '')
          : [],
        pre_order_free_shipping_price: hasPreOrder && formData.get('pre_order_free_shipping_price') && formData.get('pre_order_free_shipping_price') !== ''
          ? Number(formData.get('pre_order_free_shipping_price'))
          : null,
        pre_order_fast_shipping_price: hasPreOrder && formData.get('pre_order_fast_shipping_price') && formData.get('pre_order_fast_shipping_price') !== ''
          ? Number(formData.get('pre_order_fast_shipping_price'))
          : null,
        // Use empty array [] instead of undefined to actually clear data
        colors: validColors.length > 0 ? validColors : [],
        features: validFeatures.length > 0 ? validFeatures : [],
        // Taobao sync fields
        taobao_url: (formData.get('taobao_url') as string)?.trim() || null,
        // Product rewards - points from form (can be auto-calculated or manually set)
        points_reward: formData.get('points_reward') && formData.get('points_reward') !== '' 
          ? Number(formData.get('points_reward')) 
          : 0,
        // Multiple card discounts as JSON array
        card_discounts: productCardDiscounts.filter(d => d.level_id && d.discount_amount > 0),
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

      // Save product options - always delete existing options when editing
      if (productId) {
        // Delete existing options if editing (even if no new options)
        if (editingProduct) {
          await supabase
            .from('product_options')
            .delete()
            .eq('product_id', productId);
        }

        // Insert new options if any
        const optionsToInsert = productOptions
          .filter(opt => opt.name_ar.trim() && opt.name.trim())
          .map(opt => ({
            product_id: productId,
            name: opt.name,
            name_ar: opt.name_ar,
            price_adjustment: opt.price_adjustment,
            in_stock: opt.in_stock,
            image_url: opt.image_url || null,
            available_for_direct_sale: opt.available_for_direct_sale ?? true,
            available_for_pre_order: opt.available_for_pre_order ?? false
          }));

        if (optionsToInsert.length > 0) {
          const { error: optionsError } = await supabase
            .from('product_options')
            .insert(optionsToInsert);
          
          if (optionsError) throw optionsError;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return Array.isArray(k) && (
            k[0] === 'products' ||
            k[0] === 'featured-products' ||
            k[0] === 'category-products' ||
            k[0] === 'product' ||
            k[0] === 'product-options' ||
            k[0] === 'admin-products'
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
      setProductCardDiscounts([]);
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
    
    // Filter by availability type
    const matchesAvailabilityType = productAvailabilityTypeFilter === 'all' ||
      (productAvailabilityTypeFilter === 'in_stock_only' && product.has_in_stock && !product.has_pre_order) ||
      (productAvailabilityTypeFilter === 'pre_order_only' && product.has_pre_order && !product.has_in_stock) ||
      (productAvailabilityTypeFilter === 'both' && product.has_in_stock && product.has_pre_order);
    
    // Filter by options/colors stock status
    const colors = Array.isArray(product.colors) ? product.colors : [];
    const options = Array.isArray(product.product_options) ? product.product_options : [];
    const hasOutOfStockColor = colors.some((c: any) => c.in_stock === false);
    const hasOutOfStockOption = options.some((o: any) => o.in_stock === false);
    
    const matchesOptionsStock = productOptionsStockFilter === 'all' ||
      (productOptionsStockFilter === 'has_out_of_stock_color' && hasOutOfStockColor) ||
      (productOptionsStockFilter === 'has_out_of_stock_option' && hasOutOfStockOption) ||
      (productOptionsStockFilter === 'has_any_out_of_stock' && (hasOutOfStockColor || hasOutOfStockOption));
    
    return matchesSearch && matchesCategory && matchesStock && matchesFeatured && matchesAvailabilityType && matchesOptionsStock;
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
    <div className="admin-page relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'url(/images/decorative-frame-new.webp)',
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        <div className="absolute top-0 left-0 w-64 h-64 bg-ring/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-3xl" />
      </div>
      
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
        {/* Admin Header */}
        <div className="admin-header">
          <h1>لوحة التحكم</h1>
          <p>إدارة شاملة للمنتجات والأقسام والإعدادات</p>
        </div>

        {/* Statistics Cards */}
        <div className="admin-grid-5 mb-8">
          <div className="admin-stat-card text-center">
            <div className="admin-stat-value">{stats?.totalProducts || 0}</div>
            <div className="admin-stat-label">إجمالي المنتجات</div>
          </div>

          <div className="admin-stat-card text-center">
            <div className="admin-stat-value">{stats?.totalCategories || 0}</div>
            <div className="admin-stat-label">الأقسام</div>
          </div>

          <div 
            className="admin-stat-card text-center cursor-pointer relative"
            onClick={() => navigate(ADMIN_ROUTES.orders + '?status=pending')}
          >
            <div className="admin-stat-value text-amber-500">{stats?.pendingOrders || 0}</div>
            <div className="admin-stat-label">طلبات معلقة</div>
            {stats?.pendingOrders && stats.pendingOrders > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs rounded-full animate-pulse"
              >
                {stats.pendingOrders}
              </Badge>
            )}
          </div>

          <div 
            className="admin-stat-card text-center cursor-pointer"
            onClick={() => navigate(ADMIN_ROUTES.orders)}
          >
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="text-sm font-semibold text-foreground">جميع الطلبات</div>
            <div className="admin-stat-label">تعديل وإدارة</div>
          </div>

          <div 
            className="admin-stat-card text-center cursor-pointer relative"
            onClick={() => setActiveTab('custom-requests')}
          >
            <div className="admin-stat-value text-orange-500">{pendingRequestsCount || 0}</div>
            <div className="admin-stat-label">طلبات خاصة معلقة</div>
            {pendingRequestsCount && pendingRequestsCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs rounded-full animate-pulse"
              >
                !
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions - Settings & Management */}
        <div className="admin-card mb-8">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Bell className="h-5 w-5 text-primary" />
              الإعدادات والإدارة
            </div>
          </div>
          <div className="admin-card-content">
            <div className="admin-grid-4">
              {[
                { icon: Bell, title: 'إدارة الإشعارات', desc: 'إرسال إشعارات للمستخدمين', path: ADMIN_ROUTES.notifications },
                { icon: Megaphone, title: 'الشريط الإخباري', desc: 'إدارة الإعلانات المتحركة', path: ADMIN_ROUTES.announcements },
                { icon: Ticket, title: 'إدارة الكوبونات', desc: 'إنشاء وإدارة الخصومات', path: ADMIN_ROUTES.coupons },
                { icon: Package, title: 'إدارة الطلبات', desc: 'تتبع وإدارة الطلبات', path: ADMIN_ROUTES.orders },
                { icon: FileText, title: 'الطلبات المخصصة', desc: 'مراجعة طلبات العملاء', action: () => setActiveTab('custom-requests'), badge: pendingRequestsCount },
                { icon: Zap, title: 'الإعدادات الافتراضية', desc: 'تخصيص القيم الافتراضية', path: ADMIN_ROUTES.defaultSettings },
                { icon: Coins, title: 'إعدادات النقاط', desc: 'إدارة نظام المكافآت', path: ADMIN_ROUTES.pointsSettings },
                { icon: Award, title: 'مستويات الولاء', desc: 'إدارة المستويات والمزايا', path: ADMIN_ROUTES.loyaltyLevels },
                { icon: Wallet, title: 'إدارة المحفظة', desc: 'تعبئة وسحب الأرصدة', path: ADMIN_ROUTES.wallet },
                { icon: MessageCircle, title: 'محادثات العملاء', desc: 'الدعم والمساعدة', path: ADMIN_ROUTES.chats },
                { icon: Receipt, title: 'قوالب الفواتير', desc: 'تخصيص تصميم الفاتورة', path: ADMIN_ROUTES.invoiceTemplates },
                { icon: FileText, title: 'الفواتير المحفوظة', desc: 'مراجعة وإدارة الفواتير', path: ADMIN_ROUTES.savedInvoices },
                { icon: TrendingUp, title: 'التحليلات المالية', desc: 'الإيرادات والتكاليف والأرباح', path: ADMIN_ROUTES.financials },
                { icon: Percent, title: 'رسوم الدفع الجزئي', desc: 'إعداد رسوم دفع ربع المبلغ', path: ADMIN_ROUTES.partialPaymentSettings },
                { icon: Trophy, title: 'المسابقات والعروض', desc: 'إدارة المسابقات وعروض المنتجات', path: ADMIN_ROUTES.competitions },
                { icon: Package, title: 'سوق المستعمل', desc: 'إدارة منتجات البائعين', path: ADMIN_ROUTES.marketplace },
                { icon: Shield, title: 'حماية الطابعات', desc: 'إدارة اشتراكات الحماية', path: ADMIN_ROUTES.printerProtection },
                { icon: Truck, title: 'إعدادات الشحن', desc: 'أسعار وحساب تكلفة الشحن', path: ADMIN_ROUTES.shippingSettings },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => item.path ? navigate(item.path) : item.action?.()}
                  className="admin-action-btn relative"
                >
                  <div className="icon-wrapper">
                    <item.icon />
                  </div>
                  <span className="btn-title">{item.title}</span>
                  <span className="btn-desc">{item.desc}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge 
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs rounded-full"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions - Content Management */}
        <div className="admin-card mb-8">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Plus className="h-5 w-5 text-primary" />
              إضافة محتوى جديد
            </div>
          </div>
          <div className="admin-card-content">
            <div className="admin-grid-3">
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
                className="admin-btn-primary gap-3 h-auto py-8 flex-col"
              >
                <Plus className="h-10 w-10" />
                <span className="text-sm font-semibold">منتج جديد</span>
                <span className="text-xs opacity-90">إضافة منتج للمتجر</span>
              </Button>
              
              <Button
                onClick={() => {
                  setActiveTab('categories');
                  setEditingCategory(null);
                  setCategoryDialogOpen(true);
                }}
                className="admin-btn-primary gap-3 h-auto py-8 flex-col"
              >
                <FolderOpen className="h-10 w-10" />
                <span className="text-sm font-semibold">قسم جديد</span>
                <span className="text-xs opacity-90">إضافة قسم للمنتجات</span>
              </Button>
              
              <Button
                onClick={() => {
                  setActiveTab('main-sections');
                  setEditingMainSection(null);
                  setMainSectionDialogOpen(true);
                }}
                className="admin-btn-primary gap-3 h-auto py-8 flex-col"
              >
                <FolderOpen className="h-10 w-10" />
                <span className="text-sm font-semibold">قسم رئيسي</span>
                <span className="text-xs opacity-90">إضافة قسم رئيسي</span>
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="admin-tabs-list mb-6 w-full max-w-3xl">
            <TabsTrigger value="products" className="admin-tab gap-2 flex-1">
              <Package className="h-4 w-4" />
              المنتجات
            </TabsTrigger>
            <TabsTrigger value="categories" className="admin-tab gap-2 flex-1">
              <FolderOpen className="h-4 w-4" />
              الأقسام
            </TabsTrigger>
            <TabsTrigger value="main-sections" className="admin-tab gap-2 flex-1">
              <FolderOpen className="h-4 w-4" />
              الأقسام الرئيسية
            </TabsTrigger>
            <TabsTrigger value="custom-requests" className="admin-tab gap-2 flex-1 relative">
              <FileText className="h-4 w-4" />
              الطلبات المخصصة
              {pendingRequestsCount && pendingRequestsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -left-1 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full"
                >
                  {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            {/* Search and Filters for Products */}
            <div className="admin-filters mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="lg:col-span-2">
                  <Label className="admin-filter-label">البحث</Label>
                  <Input
                    placeholder="ابحث بالاسم العربي أو الإنجليزي..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="admin-input"
                  />
                </div>
                
                <div>
                  <Label className="admin-filter-label">القسم</Label>
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="admin-select w-full"
                  >
                    <option value="all">جميع الأقسام</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name_ar}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label className="admin-filter-label">الحالة</Label>
                  <select
                    value={productStockFilter}
                    onChange={(e) => setProductStockFilter(e.target.value)}
                    className="admin-select w-full"
                  >
                    <option value="all">الكل</option>
                    <option value="in_stock">متوفر</option>
                    <option value="out_of_stock">غير متوفر</option>
                  </select>
                </div>
                
                <div>
                  <Label className="admin-filter-label">مميز</Label>
                  <select
                    value={productFeaturedFilter}
                    onChange={(e) => setProductFeaturedFilter(e.target.value)}
                    className="admin-select w-full"
                  >
                    <option value="all">الكل</option>
                    <option value="featured">مميز</option>
                    <option value="not_featured">غير مميز</option>
                  </select>
                </div>
                
                <div>
                  <Label className="admin-filter-label">نوع التوفر</Label>
                  <select
                    value={productAvailabilityTypeFilter}
                    onChange={(e) => setProductAvailabilityTypeFilter(e.target.value)}
                    className="admin-select w-full"
                  >
                    <option value="all">الكل</option>
                    <option value="in_stock_only">مباشر فقط</option>
                    <option value="pre_order_only">طلب مسبق فقط</option>
                    <option value="both">مباشر وطلب مسبق</option>
                  </select>
                </div>
                
                <div>
                  <Label className="admin-filter-label">ألوان/خيارات غير متوفرة</Label>
                  <select
                    value={productOptionsStockFilter}
                    onChange={(e) => setProductOptionsStockFilter(e.target.value)}
                    className="admin-select w-full"
                  >
                    <option value="all">الكل</option>
                    <option value="has_out_of_stock_color">ألوان غير متوفرة</option>
                    <option value="has_out_of_stock_option">خيارات غير متوفرة</option>
                    <option value="has_any_out_of_stock">أي عنصر غير متوفر</option>
                  </select>
                </div>
              </div>
              
              {(productSearch || productCategoryFilter !== 'all' || productStockFilter !== 'all' || productFeaturedFilter !== 'all' || productAvailabilityTypeFilter !== 'all' || productOptionsStockFilter !== 'all') && (
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
                      setProductAvailabilityTypeFilter('all');
                      setProductOptionsStockFilter('all');
                    }}
                  >
                    إعادة تعيين
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">إدارة المنتجات</h2>
              
              <div className="flex items-center gap-2">
                
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
                  
                  <form key={editingProduct?.id || `new-${formKey}`} onSubmit={handleProductSubmit} className="space-y-4">
                    {/* Text Paste & URL Extraction Section - For Quick Access */}
                    <div className="p-4 border-2 border-dashed border-amber-500/30 rounded-lg bg-amber-500/5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                        <FileText className="h-4 w-4" />
                        <span>لصق النص واستخراج الرابط (للوصول السريع)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        الصق نص المشاركة من تطبيق تاوباو أو JD وسيتم استخراج الرابط و Item ID للوصول السريع للمنتج
                      </p>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="【淘宝】假一赔四 https://e.tb.cn/h.77BGXtZFQ2kzrfF?tk=G4D2UbFSfoL CZ356..."
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          rows={2}
                          className="flex-1 text-xs"
                          dir="ltr"
                        />
                        <Button
                          type="button"
                          onClick={handleExtractFromPastedText}
                          disabled={!pastedText.trim()}
                          variant="outline"
                          className="gap-2 shrink-0"
                        >
                          <Zap className="h-4 w-4" />
                          استخراج
                        </Button>
                      </div>
                      {extractedUrlInfo && (
                        <div className="p-3 bg-card border border-border rounded-lg space-y-3 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="uppercase">{extractedUrlInfo.platform || 'غير معروف'}</Badge>
                            {extractedUrlInfo.itemId && (
                              <Badge variant="outline" className="font-mono text-xs">
                                Item ID: {extractedUrlInfo.itemId}
                              </Badge>
                            )}
                          </div>
                          {extractedUrlInfo.url && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={extractedUrlInfo.url}
                                  readOnly
                                  className="text-xs font-mono flex-1 bg-muted"
                                  dir="ltr"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="default"
                                  className="gap-1 shrink-0"
                                  onClick={() => window.open(extractedUrlInfo.url!, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  فتح
                                </Button>
                              </div>
                              {!extractedUrlInfo.itemId && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                  ⚠️ هذا رابط مختصر - اضغط "فتح" للوصول للمنتج الأصلي
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* AI Product Extraction Section - Always visible for both new and editing */}
                    <div className="p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Sparkles className="h-4 w-4" />
                        <span>
                          {editingProduct 
                            ? 'تحديث معلومات المنتج بالذكاء الاصطناعي' 
                            : 'استخراج معلومات المنتج تلقائياً بالذكاء الاصطناعي'
                          }
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {editingProduct 
                          ? 'أدخل رابط المنتج لتحديث البيانات (سيتم استبدال البيانات الحالية)'
                          : 'أدخل رابط المنتج وسيقوم الذكاء الاصطناعي باستخراج جميع التفاصيل تلقائياً'
                        }
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://example.com/product"
                          value={productUrl}
                          onChange={(e) => setProductUrl(e.target.value)}
                          disabled={extractingInfo}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={handleExtractProductInfo}
                          disabled={extractingInfo || !productUrl.trim()}
                          className="gap-2"
                        >
                          {extractingInfo ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              جاري الاستخراج...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              {editingProduct ? 'تحديث' : 'استخراج'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">السعر *</Label>
                        <Input 
                          id="price" 
                          name="price"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={editingProduct?.price ?? 0}
                          required 
                        />
                        <p className="text-xs text-muted-foreground">يمكن تركه 0 وتعديله لاحقاً</p>
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cost_price">سعر التكلفة (للمشرف فقط)</Label>
                        <Input 
                          id="cost_price" 
                          name="cost_price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct?.cost_price}
                          placeholder="سعر الشراء من المورد"
                        />
                        <p className="text-xs text-muted-foreground">يستخدم لحساب الأرباح - مرئي للمشرف فقط</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="currency">العملة</Label>
                        <Input 
                          id="currency" 
                          name="currency"
                          defaultValue={editingProduct?.currency || defaultSettings?.currency || 'دينار عراقي'}
                          placeholder="دينار عراقي"
                        />
                      </div>
                    </div>

                    {/* Product Rewards & Card Discounts Section */}
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Coins className="h-4 w-4" />
                        <span>مكافآت المنتج وخصم البطاقات</span>
                      </div>
                      
                      <div className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-4">
                        {/* Points Reward */}
                        <div className="space-y-2">
                          <Label htmlFor="points_reward">نقاط المكافأة</Label>
                          <Input 
                            id="points_reward" 
                            name="points_reward"
                            type="number"
                            min="0"
                            defaultValue={editingProduct?.points_reward || 0}
                            placeholder="0"
                          />
                          <p className="text-xs text-muted-foreground">النقاط التي يحصل عليها الزبون عند الشراء (تحسب تلقائياً: 1 نقطة لكل 1000 دينار)</p>
                        </div>
                        
                        {/* Multiple Card Discounts */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>خصومات البطاقات (بالدينار)</Label>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setProductCardDiscounts([...productCardDiscounts, { level_id: '', discount_amount: 0 }])}
                            >
                              <Plus className="ml-1 h-3 w-3" />
                              إضافة خصم بطاقة
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">أضف خصومات مختلفة لكل نوع بطاقة (المبلغ بالدينار - يظهر للزبون كنسبة مئوية)</p>
                          
                          {productCardDiscounts.length > 0 && (
                            <div className="space-y-2">
                              {productCardDiscounts.map((discount, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border">
                                  <div className="flex-1">
                                    <select
                                      value={discount.level_id}
                                      onChange={(e) => {
                                        const updated = [...productCardDiscounts];
                                        updated[index] = { ...updated[index], level_id: e.target.value };
                                        setProductCardDiscounts(updated);
                                      }}
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                    >
                                      <option value="">اختر البطاقة</option>
                                      {loyaltyLevels?.map((level) => (
                                        <option key={level.id} value={level.id}>
                                          {level.name_ar}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="w-32">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="500"
                                      value={discount.discount_amount}
                                      onChange={(e) => {
                                        const updated = [...productCardDiscounts];
                                        updated[index] = { ...updated[index], discount_amount: Number(e.target.value) };
                                        setProductCardDiscounts(updated);
                                      }}
                                      placeholder="مبلغ الخصم"
                                      className="h-9"
                                    />
                                  </div>
                                  <span className="text-sm text-muted-foreground">د.ع</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setProductCardDiscounts(productCardDiscounts.filter((_, i) => i !== index));
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <input id="featured" name="featured" type="checkbox" defaultChecked={editingProduct?.featured ?? defaultSettings?.featured ?? false} />
                        <Label htmlFor="featured">مميز (يظهر في الرئيسية)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input id="in_stock" name="in_stock" type="checkbox" defaultChecked={editingProduct?.in_stock ?? defaultSettings?.in_stock ?? true} />
                        <Label htmlFor="in_stock">متاح في المخزون</Label>
                      </div>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <Label>خيارات التوفر *</Label>
                      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/30">
                        <div className="flex items-center gap-2">
                          <input 
                            id="has_in_stock" 
                            name="has_in_stock" 
                            type="checkbox" 
                            defaultChecked={editingProduct?.has_in_stock ?? defaultSettings?.has_in_stock ?? false}
                            onChange={(e) => {
                              const colorsSection = document.getElementById('colors-in-stock-notice');
                              if (colorsSection) {
                                colorsSection.style.display = e.target.checked ? 'block' : 'none';
                              }
                            }}
                          />
                          <Label htmlFor="has_in_stock" className="cursor-pointer">متاح في المخزن</Label>
                        </div>
                        <p className="text-xs text-muted-foreground pr-6">
                          يمكن للعملاء شراء المنتج مباشرة من المخزون
                        </p>
                        
                        <div className="flex items-center gap-2 pt-2">
                          <input 
                            id="has_pre_order" 
                            name="has_pre_order" 
                            type="checkbox" 
                            defaultChecked={editingProduct?.has_pre_order ?? defaultSettings?.has_pre_order ?? true}
                            onChange={(e) => {
                              const preOrderSection = document.getElementById('pre-order-section');
                              if (preOrderSection) {
                                preOrderSection.style.display = e.target.checked ? 'block' : 'none';
                              }
                            }}
                          />
                          <Label htmlFor="has_pre_order" className="cursor-pointer">طلب مسبق</Label>
                        </div>
                        <p className="text-xs text-muted-foreground pr-6">
                          يمكن للعملاء طلب المنتج مسبقاً مع اختيار نوع الشحن
                        </p>
                      </div>

                       <div 
                         id="pre-order-section" 
                         className="space-y-4 p-4 border border-primary/20 rounded-lg bg-primary/5"
                         style={{ display: (editingProduct ? (editingProduct?.has_pre_order || editingProduct?.availability_type === 'pre_order') : (defaultSettings?.has_pre_order ?? true)) ? 'block' : 'none' }}
                       >
                         <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                           <Package className="h-4 w-4" />
                           <span>خيارات الشحن للطلب المسبق (مخصصة)</span>
                         </div>

                         {/* Air Shipping Calculator */}
                         <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                           <div className="flex items-center gap-2 mb-3">
                             <Truck className="h-4 w-4 text-amber-600" />
                             <Label className="text-sm font-medium text-amber-700">حاسبة الشحن السريع (جوي من الصين)</Label>
                           </div>
                           <p className="text-xs text-muted-foreground mb-3">
                             أدخل الوزن و/أو الأبعاد لحساب سعر الشحن الجوي تلقائياً وإضافته للشحن السريع
                           </p>
                           <div className="grid grid-cols-4 gap-2 mb-3">
                             <div>
                               <Label className="text-xs">الوزن (كغ)</Label>
                               <Input
                                 type="number"
                                 step="0.1"
                                 min="0"
                                 id="calc_weight"
                                 placeholder="1.5"
                                 className="h-8 text-sm"
                               />
                             </div>
                             <div>
                               <Label className="text-xs">الطول (سم)</Label>
                               <Input
                                 type="number"
                                 step="1"
                                 min="0"
                                 id="calc_length"
                                 placeholder="30"
                                 className="h-8 text-sm"
                               />
                             </div>
                             <div>
                               <Label className="text-xs">العرض (سم)</Label>
                               <Input
                                 type="number"
                                 step="1"
                                 min="0"
                                 id="calc_width"
                                 placeholder="20"
                                 className="h-8 text-sm"
                               />
                             </div>
                             <div>
                               <Label className="text-xs">الارتفاع (سم)</Label>
                               <Input
                                 type="number"
                                 step="1"
                                 min="0"
                                 id="calc_height"
                                 placeholder="15"
                                 className="h-8 text-sm"
                               />
                             </div>
                           </div>
                           <Button
                             type="button"
                             size="sm"
                             variant="outline"
                             className="w-full bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30"
                             onClick={async () => {
                               const weightInput = document.getElementById('calc_weight') as HTMLInputElement;
                               const lengthInput = document.getElementById('calc_length') as HTMLInputElement;
                               const widthInput = document.getElementById('calc_width') as HTMLInputElement;
                               const heightInput = document.getElementById('calc_height') as HTMLInputElement;
                               
                               const weight = parseFloat(weightInput?.value) || 0;
                               const length = parseFloat(lengthInput?.value) || 0;
                               const width = parseFloat(widthInput?.value) || 0;
                               const height = parseFloat(heightInput?.value) || 0;
                               
                               if (weight <= 0 && (length <= 0 || width <= 0 || height <= 0)) {
                                 toast.error('أدخل الوزن أو الأبعاد لحساب الشحن');
                                 return;
                               }
                               
                               const dimensions = length > 0 && width > 0 && height > 0 
                                 ? { length_cm: length, width_cm: width, height_cm: height }
                                 : null;
                               
                               await calculateAndApplyAirShipping(dimensions, weight > 0 ? weight : null);
                             }}
                           >
                             <Zap className="ml-1 h-3 w-3" />
                             حساب وتطبيق على الشحن السريع
                           </Button>
                         </div>

                         <div className="bg-card/50 border border-border rounded-lg p-4 mb-4">
                           <div className="flex items-center justify-between mb-3">
                             <Label className="text-sm font-medium">خيارات الشحن المخصصة</Label>
                             <Button
                               type="button"
                               size="sm"
                               variant="outline"
                               onClick={addPreOrderShippingOption}
                             >
                               <Plus className="ml-1 h-3 w-3" />
                               إضافة خيار
                             </Button>
                           </div>
                           <p className="text-xs text-muted-foreground mb-3">
                             أضف خيارات شحن مخصصة. السعر يمكن أن يزيد (+) أو ينقص (-) من السعر الكلي. اترك السعر 0 إذا لم يؤثر على السعر.
                           </p>

                           {preOrderShippingOptions.length > 0 && (
                             <div className="space-y-3">
                               {preOrderShippingOptions.map((option, index) => (
                                 <div key={index} className="p-3 border border-border rounded-lg bg-background space-y-3">
                                   <div className="flex justify-between items-start">
                                     <span className="text-sm font-medium">خيار {index + 1}</span>
                                     <Button
                                       type="button"
                                       size="sm"
                                       variant="ghost"
                                       onClick={() => removePreOrderShippingOption(index)}
                                     >
                                       <X className="h-4 w-4" />
                                     </Button>
                                   </div>
                                   
                                   <div className="grid grid-cols-2 gap-3">
                                     <div className="space-y-1">
                                       <Label className="text-xs">الاسم بالعربي *</Label>
                                       <Input
                                         value={option.name_ar}
                                         onChange={(e) => updatePreOrderShippingOption(index, 'name_ar', e.target.value)}
                                         placeholder="شحن مجاني"
                                         className="h-9"
                                       />
                                     </div>
                                     <div className="space-y-1">
                                       <Label className="text-xs">الاسم بالإنجليزي *</Label>
                                       <Input
                                         value={option.name}
                                         onChange={(e) => updatePreOrderShippingOption(index, 'name', e.target.value)}
                                         placeholder="Free Shipping"
                                         className="h-9"
                                       />
                                     </div>
                                   </div>

                                   <div className="space-y-1">
                                     <Label className="text-xs">تعديل السعر (+ يزيد، - ينقص، 0 بدون تأثير)</Label>
                                     <Input
                                       type="number"
                                       step="0.01"
                                       value={option.price_adjustment}
                                       onChange={(e) => updatePreOrderShippingOption(index, 'price_adjustment', Number(e.target.value))}
                                       placeholder="0"
                                       className="h-9"
                                     />
                                     <p className="text-xs text-muted-foreground">
                                       أدخل رقم موجب للإضافة، سالب للخصم، أو 0 لعدم التأثير
                                     </p>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
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
                          <p className="text-sm text-muted-foreground mb-2">
                            الصور الحالية: <span className="text-primary">(اسحب لإعادة الترتيب - الصورة الأولى هي الرئيسية)</span>
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {editingProduct.images.map((img: string, index: number) => {
                              const isMainImage = index === 0;
                              return (
                                <div 
                                  key={img} 
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedImageIndex(index);
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  onDragEnd={() => setDraggedImageIndex(null)}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedImageIndex === null || draggedImageIndex === index) return;
                                    
                                    const newImages = [...editingProduct.images];
                                    const [draggedItem] = newImages.splice(draggedImageIndex, 1);
                                    newImages.splice(index, 0, draggedItem);
                                    
                                    setEditingProduct({ 
                                      ...editingProduct, 
                                      images: newImages, 
                                      image_url: newImages[0] 
                                    });
                                    setDraggedImageIndex(null);
                                    toast.success('تم إعادة ترتيب الصور');
                                  }}
                                  className={`relative aspect-square rounded-lg overflow-hidden border-2 group cursor-grab active:cursor-grabbing transition-all ${
                                    isMainImage 
                                      ? 'border-primary ring-2 ring-primary/30' 
                                      : 'border-border hover:border-primary/50'
                                  } ${draggedImageIndex === index ? 'opacity-50 scale-95' : ''}`}
                                >
                                  <img src={img} alt={`صورة ${index + 1}`} className="w-full h-full object-cover pointer-events-none" />
                                  
                                  {/* Drag handle indicator */}
                                  <div className="absolute bottom-1 left-1 bg-background/80 text-muted-foreground p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical className="h-3 w-3" />
                                  </div>
                                  
                                  {isMainImage && (
                                    <div className="absolute top-1 left-1 bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-xs font-medium">
                                      رئيسية
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updatedImages = editingProduct.images.filter((_: string, i: number) => i !== index);
                                      setEditingProduct({ 
                                        ...editingProduct, 
                                        images: updatedImages, 
                                        image_url: updatedImages[0] || null 
                                      });
                                    }}
                                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
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
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">خيار {index + 1}</span>
                                </div>
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

                              <div className="space-y-3">
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
                                
                                <div className="space-y-2">
                                  <Label className="text-xs">التوفر</Label>
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        id={`option-direct-sale-${index}`}
                                        checked={option.available_for_direct_sale ?? true}
                                        onChange={(e) => updateProductOption(index, 'available_for_direct_sale', e.target.checked)}
                                        className="rounded"
                                      />
                                      <Label htmlFor={`option-direct-sale-${index}`} className="text-sm cursor-pointer">
                                        متوفر للبيع المباشر
                                      </Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        id={`option-pre-order-${index}`}
                                        checked={option.available_for_pre_order ?? false}
                                        onChange={(e) => updateProductOption(index, 'available_for_pre_order', e.target.checked)}
                                        className="rounded"
                                      />
                                      <Label htmlFor={`option-pre-order-${index}`} className="text-sm cursor-pointer">
                                        متوفر للطلب المسبق
                                      </Label>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {!option.available_for_direct_sale && !option.available_for_pre_order 
                                      ? "⚠️ الخيار معطل ولن يمكن إضافته للسلة"
                                      : "الخيار متاح للعملاء"}
                                  </p>
                                </div>
                                
                                <div className="space-y-1">
                                  <Label className="text-xs">حالة المخزون</Label>
                                  <div className="flex items-center gap-2 h-9">
                                    <input
                                      type="checkbox"
                                      checked={option.in_stock}
                                      onChange={(e) => {
                                        updateProductOption(index, 'in_stock', e.target.checked);
                                        if (!e.target.checked) {
                                          updateProductOption(index, 'stock_quantity', 0);
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-sm">متاح في المخزون</span>
                                  </div>
                                </div>
                                
                                {option.available_for_direct_sale && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">كمية المخزون (اختياري)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={option.stock_quantity ?? ''}
                                      onChange={(e) => updateProductOption(index, 'stock_quantity', e.target.value ? Number(e.target.value) : undefined)}
                                      placeholder="اتركه فارغاً لغير محدود"
                                      className="h-9"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      اتركه فارغاً إذا كان المخزون غير محدود
                                    </p>
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-1">
                                <Label className="text-xs">صورة الخيار (اختياري)</Label>
                                <div className="flex gap-2 items-end">
                                  <Input
                                    id={`option-image-${index}`}
                                    type="file"
                                    accept="image/*"
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={async (e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      
                                      try {
                                        toast.info('جاري رفع صورة الخيار...');
                                        const fileExt = file.name.split('.').pop();
                                        const timestamp = Date.now();
                                        const random = Math.random().toString().substring(2, 10);
                                        const fileName = `option-img-${index}-${timestamp}-${random}.${fileExt}`;
                                        
                                        console.log('[OptionImage] Starting upload for option', index, 'file:', fileName);
                                        
                                        const { error: uploadError } = await supabase.storage
                                          .from('product-images')
                                          .upload(fileName, file);
                                        
                                        if (uploadError) {
                                          console.error('[OptionImage] Upload error:', uploadError);
                                          toast.error(`فشل رفع الصورة: ${uploadError.message}`);
                                          return;
                                        }
                                        
                                        const { data: { publicUrl } } = supabase.storage
                                          .from('product-images')
                                          .getPublicUrl(fileName);
                                        
                                        console.log('[OptionImage] Uploaded successfully, URL:', publicUrl);
                                        
                                        // Update the option's image_url directly
                                        const updatedOptions = [...productOptions];
                                        updatedOptions[index] = { ...updatedOptions[index], image_url: publicUrl };
                                        setProductOptions(updatedOptions);
                                        
                                        console.log('[OptionImage] Updated productOptions state for index', index);
                                        toast.success('تم رفع صورة الخيار بنجاح');
                                        
                                        // Clear the file input
                                        e.target.value = '';
                                      } catch (err) {
                                        console.error('[OptionImage] Exception:', err);
                                        toast.error('حدث خطأ غير متوقع أثناء رفع الصورة');
                                      }
                                    }}
                                    className="h-9"
                                  />
                                  {option.image_url && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => updateProductOption(index, 'image_url', undefined)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                {option.image_url && (
                                  <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                                    <img src={option.image_url} alt={option.name_ar} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  صورة خاصة تظهر عند اختيار هذا الخيار
                                </p>
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
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">لون {index + 1}</span>
                                </div>
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
                                      id={`color-image-${index}`}
                                      type="file"
                                      accept="image/*"
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={async (e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        
                                        try {
                                          toast.info('جاري رفع صورة اللون...');
                                          const fileExt = file.name.split('.').pop();
                                          const timestamp = Date.now();
                                          const random = Math.random().toString().substring(2, 10);
                                          const fileName = `color-img-${index}-${timestamp}-${random}.${fileExt}`;
                                          
                                          console.log('[ColorImage] Starting upload for color', index, 'file:', fileName);
                                          
                                          const { error: uploadError } = await supabase.storage
                                            .from('product-images')
                                            .upload(fileName, file);
                                          
                                          if (uploadError) {
                                            console.error('[ColorImage] Upload error:', uploadError);
                                            toast.error(`فشل رفع الصورة: ${uploadError.message}`);
                                            return;
                                          }
                                          
                                          const { data: { publicUrl } } = supabase.storage
                                            .from('product-images')
                                            .getPublicUrl(fileName);
                                          
                                          console.log('[ColorImage] Uploaded successfully, URL:', publicUrl);
                                          
                                          // Update the color's image_url directly
                                          const updatedColors = [...productColors];
                                          updatedColors[index] = { ...updatedColors[index], image_url: publicUrl };
                                          setProductColors(updatedColors);
                                          
                                          console.log('[ColorImage] Updated productColors state for index', index);
                                          toast.success('تم رفع صورة اللون بنجاح');
                                          
                                          // Clear the file input
                                          e.target.value = '';
                                        } catch (err) {
                                          console.error('[ColorImage] Exception:', err);
                                          toast.error('حدث خطأ غير متوقع أثناء رفع الصورة');
                                        }
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
                                 
                                 <div className="space-y-2 pt-2">
                                   <Label className="text-xs">التوفر</Label>
                                   <div className="flex flex-col gap-2">
                                     <div className="flex items-center gap-2">
                                       <input
                                         type="checkbox"
                                         id={`color-direct-sale-${index}`}
                                         checked={color.available_for_direct_sale ?? true}
                                         onChange={(e) => updateProductColor(index, 'available_for_direct_sale', e.target.checked)}
                                         className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                       />
                                       <Label htmlFor={`color-direct-sale-${index}`} className="text-sm cursor-pointer">
                                         متوفر للبيع المباشر
                                       </Label>
                                     </div>
                                     <div className="flex items-center gap-2">
                                       <input
                                         type="checkbox"
                                         id={`color-pre-order-${index}`}
                                         checked={color.available_for_pre_order ?? false}
                                         onChange={(e) => updateProductColor(index, 'available_for_pre_order', e.target.checked)}
                                         className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                       />
                                       <Label htmlFor={`color-pre-order-${index}`} className="text-sm cursor-pointer">
                                         متوفر للطلب المسبق
                                       </Label>
                                     </div>
                                   </div>
                                   <p className="text-xs text-muted-foreground">
                                     {!color.available_for_direct_sale && !color.available_for_pre_order 
                                       ? "⚠️ اللون معطل ولن يمكن إضافته للسلة"
                                       : "اللون متاح للعملاء"}
                                   </p>
                                 </div>
                                 
                                 <div 
                                   id="colors-in-stock-notice"
                                   className="space-y-2 pt-2"
                                   style={{ display: (editingProduct?.has_in_stock ?? true) ? 'block' : 'none' }}
                                 >
                                   <div className="flex items-center gap-2">
                                     <input
                                       type="checkbox"
                                       id={`color-in-stock-${index}`}
                                       checked={color.in_stock !== false}
                                       onChange={(e) => {
                                         updateProductColor(index, 'in_stock', e.target.checked);
                                         if (!e.target.checked) {
                                           updateProductColor(index, 'stock_quantity', 0);
                                         }
                                       }}
                                       className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                     />
                                     <Label htmlFor={`color-in-stock-${index}`} className="text-xs cursor-pointer">
                                       متوفر في المخزون
                                     </Label>
                                   </div>
                                   
                                   {color.available_for_direct_sale && (
                                     <div className="space-y-1 mr-6">
                                       <Label className="text-xs">كمية المخزون (اختياري)</Label>
                                       <Input
                                         type="number"
                                         min="0"
                                         value={color.stock_quantity ?? ''}
                                         onChange={(e) => updateProductColor(index, 'stock_quantity', e.target.value ? Number(e.target.value) : undefined)}
                                         placeholder="اتركه فارغاً لغير محدود"
                                         className="h-9"
                                       />
                                     </div>
                                   )}
                                 </div>
                                 <p 
                                   className="text-xs text-muted-foreground"
                                   style={{ display: (editingProduct?.has_in_stock ?? true) ? 'block' : 'none' }}
                                 >
                                   فقط للمنتجات المتوفرة في المخزن. عند إلغاء التحديد، يظهر اللون بشكل خافت للزبون
                                 </p>
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
                              onClick={() => handleReExtractImages(product)}
                              disabled={reExtractingImages === product.id}
                              title="إعادة استخراج الصور"
                              className="text-primary hover:text-primary"
                            >
                              {reExtractingImages === product.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </Button>
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
              }} key={editingCategory?.id || 'new-category'}>
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