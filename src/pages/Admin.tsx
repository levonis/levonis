import { useEffect, useState, memo, useCallback, useMemo, useRef } from 'react';
import '@/styles/admin.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, FolderOpen, Upload, X, Copy, FileText, Bell, Megaphone, Ticket, Package, Truck, Zap, Sparkles, Coins, Award, Wallet, MessageCircle, Receipt, TrendingUp, Percent, ImageIcon, GripVertical, Trophy, Gift, Check, AlertCircle, RefreshCw, ExternalLink, Shield, ShieldCheck, Users, Music, BadgeDollarSign, Star, Eye, EyeOff, Flag, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { z } from 'zod';
import AdminMainSections from './AdminMainSections';
import AdminCustomRequests from './AdminCustomRequests';
import { formatPrice } from '@/lib/utils';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { extractUrlFromText, ExtractedUrlInfo } from '@/lib/extractTaobaoUrl';
import AdminProductPricingSection from '@/components/admin/AdminProductPricingSection';
import AdminProductAIContentEditor from '@/components/admin/AdminProductAIContentEditor';
import { ExtractionProgress, type ExtractionStep } from '@/components/admin/ExtractionProgress';
import { useShippingSettings, calculateShippingCost } from '@/hooks/useShippingCalculator';
import PermissionsHealthPanel from '@/components/admin/PermissionsHealthPanel';
import { adminCreateProduct, adminDeleteProduct, adminUpdateProduct } from '@/lib/adminMutations';

const EXTRACTION_STEP_DEFS: { key: string; label: string }[] = [
  { key: 'fetch', label: 'جلب صفحة المنتج' },
  { key: 'parse', label: 'تحليل البيانات الأساسية' },
  { key: 'price', label: 'استخراج الأسعار' },
  { key: 'images', label: 'استخراج الصور' },
  { key: 'options', label: 'استخراج الخيارات والألوان' },
  { key: 'ai', label: 'إنشاء الملخص ومحتوى SEO بالذكاء الاصطناعي' },
  { key: 'apply', label: 'تعبئة الحقول تلقائياً' },
];

const productSchema = z.object({
  name_ar: z.string().min(1, 'الاسم مطلوب'),
  name: z.string().min(1, 'الاسم بالإنجليزية مطلوب'),
  slug: z.string().min(1, 'الرابط مطلوب'),
  description_ar: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
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
  direct_sale_price: z.number().nullable().optional(),
  sea_price: z.number().nullable().optional(),
  air_price: z.number().nullable().optional(),
  colors: z.array(z.any()).optional(),
  features: z.array(z.any()).optional(),
  pre_order_shipping_options: z.array(z.any()).optional(),
  display_order: z.number().int().min(0).optional(),
  brand: z.string().nullable().optional(),
});

const categorySchema = z.object({
  name_ar: z.string().min(1, 'الاسم بالعربي مطلوب'),
  name: z.string().min(1, 'الاسم بالإنجليزي مطلوب'),
  name_en: z.string().optional(),
  name_ku: z.string().optional(),
  slug: z.string().min(1, 'الرابط مطلوب'),
  icon: z.string().min(1, 'الأيقونة مطلوبة'),
  description_ar: z.string().optional(),
  description: z.string().optional(),
  description_en: z.string().optional(),
  description_ku: z.string().optional(),
  main_section_id: z.string().uuid().optional(),
  featured_product_id: z.string().uuid().nullable().optional(),
  media_url: z.string().nullable().optional(),
  media_type: z.string().nullable().optional(),
  media_transparent: z.boolean().optional(),
  media_chroma: z.enum(['none', 'black', 'white', 'auto']).optional(),
});

const mainSectionSchema = z.object({
  name_ar: z.string().min(1, 'الاسم بالعربي مطلوب'),
  name: z.string().min(1, 'الاسم بالإنجليزي مطلوب'),
  display_order: z.number().min(0, 'ترتيب العرض يجب أن يكون صفر أو أكبر'),
});

/** Convert option adjustment from stored IQD to admin USD input */
function adjustmentIqdToUsd(adjustmentIqd: number, usdToIqd: number): number {
  if (!adjustmentIqd) return 0;
  if (!usdToIqd || usdToIqd <= 0) return adjustmentIqd;
  return Math.round((Number(adjustmentIqd) / usdToIqd) * 100) / 100;
}

/** Convert admin USD input to stored IQD */
function adjustmentUsdToIqd(adjustmentUsd: number, usdToIqd: number): number {
  if (!adjustmentUsd) return 0;
  if (!usdToIqd || usdToIqd <= 0) return Math.round(adjustmentUsd);
  return Math.round(Number(adjustmentUsd) * usdToIqd);
}

/** Inline price preview for product options */
function OptionPricePreview({ adjustment, editingProduct }: { adjustment: number; editingProduct: any }) {
  const { data: ss } = useShippingSettings();
  if (!ss || !editingProduct) return null;
  const rate = ss.usd_to_iqd_rate || 1410;
  const adjIqd = adjustmentUsdToIqd(adjustment || 0, rate);
  const prices: { label: string; value: number }[] = [];
  if (editingProduct.direct_sale_price) prices.push({ label: 'مباشر', value: editingProduct.direct_sale_price + adjIqd });
  if (editingProduct.sea_price) prices.push({ label: 'بحري', value: editingProduct.sea_price + adjIqd });
  if (editingProduct.air_price) prices.push({ label: 'جوي', value: editingProduct.air_price + adjIqd });
  if (prices.length === 0 && editingProduct.price_usd) {
    prices.push({ label: 'تقريبي', value: Math.round(editingProduct.price_usd * rate) + adjIqd });
  }
  if (prices.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {prices.map(p => (
        <span key={p.label} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">
          {'👁'} {p.label}: {p.value.toLocaleString()} د.ع
        </span>
      ))}
    </div>
  );
}

/** Inline price preview for product colors */
function ColorPricePreview({ color, editingProduct }: { color: any; editingProduct: any }) {
  const { data: ss } = useShippingSettings();
  if (!ss || !editingProduct) return null;
  const rate = ss.usd_to_iqd_rate || 1410;
  const prices: { label: string; value: number }[] = [];
  if (color.direct_sale_price) {
    prices.push({ label: 'بيع مباشر', value: color.direct_sale_price });
  } else if (color.price) {
    // color.price is stored in IQD - never convert from USD
    prices.push({ label: 'سعر اللون', value: Math.round(color.price) });
  } else {
    if (editingProduct.direct_sale_price) prices.push({ label: 'مباشر (افتراضي)', value: editingProduct.direct_sale_price });
    if (editingProduct.sea_price) prices.push({ label: 'بحري', value: editingProduct.sea_price });
    if (editingProduct.air_price) prices.push({ label: 'جوي', value: editingProduct.air_price });
  }
  if (prices.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {prices.map(p => (
        <span key={p.label} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">
          {'👁'} {p.label}: {p.value.toLocaleString()} د.ع
        </span>
      ))}
    </div>
  );
}

