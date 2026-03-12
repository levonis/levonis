import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, Gift, Loader2, Trash2, Upload, X, Edit, Package, DollarSign, Ticket, 
  BarChart3, Download, TrendingUp, Palette, Settings2, Eye, EyeOff, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Coins, MoreVertical, Search, Filter, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { exportToExcel } from "@/lib/exportUtils";
import AdminLayout, { AdminLoading } from "@/components/admin/AdminLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProductOption {
  name_ar: string;
  price_adjustment: number;
  in_stock: boolean;
  stock_quantity: number | null;
}

interface ProductColor {
  name_ar: string;
  hex_code: string;
  image_url: string | null;
  in_stock: boolean;
  stock_quantity: number | null;
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
  points_reward: number;
  stock_quantity: number | null;
  total_sold: number;
  status: 'draft' | 'active' | 'inactive';
  currency: string;
  created_at: string;
  options: ProductOption[] | null;
  colors: ProductColor[] | null;
  show_in_cart: boolean;
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
}

const statusConfig = {
  draft: { label: 'مسودة', bg: 'bg-muted', text: 'text-muted-foreground', icon: EyeOff },
  active: { label: 'نشط', bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: Eye },
  inactive: { label: 'متوقف', bg: 'bg-red-500/10', text: 'text-red-600', icon: EyeOff },
};

