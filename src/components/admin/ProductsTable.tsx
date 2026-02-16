import { memo, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Copy, Sparkles, Search } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import TaobaoLinkButton from './TaobaoLinkButton';

interface ProductsTableProps {
  products: any[];
  categories: any[];
  mainSections: any[];
  onEdit: (product: any) => void;
  onDelete: (id: string) => void;
  onDuplicate: (product: any) => void;
  onReExtract: (product: any) => void;
  onRefresh?: () => void;
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
  onRefresh,
  filters 
}: ProductsTableProps) => {
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
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الصورة</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">القسم</TableHead>
              <TableHead className="text-right">السعر</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
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
                  <div className="flex gap-1">
                    <TaobaoLinkButton taobaoUrl={product.taobao_url} size="sm" variant="outline" />
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