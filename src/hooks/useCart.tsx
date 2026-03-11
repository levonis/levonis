import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useShippingSettings } from './useShippingCalculator';
import { toast } from 'sonner';

export interface CartItem {
  id: string;
  product_id: string | null;
  custom_request_id: string | null;
  bundle_id?: string | null;
  quantity: number;
  product_option_id?: string | null;
  selected_color?: string | null;
  color_image_url?: string | null;
  option_image_url?: string | null;
  shipping_option_index?: number | null;
  shipping_option_name_ar?: string | null;
  sale_type?: string | null;
  products?: {
    id: string;
    name: string;
    name_ar: string;
    price: number;
    direct_sale_price?: number | null;
    sea_price?: number | null;
    air_price?: number | null;
    original_price: number | null;
    image_url: string | null;
    images?: string[];
    slug: string;
    colors?: any[];
    pre_order_shipping_options?: any;
    shipping_type?: string | null;
    category_id?: string | null;
    categories?: {
      id: string;
      tax_rate: number | null;
      main_section_id: string | null;
    } | null;
  };
  product_options?: {
    id: string;
    name_ar: string;
    price_adjustment: number | null;
  };
  custom_product_requests?: {
    id: string;
    product_name: string;
    suggested_price: number;
    image_url: string | null;
    quantity: number;
  };
  product_bundles?: {
    id: string;
    title_ar: string;
    bundle_price: number;
    original_price: number;
    image_url: string | null;
    sale_type: string | null;
  };
}

export interface PendingCartRequest {
  id: string;
  cart_code: string;
  adjusted_total: number | null;
  admin_notes: string | null;
  status: string;
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  itemCount: number;
  total: number;
  pendingCartRequest: PendingCartRequest | null;
  addToCart: (productId: string, optionId?: string, color?: string, quantity?: number, shippingInfo?: { index: number; name_ar: string }, saleType?: 'direct' | 'preorder') => Promise<boolean>;
  forceAddToCart: (productId: string, optionId?: string, color?: string, quantity?: number, shippingInfo?: { index: number; name_ar: string }, saleType?: 'direct' | 'preorder') => Promise<boolean>;
  addBundleToCart: (bundleId: string, saleType: 'direct' | 'preorder') => Promise<boolean>;
  cartSaleType: string | null;
  addCustomRequestToCart: (customRequestId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  deleteCartRequest: () => Promise<boolean>;
  checkAndWarnCartRequest: () => Promise<boolean>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCartRequest, setPendingCartRequest] = useState<PendingCartRequest | null>(null);
  const { user } = useAuth();
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1300;
  const optimisticLockRef = useRef(0); // Guard against fetch overwriting optimistic updates