export default function AdminProductOffers() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<ProductOffer | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeView, setActiveView] = useState<'grid' | 'list'>('grid');

  const [formData, setFormData] = useState({
    title_ar: '',
    description_ar: '',
    images: [] as string[],
    price: '',
    cost_price: '',
    gift_tickets: '1',
    points_reward: '0',
    stock_quantity: '',
    status: 'active' as 'draft' | 'active' | 'inactive',
    options: [] as ProductOption[],
    colors: [] as ProductColor[],
    show_in_cart: false,
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

  // Fetch purchases for stats
  const { data: purchases } = useQuery({
    queryKey: ['product-offer-purchases-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offer_purchases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OfferPurchase[];
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!offers || !purchases) return { 
      activeOffers: 0, totalRevenue: 0, totalCost: 0, netProfit: 0, 
      totalTickets: 0, totalSold: 0, profitMargin: 0 
    };

    const offerMap = new Map(offers.map(o => [o.id, o]));
    let totalRevenue = 0;
    let totalCost = 0;
    let totalTickets = 0;
    let totalSold = 0;

    purchases.forEach(p => {
      totalRevenue += p.total_price;
      totalTickets += p.gift_tickets_awarded;
      totalSold += p.quantity;
      const offer = offerMap.get(p.offer_id);
      if (offer) {
        totalCost += p.quantity * (offer.cost_price || 0);
      }
    });

    const netProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      activeOffers: offers.filter(o => o.status === 'active').length,
      totalRevenue,
      totalCost,
      netProfit,
      totalTickets,
      totalSold,
      profitMargin,
    };
  }, [offers, purchases]);

  // Filter offers
  const filteredOffers = useMemo(() => {
    if (!offers) return [];
    return offers.filter(offer => {
      const matchesSearch = offer.title_ar.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [offers, searchTerm, statusFilter]);

  const resetForm = () => {
    setFormData({
      title_ar: '', description_ar: '', images: [], price: '', cost_price: '',
      gift_tickets: '1', points_reward: '0', stock_quantity: '', status: 'active',
      options: [], colors: [], show_in_cart: false,
    });
    setEditingOffer(null);
  };

  const handleEdit = (offer: ProductOffer) => {
    setEditingOffer(offer);
    setFormData({
      title_ar: offer.title_ar,
      description_ar: offer.description_ar || '',
      images: offer.images || (offer.image_url ? [offer.image_url] : []),
      price: offer.price.toString(),
      cost_price: (offer.cost_price || 0).toString(),
      gift_tickets: offer.gift_tickets.toString(),
      points_reward: (offer.points_reward || 0).toString(),
      stock_quantity: offer.stock_quantity?.toString() || '',
      status: offer.status,
      options: (offer.options as ProductOption[]) || [],
      colors: (offer.colors as ProductColor[]) || [],
      show_in_cart: offer.show_in_cart || false,
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
      const { error } = await supabase.storage.from('competition-images').upload(filePath, file);
      if (error) { toast.error(`خطأ في رفع الصورة`); continue; }
      const { data: publicUrl } = supabase.storage.from('competition-images').getPublicUrl(filePath);
      newImages.push(publicUrl.publicUrl);
    }
    setFormData(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
    setUploadingImage(false);
  };

  const removeImage = (index: number) => {
    setFormData(prev => {
      const newImages = [...prev.images];
      newImages.splice(index, 1);
      return { ...prev, images: newImages };
    });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title_ar, title_ar: data.title_ar,
        description: data.description_ar, description_ar: data.description_ar,
        image_url: data.images.length > 0 ? data.images[0] : null,
        images: data.images,
        price: parseFloat(data.price) || 0,
        cost_price: parseFloat(data.cost_price) || 0,
        gift_tickets: parseInt(data.gift_tickets) || 1,
        points_reward: parseInt(data.points_reward) || 0,
        stock_quantity: data.stock_quantity ? parseInt(data.stock_quantity) : null,
        status: data.status,
        options: JSON.parse(JSON.stringify(data.options)),
        colors: JSON.parse(JSON.stringify(data.colors)),
      };
      const { data: result, error } = await supabase.from('product_offers').insert([payload]).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('تم إنشاء العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const payload = {
        title: data.title_ar, title_ar: data.title_ar,
        description: data.description_ar, description_ar: data.description_ar,
        image_url: data.images.length > 0 ? data.images[0] : null,
        images: data.images,
        price: parseFloat(data.price) || 0,
        cost_price: parseFloat(data.cost_price) || 0,
        gift_tickets: parseInt(data.gift_tickets) || 1,
        points_reward: parseInt(data.points_reward) || 0,
        stock_quantity: data.stock_quantity ? parseInt(data.stock_quantity) : null,
        status: data.status,
        options: JSON.parse(JSON.stringify(data.options)),
        colors: JSON.parse(JSON.stringify(data.colors)),
      };
      const { error } = await supabase.from('product_offers').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث العرض');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_offers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف العرض');
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('product_offers').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-offers'] });
      toast.success('تم تحديث الحالة');
    },
  });

  const handleSubmit = () => {
    if (!formData.title_ar || !formData.price) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }
    if (editingOffer) {
      updateMutation.mutate({ id: editingOffer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const exportReport = () => {
    if (!offers) return;
    const exportData = offers.map((o, i) => ({
      '#': i + 1,
      'المنتج': o.title_ar,
      'السعر': o.price,
      'التكلفة': o.cost_price || 0,
      'المبيعات': o.total_sold || 0,
      'المخزون': o.stock_quantity ?? 'غير محدود',
      'التذاكر': o.gift_tickets,
      'الحالة': statusConfig[o.status].label,
    }));
    exportToExcel(exportData, { filename: `عروض-المنتجات-${format(new Date(), 'yyyy-MM-dd')}.csv` });
    toast.success('تم التصدير بنجاح');
  };

  if (isLoading) {
    return (
      <AdminLayout title="إدارة العروض" icon={<Gift className="h-5 w-5" />} description="إدارة عروض المنتجات والمبيعات">
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="إدارة العروض" 
      icon={<Gift className="h-5 w-5" />} 
      description="إدارة عروض المنتجات والمبيعات"
      maxWidth="7xl"
    >
      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl p-3 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] text-muted-foreground">نشطة</span>
          </div>
          <p className="text-lg font-black text-emerald-600">{stats.activeOffers}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-3 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] text-muted-foreground">مبيعات</span>
          </div>
          <p className="text-lg font-black text-blue-600">{stats.totalSold}</p>
        </div>
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-3 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-[10px] text-muted-foreground">إيرادات</span>
          </div>
          <p className="text-lg font-black text-primary">{stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-xl p-3 border border-orange-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="h-4 w-4 text-orange-600" />
            <span className="text-[10px] text-muted-foreground">تكلفة</span>
          </div>
          <p className="text-lg font-black text-orange-600">{stats.totalCost.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl p-3 border ${stats.netProfit >= 0 ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20' : 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            {stats.netProfit >= 0 ? <ArrowUpRight className="h-4 w-4 text-green-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
            <span className="text-[10px] text-muted-foreground">صافي</span>
          </div>
          <p className={`text-lg font-black ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.netProfit.toLocaleString()}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-3 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] text-muted-foreground">تذاكر</span>
          </div>
          <p className="text-lg font-black text-purple-600">{stats.totalTickets}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 rounded-xl p-3 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <span className="text-[10px] text-muted-foreground">هامش</span>
          </div>
          <p className="text-lg font-black text-indigo-600">{stats.profitMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-muted/30 rounded-xl border">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 text-sm">
              <Filter className="h-3.5 w-3.5 ml-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="inactive">متوقف</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportReport} className="gap-1.5 h-9">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">تصدير</span>
          </Button>
          <Button size="sm" onClick={() => setIsDialogOpen(true)} className="gap-1.5 h-9 admin-btn-primary">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">عرض جديد</span>
          </Button>
        </div>
      </div>

      {/* Offers Grid */}
      {filteredOffers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-2xl border-2 border-dashed">
          <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium mb-2">لا توجد عروض</p>
          <p className="text-sm text-muted-foreground/60 mb-4">ابدأ بإنشاء عرض منتج جديد</p>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            إنشاء عرض
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredOffers.map((offer) => {
            const StatusIcon = statusConfig[offer.status].icon;
            const profit = offer.price - (offer.cost_price || 0);
            return (
              <div 
                key={offer.id} 
                className="group relative bg-card rounded-xl border overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                {/* Image */}
                <div className="relative aspect-square bg-muted">
                  {offer.image_url ? (
                    <img src={offer.image_url} alt={offer.title_ar} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${statusConfig[offer.status].bg} ${statusConfig[offer.status].text}`}>
                    <StatusIcon className="h-2.5 w-2.5" />
                    {statusConfig[offer.status].label}
                  </div>

                  {/* Rewards Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {offer.gift_tickets > 0 && (
                      <div className="bg-purple-500/90 text-white px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5">
                        <Ticket className="h-2.5 w-2.5" />
                        {offer.gift_tickets}
                      </div>
                    )}
                    {offer.points_reward > 0 && (
                      <div className="bg-amber-500/90 text-white px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5">
                        <Coins className="h-2.5 w-2.5" />
                        {offer.points_reward}
                      </div>
                    )}
                  </div>

                  {/* Stock Warning */}
                  {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                    <div className="absolute bottom-2 left-2 bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded text-[8px] font-bold">
                      متبقي {offer.stock_quantity}
                    </div>
                  )}
                  {offer.stock_quantity === 0 && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <span className="text-destructive font-bold text-sm">نفذت الكمية</span>
                    </div>
                  )}

                  {/* Quick Actions Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => handleEdit(offer)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8 w-8 p-0"
                      onClick={() => toggleStatus.mutate({ id: offer.id, status: offer.status })}
                    >
                      {offer.status === 'active' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(offer)}>
                          <Edit className="h-4 w-4 ml-2" />
                          تعديل
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            if (window.confirm('هل أنت متأكد من الحذف؟')) {
                              deleteMutation.mutate(offer.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Content */}
                <div className="p-2.5">
                  <h3 className="font-semibold text-xs line-clamp-1 mb-1.5">{offer.title_ar}</h3>
                  
                  <div className="flex items-center justify-between mb-2">
                    <div className="bg-primary/10 rounded-md px-2 py-0.5">
                      <span className="font-black text-primary text-sm">{offer.price.toLocaleString()}</span>
                      <span className="text-[8px] text-muted-foreground mr-0.5">{offer.currency}</span>
                    </div>
                    {profit > 0 && (
                      <div className="text-[9px] text-emerald-600 font-medium">
                        +{profit.toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <ShoppingBag className="h-3 w-3" />
                      {offer.total_sold || 0}
                    </span>
                    <span>{format(new Date(offer.created_at), 'dd/MM', { locale: ar })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              {editingOffer ? 'تعديل العرض' : 'عرض جديد'}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">اسم المنتج *</Label>
                <Input
                  value={formData.title_ar}
                  onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                  placeholder="مثال: ساعة ذكية"
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">الوصف</Label>
                <Textarea
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  placeholder="وصف مختصر..."
                  className="min-h-[60px] text-sm"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">سعر البيع *</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="25000"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">التكلفة</Label>
                  <Input
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="20000"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Rewards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Ticket className="h-3 w-3 text-purple-500" />
                    تذاكر هدية
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.gift_tickets}
                    onChange={(e) => setFormData({ ...formData, gift_tickets: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Coins className="h-3 w-3 text-amber-500" />
                    نقاط مكافأة
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.points_reward}
                    onChange={(e) => setFormData({ ...formData, points_reward: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">المخزون</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    placeholder="∞"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">الحالة</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v as any })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="inactive">متوقف</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Images */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">الصور</Label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={uploadingImage}
                  />
                  <Button type="button" variant="outline" className="w-full h-9 gap-2" disabled={uploadingImage}>
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingImage ? 'جاري الرفع...' : 'رفع صور'}
                  </Button>
                </div>
                {formData.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.images.map((url, index) => (
                      <div key={index} className="relative w-16 h-16 group">
                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Settings2 className="h-3 w-3" />
                    الخيارات
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      options: [...prev.options, { name_ar: '', price_adjustment: 0, in_stock: true, stock_quantity: null }]
                    }))}
                  >
                    <Plus className="h-3 w-3 ml-1" />
                    إضافة
                  </Button>
                </div>
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Input
                      placeholder="الاسم"
                      value={opt.name_ar}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[idx].name_ar = e.target.value;
                        setFormData(prev => ({ ...prev, options: newOptions }));
                      }}
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="±0"
                      value={opt.price_adjustment || ''}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[idx].price_adjustment = parseFloat(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, options: newOptions }));
                      }}
                      className="h-8 text-xs w-20"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => {
                        const newOptions = formData.options.filter((_, i) => i !== idx);
                        setFormData(prev => ({ ...prev, options: newOptions }));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Colors */}
              <div className="space-y-2 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Palette className="h-3 w-3" />
                    الألوان
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      colors: [...prev.colors, { name_ar: '', hex_code: '#000000', image_url: null, in_stock: true, stock_quantity: null }]
                    }))}
                  >
                    <Plus className="h-3 w-3 ml-1" />
                    إضافة
                  </Button>
                </div>
                {formData.colors.map((color, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <input
                      type="color"
                      value={color.hex_code}
                      onChange={(e) => {
                        const newColors = [...formData.colors];
                        newColors[idx].hex_code = e.target.value;
                        setFormData(prev => ({ ...prev, colors: newColors }));
                      }}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      placeholder="اسم اللون"
                      value={color.name_ar}
                      onChange={(e) => {
                        const newColors = [...formData.colors];
                        newColors[idx].name_ar = e.target.value;
                        setFormData(prev => ({ ...prev, colors: newColors }));
                      }}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => {
                        const newColors = formData.colors.filter((_, i) => i !== idx);
                        setFormData(prev => ({ ...prev, colors: newColors }));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending}
              className="gap-2"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" />
              {editingOffer ? 'حفظ التغييرات' : 'إنشاء العرض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}