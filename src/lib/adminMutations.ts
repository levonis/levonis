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
  if (!productId) throw new Error('adminUpdateProduct: productId is required');
  // Place id AFTER the spread so a stray `id: undefined` in `updates`
  // (kept by the edit form) cannot wipe it during JSON serialization.
  // Use the single-arg overload to avoid PostgREST overload ambiguity.
  const payload = { ...updates, id: productId, product_id: productId };
  const { error } = await (supabase as any).rpc('admin_update_product', { _updates: payload });
  if (error) throw error;
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