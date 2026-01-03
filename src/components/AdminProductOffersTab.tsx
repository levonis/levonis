import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Gift, Loader2, Trash2, Upload, X, Edit, Package, DollarSign, Ticket, BarChart3, Download, TrendingUp, Palette, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import * as XLSX from "xlsx";

interface ProductOption {
  name_ar: string;
  price_adjustment: number;
  in_stock: boolean;
}

interface ProductColor {
  name_ar: string;
  hex_code: string;
  image_url: string | null;
  in_stock: boolean;
}

interface ProductOffer {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  price: number;
  cost_price: number;
  gift_tickets: number;
  stock_quantity: number | null;
  total_sold: number;
  status: 'draft' | 'active' | 'inactive';
  currency: string;
  created_at: string;
  options: ProductOption[] | null;
  colors: ProductColor[] | null;
}

interface OfferPurchase {
  id: string;
  user_id: string;
  offer_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  gift_tickets_awarded: number;
  created_at: string;
  profiles?: {
    username: string;
    full_name: string | null;
  };
}

export default function AdminProductOffersTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<ProductOffer | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<"offers" | "report">("offers");

  const [formData, setFormData] = useState({
    title_ar: '',
    description_ar: '',
    image_url: '',
    images: [] as string[],
    price: '',
    cost_price: '',
    gift_tickets: '1',
    stock_quantity: '',
    status: 'active' as 'draft' | 'active' | 'inactive',
    options: [] as ProductOption[],
    colors: [] as ProductColor[],
  });

  // Fetch product offers
  const { data: offers, isLoading } = useQuery({
    queryKey: ['admin-product-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as ProductOffer[];
    },
  });

  // Fetch all purchases for financial report
  const { data: purchases } = useQuery({
    queryKey: ['product-offer-purchases-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offer_purchases')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = [...new Set(data?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data?.map(p => ({
        ...p,
        profiles: profileMap.get(p.user_id) || null
      })) as OfferPurchase[];
    },
  });

  // Calculate financial stats
  const financialStats = useMemo(() => {
    if (!offers || !purchases) return { totalRevenue: 0, totalCost: 0, netProfit: 0, totalTickets: 0, ticketsByOffer: [] as any[] };
    
    const offerMap = new Map(offers.map(o => [o.id, o]));
    
    let totalRevenue = 0;
    let totalCost = 0;
    let totalTickets = 0;
    const ticketsByOffer: { offer: ProductOffer; tickets: number; revenue: number; cost: number; profit: number; purchases: number }[] = [];
    
    // Group purchases by offer
    const purchasesByOffer = new Map<string, OfferPurchase[]>();
    purchases.forEach(p => {
      if (!purchasesByOffer.has(p.offer_id)) {
        purchasesByOffer.set(p.offer_id, []);
      }
      purchasesByOffer.get(p.offer_id)!.push(p);
    });
    
    offers.forEach(offer => {
      const offerPurchases = purchasesByOffer.get(offer.id) || [];
      const offerRevenue = offerPurchases.reduce((sum, p) => sum + p.total_price, 0);
      const offerTickets = offerPurchases.reduce((sum, p) => sum + p.gift_tickets_awarded, 0);
      const purchaseCount = offerPurchases.reduce((sum, p) => sum + p.quantity, 0);
      const offerCost = purchaseCount * (offer.cost_price || 0);
      
      totalRevenue += offerRevenue;
      totalCost += offerCost;
      totalTickets += offerTickets;
      
      if (purchaseCount > 0) {
        ticketsByOffer.push({
          offer,
          tickets: offerTickets,
          revenue: offerRevenue,
          cost: offerCost,
          profit: offerRevenue - offerCost,
          purchases: purchaseCount,
        });
      }
    });
    
    return {
      totalRevenue,
      totalCost,
      netProfit: totalRevenue - totalCost,
      totalTickets,
      ticketsByOffer: ticketsByOffer.sort((a, b) => b.revenue - a.revenue),
    };
  }, [offers, purchases]);

  const resetForm = () => {
    setFormData({
      title_ar: '',
      description_ar: '',
      image_url: '',
      images: [],
      price: '',
      cost_price: '',
      gift_tickets: '1',
      stock_quantity: '',
      status: 'active',
      options: [],
      colors: [],
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
      price: offer.price.toString(),
      cost_price: (offer.cost_price || 0).toString(),
      gift_tickets: offer.gift_tickets.toString(),
      stock_quantity: offer.stock_quantity?.toString() || '',
      status: offer.status,
      options: (offer.options as ProductOption[]) || [],
      colors: (offer.colors as ProductColor[]) || [],
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

  // Create mutation
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
        cost_price: parseFloat(data.cost_price) || 0,
        gift_tickets: parseInt(data.gift_tickets) || 1,
        stock_quantity: data.stock_quantity ? parseInt(data.stock_quantity) : null,
        status: data.status,
        options: JSON.parse(JSON.stringify(data.options)),
        colors: JSON.parse(JSON.stringify(data.colors)),
      };

      const { data: result, error } = await supabase
        .from('product_offers')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('تم إنشاء العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      queryClient.invalidateQueries({ queryKey: ['product-offers-list'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('خطأ في الإنشاء: ' + error.message);
    },
  });

  // Update mutation
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
        cost_price: parseFloat(data.cost_price) || 0,
        gift_tickets: parseInt(data.gift_tickets) || 1,
        stock_quantity: data.stock_quantity ? parseInt(data.stock_quantity) : null,
        status: data.status,
        options: JSON.parse(JSON.stringify(data.options)),
        colors: JSON.parse(JSON.stringify(data.colors)),
      };

      const { error } = await supabase
        .from('product_offers')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      queryClient.invalidateQueries({ queryKey: ['product-offers-list'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('خطأ في التحديث: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_offers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف العرض');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      queryClient.invalidateQueries({ queryKey: ['product-offers-list'] });
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

  const exportFinancialReport = () => {
    if (!financialStats.ticketsByOffer.length) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData = financialStats.ticketsByOffer.map((item, index) => ({
      '#': index + 1,
      'اسم المنتج': item.offer.title_ar,
      'عدد المشتريات': item.purchases,
      'التذاكر الممنوحة': item.tickets,
      'الإيرادات': item.revenue,
      'التكلفة': item.cost,
      'الربح': item.profit,
    }));

    // Add summary row
    exportData.push({
      '#': '' as any,
      'اسم المنتج': 'الإجمالي',
      'عدد المشتريات': financialStats.ticketsByOffer.reduce((s, i) => s + i.purchases, 0),
      'التذاكر الممنوحة': financialStats.totalTickets,
      'الإيرادات': financialStats.totalRevenue,
      'التكلفة': financialStats.totalCost,
      'الربح': financialStats.netProfit,
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'التقرير المالي');

    XLSX.writeFile(workbook, `تقرير-عروض-المنتجات-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('تم تصدير التقرير بنجاح');
  };

  const statusLabels = {
    draft: { label: 'مسودة', color: 'bg-gray-500' },
    active: { label: 'نشط', color: 'bg-green-500' },
    inactive: { label: 'متوقف', color: 'bg-red-500' },
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "offers" | "report")}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="offers" className="gap-2">
              <Package className="h-4 w-4" />
              العروض
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              التقرير المالي
            </TabsTrigger>
          </TabsList>
          
          {activeTab === "offers" && (
            <Button onClick={() => setIsDialogOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" />
              إضافة عرض
            </Button>
          )}
          {activeTab === "report" && (
            <Button variant="outline" onClick={exportFinancialReport} className="gap-1">
              <Download className="h-4 w-4" />
              تصدير Excel
            </Button>
          )}
        </div>

        <TabsContent value="offers" className="space-y-4 mt-4">
          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="p-4 text-center">
                <Package className="h-6 w-6 mx-auto mb-1 text-green-600" />
                <p className="text-xl font-bold">{offers?.filter(o => o.status === 'active').length || 0}</p>
                <p className="text-xs text-muted-foreground">عروض نشطة</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4 text-center">
                <Ticket className="h-6 w-6 mx-auto mb-1 text-blue-600" />
                <p className="text-xl font-bold">{financialStats.totalTickets}</p>
                <p className="text-xs text-muted-foreground">تذاكر ممنوحة</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{financialStats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-1 text-purple-600" />
                <p className="text-xl font-bold">{financialStats.netProfit.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">صافي الربح</p>
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold truncate">{offer.title_ar}</h3>
                          <Badge className={`${statusLabels[offer.status]?.color || 'bg-gray-500'} text-white text-xs`}>
                            {statusLabels[offer.status]?.label || offer.status}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {offer.description_ar || 'لا يوجد وصف'}
                        </p>
                        
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-primary" />
                            <span className="font-bold">{offer.price.toLocaleString()} {offer.currency}</span>
                          </div>
                          {offer.cost_price > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span>التكلفة: {offer.cost_price.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Gift className="h-4 w-4 text-green-600" />
                            <span>{offer.gift_tickets} تذكرة هدية</span>
                          </div>
                          {offer.stock_quantity !== null && (
                            <div className="text-muted-foreground">
                              المخزون: {offer.stock_quantity}
                            </div>
                          )}
                          <div className="text-muted-foreground">
                            المباع: {offer.total_sold || 0}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
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
        </TabsContent>

        <TabsContent value="report" className="space-y-4 mt-4">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Ticket className="h-6 w-6 mx-auto mb-1 text-blue-600" />
                <p className="text-2xl font-bold">{financialStats.totalTickets}</p>
                <p className="text-xs text-muted-foreground">إجمالي التذاكر الممنوحة</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold">{financialStats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="h-6 w-6 mx-auto mb-1 text-orange-600" />
                <p className="text-2xl font-bold">{financialStats.totalCost.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">إجمالي التكلفة</p>
              </CardContent>
            </Card>
            <Card className={financialStats.netProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}>
              <CardContent className="p-4 text-center">
                <TrendingUp className={`h-6 w-6 mx-auto mb-1 ${financialStats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <p className={`text-2xl font-bold ${financialStats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {financialStats.netProfit.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">صافي الربح</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown by Offer */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  تفاصيل حسب العرض
                </h3>
              </div>
              <ScrollArea className="h-[400px]">
                {financialStats.ticketsByOffer.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    لا توجد مشتريات بعد
                  </div>
                ) : (
                  <div className="divide-y">
                    {financialStats.ticketsByOffer.map((item) => (
                      <div key={item.offer.id} className="p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          {item.offer.image_url && (
                            <img src={item.offer.image_url} alt="" className="w-12 h-12 object-cover rounded" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.offer.title_ar}</p>
                            <p className="text-sm text-muted-foreground">{item.purchases} عملية شراء</p>
                          </div>
                          <div className="text-left space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Ticket className="h-3 w-3 text-blue-600" />
                              <span>{item.tickets} تذكرة</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <DollarSign className="h-3 w-3 text-green-600" />
                              <span>{item.revenue.toLocaleString()}</span>
                            </div>
                            <div className={`text-sm font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ربح: {item.profit.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOffer ? 'تعديل العرض' : 'إضافة عرض منتج جديد'}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
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
                  <Label>سعر البيع (دينار) *</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="25000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>سعر التكلفة (دينار)</Label>
                  <Input
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="20000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label>كمية المخزون</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    placeholder="غير محدود"
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
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Options Section */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Settings2 className="h-4 w-4" />الخيارات</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      options: [...prev.options, { name_ar: '', price_adjustment: 0, in_stock: true }]
                    }))}
                  >
                    <Plus className="h-3 w-3 ml-1" />إضافة خيار
                  </Button>
                </div>
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                    <Input
                      placeholder="اسم الخيار"
                      value={opt.name_ar}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[idx].name_ar = e.target.value;
                        setFormData(prev => ({ ...prev, options: newOptions }));
                      }}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="فرق السعر"
                      value={opt.price_adjustment}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[idx].price_adjustment = parseFloat(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, options: newOptions }));
                      }}
                      className="w-24"
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={opt.in_stock}
                        onChange={(e) => {
                          const newOptions = [...formData.options];
                          newOptions[idx].in_stock = e.target.checked;
                          setFormData(prev => ({ ...prev, options: newOptions }));
                        }}
                      />
                      متوفر
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        options: prev.options.filter((_, i) => i !== idx)
                      }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Colors Section */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Palette className="h-4 w-4" />الألوان</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      colors: [...prev.colors, { name_ar: '', hex_code: '#000000', image_url: null, in_stock: true }]
                    }))}
                  >
                    <Plus className="h-3 w-3 ml-1" />إضافة لون
                  </Button>
                </div>
                {formData.colors.map((color, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                    <input
                      type="color"
                      value={color.hex_code}
                      onChange={(e) => {
                        const newColors = [...formData.colors];
                        newColors[idx].hex_code = e.target.value;
                        setFormData(prev => ({ ...prev, colors: newColors }));
                      }}
                      className="w-10 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      placeholder="اسم اللون"
                      value={color.name_ar}
                      onChange={(e) => {
                        const newColors = [...formData.colors];
                        newColors[idx].name_ar = e.target.value;
                        setFormData(prev => ({ ...prev, colors: newColors }));
                      }}
                      className="flex-1"
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={color.in_stock}
                        onChange={(e) => {
                          const newColors = [...formData.colors];
                          newColors[idx].in_stock = e.target.checked;
                          setFormData(prev => ({ ...prev, colors: newColors }));
                        }}
                      />
                      متوفر
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        colors: prev.colors.filter((_, i) => i !== idx)
                      }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              إلغاء
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
              {editingOffer ? 'تحديث' : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}