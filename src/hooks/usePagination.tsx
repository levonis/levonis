import { useState, useMemo } from 'react';

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface UsePaginationOptions {
  pageSize?: number;
  initialPage?: number;
}

export function usePagination<T>(
  items: T[] | undefined,
  options: UsePaginationOptions = {}
) {
  const { pageSize = 25, initialPage = 1 } = options;
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalItems = items?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Reset to page 1 if current page is out of bounds
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  const paginatedItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  }, [items, safePage, pageSize]);

  const goToPage = (page: number) => {
    const newPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(newPage);
  };

  const nextPage = () => {
    if (safePage < totalPages) {
      setCurrentPage(safePage + 1);
    }
  };

  const prevPage = () => {
    if (safePage > 1) {
      setCurrentPage(safePage - 1);
    }
  };

  const resetPage = () => {
    setCurrentPage(1);
  };

  return {
    // Paginated data
    paginatedItems,
    
    // Pagination state
    currentPage: safePage,
    pageSize,
    totalItems,
    totalPages,
    
    // Navigation functions
    goToPage,
    nextPage,
    prevPage,
    resetPage,
    
    // Computed values
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
    startIndex: (safePage - 1) * pageSize + 1,
    endIndex: Math.min(safePage * pageSize, totalItems),
    
    // Show pagination only if needed
    showPagination: totalItems > pageSize,
  };
}
