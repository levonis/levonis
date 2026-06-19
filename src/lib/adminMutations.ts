import { supabase } from '@/integrations/supabase/client';

export const adminUpdateOrder = async (orderId: string, updates: Record<string, any>) => {
  const { error } = await (supabase as any).rpc('admin_update_order', {
    _order_id: orderId,
    _updates: updates,
  });
  if (error) throw error;
};

export const adminCreateOrder = async (values: Record<string, any>) => {
  const { data, error } = await (supabase as any).rpc('admin_create_order', { _values: values });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
};

export const adminDeleteOrder = async (orderId: string) => {
  const { error } = await (supabase as any).rpc('admin_delete_order', { _order_id: orderId });
  if (error) throw error;
};

export const adminUpdateProduct = async (productId: string, updates: Record<string, any>) => {
  const { error } = await (supabase as any).rpc('admin_update_product', {
    _product_id: productId,
    // Keep id inside _updates too: if PostgREST routes this overloaded RPC
    // to the single-jsonb compatibility function, it receives only _updates.
    _updates: { id: productId, ...updates },
  });
  if (!error) return;
  // Fallback for stale PostgREST schema cache that only sees a single-arg overload
  const msg = String(error?.message || '');
  const isSchemaCacheMiss =
    error?.code === 'PGRST202' ||
    /schema cache/i.test(msg) ||
    /Could not find the function/i.test(msg);
  if (isSchemaCacheMiss) {
    const { error: error2 } = await (supabase as any).rpc('admin_update_product', {
      _updates: { id: productId, ...updates },
    });
    if (error2) throw error2;
    return;
  }
  throw error;
};

export const adminCreateProduct = async (values: Record<string, any>) => {
  const { data, error } = await (supabase as any).rpc('admin_create_product', { _values: values });
  if (error) throw error;
  return data as string;
};

export const adminDeleteProduct = async (productId: string) => {
  const { error } = await (supabase as any).rpc('admin_delete_product', { _product_id: productId });
  if (error) throw error;
};