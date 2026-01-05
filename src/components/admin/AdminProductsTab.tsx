import { memo, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the heavy table component
const ProductsTable = lazy(() => import('./ProductsTable'));

interface AdminProductsTabProps {
  products: any[];
  categories: any[];
  mainSections: any[];
  isLoading: boolean;
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

const AdminProductsTab = memo(({ 
  products, 
  categories, 
  mainSections, 
  isLoading, 
  onEdit, 
  onDelete, 
  onDuplicate,
  onReExtract,
  onRefresh,
  filters 
}: AdminProductsTabProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProductsTable 
        products={products}
        categories={categories}
        mainSections={mainSections}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onReExtract={onReExtract}
        onRefresh={onRefresh}
        filters={filters}
      />
    </Suspense>
  );
});

AdminProductsTab.displayName = 'AdminProductsTab';

export default AdminProductsTab;