  // Fetch pending cart request
  const fetchPendingCartRequest = async () => {
    if (!user) {
      setPendingCartRequest(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cart_requests')
        .select('id, cart_code, adjusted_total, admin_notes, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setPendingCartRequest(data as PendingCartRequest | null);
    } catch (error) {
      console.error('Error fetching cart request:', error);
    }
  };

  // Delete cart request
  const deleteCartRequest = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // First fetch the latest pending request to ensure we have the correct ID
      const { data: latestRequest, error: fetchError } = await supabase
        .from('cart_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching cart request for deletion:', fetchError);
        throw fetchError;
      }

      if (latestRequest) {
        console.log('Deleting cart request:', latestRequest.id);
        
        const { error: deleteError } = await supabase
          .from('cart_requests')
          .delete()
          .eq('id', latestRequest.id)
          .eq('user_id', user.id); // Extra safety check

        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw deleteError;
        }
        
        setPendingCartRequest(null);
        toast.success('تم حذف رمز السلة والسعر المعدل');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting cart request:', error);
      toast.error('حدث خطأ في حذف رمز السلة');
      return false;
    }
  };

  // Check and warn about cart request deletion
  const checkAndWarnCartRequest = async (): Promise<boolean> => {
    if (!user) return false;
    
    // Fetch directly from database to get latest state
    const { data } = await supabase
      .from('cart_requests')
      .select('id, cart_code, adjusted_total, admin_notes, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Update state with latest data
    setPendingCartRequest(data as PendingCartRequest | null);
    
    return !!data;
  };

  const fetchCart = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const lockValue = optimisticLockRef.current;

    try {
      
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          custom_request_id,
          bundle_id,
          quantity,
          product_option_id,
          selected_color,
          color_image_url,
          option_image_url,
          shipping_option_index,
          shipping_option_name_ar,
          sale_type,
          products (
            id,
            name,
            name_ar,
            price,
            direct_sale_price,
            sea_price,
            air_price,
            original_price,
            round_up_price,
            image_url,
            images,
            slug,
            colors,
            pre_order_shipping_options,
            shipping_type,
            category_id,
            categories (
              id,
              tax_rate,
              main_section_id
            )
          ),
          product_options (
            id,
            name_ar,
            price_adjustment
          ),
          custom_product_requests!cart_items_custom_request_id_fkey (
            id,
            product_name,
            suggested_price,
            image_url,
            quantity
          ),
          product_bundles:bundle_id (
            id,
            title_ar,
            bundle_price,
            original_price,
            image_url,
            sale_type
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch cart error:', error);
        throw error;
      }
      
      // Only update if no optimistic operation happened while we were fetching
      if (optimisticLockRef.current === lockValue) {
        setItems(data as CartItem[] || []);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
      console.warn('Cart fetch failed (non-critical):', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
    fetchPendingCartRequest();
  }, [user]);

  const addToCart = async (productId: string, optionId?: string, color?: string, quantity: number = 1, shippingInfo?: { index: number; name_ar: string }, saleType: 'direct' | 'preorder' = 'preorder'): Promise<boolean> => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      // Check for sale type conflict
      const existingProductItems = items.filter(i => i.product_id);
      if (existingProductItems.length > 0) {
        const currentCartSaleType = existingProductItems[0]?.sale_type || 'preorder';
        if (currentCartSaleType !== saleType) {
          // Signal conflict - let the caller handle confirmation
          throw new Error('SALE_TYPE_CONFLICT');
        }
      }

      // Get product data to find color image
      const { data: productData } = await supabase
        .from('products')
        .select('colors, images, image_url')
        .eq('id', productId)
        .single();
      
      let colorImageUrl: string | null = null;
      if (color && productData?.colors) {
        const selectedColorData = (productData.colors as any[]).find(
          (c: any) => c.name === color || c.name_ar === color
        );
        colorImageUrl = selectedColorData?.image_url || null;
      }
      
      // Get option data to find option image
      let optionImageUrl: string | null = null;
      if (optionId) {
        const { data: optionData } = await supabase
          .from('product_options')
          .select('image_url')
          .eq('id', optionId)
          .single();
        
        optionImageUrl = optionData?.image_url || null;
      }
      
      // Check if item with same product, option, color and shipping already exists
      const normalize = (v: any) => (v ?? '').toString().trim().toLowerCase();
      const normalizeShippingIndex = (v: any): number | null => (v === null || v === undefined) ? null : Number(v);
      
      const targetShippingIndex = normalizeShippingIndex(shippingInfo?.index);
      
      const existingItem = items.find(item => 
        item.product_id === productId && 
        normalize((item as any).product_option_id) === normalize(optionId) &&
        normalize((item as any).selected_color) === normalize(color) &&
        normalizeShippingIndex((item as any).shipping_option_index) === targetShippingIndex
      );
      
      if (existingItem) {
        await updateQuantity(existingItem.id, existingItem.quantity + quantity);
        return true;
      }

      const insertData: any = { 
        user_id: user.id, 
        product_id: productId, 
        quantity: quantity,
        sale_type: saleType,
      };
      
      if (optionId) {
        insertData.product_option_id = optionId;
      }
      
      if (color) {
        insertData.selected_color = color;
      }
      
      if (colorImageUrl) {
        insertData.color_image_url = colorImageUrl;
      }
      
      if (optionImageUrl) {
        insertData.option_image_url = optionImageUrl;
      }
      
      const safeShippingIndex = normalizeShippingIndex(shippingInfo?.index);
      const safeShippingNameAr = shippingInfo?.name_ar;

      if (safeShippingIndex !== null && Number.isFinite(safeShippingIndex)) {
        insertData.shipping_option_index = Math.trunc(safeShippingIndex);
        insertData.shipping_option_name_ar = safeShippingNameAr || null;
      }

      const { error } = await supabase
        .from('cart_items')
        .insert([insertData]);

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      
      await fetchCart();
      return true;
    } catch (error: any) {
      if (error?.message === 'SALE_TYPE_CONFLICT') throw error;
      console.error('Error adding to cart:', error);
      const msg = error?.message || error?.error_description || 'حدث خطأ في إضافة المنتج';
      toast.error(msg);
      return false;
    }
  };

  const addCustomRequestToCart = async (customRequestId: string) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    try {
      // Check if custom request already exists in cart
      const existingItem = items.find(item => item.custom_request_id === customRequestId);
      
      if (existingItem) {
        toast.info('هذا الطلب موجود بالفعل في السلة');
        return;
      }

      const { error } = await supabase
        .from('cart_items')
        .insert([{ user_id: user.id, product_id: null, custom_request_id: customRequestId, quantity: 1 }]);

      if (error) throw error;
      
      await fetchCart();
      toast.success('تمت إضافة الطلب المخصص إلى السلة');
    } catch (error) {
      console.error('Error adding custom request to cart:', error);
      toast.error('حدث خطأ في إضافة الطلب المخصص');
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    if (quantity < 1) return;

    // Optimistic update with lock to prevent fetchCart from overwriting
    optimisticLockRef.current++;
    const previousItems = items;
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, quantity } : item));

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Update quantity error:', error);
        setItems(previousItems);
        optimisticLockRef.current--;
        throw error;
      }
      
      toast.success('تم تحديث الكمية');
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('حدث خطأ في تحديث الكمية');
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    // Optimistic update with lock
    optimisticLockRef.current++;
    const previousItems = items;
    setItems(prev => prev.filter(item => item.id !== itemId));
    
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Remove from cart error:', error);
        // Revert on error
        setItems(previousItems);
        throw error;
      }
      
      toast.success('تم حذف المنتج من السلة');
    } catch (error) {
      console.error('Error removing from cart:', error);
      toast.error('حدث خطأ في حذف المنتج');
    }
  };

  const clearCart = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      setItems([]);
      toast.success('تم تفريغ السلة');
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('حدث خطأ في تفريغ السلة');
    }
  };

  const forceAddToCart = async (productId: string, optionId?: string, color?: string, quantity: number = 1, shippingInfo?: { index: number; name_ar: string }, saleType: 'direct' | 'preorder' = 'preorder'): Promise<boolean> => {
    if (!user) return false;
    try {
      // Clear cart items directly in DB
      const { error: clearError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);
      if (clearError) throw clearError;
      // Reset local items so addToCart won't detect a conflict
      setItems([]);

      // Now insert the new item directly (bypass addToCart conflict check)
      const { data: productData } = await supabase
        .from('products')
        .select('colors, images, image_url')
        .eq('id', productId)
        .single();

      let colorImageUrl: string | null = null;
      if (color && productData?.colors) {
        const selectedColorData = (productData.colors as any[]).find(
          (c: any) => c.name === color || c.name_ar === color
        );
        colorImageUrl = selectedColorData?.image_url || null;
      }

      let optionImageUrl: string | null = null;
      if (optionId) {
        const { data: optionData } = await supabase
          .from('product_options')
          .select('image_url')
          .eq('id', optionId)
          .single();
        optionImageUrl = optionData?.image_url || null;
      }

      const insertData: any = {
        user_id: user.id,
        product_id: productId,
        quantity,
        sale_type: saleType,
      };
      if (optionId) insertData.product_option_id = optionId;
      if (color) insertData.selected_color = color;
      if (colorImageUrl) insertData.color_image_url = colorImageUrl;
      if (optionImageUrl) insertData.option_image_url = optionImageUrl;
      if (shippingInfo?.index !== null && shippingInfo?.index !== undefined && Number.isFinite(shippingInfo.index)) {
        insertData.shipping_option_index = Math.trunc(shippingInfo.index);
        insertData.shipping_option_name_ar = shippingInfo.name_ar || null;
      }

      const { error } = await supabase.from('cart_items').insert([insertData]);
      if (error) throw error;

      await fetchCart();
      return true;
    } catch (error) {
      console.error('Error in forceAddToCart:', error);
      toast.error('حدث خطأ في إضافة المنتج');
      return false;
    }
  };

  const addBundleToCart = async (bundleId: string, saleType: 'direct' | 'preorder'): Promise<boolean> => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      // Check for sale type conflict
      const existingProductItems = items.filter(i => i.product_id || i.bundle_id);
      if (existingProductItems.length > 0) {
        const currentCartSaleType = existingProductItems[0]?.sale_type || 'preorder';
        if (currentCartSaleType !== saleType) {
          throw new Error('SALE_TYPE_CONFLICT');
        }
      }

      // Check if this bundle already exists in the cart
      const existingBundle = items.find(item => item.bundle_id === bundleId);
      if (existingBundle) {
        await updateQuantity(existingBundle.id, existingBundle.quantity + 1);
        return true;
      }

      const { error } = await supabase
        .from('cart_items')
        .insert([{
          user_id: user.id,
          bundle_id: bundleId,
          product_id: null,
          quantity: 1,
          sale_type: saleType,
        }]);

      if (error) {
        console.error('Bundle insert error:', error);
        throw error;
      }

      await fetchCart();
      return true;
    } catch (error: any) {
      if (error?.message === 'SALE_TYPE_CONFLICT') throw error;
      console.error('Error adding bundle to cart:', error);
      toast.error('حدث خطأ في إضافة الباقة');
      return false;
    }
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const total = items.reduce((sum, item) => {
    if (item.products) {
      const isDirect = (item as any).sale_type === 'direct';
      let itemPrice = Number(item.products.price);

      // For direct sale, use direct_sale_price if available
      if (isDirect && item.products.direct_sale_price != null) {
        itemPrice = Number(item.products.direct_sale_price);
      }

      // For pre-order, use sea_price or air_price based on shipping option
      if (!isDirect) {
        const shippingType = (item.products as any).shipping_type;
        const shippingIndex = (item as any).shipping_option_index;
        const seaPrice = (item.products as any).sea_price;
        const airPrice = (item.products as any).air_price;
        
        if (shippingType === 'sea' && seaPrice != null) {
          itemPrice = Number(seaPrice);
        } else if (shippingType === 'air' && airPrice != null) {
          itemPrice = Number(airPrice);
        } else if (shippingType === 'both' && seaPrice != null && airPrice != null) {
          // Base price is the lower one; shipping adjustment adds the difference
          itemPrice = Math.min(Number(seaPrice), Number(airPrice));
        }
      }

      // Add color price if selected and different from base price
      const selColor = (item as any).selected_color;
      const selectedColorData = selColor && item.products?.colors
        ? (item.products.colors as any[]).find((c: any) => c.name === selColor || c.name_ar === selColor || c.hex_code === selColor)
        : null;

      if (selectedColorData?.price != null) {
        // For direct sale, prefer direct_sale_price from color
        if (isDirect && selectedColorData?.direct_sale_price != null) {
          itemPrice = Number(selectedColorData.direct_sale_price);
        } else {
          itemPrice = Number(selectedColorData.price);
        }
      }

      // Add option price adjustment
      const itemOption = (item as any).product_options;
      if (itemOption?.price_adjustment) {
        itemPrice += Math.round(Number(itemOption.price_adjustment) * usdToIqd);
      }

      // Add pre-order shipping adjustment (if chosen)
      const shippingIndex = (item as any).shipping_option_index;
      const shippingOptions = item.products?.pre_order_shipping_options;
      if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
        const shippingAdjustment = Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
        itemPrice += shippingAdjustment;
      }

      // Round to nearest 250 if enabled
      if ((item.products as any)?.round_up_price === true) {
        itemPrice = Math.ceil(itemPrice / 250) * 250;
      }

      return sum + (itemPrice * item.quantity);
    } else if (item.custom_product_requests) {
      return sum + (Number(item.custom_product_requests.suggested_price) * item.quantity);
    } else if ((item as any).product_bundles) {
      return sum + (Number((item as any).product_bundles.bundle_price) * item.quantity);
    }
    return sum;
  }, 0);

  // Combined refresh function
  const refreshAll = async () => {
    await fetchCart();
    await fetchPendingCartRequest();
  };

  // Determine the current cart's sale type
  const cartSaleType = items.length > 0 
    ? (items.find(i => i.product_id || i.bundle_id)?.sale_type || 'preorder')
    : null;

  return (
    <CartContext.Provider
      value={{
        items,
        loading,
        itemCount,
        total,
        pendingCartRequest,
        cartSaleType,
        addToCart,
        forceAddToCart,
        addBundleToCart,
        addCustomRequestToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart: refreshAll,
        deleteCartRequest,
        checkAndWarnCartRequest,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};