const Admin = () => {
  const { user, isAdmin, isAssistant, isAdminOrAssistant, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqdRate = shippingSettings?.usd_to_iqd_rate || 1410;
  const [activeTab, setActiveTab] = useState('products');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [mainSectionDialogOpen, setMainSectionDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryMediaUrl, setCategoryMediaUrl] = useState<string | null>(null);
  const [categoryMediaType, setCategoryMediaType] = useState<string | null>(null);
  const [categoryMediaTransparent, setCategoryMediaTransparent] = useState(false);
  const [categoryMediaUploading, setCategoryMediaUploading] = useState(false);
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
    cost_usd?: number;
    cost_iqd?: number;
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
    linked_options?: string[];
    direct_sale_price?: number;
    option_stocks?: Record<string, number>;
    cost_usd?: number;
    cost_iqd?: number;
  }>>([]);
  const [productFeatures, setProductFeatures] = useState<Array<{
    text_ar: string;
    text: string;
    icon?: string;
  }>>([]);
  const [productCardDiscounts, setProductCardDiscounts] = useState<Array<{
    card_id: string;
    discount_amount: number; // Amount in IQD
  }>>([]);
  const [productAIContent, setProductAIContent] = useState<any>({});
  const [productShortSummary, setProductShortSummary] = useState<{ ar?: string; en?: string; ku?: string }>({});
  const [productSearchableAttrs, setProductSearchableAttrs] = useState<string[]>([]);
  const [searchableAttrInput, setSearchableAttrInput] = useState('');
  // preOrderShippingOptions removed - now handled by AdminProductPricingSection
  
  // AI extraction states
  const [productUrl, setProductUrl] = useState('');
  const [extractingInfo, setExtractingInfo] = useState(false);
  const [extractionSteps, setExtractionSteps] = useState<ExtractionStep[]>([]);
  const [extractionFilledFields, setExtractionFilledFields] = useState<string[]>([]);

  const initExtractionSteps = useCallback(() => {
    setExtractionSteps(EXTRACTION_STEP_DEFS.map((s) => ({ ...s, status: 'pending' as const })));
    setExtractionFilledFields([]);
  }, []);

  const advanceExtractionStep = useCallback((key: string, status: 'active' | 'done') => {
    setExtractionSteps((prev) => prev.map((s) => {
      if (s.key === key) return { ...s, status };
      // mark earlier-still-active as done when a later step starts
      if (status === 'active' && s.status === 'active') return { ...s, status: 'done' };
      return s;
    }));
  }, []);

  const markFieldFilled = useCallback((field: string) => {
    setExtractionFilledFields((prev) => (prev.includes(field) ? prev : [...prev, field]));
  }, []);
  const [showManualInput, setShowManualInput] = useState(false);
  const [extractionItemId, setExtractionItemId] = useState<string>('');
  const [extractionPlatform, setExtractionPlatform] = useState<string>('');
  
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
  const [productFeatured, setProductFeatured] = useState(false);
  const [selectedCategoryForPricing, setSelectedCategoryForPricing] = useState<string>('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryMainSectionFilter, setCategoryMainSectionFilter] = useState<string>('all');
  const [formKey, setFormKey] = useState(0); // Key to force form re-render with correct defaults

  // ===== Product draft autosave =====
  const PRODUCT_DRAFT_KEY = 'admin-product-draft-v1';
  const formRef = useRef<HTMLFormElement | null>(null);
  const restoredDraftRef = useRef(false);
  const draftRestoredOnceRef = useRef(false);

  const clearProductDraft = useCallback(() => {
    try { localStorage.removeItem(PRODUCT_DRAFT_KEY); } catch {}
  }, []);

  // Restore draft on first mount
  useEffect(() => {
    if (draftRestoredOnceRef.current) return;
    draftRestoredOnceRef.current = true;
    try {
      const raw = localStorage.getItem(PRODUCT_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || !draft.open) return;
      restoredDraftRef.current = true;
      setEditingProduct(draft.editingProduct ?? null);
      setUploadedImages(Array.isArray(draft.uploadedImages) ? draft.uploadedImages : []);
      setProductOptions(Array.isArray(draft.productOptions) ? draft.productOptions : []);
      setProductColors(Array.isArray(draft.productColors) ? draft.productColors : []);
      setProductFeatures(Array.isArray(draft.productFeatures) ? draft.productFeatures : []);
      setProductCardDiscounts(Array.isArray(draft.productCardDiscounts) ? draft.productCardDiscounts : []);
      setProductAIContent(draft.productAIContent ?? {});
      setProductShortSummary(draft.productShortSummary ?? {});
      setProductSearchableAttrs(Array.isArray(draft.productSearchableAttrs) ? draft.productSearchableAttrs : []);
      setProductUrl(typeof draft.productUrl === 'string' ? draft.productUrl : '');
      setActiveTab('products');
      setProductDialogOpen(true);
      toast.info('تم استرجاع مسودة المنتج المحفوظة');
    } catch (e) {
      console.warn('[Admin] Failed to restore product draft', e);
    }
  }, []);

  // Autosave draft (debounced via interval snapshot of form values)
  useEffect(() => {
    if (!productDialogOpen) return;
    const snapshot = () => {
      try {
        const formValues: Record<string, any> = {};
        if (formRef.current) {
          const fd = new FormData(formRef.current);
          for (const [k, v] of fd.entries()) {
            if (typeof v === 'string') formValues[k] = v;
          }
        }
        const mergedEditing = { ...(editingProduct || {}), ...formValues };
        const draft = {
          open: true,
          editingProduct: mergedEditing,
          uploadedImages,
          productOptions,
          productColors,
          productFeatures,
          productCardDiscounts,
          productAIContent,
          productShortSummary,
          productSearchableAttrs,
          productUrl,
          savedAt: Date.now(),
        };
        localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify(draft));
      } catch (e) {
        // localStorage can throw (quota); ignore
      }
    };
    snapshot();
    const id = window.setInterval(snapshot, 1500);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      snapshot();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [productDialogOpen, editingProduct, uploadedImages, productOptions, productColors, productFeatures, productCardDiscounts, productAIContent, productShortSummary, productSearchableAttrs, productUrl]);



  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, authLoading, navigate]);

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

  // Fetch membership cards for product card discount selection
  const { data: membershipCardsForDiscounts } = useQuery({
    queryKey: ['membership-cards-admin-discounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_cards')
        .select('id, name_ar, name_en, card_key, color')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  // Ensure product options, colors, and features load reliably when opening the editor
  useEffect(() => {
    if (restoredDraftRef.current) {
      // Skip the auto-init once after restoring a saved draft so we don't clobber it
      restoredDraftRef.current = false;
      return;
    }
    if (productDialogOpen && editingProduct) {
      // Initialize from the current product - include stock_quantity from colors
      const colorsWithStock = Array.isArray(editingProduct.colors) 
        ? editingProduct.colors.map((c: any) => ({ ...c, stock_quantity: c.stock_quantity ?? undefined }))
        : [];
      setProductColors(colorsWithStock);
      setProductFeatures(Array.isArray(editingProduct.features) ? editingProduct.features : []);
      setProductAIContent(editingProduct.ai_content && typeof editingProduct.ai_content === 'object' ? editingProduct.ai_content : {});
      setProductShortSummary(
        editingProduct.short_summary && typeof editingProduct.short_summary === 'object'
          ? editingProduct.short_summary
          : {}
      );
      setProductSearchableAttrs(
        Array.isArray(editingProduct.searchable_attributes) ? editingProduct.searchable_attributes : []
      );
      // preOrderShippingOptions removed
      
      // Load card discounts from product
      const cardDiscounts = Array.isArray(editingProduct.card_discounts) ? editingProduct.card_discounts : [];
      setProductCardDiscounts(cardDiscounts.map((d: any) => ({
        card_id: d.card_id || d.level_id || '',
        discount_amount: Number(d.discount_amount || 0),
      })));

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
                  price_adjustment: adjustmentIqdToUsd(Number(opt.price_adjustment), usdToIqdRate),
                  in_stock: opt.in_stock ?? true,
                  image_url: opt.image_url || undefined,
                  available_for_direct_sale: opt.available_for_direct_sale ?? true,
                  available_for_pre_order: opt.available_for_pre_order ?? false,
                  cost_usd: Number((opt as any).cost_usd) || 0,
                  cost_iqd: Number((opt as any).cost_iqd) || 0,
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
      setProductAIContent({});
      setProductShortSummary({});
      setProductSearchableAttrs([]);
      setSearchableAttrInput('');
      setProductUrl(''); // Clear URL when opening for new product
      setFormKey(prev => prev + 1); // Force form to re-render with correct defaults
      
      // preOrderShippingOptions removed - handled by pricing section
    } else if (!productDialogOpen) {
      // Clear URL when closing dialog
      setProductUrl('');
      setFormKey(prev => prev + 1); // Reset form key when closing
    }
  }, [productDialogOpen, editingProduct, defaultSettings]);

  const { data: products, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['admin-products-with-options', isAdminOrAssistant],
    queryFn: async () => {
      const { data: productRows, error } = await (supabase as any)
        .from('products_admin')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const productIds = (productRows || []).map((product: any) => product.id).filter(Boolean);

      const [categoriesResult, optionsResult] = await Promise.all([
        supabase.from('categories').select('id, name_ar'),
        productIds.length > 0
          ? supabase
              .from('product_options')
              .select('id, product_id, in_stock, taobao_available, taobao_sku_id')
              .in('product_id', productIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (optionsResult.error) throw optionsResult.error;

      const categoryMap = new Map((categoriesResult.data || []).map((category: any) => [category.id, category]));
      const optionsByProduct = new Map<string, any[]>();
      (optionsResult.data || []).forEach((option: any) => {
        const list = optionsByProduct.get(option.product_id) || [];
        list.push(option);
        optionsByProduct.set(option.product_id, list);
      });

      return (productRows || []).map((product: any) => ({
        ...product,
        categories: categoryMap.get(product.category_id) || null,
        product_options: optionsByProduct.get(product.id) || [],
      }));
    },
    enabled: isAdminOrAssistant
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
    queryKey: ['admin-stats', isAdminOrAssistant],
    queryFn: async () => {
      const [productsResult, featuredResult, categoriesResult, outOfStockResult, pendingOrdersResult] = await Promise.all([
        (supabase as any).from('products_admin').select('id', { count: 'exact', head: true }),
        (supabase as any).from('products_admin').select('id', { count: 'exact', head: true }).eq('featured', true),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        (supabase as any).from('products_admin').select('id', { count: 'exact', head: true }).eq('in_stock', false),
        (supabase as any).from('orders_admin').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      return {
        totalProducts: productsResult.count || 0,
        featuredProducts: featuredResult.count || 0,
        totalCategories: categoriesResult.count || 0,
        outOfStock: outOfStockResult.count || 0,
        pendingOrders: pendingOrdersResult.count || 0
      };
    },
    enabled: !!isAdminOrAssistant,
    refetchInterval: 60000
  });

  // Refetch when admin/assistant access changes
  useEffect(() => {
    if (isAdminOrAssistant) {
      console.log('Admin/assistant access confirmed, refetching data...');
      refetchRequests();
    }
  }, [isAdminOrAssistant, refetchRequests]);

  const createProduct = useMutation({
    mutationFn: async (values: any) => {
      await adminCreateProduct(values);
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
      clearProductDraft();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إضافة المنتج');
      console.error(error);
    }
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, values }: { id: string, values: any }) => {
      await adminUpdateProduct(id, values);
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
      // Toast handled in handleSubmitProduct
      setProductDialogOpen(false);
      setEditingProduct(null);
      clearProductDraft();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث المنتج');
      console.error(error);
    }
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      await adminDeleteProduct(id);
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
    onError: (error: any) => {
      const msg = error?.message || error?.details || error?.hint || 'حدث خطأ أثناء حذف المنتج';
      toast.error(msg, { duration: 7000 });
      console.error('[deleteProduct]', error);
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
        // If editing an existing product, append directly to its images array
        // so the new images appear immediately in the main draggable grid
        // (allowing set-as-main and reordering without saving first).
        if (editingProduct) {
          const merged = [...(editingProduct.images || []), ...newImageUrls];
          setEditingProduct({
            ...editingProduct,
            images: merged,
            image_url: editingProduct.image_url || merged[0] || null,
          });
        } else {
          setUploadedImages([...uploadedImages, ...newImageUrls]);
        }
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
    initExtractionSteps();
    advanceExtractionStep('fetch', 'active');
    toast.info('جاري فحص إمكانية الاستخراج...');
    
    // Simulate progressive backend phases (since edge function is a single call)
    const phaseTimers: ReturnType<typeof setTimeout>[] = [];
    phaseTimers.push(setTimeout(() => advanceExtractionStep('parse', 'active'), 800));
    phaseTimers.push(setTimeout(() => advanceExtractionStep('price', 'active'), 1800));
    phaseTimers.push(setTimeout(() => advanceExtractionStep('images', 'active'), 2800));
    phaseTimers.push(setTimeout(() => advanceExtractionStep('options', 'active'), 3800));
    phaseTimers.push(setTimeout(() => advanceExtractionStep('ai', 'active'), 4800));

    try {
      const response = await supabase.functions.invoke('extract-product-info', {
        body: { url: productUrl }
      });

      phaseTimers.forEach(clearTimeout);

      if (response.error) {
        // Try to read data even on error - edge function may return useful info
        const errorData = response.data;
        if (errorData?.requiresManualInput) {
          setExtractionItemId(errorData.item_id || '');
          setExtractionPlatform(errorData.platform || 'taobao');
          setShowManualInput(true);
          toast.info(errorData.message || 'يرجى إدخال البيانات يدوياً', { duration: 5000 });
          return;
        }
        if (errorData?.error) {
          setShowManualInput(true);
          toast.error(errorData.error);
          return;
        }
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

      // Mark backend phases as done
      ['fetch','parse','price','images','options','ai'].forEach((k) => advanceExtractionStep(k, 'done'));
      advanceExtractionStep('apply', 'active');

      // Fill form with extracted data
      console.log('[AI Extract] Product info received:', {
        dimensions: productInfo.dimensions,
        weight_kg: productInfo.weight_kg,
        name: productInfo.name
      });
      applyProductInfo(productInfo);
      advanceExtractionStep('apply', 'done');
      toast.success('تم الاستخراج والتعبئة بنجاح');
      
    } catch (error) {
      phaseTimers.forEach(clearTimeout);
      console.error('Error extracting product info:', error);
      setShowManualInput(true);
      toast.error(error instanceof Error ? error.message : 'حدث خطأ أثناء الاستخراج - استخدم الإدخال اليدوي');
    } finally {
      setExtractingInfo(false);
    }
  };

  // Handle extracting URL from pasted messy text
  // Re-run AI extraction: refresh ONLY summary, searchable tags, and AI content
  const handleRerunAIExtraction = async () => {
    if (!productUrl.trim()) {
      toast.error('يرجى إدخال رابط المنتج');
      return;
    }

    setExtractingInfo(true);
    initExtractionSteps();
    advanceExtractionStep('fetch', 'active');
    toast.info('جاري إعادة توليد المحتوى بالذكاء الاصطناعي...');

    const phaseTimers: ReturnType<typeof setTimeout>[] = [];
    phaseTimers.push(setTimeout(() => advanceExtractionStep('parse', 'active'), 700));
    phaseTimers.push(setTimeout(() => advanceExtractionStep('ai', 'active'), 1500));

    try {
      const response = await supabase.functions.invoke('extract-product-info', {
        body: { url: productUrl }
      });

      phaseTimers.forEach(clearTimeout);

      if (response.error) {
        throw new Error(response.error.message || 'فشل في إعادة التوليد');
      }

      const { productInfo, success, error: extractError } = response.data || {};

      if (!success || extractError || !productInfo) {
        toast.error(extractError || 'لم يتم العثور على بيانات للتحديث');
        return;
      }

      ['fetch', 'parse', 'price', 'images', 'options', 'ai'].forEach((k) => advanceExtractionStep(k, 'done'));
      advanceExtractionStep('apply', 'active');

      let updated = 0;

      if (productInfo.short_summary && typeof productInfo.short_summary === 'object') {
        setProductShortSummary({
          ar: productInfo.short_summary.ar || '',
          en: productInfo.short_summary.en || '',
          ku: productInfo.short_summary.ku || '',
        });
        markFieldFilled('short_summary');
        updated++;
      }

      if (Array.isArray(productInfo.searchable_tags) && productInfo.searchable_tags.length > 0) {
        const cleaned = productInfo.searchable_tags
          .map((t: any) => (typeof t === 'string' ? t.trim() : ''))
          .filter((t: string) => t.length > 0);
        setProductSearchableAttrs(Array.from(new Set(cleaned)));
        markFieldFilled('searchable_tags');
        updated++;
      }

      if (productInfo.ai_content && typeof productInfo.ai_content === 'object') {
        setProductAIContent(productInfo.ai_content);
        markFieldFilled('ai_content');
        updated++;
      }

      advanceExtractionStep('apply', 'done');

      if (updated > 0) {
        toast.success(`تم تحديث ${updated} حقل بالذكاء الاصطناعي`);
      } else {
        toast.info('لم يتم العثور على محتوى ذكاء اصطناعي للتحديث');
      }
    } catch (error) {
      phaseTimers.forEach(clearTimeout);
      console.error('Re-run AI extraction error:', error);
      toast.error(error instanceof Error ? error.message : 'حدث خطأ أثناء إعادة التوليد');
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
      markFieldFilled('name_ar');
    }
    if (productInfo.name) {
      const input = form.querySelector('#name') as HTMLInputElement;
      if (input) input.value = productInfo.name;
      markFieldFilled('name');
    }
    if (productInfo.name_ar && productInfo.name) {
      const slug = productInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const input = form.querySelector('#slug') as HTMLInputElement;
      if (input) input.value = slug;
      markFieldFilled('slug');
    }
    if (productInfo.description_ar) {
      const textarea = form.querySelector('#description_ar') as HTMLTextAreaElement;
      if (textarea) textarea.value = productInfo.description_ar;
      markFieldFilled('description_ar');
    }
    if (productInfo.description) {
      const textarea = form.querySelector('#description') as HTMLTextAreaElement;
      if (textarea) textarea.value = productInfo.description;
      markFieldFilled('description');
    }

    // Set price (current price after discount)
    if (productInfo.price && productInfo.price > 0) {
      const priceInput = form.querySelector('#price') as HTMLInputElement;
      if (priceInput) priceInput.value = String(productInfo.price);
      markFieldFilled('price');
    }

    // Set original source price ($) used by the pricing section.
    // The final original_price (IQD) is calculated on save as source × exchange rate only.
    if (productInfo.original_price_usd && productInfo.original_price_usd > 0) {
      const originalPriceUsdInput = form.querySelector('#original_price_usd') as HTMLInputElement;
      if (originalPriceUsdInput) {
        originalPriceUsdInput.value = String(productInfo.original_price_usd);
        originalPriceUsdInput.dispatchEvent(new Event('input', { bubbles: true }));
        originalPriceUsdInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      window.dispatchEvent(new CustomEvent('admin-product-pricing-autofill', {
        detail: { originalPriceUsd: productInfo.original_price_usd }
      }));
      markFieldFilled('original_price');
    } else if (productInfo.original_price && productInfo.original_price > 0) {
      const originalPriceInput = form.querySelector('input[name="original_price"]') as HTMLInputElement;
      if (originalPriceInput) originalPriceInput.value = String(productInfo.original_price);
      markFieldFilled('original_price');
    }

    // Auto-fill SEO short summary (tri-lang)
    if (productInfo.short_summary && typeof productInfo.short_summary === 'object') {
      setProductShortSummary({
        ar: productInfo.short_summary.ar || '',
        en: productInfo.short_summary.en || '',
        ku: productInfo.short_summary.ku || '',
      });
      markFieldFilled('short_summary');
    }

    // Auto-fill searchable tags (keywords)
    if (Array.isArray(productInfo.searchable_tags) && productInfo.searchable_tags.length > 0) {
      const cleaned = productInfo.searchable_tags
        .map((t: any) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t: string) => t.length > 0);
      setProductSearchableAttrs(Array.from(new Set(cleaned)));
      markFieldFilled('searchable_tags');
    }

    // Auto-fill "Why this product" AI content
    if (productInfo.ai_content && typeof productInfo.ai_content === 'object') {
      setProductAIContent(productInfo.ai_content);
      markFieldFilled('ai_content');
    }

    // Auto-fill brand (only when empty, to preserve admin edits)
    if (productInfo.brand && typeof productInfo.brand === 'string') {
      const brandInput = form.querySelector('#brand') as HTMLInputElement | null;
      if (brandInput && !brandInput.value.trim()) {
        brandInput.value = productInfo.brand;
        brandInput.dispatchEvent(new Event('input', { bubbles: true }));
        brandInput.dispatchEvent(new Event('change', { bubbles: true }));
        markFieldFilled('brand');
      }
    }

    // Auto-fill display_order: next available within the same category (only when empty/0)
    try {
      const orderInput = form.querySelector('#display_order') as HTMLInputElement | null;
      const categorySelect = form.querySelector('#category_id') as HTMLSelectElement | null;
      const currentCategoryId = categorySelect?.value || editingProduct?.category_id || null;
      if (orderInput && (!orderInput.value || Number(orderInput.value) === 0) && Array.isArray(products)) {
        const sameCat = currentCategoryId
          ? (products as any[]).filter((p) => p.category_id === currentCategoryId)
          : (products as any[]);
        const maxOrder = sameCat.reduce((m, p) => Math.max(m, Number(p.display_order) || 0), 0);
        orderInput.value = String(maxOrder + 1);
        orderInput.dispatchEvent(new Event('input', { bubbles: true }));
        orderInput.dispatchEvent(new Event('change', { bubbles: true }));
        markFieldFilled('display_order');
      }
    } catch (_) { /* non-fatal */ }

    // Auto-fill packaging dimensions (carton with packaging) and gross weight
    const dims = productInfo.dimensions || {};
    const setNumInput = (selector: string, value: any) => {
      const el = form.querySelector(selector) as HTMLInputElement | null;
      if (!el) return;
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return;
      el.value = String(n);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setNumInput('#length_cm', dims.length_cm);
    setNumInput('#width_cm', dims.width_cm);
    setNumInput('#height_cm', dims.height_cm);
    setNumInput('#weight_kg', productInfo.weight_kg);

    // Notify pricing section to sync its local state for shipping calculation
    if (productInfo.dimensions || productInfo.weight_kg) {
      window.dispatchEvent(new CustomEvent('admin-product-pricing-autofill', {
        detail: {
          length_cm: Number(dims.length_cm) || undefined,
          width_cm: Number(dims.width_cm) || undefined,
          height_cm: Number(dims.height_cm) || undefined,
          weight_kg: Number(productInfo.weight_kg) || undefined,
        },
      }));
    }

    if (productInfo.dimensions) markFieldFilled('dimensions');
    if (productInfo.weight_kg) markFieldFilled('weight_kg');
    if (Array.isArray(productInfo.images) && productInfo.images.length > 0) markFieldFilled('images');
    if (Array.isArray(productInfo.options) && productInfo.options.length > 0) markFieldFilled('options');
    if (Array.isArray(productInfo.colors) && productInfo.colors.length > 0) markFieldFilled('colors');

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

    // Set images - remove duplicates by base URL
    // Note: We no longer exclude option/color images because they might be the only product images available
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
        // Only skip duplicates, don't skip option/color images
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
        available_for_pre_order: color.available_for_pre_order ?? defaultColorPreOrder,
        cost_usd: Number(color.cost_usd) || 0,
        cost_iqd: Number(color.cost_iqd) || 0,
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

    // Shipping calculation now handled by AdminProductPricingSection

    // Hide manual input if it was shown
    setShowManualInput(false);

    const colorsCount = productInfo.colors?.length || 0;
    const optionsCount = optionsData.length || 0;
    const featuresCount = productInfo.features?.length || 0;
    const pointsReward = productInfo.points_reward || 0;
    const hasShippingCalc = productInfo.dimensions || productInfo.weight_kg;
    toast.success(`تم استخراج المعلومات! (${colorsCount} ألوان، ${optionsCount} خيارات، ${featuresCount} مميزات${hasShippingCalc ? '، + سعر الشحن' : ''})`);
  };

  // Publish a pending-review product (admin only). Clears the pending flag and marks pricing updated.
  const handlePublishPendingProduct = async (product: any) => {
    if (!isAdmin) return;
    try {
      await adminUpdateProduct(product.id, {
        pending_admin_review: false,
        is_pricing_updated: true,
        updated_at: new Date().toISOString(),
      } as any);
      queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && (q.queryKey[0] === 'products' || q.queryKey[0] === 'featured-products'),
      });
      toast.success('تم نشر المنتج للمستخدمين');
    } catch (e) {
      console.error('[Admin] publish pending failed:', e);
      toast.error('فشل نشر المنتج');
    }
  };



  // Legacy shipping functions removed - now handled by AdminProductPricingSection

  // Toggle product visibility (is_pricing_updated)
  const handleToggleVisibility = async (product: any) => {
    const newValue = !product.is_pricing_updated;
    try {
      await adminUpdateProduct(product.id, { is_pricing_updated: newValue, updated_at: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
      toast.success(newValue ? 'تم إظهار المنتج للمستخدمين' : 'تم إخفاء المنتج عن المستخدمين');
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('حدث خطأ أثناء تحديث حالة المنتج');
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
      const newProductId = await adminCreateProduct(newValues as any);

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

  // Legacy preOrderShippingOption functions removed

  const handleProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const allImages = editingProduct?.images || [];
      const finalImages = [...allImages, ...uploadedImages];

      const hasInStock = (formData.get('has_in_stock_pricing') as string) === 'true' || (formData.get('has_in_stock') as string) === 'on';
      const hasPreOrder = (formData.get('has_pre_order_pricing') as string) === 'true' || (formData.get('has_pre_order') as string) === 'on';
      
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
      const validColors = productColors.filter(c => c.name_ar.trim() && c.name.trim()).map(c => {
        const costUsd = Number(c.cost_usd) || 0;
        const costIqd = Number(c.cost_iqd) || Math.round(costUsd * usdToIqdRate);
        return {
          ...c,
          stock_quantity: c.stock_quantity ?? undefined,
          cost_usd: costUsd,
          cost_iqd: costIqd,
        };
      });
      const validFeatures = productFeatures.filter(f => f.text_ar.trim() && f.text.trim());
      
      const values = {
        name_ar: formData.get('name_ar') as string,
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description_ar: (formData.get('description_ar') as string) || null,
        description: (formData.get('description') as string) || null,
        price: formData.get('price') && formData.get('price') !== '' ? Number(formData.get('price')) : 0,
        original_price: formData.get('original_price_iqd') && formData.get('original_price_iqd') !== ''
          ? Number(formData.get('original_price_iqd'))
          : (formData.get('original_price') && formData.get('original_price') !== ''
              ? Number(formData.get('original_price'))
              : null),
        // Original price is now entered directly in IQD; clear the legacy USD column.
        original_price_usd: null as number | null,
        cost_price: formData.get('cost_price') && formData.get('cost_price') !== '' 
          ? Number(formData.get('cost_price')) 
          : null,
        direct_sale_price: null as number | null,
        sea_price: null as number | null,
        air_price: null as number | null,
        currency: (formData.get('currency') as string) || 'دينار عراقي',
        images: finalImages.length > 0 ? finalImages : [],
        image_url: finalImages[0] || null,
        category_id: formData.get('category_id') as string,
        featured: productFeatured,
        in_stock: (formData.get('in_stock') as string) === 'on',
        availability_type: availabilityType,
        has_in_stock: hasInStock,
        has_pre_order: hasPreOrder,
        pre_order_shipping_options: [],
        pre_order_free_shipping_price: null,
        pre_order_fast_shipping_price: null,
        display_order: formData.get('display_order') && formData.get('display_order') !== ''
          ? Number(formData.get('display_order'))
          : 0,
        brand: ((formData.get('brand') as string) || '').trim() || null,
        // Use empty array [] instead of undefined to actually clear data
        colors: validColors.length > 0 ? validColors : [],
        features: validFeatures.length > 0 ? validFeatures : [],
        ai_content: productAIContent || {},
        short_summary: productShortSummary || {},
        searchable_attributes: productSearchableAttrs || [],
        // Taobao sync fields
        taobao_url: (formData.get('taobao_url') as string)?.trim() || null,
        // Product rewards - points from form (can be auto-calculated or manually set)
        points_reward: formData.get('points_reward') && formData.get('points_reward') !== '' 
          ? Number(formData.get('points_reward')) 
          : 0,
        // Multiple card discounts as JSON array
        card_discounts: productCardDiscounts.filter(d => d.card_id && d.discount_amount > 0),
        // New USD pricing fields
        price_usd: formData.get('price_usd') && formData.get('price_usd') !== '' 
          ? Number(formData.get('price_usd')) 
          : null,
        shipping_type: (formData.get('shipping_type') as string) || null,
        weight_kg: formData.get('weight_kg') && formData.get('weight_kg') !== '' 
          ? Number(formData.get('weight_kg')) 
          : null,
        length_cm: formData.get('length_cm') && formData.get('length_cm') !== '' 
          ? Number(formData.get('length_cm')) 
          : null,
        width_cm: formData.get('width_cm') && formData.get('width_cm') !== '' 
          ? Number(formData.get('width_cm')) 
          : null,
        height_cm: formData.get('height_cm') && formData.get('height_cm') !== '' 
          ? Number(formData.get('height_cm')) 
          : null,
        // Stock for products without options/colors
        direct_stock: formData.get('direct_stock') && formData.get('direct_stock') !== '' 
          ? Number(formData.get('direct_stock')) 
          : null,
        pre_order_stock: formData.get('pre_order_stock') && formData.get('pre_order_stock') !== '' 
          ? Number(formData.get('pre_order_stock')) 
          : null,
      } as any;

      const priceUsdVal = values.price_usd;
      const commissionIqdVal = formData.get('commission_iqd') ? Number(formData.get('commission_iqd')) : 0;
      const commissionSeaIqdVal = formData.get('commission_sea_iqd') ? Number(formData.get('commission_sea_iqd')) : 0;
      const commissionAirIqdVal = formData.get('commission_air_iqd') ? Number(formData.get('commission_air_iqd')) : 0;
      const commissionDirectIqdVal = formData.get('commission_direct_iqd') ? Number(formData.get('commission_direct_iqd')) : 0;
      const otherCostsIqdVal = formData.get('other_costs_iqd') ? Number(formData.get('other_costs_iqd')) : 0;
      const personalDeliveryCostRaw = formData.get('personal_delivery_cost') ? Number(formData.get('personal_delivery_cost')) : 0;
      const referralEarningsIqdVal = formData.get('referral_earnings_iqd') ? Number(formData.get('referral_earnings_iqd')) : 0;
      
      // Only apply personal delivery cost for printer categories (categories linked to personal delivery method)
      const selectedCategoryId = values.category_id;
      let personalDeliveryCostVal = 0;
      if (personalDeliveryCostRaw > 0 && selectedCategoryId) {
        const { data: pdMethods } = await supabase
          .from('delivery_methods')
          .select('base_price_category_id')
          .not('base_price_category_id', 'is', null);
        const printerCategoryIds = (pdMethods || []).map((m: any) => m.base_price_category_id);
        if (printerCategoryIds.includes(selectedCategoryId)) {
          personalDeliveryCostVal = personalDeliveryCostRaw;
        }
      }
      
      values.commission_iqd = commissionIqdVal;
      values.commission_sea_iqd = commissionSeaIqdVal;
      values.commission_air_iqd = commissionAirIqdVal;
      values.commission_direct_iqd = commissionDirectIqdVal;
      values.other_costs_iqd = otherCostsIqdVal;
      values.personal_delivery_cost = personalDeliveryCostVal;
      values.referral_earnings_iqd = referralEarningsIqdVal;
      values.cod_enabled = formData.get('cod_enabled') === 'true';
      values.link_direct_commission_to_cod = formData.get('link_direct_commission_to_cod') === 'true';

      if (priceUsdVal && priceUsdVal > 0) {
        // Fetch shipping settings for calculation
        const { data: settingsData } = await supabase
          .from('shipping_settings')
          .select('setting_key, setting_value');
        
        const settings: any = {
          sea_cbm_price: 350000, sea_padding_cm: 5,
          air_china_volumetric_price: 15000, air_china_volumetric_divider: 5000,
          air_china_weight_safety_margin: 20,
          local_delivery_baghdad: 6000, local_delivery_provinces: 5000,
          usd_to_iqd_rate: 1410,
        };
        settingsData?.forEach((item: any) => {
          if (item.setting_key in settings) settings[item.setting_key] = Number(item.setting_value);
        });

        const priceIqd = Math.round(priceUsdVal * settings.usd_to_iqd_rate);
        const shippingType = values.shipping_type;
        
        // Calculate prices for each active mode and use the lowest for the main price
        const prices: number[] = [];

        if (hasPreOrder) {
          const dims = (values.length_cm > 0 || values.width_cm > 0 || values.height_cm > 0)
            ? { length: values.length_cm || 0, width: values.width_cm || 0, height: values.height_cm || 0 }
            : null;

          if (shippingType === 'sea' || shippingType === 'both') {
            const seaCalc = calculateShippingCost('china', 'sea', dims, null, settings);
            const seaFinalPrice = priceIqd + seaCalc.shippingCost + commissionSeaIqdVal + personalDeliveryCostVal + referralEarningsIqdVal;
            prices.push(seaFinalPrice);
            values.sea_price = seaFinalPrice;
            values.shipping_cost_iqd = seaCalc.shippingCost;
          }
          if (shippingType === 'air' || shippingType === 'both') {
            const airCalc = calculateShippingCost('china', 'air', dims, values.weight_kg > 0 ? values.weight_kg : null, settings);
            const airFinalPrice = priceIqd + airCalc.shippingCost + commissionAirIqdVal + personalDeliveryCostVal + referralEarningsIqdVal;
            prices.push(airFinalPrice);
            values.air_price = airFinalPrice;
            if (!values.shipping_cost_iqd) values.shipping_cost_iqd = airCalc.shippingCost;
          }

          // Auto-populate pre_order_shipping_options when both sea & air exist
          if (shippingType === 'both' && values.sea_price && values.air_price) {
            const basePreOrderPrice = Math.min(values.sea_price, values.air_price);
            values.pre_order_shipping_options = [
              { name_ar: 'شحن بحري', price_adjustment: values.sea_price - basePreOrderPrice },
              { name_ar: 'شحن جوي', price_adjustment: values.air_price - basePreOrderPrice },
            ];
          }
        }

        if (hasInStock) {
          // Direct sale final price reuses the pre-order shipping (sea preferred, else air)
          // and includes the corresponding pre-order commission addon.
          const dims = (values.length_cm > 0 || values.width_cm > 0 || values.height_cm > 0)
            ? { length: values.length_cm || 0, width: values.width_cm || 0, height: values.height_cm || 0 }
            : null;
          let directShipping = 0;
          let preOrderCommissionAddon = 0;
          if (hasPreOrder) {
            if (shippingType === 'sea' || shippingType === 'both') {
              directShipping = calculateShippingCost('china', 'sea', dims, null, settings).shippingCost;
              preOrderCommissionAddon = commissionSeaIqdVal;
            } else if (shippingType === 'air') {
              directShipping = calculateShippingCost('china', 'air', dims, values.weight_kg > 0 ? values.weight_kg : null, settings).shippingCost;
              preOrderCommissionAddon = commissionAirIqdVal;
            }
          }

          // When the product is linked to the global COD %, derive the direct
          // commission live from the pre-order base. This keeps DB and the UI
          // (cart/product detail) in lock-step using the same formula as
          // `computeLinkedDirectSalePrice` in `priceGuard.ts`.
          let directCommission = commissionDirectIqdVal;
          if (values.link_direct_commission_to_cod) {
            const { data: codSetting } = await supabase
              .from('default_settings')
              .select('setting_value')
              .eq('setting_key', 'partial_payment_settings')
              .single();
            const cv: any = codSetting?.setting_value || {};
            const preorderBase = priceIqd + directShipping + preOrderCommissionAddon + personalDeliveryCostVal + referralEarningsIqdVal;

            // Prefer per-amount tiers; fall back to legacy default
            let codType: 'percentage' | 'fixed' = (cv.cod_default_fee_type || 'percentage') as 'percentage' | 'fixed';
            let codValue = Number(cv.cod_default_fee_value) || 0;
            if (Array.isArray(cv.fee_tiers) && cv.fee_tiers.length > 0) {
              const tier = cv.fee_tiers.find(
                (t: any) =>
                  preorderBase >= Number(t.min_amount || 0) &&
                  preorderBase <= Number(t.max_amount || 0)
              );
              if (tier && tier.cod_fee_value != null) {
                codType = (tier.cod_fee_type ?? 'percentage') as 'percentage' | 'fixed';
                codValue = Number(tier.cod_fee_value) || 0;
              }
            }

            if (codValue > 0) {
              directCommission = codType === 'fixed'
                ? Math.ceil(codValue)
                : Math.ceil((preorderBase * codValue) / 100);
              // Mirror back to the stored field so admin UI stays consistent.
              values.commission_direct_iqd = directCommission;
            }
          }

          const directFinalPrice = priceIqd + otherCostsIqdVal + directShipping + preOrderCommissionAddon + directCommission + personalDeliveryCostVal + referralEarningsIqdVal;
          prices.push(directFinalPrice);
          values.direct_sale_price = directFinalPrice;
        }

        // Round up logic
        const shouldRoundUp = formData.get('round_up_price') === 'true';
        const roundUpTo250 = (v: number) => Math.ceil(v / 250) * 250;
        
        if (shouldRoundUp) {
          if (values.sea_price) values.sea_price = roundUpTo250(values.sea_price);
          if (values.air_price) values.air_price = roundUpTo250(values.air_price);
          if (values.direct_sale_price) values.direct_sale_price = roundUpTo250(values.direct_sale_price);
          // Recalculate prices array with rounded values
          const roundedPrices: number[] = [];
          if (values.sea_price) roundedPrices.push(values.sea_price);
          if (values.air_price) roundedPrices.push(values.air_price);
          if (values.direct_sale_price) roundedPrices.push(values.direct_sale_price);
          prices.length = 0;
          roundedPrices.forEach(p => prices.push(p));

          // Recalculate shipping options with rounded prices
          if (values.shipping_type === 'both' && values.sea_price && values.air_price) {
            const basePreOrderPrice = Math.min(values.sea_price, values.air_price);
            values.pre_order_shipping_options = [
              { name_ar: 'شحن بحري', price_adjustment: values.sea_price - basePreOrderPrice },
              { name_ar: 'شحن جوي', price_adjustment: values.air_price - basePreOrderPrice },
            ];
          }

          // Round colors prices (IQD values)
          if (Array.isArray(values.colors)) {
            values.colors = values.colors.map((c: any) => ({
              ...c,
              price: c.price ? roundUpTo250(Number(c.price)) : c.price,
              direct_sale_price: c.direct_sale_price ? roundUpTo250(Number(c.direct_sale_price)) : c.direct_sale_price,
            }));
          }
        }

        values.round_up_price = shouldRoundUp;

        // Use the lowest price as the main display price
        values.price = prices.length > 0 ? Math.min(...prices) : priceIqd;
        values.is_pricing_updated = true;
        // When an admin edits a pending product (filling costs/commission), auto-publish it.
        if (isAdmin && editingProduct?.pending_admin_review) {
          (values as any).pending_admin_review = false;
        }

        // Original price is entered directly in IQD by the admin (no USD conversion).
        // Apply optional rounding to nearest 250 if the toggle is on.
        if (values.original_price && values.original_price > 0) {
          let origPriceIqd = Math.round(Number(values.original_price));
          if (shouldRoundUp) {
            origPriceIqd = roundUpTo250(origPriceIqd);
          }
          values.original_price = origPriceIqd;
        } else {
          values.original_price = null;
        }
      }

      // Validate with zod
      productSchema.parse(values);

      let productId = editingProduct?.id;

      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, values });
      } else {
        productId = await adminCreateProduct(values as any);
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
          .map(opt => {
            const adj = adjustmentUsdToIqd(Number(opt.price_adjustment || 0), usdToIqdRate);
            const costUsd = Number(opt.cost_usd) || 0;
            const costIqd = Number(opt.cost_iqd) || Math.round(costUsd * usdToIqdRate);
            return {
              product_id: productId,
              name: opt.name,
              name_ar: opt.name_ar,
              price_adjustment: adj,
              in_stock: opt.in_stock,
              image_url: opt.image_url || null,
              stock_quantity: opt.stock_quantity ?? null,
              available_for_direct_sale: opt.available_for_direct_sale ?? true,
              available_for_pre_order: opt.available_for_pre_order ?? false,
              cost_usd: costUsd,
              cost_iqd: costIqd,
            };
          });

        if (optionsToInsert.length > 0) {
          const { error: optionsError } = await supabase
            .from('product_options')
            .insert(optionsToInsert);
          
          if (optionsError) throw optionsError;
        }
      }

      // Sync featured product with category
      if (productId && values.category_id) {
        if (values.featured) {
          // Set this product as the category's featured product
          await supabase
            .from('categories')
            .update({ featured_product_id: productId })
            .eq('id', values.category_id);
          // Unfeature other products in the same category
          const featuredProducts = (products || []).filter((p: any) => p.category_id === values.category_id && p.id !== productId && p.featured);
          await Promise.all(featuredProducts.map((p: any) => adminUpdateProduct(p.id, { featured: false })));
        } else {
          // If this product was the featured one, clear it
          await supabase
            .from('categories')
            .update({ featured_product_id: null })
            .eq('id', values.category_id)
            .eq('featured_product_id', productId);
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
            k[0] === 'admin-products' ||
            k[0] === 'categories' ||
            k[0] === 'category'
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
      clearProductDraft();

      // Auto-translate product to English and Kurdish (non-blocking)
      if (productId && values.name_ar) {
        toast.info('جارٍ ترجمة المنتج...');
        supabase.functions.invoke('translate-product', {
          body: {
            product_id: productId,
            name_ar: values.name_ar,
            description_ar: values.description_ar || null,
          }
        }).then(({ error: translateError }) => {
          if (translateError) {
            console.error('Translation error:', translateError);
            toast.error('فشل في ترجمة المنتج تلقائياً');
          } else {
            toast.success('تم ترجمة المنتج بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-products-with-options'] });
            queryClient.invalidateQueries({
              predicate: (q) => {
                const k = q.queryKey as unknown[];
                return Array.isArray(k) && (k[0] === 'products' || k[0] === 'product');
              },
            });
          }
        });
      }
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
      const featuredVal = editingCategory?.featured_product_id || '';
      const mainSectionVal = formData.get('main_section_id') as string;
      const values = categorySchema.parse({
        name_ar: formData.get('name_ar') as string,
        name: formData.get('name') as string,
        name_en: (formData.get('name_en') as string) || undefined,
        name_ku: (formData.get('name_ku') as string) || undefined,
        slug: formData.get('slug') as string,
        icon: formData.get('icon') as string,
        description_ar: formData.get('description_ar') as string || undefined,
        description: formData.get('description') as string || undefined,
        description_en: (formData.get('description_en') as string) || undefined,
        description_ku: (formData.get('description_ku') as string) || undefined,
        main_section_id: mainSectionVal || undefined,
        featured_product_id: featuredVal || null,
        media_url: categoryMediaUrl,
        media_type: categoryMediaType,
        media_transparent: categoryMediaTransparent,
      });

      if (editingCategory) {
        updateCategory.mutate({ id: editingCategory.id, values });
      } else {
        createCategory.mutate(values);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        console.error('Category validation error:', error.errors);
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

  if (authLoading || !isAdminOrAssistant) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i=><div key={i} className="rounded-lg border bg-card p-4"><div className="h-3 w-16 rounded bg-muted animate-pulse mb-2" /><div className="h-7 w-20 rounded bg-muted animate-pulse" /></div>)}</div>
          <div className="rounded-lg border overflow-hidden"><div className="bg-muted/50 p-3 flex gap-4">{[1,2,3,4,5,6].map(i=><div key={i} className="h-4 flex-1 rounded bg-muted animate-pulse" />)}</div>{[1,2,3,4,5].map(i=><div key={i} className="p-3 flex gap-4 border-t">{[1,2,3,4,5,6].map(j=><div key={j} className="h-4 flex-1 rounded bg-muted animate-pulse" />)}</div>)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page relative">
      {/* Subtle background decoration */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-0 left-0 w-64 h-64 bg-ring/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-3xl" />
      </div>
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Admin Header */}
        <div className="admin-header">
          <h1>لوحة التحكم</h1>
          <p>إدارة شاملة للمنتجات والأقسام والإعدادات</p>
        </div>
        {/* Warning: Products missing cost_price — hidden from assistants */}
        {isAdmin && (() => {
          const missingCostProducts = products?.filter((p: any) => !p.cost_price || p.cost_price <= 0) || [];
          if (missingCostProducts.length === 0) return null;
          return (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-600 dark:text-amber-400 mb-1">⚠️ تحذير: {missingCostProducts.length} منتج بدون سعر تكلفة</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">يجب تحديث سعر التكلفة لجميع المنتجات لحساب الأرباح بدقة.</p>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {missingCostProducts.slice(0, 10).map((p: any) => (
                      <Badge key={p.id} variant="outline" className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                        {p.name_ar}
                      </Badge>
                    ))}
                    {missingCostProducts.length > 10 && (
                      <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                        +{missingCostProducts.length - 10} أخرى
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Statistics Cards */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-2.5 mb-6">
          <div className="admin-stat-card text-center">
            <div className="admin-stat-value text-lg md:text-xl">{stats?.totalProducts || 0}</div>
            <div className="admin-stat-label">المنتجات</div>
          </div>

          <div className="admin-stat-card text-center">
            <div className="admin-stat-value text-lg md:text-xl">{stats?.totalCategories || 0}</div>
            <div className="admin-stat-label">الأقسام</div>
          </div>

          <div 
            className="admin-stat-card text-center cursor-pointer relative"
            onClick={() => navigate(ADMIN_ROUTES.orders + '?status=pending')}
          >
            <div className="admin-stat-value text-lg md:text-xl text-amber-500">{stats?.pendingOrders || 0}</div>
            <div className="admin-stat-label">معلقة</div>
            {stats?.pendingOrders && stats.pendingOrders > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full animate-pulse"
              >
                {stats.pendingOrders}
              </Badge>
            )}
          </div>

          <div 
            className="admin-stat-card text-center cursor-pointer"
            onClick={() => navigate(ADMIN_ROUTES.orders)}
          >
            <div className="flex justify-center mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="text-xs font-semibold text-foreground">الطلبات</div>
          </div>

          <div 
            className="admin-stat-card text-center cursor-pointer relative"
            onClick={() => setActiveTab('custom-requests')}
          >
            <div className="admin-stat-value text-lg md:text-xl text-orange-500">{pendingRequestsCount || 0}</div>
            <div className="admin-stat-label">خاصة</div>
            {pendingRequestsCount && pendingRequestsCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full animate-pulse"
              >
                !
              </Badge>
            )}
          </div>
        </div>

        {/* Permissions Health Panel - diagnoses 403/permission errors */}
        <PermissionsHealthPanel />

        {/* Quick Actions - Settings & Management */}
        <div className="admin-card mb-6">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Bell className="h-4 w-4 text-primary" />
              الإعدادات والإدارة
            </div>
          </div>
          <div className="admin-card-content">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-2.5">
              {([
                { icon: Bell, title: 'الإشعارات', desc: 'إرسال إشعارات', path: ADMIN_ROUTES.notifications },
                { icon: Megaphone, title: 'الشريط الإخباري', desc: 'إعلانات متحركة', path: ADMIN_ROUTES.announcements },
                { icon: Ticket, title: 'الكوبونات', desc: 'خصومات', path: ADMIN_ROUTES.coupons },
                { icon: Package, title: 'الطلبات', desc: 'تتبع وإدارة', path: ADMIN_ROUTES.orders },
                { icon: Package, title: 'البندلات', desc: 'باقات منتجات', path: ADMIN_ROUTES.productBundles },
                { icon: FileText, title: 'طلبات مخصصة', desc: 'مراجعة', action: () => setActiveTab('custom-requests'), badge: pendingRequestsCount },
                { icon: Zap, title: 'الافتراضية', desc: 'قيم افتراضية', path: ADMIN_ROUTES.defaultSettings },
                { icon: Coins, title: 'النقاط', desc: 'مكافآت', path: ADMIN_ROUTES.pointsSettings },
                { icon: Award, title: 'الولاء', desc: 'مستويات', path: ADMIN_ROUTES.loyaltyLevels },
                { icon: Ticket, title: 'أكواد الولاء', desc: 'تفعيل البطاقات', path: ADMIN_ROUTES.loyaltyCardCodes },
                { icon: Wallet, title: 'المحفظة', desc: 'أرصدة', path: ADMIN_ROUTES.wallet },
                { icon: MessageCircle, title: 'المحادثات', desc: 'دعم', path: ADMIN_ROUTES.chats },
                { icon: Receipt, title: 'الفواتير', desc: 'قوالب', path: ADMIN_ROUTES.invoiceTemplates },
                { icon: FileText, title: 'فواتير محفوظة', desc: 'مراجعة', path: ADMIN_ROUTES.savedInvoices },
                { icon: TrendingUp, title: 'المالية', desc: 'تحليلات', path: ADMIN_ROUTES.financials, adminOnly: true },
                { icon: Heart, title: 'التبرعات', desc: 'سجل ومراجعة', path: ADMIN_ROUTES.donations },
                { icon: Percent, title: 'دفع جزئي', desc: 'رسوم', path: ADMIN_ROUTES.partialPaymentSettings },
                { icon: Trophy, title: 'المسابقات', desc: 'سحوبات', path: ADMIN_ROUTES.competitions },
                { icon: Gift, title: 'العروض', desc: 'منتجات', path: ADMIN_ROUTES.productOffers },
                { icon: Shield, title: 'الحماية', desc: 'طابعات', path: ADMIN_ROUTES.printerProtection },
                { icon: Truck, title: 'الشحن', desc: 'إعدادات', path: ADMIN_ROUTES.shippingSettings },
                { icon: Sparkles, title: 'مجتمع ليفو', desc: 'تجار وعملاء', path: ADMIN_ROUTES.levoCommunity },
                { icon: Users, title: 'المستخدمين', desc: 'إدارة', path: ADMIN_ROUTES.users },
                { icon: ImageIcon, title: 'ستوريات', desc: 'فيديوهات', path: ADMIN_ROUTES.stories },
                { icon: Music, title: 'الألعاب', desc: 'إعدادات', path: ADMIN_ROUTES.gamesSettings },
                { icon: BadgeDollarSign, title: 'مطابقة أسعار', desc: 'طلبات', path: ADMIN_ROUTES.priceMatch },
                { icon: Sparkles, title: 'الأمنيات', desc: 'مراجعة', path: ADMIN_ROUTES.wishes },
                { icon: Star, title: 'التقييمات', desc: 'موافقة', path: ADMIN_ROUTES.reviews },
                { icon: BadgeDollarSign, title: 'حماية السعر', desc: 'استرداد فرق', path: ADMIN_ROUTES.priceProtection },
                { icon: Trophy, title: 'الفائزون', desc: 'جوائز', path: ADMIN_ROUTES.winners },
                { icon: Flag, title: 'فحص الألوان', desc: 'مطابقة الصور', path: ADMIN_ROUTES.productColorQa },
                { icon: Sparkles, title: 'فلمنت عشوائي', desc: 'إعدادات وحظر', path: ADMIN_ROUTES.randomFilament },
                { icon: BadgeDollarSign, title: 'تسعير الطباعة 3D', desc: 'مواد ومحرك السعر', path: ADMIN_ROUTES.printMaterials },
                { icon: ShieldCheck, title: 'المساعدون', desc: 'إدارة صلاحيات', path: ADMIN_ROUTES.assistants, adminOnly: true },
              ] as Array<{ icon: any; title: string; desc: string; path?: string; action?: () => void; badge?: number; adminOnly?: boolean }>)
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => item.path ? navigate(item.path) : item.action?.()}
                  className="admin-action-btn relative"
                >
                  <div className="icon-wrapper">
                    <item.icon />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="btn-title">{item.title}</span>
                    <span className="btn-desc">{item.desc}</span>
                  </div>
                  {item.badge && item.badge > 0 && (
                    <Badge 
                      variant="destructive"
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full"
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
        <div className="admin-card mb-6">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Plus className="h-4 w-4 text-primary" />
              إضافة محتوى جديد
            </div>
          </div>
          <div className="admin-card-content">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3">
              <Button
                onClick={() => {
                  setActiveTab('products');
                  setEditingProduct(null);
                  setProductFeatured(defaultSettings?.featured ?? false);
                  setUploadedImages([]);
                  setProductOptions([]);
                  setProductColors([]);
                  setProductFeatures([]);
                  setProductDialogOpen(true);
                }}
                className="admin-btn-primary gap-2 h-auto py-5 flex-col rounded-xl"
              >
                <Plus className="h-7 w-7 md:h-8 md:w-8" />
                <span className="text-xs font-semibold">منتج جديد</span>
              </Button>
              
              <Button
                onClick={() => {
                  setActiveTab('categories');
                  setEditingCategory(null);
                  setCategoryDialogOpen(true);
                }}
                className="admin-btn-primary gap-2 h-auto py-5 flex-col rounded-xl"
              >
                <FolderOpen className="h-7 w-7 md:h-8 md:w-8" />
                <span className="text-xs font-semibold">قسم جديد</span>
              </Button>
              
              <Button
                onClick={() => {
                  setActiveTab('main-sections');
                  setEditingMainSection(null);
                  setMainSectionDialogOpen(true);
                }}
                className="admin-btn-primary gap-2 h-auto py-5 flex-col rounded-xl"
              >
                <FolderOpen className="h-7 w-7 md:h-8 md:w-8" />
                <span className="text-xs font-semibold">قسم رئيسي</span>
              </Button>
              
              <Button
                onClick={() => navigate(ADMIN_ROUTES.productBundles)}
                className="admin-btn-primary gap-2 h-auto py-5 flex-col rounded-xl"
              >
                <Package className="h-7 w-7 md:h-8 md:w-8" />
                <span className="text-xs font-semibold">بندل جديد</span>
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
                
                <Button
                  onClick={() => setProductDialogOpen(true)}
                  className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                  disabled={!isAdmin}
                  title={!isAdmin ? 'هذه الميزة للأدمن فقط' : undefined}
                  style={!isAdmin ? { display: 'none' } : undefined}
                >
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة منتج جديد
                </Button>
                {productDialogOpen && (
                  <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 border-b bg-background/95 backdrop-blur">
                      <h2 className="text-lg font-bold">{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const ok = window.confirm('سيتم حذف المسودة المحفوظة. هل تريد المتابعة؟');
                          if (!ok) return;
                          setProductDialogOpen(false);
                          setEditingProduct(null);
                          setUploadedImages([]);
                          setProductOptions([]);
                          setProductColors([]);
                          setProductFeatures([]);
                          clearProductDraft();
                        }}
                      >
                        إغلاق
                      </Button>
                    </div>
                    <div className="max-w-3xl mx-auto p-4">
                  <form ref={formRef} key={editingProduct?.id || `new-${formKey}`} onSubmit={handleProductSubmit} className="space-y-4">

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
                      <div className="flex gap-2 flex-wrap">
                        <Input
                          placeholder="https://example.com/product"
                          value={productUrl}
                          onChange={(e) => setProductUrl(e.target.value)}
                          disabled={extractingInfo}
                          className="flex-1 min-w-[200px]"
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRerunAIExtraction}
                          disabled={extractingInfo || !productUrl.trim()}
                          className="gap-2"
                          title="إعادة توليد الملخص والكلمات المفتاحية ومحتوى الذكاء الاصطناعي فقط"
                        >
                          {extractingInfo ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          إعادة توليد بالذكاء
                        </Button>
                      </div>
                      <ExtractionProgress
                        active={extractingInfo}
                        steps={extractionSteps}
                        filledFields={extractionFilledFields}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="name_ar">الاسم بالعربي *</Label>
                        <Input 
                          id="name_ar" 
                          name="name_ar" 
                          defaultValue={editingProduct?.name_ar}
                          required 
                        />
                        <p className="text-[10px] text-muted-foreground">يُترجم تلقائياً للإنجليزية والكردية عند العرض</p>
                      </div>
                      {/* English name auto-filled from Arabic; translated lazily by translate-product */}
                      <input type="hidden" name="name" defaultValue={editingProduct?.name || ''} />
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

                    <div className="space-y-2">
                      <Label htmlFor="description_ar">الوصف بالعربي</Label>
                      <Textarea 
                        id="description_ar" 
                        name="description_ar"
                        defaultValue={editingProduct?.description_ar}
                        rows={3}
                      />
                      <p className="text-[10px] text-muted-foreground">يُترجم تلقائياً للإنجليزية والكردية عند العرض</p>
                      <input type="hidden" name="description" defaultValue={editingProduct?.description || ''} />
                    </div>

                    {/* Price fields moved to AdminProductPricingSection */}
                    <input type="hidden" name="price" value={editingProduct?.price ?? 0} />
                    <input type="hidden" name="currency" value="دينار عراقي" />

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
                          <p className="text-xs text-muted-foreground">النقاط التي يحصل عليها العميل عند الشراء (تحسب تلقائياً: 1 نقطة لكل 1000 دينار)</p>
                        </div>
                        
                        {/* Multiple Card Discounts */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>خصومات البطاقات (بالدينار)</Label>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setProductCardDiscounts([...productCardDiscounts, { card_id: '', discount_amount: 0 }])}
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
                                      value={discount.card_id}
                                      onChange={(e) => {
                                        const updated = [...productCardDiscounts];
                                        updated[index] = { ...updated[index], card_id: e.target.value };
                                        setProductCardDiscounts(updated);
                                      }}
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                    >
                                      <option value="">اختر البطاقة</option>
                                      {membershipCardsForDiscounts?.map((card) => (
                                        <option key={card.id} value={card.id}>
                                          {card.name_ar || card.name_en || card.card_key}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="w-32">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={discount.discount_amount || ''}
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

                    {/* New USD Pricing Section */}
                    <AdminProductPricingSection editingProduct={editingProduct} categoryId={selectedCategoryForPricing || editingProduct?.category_id} />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <input id="featured" name="featured" type="checkbox" checked={productFeatured} onChange={(e) => setProductFeatured(e.target.checked)} />
                        <Label htmlFor="featured">مميز (يظهر في الرئيسية)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input id="in_stock" name="in_stock" type="checkbox" defaultChecked={editingProduct?.in_stock ?? defaultSettings?.in_stock ?? true} />
                        <Label htmlFor="in_stock">متاح في المخزون</Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="display_order">ترتيب العرض (1، 2، 3 ...)</Label>
                        <Input
                          id="display_order"
                          name="display_order"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={editingProduct?.display_order ?? 0}
                          placeholder="0 = ترتيب تلقائي"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="brand">الشركة المصنعة / البراند</Label>
                        <Input
                          id="brand"
                          name="brand"
                          type="text"
                          defaultValue={editingProduct?.brand ?? ''}
                          placeholder="مثال: Bambu Lab، Creality، Qidi، Anycubic"
                        />
                      </div>
                    </div>

                    {/* Availability options now managed by AdminProductPricingSection */}

                    <div className="space-y-2">
                      <Label htmlFor="category_id">القسم *</Label>
                      <select
                        id="category_id"
                        name="category_id"
                        defaultValue={editingProduct?.category_id}
                        required
                        onChange={(e) => setSelectedCategoryForPricing(e.target.value)}
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

                    {/* Product Stock (only when no options and no colors) */}
                    {productOptions.length === 0 && productColors.length === 0 && (
                      <div className="space-y-3 border-t pt-4">
                        <Label className="text-sm font-medium">ستوك المنتج (بدون خيارات/ألوان)</Label>
                        <p className="text-xs text-muted-foreground">حدد الكمية المتوفرة للبيع المباشر أو الحجز المسبق</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="direct_stock" className="text-xs">ستوك البيع المباشر</Label>
                            <Input
                              id="direct_stock"
                              name="direct_stock"
                              type="number"
                              min="0"
                              placeholder="غير محدود"
                              defaultValue={editingProduct?.direct_stock ?? ''}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="pre_order_stock" className="text-xs">ستوك الحجز المسبق</Label>
                            <Input
                              id="pre_order_stock"
                              name="pre_order_stock"
                              type="number"
                              min="0"
                              placeholder="غير محدود"
                              defaultValue={editingProduct?.pre_order_stock ?? ''}
                            />
                          </div>
                        </div>
                      </div>
                    )}

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
                                {isAdmin && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">فرق السعر بالدولار ($)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={option.price_adjustment}
                                      onChange={(e) => updateProductOption(index, 'price_adjustment', Number(e.target.value))}
                                      placeholder="0"
                                      className="h-9"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      أدخل رقم موجب للإضافة أو سالب للخصم (بالدولار)
                                    </p>
                                    <OptionPricePreview
                                      adjustment={option.price_adjustment}
                                      editingProduct={editingProduct}
                                    />
                                  </div>
                                )}

                                {/* Cost per option (visible to both admin and assistant) */}
                                <div className="grid grid-cols-2 gap-2 p-2 rounded-md bg-amber-500/5 border border-amber-500/20">
                                  <div className="space-y-1">
                                    <Label className="text-xs">تكلفة الخيار ($)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={option.cost_usd ?? ''}
                                      onChange={(e) => {
                                        const v = Number(e.target.value) || 0;
                                        updateProductOption(index, 'cost_usd', v);
                                        updateProductOption(index, 'cost_iqd', Math.round(v * usdToIqdRate));
                                      }}
                                      placeholder="0.00"
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">التكلفة (د.ع)</Label>
                                    <Input
                                      type="number"
                                      step="250"
                                      min="0"
                                      value={option.cost_iqd ?? ''}
                                      onChange={(e) => updateProductOption(index, 'cost_iqd', Number(e.target.value) || 0)}
                                      placeholder="0"
                                      className="h-9"
                                    />
                                  </div>
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
                                  {isAdmin && (
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
                                      <ColorPricePreview color={color} editingProduct={editingProduct} />
                                    </div>
                                  )}
                                </div>

                                {/* Cost per color (visible to both admin and assistant) */}
                                <div className="grid grid-cols-2 gap-2 p-2 rounded-md bg-amber-500/5 border border-amber-500/20">
                                  <div className="space-y-1">
                                    <Label className="text-xs">تكلفة اللون ($)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={color.cost_usd ?? ''}
                                      onChange={(e) => {
                                        const v = Number(e.target.value) || 0;
                                        updateProductColor(index, 'cost_usd', v);
                                        updateProductColor(index, 'cost_iqd', Math.round(v * usdToIqdRate));
                                      }}
                                      placeholder="0.00"
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">التكلفة (د.ع)</Label>
                                    <Input
                                      type="number"
                                      step="250"
                                      min="0"
                                      value={color.cost_iqd ?? ''}
                                      onChange={(e) => updateProductColor(index, 'cost_iqd', Number(e.target.value) || 0)}
                                      placeholder="0"
                                      className="h-9"
                                    />
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

                                 {/* ربط اللون بالخيارات */}
                                 {productOptions.length > 0 && (
                                   <div className="space-y-2 pt-2 border-t border-border/50">
                                     <Label className="text-xs font-medium">الخيارات المتاحة لهذا اللون</Label>
                                     <p className="text-[10px] text-muted-foreground">اترك الكل بدون تحديد = متاح لجميع الخيارات</p>
                                     <div className="flex flex-wrap gap-2">
                                       {productOptions.map((opt, optIdx) => {
                                         const isLinked = color.linked_options?.includes(opt.name_ar) ?? false;
                                         return (
                                           <label key={optIdx} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2 py-1 cursor-pointer hover:bg-muted transition-colors">
                                             <input
                                               type="checkbox"
                                               checked={isLinked}
                                               onChange={(e) => {
                                                 const current = color.linked_options || [];
                                                 const updated = e.target.checked
                                                   ? [...current, opt.name_ar]
                                                   : current.filter(o => o !== opt.name_ar);
                                                 updateProductColor(index, 'linked_options', updated.length > 0 ? updated : undefined);
                                               }}
                                               className="h-3 w-3 rounded"
                                             />
                                             {opt.name_ar}
                                           </label>
                                         );
                                       })}
                                     </div>
                                   </div>
                                 )}

                                 {/* سعر البيع المباشر والمخزون */}
                                 {color.available_for_direct_sale && (
                                   <div className="space-y-2 pt-2 border-t border-border/50">
                                     <Label className="text-xs font-medium">إعدادات البيع المباشر</Label>
                                     <div className="space-y-3">
                                       <div className="space-y-1">
                                         <Label className="text-xs">سعر البيع المباشر (د.ع)</Label>
                                         <Input
                                           type="number"
                                           min="0"
                                           value={color.direct_sale_price ?? ''}
                                           onChange={(e) => updateProductColor(index, 'direct_sale_price', e.target.value ? Number(e.target.value) : undefined)}
                                           placeholder="اتركه فارغاً للسعر الافتراضي"
                                           className="h-9"
                                         />
                                       </div>
                                       
                                       {/* Per-option stock or single stock */}
                                       {(color.linked_options && color.linked_options.length > 0) ? (
                                         <div className="space-y-2">
                                           <Label className="text-xs">مخزون لكل خيار</Label>
                                           {color.linked_options.map((optName) => (
                                             <div key={optName} className="flex items-center gap-2">
                                               <span className="text-xs text-muted-foreground min-w-[80px]">{optName}:</span>
                                               <Input
                                                 type="number"
                                                 min="0"
                                                 value={color.option_stocks?.[optName] ?? ''}
                                                 onChange={(e) => {
                                                   const currentStocks = { ...(color.option_stocks || {}) };
                                                   if (e.target.value) {
                                                     currentStocks[optName] = Number(e.target.value);
                                                   } else {
                                                     delete currentStocks[optName];
                                                   }
                                                   updateProductColor(index, 'option_stocks', Object.keys(currentStocks).length > 0 ? currentStocks : undefined);
                                                 }}
                                                 placeholder="غير محدود"
                                                 className="h-8 w-24"
                                               />
                                             </div>
                                           ))}
                                         </div>
                                       ) : (
                                         <div className="space-y-1">
                                           <Label className="text-xs">كمية المخزون</Label>
                                           <Input
                                             type="number"
                                             min="0"
                                             value={color.stock_quantity ?? ''}
                                             onChange={(e) => updateProductColor(index, 'stock_quantity', e.target.value ? Number(e.target.value) : undefined)}
                                             placeholder="غير محدود"
                                             className="h-9"
                                           />
                                         </div>
                                       )}
                                     </div>
                                   </div>
                                 )}
                                 
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
                                
                                <div className="space-y-1">
                                  <Label className="text-xs">النص بالعربي</Label>
                                  <Input
                                    type="text"
                                    value={feature.text_ar}
                                    onChange={(e) => updateProductFeature(index, 'text_ar', e.target.value)}
                                    placeholder="ذاكرة 16 جيجابايت"
                                    className="h-9"
                                  />
                                  <p className="text-[10px] text-muted-foreground">يُترجم تلقائياً للإنجليزية والكردية</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SEO: short summary + searchable attributes */}
                    <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <div>
                        <h3 className="font-bold text-sm mb-1">ملخص قصير (SEO + Meta Description)</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          سطر واحد يلخص المنتج. يستخدم في وصف صفحة جوجل و OG ومساعدي الذكاء الاصطناعي.
                        </p>
                        <Input
                          value={productShortSummary.ar || ''}
                          onChange={(e) => setProductShortSummary({ ...productShortSummary, ar: e.target.value })}
                          placeholder="بالعربية (≤ 160 حرف)"
                          dir="rtl"
                          maxLength={200}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">يُترجم تلقائياً للإنجليزية والكردية عند العرض</p>
                      </div>

                      <div>
                        <h3 className="font-bold text-sm mb-1">صفات قابلة للبحث (Tags / Keywords)</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          كلمات مفتاحية تساعد جوجل والذكاء الاصطناعي على ربط المنتج بنية المستخدم: استخدام، مادة، علامة، جمهور...
                        </p>
                        <div className="flex gap-2">
                          <Input
                            value={searchableAttrInput}
                            onChange={(e) => setSearchableAttrInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                const v = searchableAttrInput.trim().replace(/,$/, '').trim();
                                if (v && !productSearchableAttrs.includes(v)) {
                                  setProductSearchableAttrs([...productSearchableAttrs, v]);
                                }
                                setSearchableAttrInput('');
                              }
                            }}
                            placeholder="أضف كلمة مفتاحية ثم اضغط Enter"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const v = searchableAttrInput.trim();
                              if (v && !productSearchableAttrs.includes(v)) {
                                setProductSearchableAttrs([...productSearchableAttrs, v]);
                              }
                              setSearchableAttrInput('');
                            }}
                          >
                            إضافة
                          </Button>
                        </div>
                        {productSearchableAttrs.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {productSearchableAttrs.map((tag, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"
                              >
                                #{tag}
                                <button
                                  type="button"
                                  onClick={() => setProductSearchableAttrs(productSearchableAttrs.filter((_, idx) => idx !== i))}
                                  className="hover:text-destructive"
                                  aria-label="remove tag"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <AdminProductAIContentEditor
                      value={productAIContent}
                      onChange={setProductAIContent}
                    />

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
                    </div>
                  </div>
                )}

              </div>
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
              {/* Desktop Table */}
              <div className="hidden md:block glass-effect rounded-2xl border border-border/50 overflow-x-auto w-full max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                <Table className="min-w-[800px]">
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
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium">{product.name_ar}</span>
                            {!product.is_pricing_updated && (
                              <Badge variant="outline" className="border-amber-500 text-amber-500 text-[10px] px-1.5 py-0">غير محدّث</Badge>
                            )}
                            {isAdmin && (product as any).pending_admin_review && (
                              <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5 py-0 gap-1">
                                <AlertCircle className="h-3 w-3" />
                                بانتظار التسعير — مضاف من مساعد
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{(product as any).categories?.name_ar}</TableCell>
                        <TableCell>{formatPrice(Number(product.price))} د.ع</TableCell>
                        <TableCell>
                          {product.original_price 
                            ? `${formatPrice(Number(product.original_price))} د.ع`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-2 justify-end">
                            {isAdmin && (product as any).pending_admin_review && (
                              <Button
                                size="sm"
                                onClick={() => handlePublishPendingProduct(product)}
                                title="نشر المنتج للمستخدمين"
                                className="bg-green-600 hover:bg-green-700 text-white gap-1"
                              >
                                <Check className="h-4 w-4" />
                                نشر
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleVisibility(product)}
                              title={product.is_pricing_updated ? 'إخفاء المنتج' : 'إظهار المنتج'}
                              className={!product.is_pricing_updated ? "text-destructive border-destructive/50 hover:text-destructive" : ""}
                            >
                              {product.is_pricing_updated ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingProduct(product);
                                setProductFeatured(!!product.featured);
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

              {/* Mobile Cards */}
              <div className="md:hidden space-y-2">
                {filteredProducts?.map((product) => (
                  <div key={product.id} className="rounded-xl border border-border/50 bg-card p-3">
                    <div className="flex items-start gap-3">
                      {product.image_url && (
                        <img 
                          src={product.image_url} 
                          alt={product.name_ar}
                          className="w-14 h-14 object-cover rounded-lg shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-foreground truncate">{product.name_ar}</h4>
                          {!product.is_pricing_updated && (
                            <Badge variant="outline" className="border-amber-500 text-amber-500 text-[9px] px-1 py-0 shrink-0">غير محدّث</Badge>
                          )}
                          {isAdmin && (product as any).pending_admin_review && (
                            <Badge className="bg-red-500 hover:bg-red-600 text-white text-[9px] px-1 py-0 shrink-0 gap-0.5">
                              <AlertCircle className="h-2.5 w-2.5" />
                              بانتظار التسعير
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{(product as any).categories?.name_ar || '-'}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-bold text-primary">{formatPrice(Number(product.price))} د.ع</span>
                          {product.original_price && product.original_price !== product.price && (
                            <span className="text-[10px] text-muted-foreground line-through">{formatPrice(Number(product.original_price))} د.ع</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/30">
                      {isAdmin && (product as any).pending_admin_review && (
                        <Button size="sm" className="h-8 px-2 bg-green-600 hover:bg-green-700 text-white gap-1" onClick={() => handlePublishPendingProduct(product)} title="نشر">
                          <Check className="h-3.5 w-3.5" />
                          <span className="text-xs">نشر</span>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className={`h-8 w-8 p-0 ${!product.is_pricing_updated ? 'text-destructive border-destructive/50' : ''}`} onClick={() => handleToggleVisibility(product)} title={product.is_pricing_updated ? 'إخفاء المنتج' : 'إظهار المنتج'}>
                        {product.is_pricing_updated ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => { setEditingProduct(product); setProductFeatured(!!product.featured); setProductDialogOpen(true); }} title="تعديل">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDuplicateProduct(product)} title="تكرار">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <div className="flex-1" />
                      <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => { if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) deleteProduct.mutate(product.id); }} title="حذف">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              </>
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
                if (open) {
                  setCategoryMediaUrl(editingCategory?.media_url ?? null);
                  setCategoryMediaType(editingCategory?.media_type ?? null);
                  setCategoryMediaTransparent(!!editingCategory?.media_transparent);
                } else {
                  setEditingCategory(null);
                  setCategoryMediaUrl(null);
                  setCategoryMediaType(null);
                  setCategoryMediaTransparent(false);
                }
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
                        <Label htmlFor="cat_name_en">Name (English) — for SEO/i18n</Label>
                        <Input
                          id="cat_name_en"
                          name="name_en"
                          defaultValue={editingCategory?.name_en || editingCategory?.name || ''}
                          placeholder="e.g. 3D Printers"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cat_name_ku">ناوی کوردی</Label>
                        <Input
                          id="cat_name_ku"
                          name="name_ku"
                          defaultValue={editingCategory?.name_ku || ''}
                          placeholder="بۆ نموونە: پرینتەری 3D"
                          dir="rtl"
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

                    {/* Category media: image / GIF / video */}
                    <div className="space-y-2 rounded-lg border border-dashed border-border/60 p-3 bg-muted/20">
                      <Label>وسائط القسم (صورة / GIF / فيديو) — اختياري</Label>
                      <p className="text-[11px] text-muted-foreground">
                        إذا تم رفع ملف فسيتم عرضه بدلاً من الأيقونة الافتراضية.
                      </p>

                      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">وسائط شفافة تملأ البطاقة</p>
                          <p className="text-[11px] text-muted-foreground">تلغي المربع الصغير وتعرض الفيديو أو الـ GIF على كامل البطاقة.</p>
                        </div>
                        <Switch
                          checked={categoryMediaTransparent}
                          onCheckedChange={setCategoryMediaTransparent}
                          disabled={!categoryMediaUrl}
                        />
                      </div>

                      {categoryMediaUrl && (
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-border/60 bg-card">
                            {categoryMediaType === 'video' ? (
                              <video src={categoryMediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                            ) : (
                              <img src={categoryMediaUrl} alt="preview" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCategoryMediaUrl(null);
                              setCategoryMediaType(null);
                              setCategoryMediaTransparent(false);
                            }}
                          >
                            <X className="h-4 w-4 ml-1" />
                            إزالة
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*,video/mp4,video/webm,video/quicktime"
                          disabled={categoryMediaUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            // 20MB limit
                            if (file.size > 20 * 1024 * 1024) {
                              toast.error('حجم الملف يجب أن يكون أقل من 20 ميجابايت');
                              e.target.value = '';
                              return;
                            }
                            try {
                              setCategoryMediaUploading(true);
                              const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
                              const path = `${crypto.randomUUID()}.${ext}`;
                              const { error: upErr } = await supabase
                                .storage
                                .from('category-media')
                                .upload(path, file, {
                                  cacheControl: '3600',
                                  upsert: false,
                                  contentType: file.type || undefined,
                                });
                              if (upErr) throw upErr;
                              const { data: pub } = supabase.storage.from('category-media').getPublicUrl(path);
                              const isVideo = file.type.startsWith('video/');
                              const isGif = file.type === 'image/gif' || ext === 'gif';
                              setCategoryMediaUrl(pub.publicUrl);
                              setCategoryMediaType(isVideo ? 'video' : isGif ? 'gif' : 'image');
                              toast.success('تم رفع الملف بنجاح');
                            } catch (err: any) {
                              toast.error(err?.message || 'فشل رفع الملف');
                            } finally {
                              setCategoryMediaUploading(false);
                              e.target.value = '';
                            }
                          }}
                        />
                        {categoryMediaUploading && <Loader2 className="h-4 w-4 animate-spin" />}
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cat_description_en">Description (English)</Label>
                        <Textarea
                          id="cat_description_en"
                          name="description_en"
                          defaultValue={editingCategory?.description_en || editingCategory?.description || ''}
                          rows={3}
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cat_description_ku">وەسف بە کوردی</Label>
                        <Textarea
                          id="cat_description_ku"
                          name="description_ku"
                          defaultValue={editingCategory?.description_ku || ''}
                          rows={3}
                          dir="rtl"
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

                    {editingCategory && (
                      <div className="space-y-2">
                        <Label htmlFor="featured_product_id">المنتج المميز</Label>
                        <select
                          id="featured_product_id"
                          name="featured_product_id"
                          value={editingCategory?.featured_product_id || ''}
                          onChange={(e) => {
                            if (editingCategory) {
                              setEditingCategory({ ...editingCategory, featured_product_id: e.target.value || null });
                            }
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">تلقائي (أعلى سعر)</option>
                          {products?.filter(p => p.category_id === editingCategory?.id).map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name_ar}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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

            <div className="glass-effect rounded-2xl border border-border/50 overflow-x-auto">
              <Table className="min-w-[800px]">
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
                              setCategoryMediaUrl((category as any).media_url ?? null);
                              setCategoryMediaType((category as any).media_type ?? null);
                              setCategoryMediaTransparent(!!(category as any).media_transparent);
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