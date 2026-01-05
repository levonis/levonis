import { memo, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pencil, Trash2, Copy, Sparkles, Search, RefreshCw, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { syncProductAvailability } from '@/lib/api/taobaoSync';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ProductsTableProps {
  products: any[];
  categories: any[];
  mainSections: any[];
  onEdit: (product: any) => void;
  onDelete: (id: string) => void;
  onDuplicate: (product: any) => void;
  onReExtract: (product: any) => void;
  filters: {
    search: string;
    setSearch: (v: string) => void;
    categoryFilter: string;
    setCategoryFilter: (v: string) => void;
    stockFilter: string;
    setStockFilter: (v: string) => void;
    featuredFilter: string;
    setFeaturedFilter: (v: string) => void;
    availabilityTypeFilter: string;
    setAvailabilityTypeFilter: (v: string) => void;
    optionsStockFilter: string;
    setOptionsStockFilter: (v: string) => void;
  };
}

const ProductsTable = memo(({ 
  products, 
  categories, 
  mainSections,
  onEdit, 
  onDelete, 
  onDuplicate,
  onReExtract,
  filters 
}: ProductsTableProps) => {
  const [syncingProducts, setSyncingProducts] = useState<Set<string>>(new Set());
  
  const {
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    stockFilter,
    setStockFilter,
    featuredFilter,
    setFeaturedFilter,
    availabilityTypeFilter,
    setAvailabilityTypeFilter,
    optionsStockFilter,
    setOptionsStockFilter
  } = filters;

  const handleSyncProduct = async (product: any) => {
    if (!product.taobao_url) {
      toast.error('لا يوجد رابط Taobao لهذا المنتج');
      return;
    }
    
    setSyncingProducts(prev => new Set(prev).add(product.id));
    
    try {
      const result = await syncProductAvailability(product.id, product.taobao_url);
      if (result.success) {
        toast.success(`تم مزامنة "${product.name_ar}" - ${result.product_available ? 'متوفر' : 'غير متوفر'}`);
      } else {
        toast.error(result.error || 'فشل في المزامنة');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء المزامنة');
    } finally {
      setSyncingProducts(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const getSyncStatusBadge = (product: any) => {
    if (!product.taobao_url) return null;
    
    const status = product.taobao_sync_status;
    const lastSync = product.taobao_last_sync_at;
    
    let icon;
    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
    let text = 'لم تتم المزامنة';
    
    if (status === 'success') {
      icon = <CheckCircle className="h-3 w-3 text-green-500" />;
      variant = 'default';
      text = lastSync ? formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ar }) : 'تمت المزامنة';
    } else if (status === 'error') {
      icon = <AlertCircle className="h-3 w-3 text-red-500" />;
      variant = 'destructive';
      text = 'فشل';
    } else {
      icon = <Clock className="h-3 w-3" />;
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={variant} className="text-[10px] cursor-default gap-1">
              {icon}
              <span className="max-w-[60px] truncate">{text}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>حالة مزامنة Taobao/JD</p>
            {lastSync && <p className="text-xs">آخر مزامنة: {new Date(lastSync).toLocaleString('ar-IQ')}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products?.filter(product => {
      const matchesSearch = !search || 
        product.name_ar?.toLowerCase().includes(search.toLowerCase()) ||
        product.name?.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
      const matchesStock = stockFilter === 'all' || 
        (stockFilter === 'in_stock' && product.in_stock) ||
        (stockFilter === 'out_of_stock' && !product.in_stock);
      const matchesFeatured = featuredFilter === 'all' || 
        (featuredFilter === 'featured' && product.featured) ||
        (featuredFilter === 'not_featured' && !product.featured);
      const matchesAvailability = availabilityTypeFilter === 'all' || 
        product.availability_type === availabilityTypeFilter;
      
      let matchesOptionsStock = true;
      if (optionsStockFilter !== 'all' && product.product_options?.length > 0) {
        const hasInStock = product.product_options.some((opt: any) => opt.in_stock);
        const hasOutOfStock = product.product_options.some((opt: any) => !opt.in_stock);
        if (optionsStockFilter === 'has_in_stock') matchesOptionsStock = hasInStock;
        else if (optionsStockFilter === 'has_out_of_stock') matchesOptionsStock = hasOutOfStock;
        else if (optionsStockFilter === 'all_in_stock') matchesOptionsStock = !hasOutOfStock;
        else if (optionsStockFilter === 'all_out_of_stock') matchesOptionsStock = !hasInStock;
      }
      
      return matchesSearch && matchesCategory && matchesStock && matchesFeatured && matchesAvailability && matchesOptionsStock;
    }) || [];
  }, [products, search, categoryFilter, stockFilter, featuredFilter, availabilityTypeFilter, optionsStockFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-card/50 rounded-lg border border-border/40">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن منتج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">جميع الأقسام</option>
          {categories?.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name_ar}</option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">جميع الحالات</option>
          <option value="in_stock">متوفر</option>
          <option value="out_of_stock">غير متوفر</option>
        </select>
        <select
          value={featuredFilter}
          onChange={(e) => setFeaturedFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">الكل</option>
          <option value="featured">مميز</option>
          <option value="not_featured">غير مميز</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الصورة</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">القسم</TableHead>
              <TableHead className="text-right">السعر</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">المزامنة</TableHead>
              <TableHead className="text-right">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <img 
                    src={product.image_url || '/placeholder.svg'} 
                    alt={product.name_ar}
                    className="w-12 h-12 object-cover rounded"
                    loading="lazy"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{product.name_ar}</span>
                    {product.taobao_url && (
                      <a 
                        href={product.taobao_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        رابط Taobao/JD
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>{product.categories?.name_ar || '-'}</TableCell>
                <TableCell>{formatPrice(product.price)}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant={product.in_stock ? "default" : "destructive"}>
                      {product.in_stock ? 'متوفر' : 'غير متوفر'}
                    </Badge>
                    {product.featured && <Badge variant="secondary">مميز</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {getSyncStatusBadge(product)}
                    {product.taobao_url && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleSyncProduct(product)}
                        disabled={syncingProducts.has(product.id)}
                      >
                        <RefreshCw className={`h-3 w-3 ${syncingProducts.has(product.id) ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => onEdit(product)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDuplicate(product)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onReExtract(product)}>
                      <Sparkles className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(product.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <p className="text-sm text-muted-foreground">
        عدد النتائج: {filteredProducts.length} من {products?.length || 0}
      </p>
    </div>
  );
});

ProductsTable.displayName = 'ProductsTable';

export default ProductsTable;
