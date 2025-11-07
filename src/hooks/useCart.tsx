import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  product_id: string | null;
  custom_request_id: string | null;
  quantity: number;
  products?: {
    id: string;
    name: string;
    name_ar: string;
    price: number;
    original_price: number | null;
    image_url: string | null;
    slug: string;
    colors?: any[];
  };
  custom_product_requests?: {
    id: string;
    product_name: string;
    suggested_price: number;
    image_url: string | null;
    quantity: number;
  };
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  itemCount: number;
  total: number;
  addToCart: (productId: string, optionId?: string, color?: string, quantity?: number) => Promise<void>;
  addCustomRequestToCart: (customRequestId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchCart = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching cart for user:', user.id);
      
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          custom_request_id,
          quantity,
          product_option_id,
          selected_color,
          products (
            id,
            name,
            name_ar,
            price,
            original_price,
            image_url,
            slug,
            colors
          ),
          custom_product_requests (
            id,
            product_name,
            suggested_price,
            image_url,
            quantity
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch cart error:', error);
        throw error;
      }
      
      console.log('Cart items fetched:', data);
      setItems(data as CartItem[] || []);
    } catch (error) {
      console.error('Error fetching cart:', error);
      toast.error('حدث خطأ في تحميل السلة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  const addToCart = async (productId: string, optionId?: string, color?: string, quantity: number = 1) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    try {
      console.log('Adding to cart:', { productId, optionId, color, quantity });
      
      // Check if item with same product, option, and color already exists
      const normalize = (v: any) => (v ?? '').toString().trim().toLowerCase();
      const existingItem = items.find(item => 
        item.product_id === productId && 
        normalize((item as any).product_option_id) === normalize(optionId) &&
        normalize((item as any).selected_color) === normalize(color)
      );
      
      console.log('Existing item found:', existingItem);
      
      if (existingItem) {
        await updateQuantity(existingItem.id, existingItem.quantity + quantity);
        return;
      }

      const insertData: any = { 
        user_id: user.id, 
        product_id: productId, 
        quantity: quantity 
      };
      
      if (optionId) {
        insertData.product_option_id = optionId;
      }
      
      if (color) {
        insertData.selected_color = color;
      }

      console.log('Inserting cart item:', insertData);

      const { error } = await supabase
        .from('cart_items')
        .insert([insertData]);

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      
      await fetchCart();
      toast.success('تمت الإضافة إلى السلة');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('حدث خطأ في إضافة المنتج');
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
    if (quantity < 1) return;

    try {
      console.log('Updating quantity:', { itemId, quantity });
      
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Update quantity error:', error);
        throw error;
      }
      
      await fetchCart();
      toast.success('تم تحديث الكمية');
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('حدث خطأ في تحديث الكمية');
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      console.log('Removing from cart:', itemId);
      
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Remove from cart error:', error);
        throw error;
      }
      
      await fetchCart();
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

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const total = items.reduce((sum, item) => {
    if (item.products) {
      let itemPrice = Number(item.products.price);
      
      // Add color price if selected and different from base price
      const selColor = (item as any).selected_color;
      const selectedColorData = selColor && item.products?.colors
        ? (item.products.colors as any[]).find((c: any) => c.name === selColor || c.name_ar === selColor || c.hex_code === selColor)
        : null;
      
      if (selectedColorData?.price != null) {
        itemPrice = Number(selectedColorData.price);
      }
      
      return sum + (itemPrice * item.quantity);
    } else if (item.custom_product_requests) {
      return sum + (Number(item.custom_product_requests.suggested_price) * item.quantity);
    }
    return sum;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        loading,
        itemCount,
        total,
        addToCart,
        addCustomRequestToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart: fetchCart,
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