import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, Search, User, Package, Plus, Minus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface OrderItem {
  product_id: string;
  product_name: string;
  product_name_ar: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  image_url?: string;
}

interface AdminCreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AdminCreateOrderDialog = ({ open, onOpenChange }: AdminCreateOrderDialogProps) => {
  const queryClient = useQueryClient();

  // User search state
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserResults, setShowUserResults] = useState(false);

  // Product search state
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);

  // Order items state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [status, setStatus] = useState('pending');
  const [currency, setCurrency] = useState('دينار عراقي');

  // Fetch users for search
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, phone_number')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch products for search
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ar, price, cost_price, image_url, slug')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Filtered users based on search
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return [];
    const term = userSearchTerm.toLowerCase().trim();
    return users.filter((u: any) =>
      u.username?.toLowerCase().includes(term) ||
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.id?.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [users, userSearchTerm]);

  // Filtered products based on search
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return [];
    const term = productSearchTerm.toLowerCase().trim();
    return products.filter((p: any) =>
      p.name?.toLowerCase().includes(term) ||
      p.name_ar?.toLowerCase().includes(term) ||
      p.slug?.toLowerCase().includes(term) ||
      p.id?.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [products, productSearchTerm]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenue = orderItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const totalCost = orderItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
    const profit = totalRevenue - totalCost;
    return { totalRevenue, totalCost, profit };
  }, [orderItems]);

  // Select user
  const handleSelectUser = useCallback((user: any) => {
    setSelectedUser(user);
    setUserSearchTerm('');
    setShowUserResults(false);
    // Auto-fill phone if available
    if (user.phone_number) {
      setPhoneNumber(user.phone_number);
    }
  }, []);

  // Add product to order
  const handleAddProduct = useCallback((product: any) => {
    const existingIndex = orderItems.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      // Increment quantity
      const updated = [...orderItems];
      updated[existingIndex].quantity += 1;
      setOrderItems(updated);
    } else {
      // Add new item
      setOrderItems(prev => [...prev, {
        product_id: product.id,
        product_name: product.name,
        product_name_ar: product.name_ar,
        quantity: 1,
        unit_price: product.price || 0,
        cost_price: product.cost_price || 0,
        image_url: product.image_url,
      }]);
    }
    
    setProductSearchTerm('');
    setShowProductResults(false);
  }, [orderItems]);

  // Update item quantity
  const updateQuantity = useCallback((index: number, delta: number) => {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, updated[index].quantity + delta);
    setOrderItems(updated);
  }, [orderItems]);

  // Update item prices
  const updateItemPrice = useCallback((index: number, field: 'unit_price' | 'cost_price', value: number) => {
    const updated = [...orderItems];
    updated[index][field] = value;
    setOrderItems(updated);
  }, [orderItems]);

  // Remove item
  const removeItem = useCallback((index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('يجب اختيار مستخدم');
      if (orderItems.length === 0) throw new Error('يجب إضافة منتج واحد على الأقل');
      if (!phoneNumber.trim()) throw new Error('يجب إدخال رقم الهاتف');
      if (!governorate.trim()) throw new Error('يجب إدخال المحافظة');
      if (!shippingAddress.trim()) throw new Error('يجب إدخال عنوان الشحن');

      // Generate order number
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      // Calculate total costs
      const totalProductCost = orderItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: selectedUser.id,
          order_number: orderNumber,
          total_amount: totals.totalRevenue,
          subtotal: totals.totalRevenue,
          admin_product_cost: totalProductCost,
          profit_amount: totals.profit,
          shipping_address: shippingAddress,
          phone_number: phoneNumber,
          governorate: governorate,
          shipping_notes: shippingNotes || null,
          status: status,
          currency: currency,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItemsData = orderItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_name_ar: item.product_name_ar,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        cost_price: item.cost_price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم إنشاء الطلب بنجاح');
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء إنشاء الطلب');
    },
  });

  // Reset form
  const resetForm = () => {
    setSelectedUser(null);
    setUserSearchTerm('');
    setProductSearchTerm('');
    setOrderItems([]);
    setPhoneNumber('');
    setGovernorate('');
    setShippingAddress('');
    setShippingNotes('');
    setStatus('pending');
    setCurrency('دينار عراقي');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">إنشاء طلب جديد</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              اختيار العميل *
            </Label>
            
            {selectedUser ? (
              <Card className="p-3 bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedUser.full_name || selectedUser.username}</p>
                    <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                    {selectedUser.email && (
                      <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث باسم المستخدم، الاسم، البريد، أو المعرف..."
                    value={userSearchTerm}
                    onChange={(e) => {
                      setUserSearchTerm(e.target.value);
                      setShowUserResults(true);
                    }}
                    onFocus={() => setShowUserResults(true)}
                    className="pr-10"
                  />
                </div>
                
                {showUserResults && filteredUsers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredUsers.map((user: any) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full px-4 py-2 text-right hover:bg-accent transition-colors border-b last:border-b-0"
                        onClick={() => handleSelectUser(user)}
                      >
                        <p className="font-medium">{user.full_name || user.username}</p>
                        <p className="text-xs text-muted-foreground">@{user.username} • {user.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                
                {showUserResults && userSearchTerm && filteredUsers.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg p-4 text-center text-muted-foreground">
                    لا توجد نتائج
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Products Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              إضافة المنتجات *
            </Label>

            <div className="relative">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالمنتج، الاسم، أو الكود..."
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value);
                    setShowProductResults(true);
                  }}
                  onFocus={() => setShowProductResults(true)}
                  className="pr-10"
                />
              </div>
              
              {showProductResults && filteredProducts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredProducts.map((product: any) => (
                    <button
                      key={product.id}
                      type="button"
                      className="w-full px-4 py-2 text-right hover:bg-accent transition-colors border-b last:border-b-0 flex items-center gap-3"
                      onClick={() => handleAddProduct(product)}
                    >
                      {product.image_url && (
                        <img 
                          src={product.image_url} 
                          alt={product.name_ar}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{product.name_ar}</p>
                        <p className="text-xs text-muted-foreground">
                          السعر: {formatPrice(product.price)} • التكلفة: {formatPrice(product.cost_price || 0)}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Order Items List */}
            {orderItems.length > 0 && (
              <div className="space-y-2 mt-4">
                {orderItems.map((item, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-start gap-3">
                      {item.image_url && (
                        <img 
                          src={item.image_url} 
                          alt={item.product_name_ar}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-sm">{item.product_name_ar}</p>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {/* Quantity */}
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(index, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(index, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {/* Unit Price */}
                          <div>
                            <Label className="text-xs text-muted-foreground">السعر</Label>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateItemPrice(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm"
                            />
                          </div>
                          
                          {/* Cost Price */}
                          <div>
                            <Label className="text-xs text-muted-foreground">التكلفة</Label>
                            <Input
                              type="number"
                              value={item.cost_price}
                              onChange={(e) => updateItemPrice(index, 'cost_price', parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
                
                {/* Totals Summary */}
                <Card className="p-4 bg-muted/50">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">إجمالي المبيعات</p>
                      <p className="font-bold text-lg">{formatPrice(totals.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">إجمالي التكلفة</p>
                      <p className="font-bold text-lg text-orange-600">{formatPrice(totals.totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">الربح المتوقع</p>
                      <p className={`font-bold text-lg ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPrice(totals.profit)}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
            
            {orderItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                ابحث وأضف منتجات للطلب
              </p>
            )}
          </div>

          {/* Customer Details */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number">رقم الهاتف *</Label>
              <Input
                id="phone_number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="07XXXXXXXXX"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="governorate">المحافظة *</Label>
              <Input
                id="governorate"
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                placeholder="بغداد"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipping_address">عنوان الشحن *</Label>
            <Textarea
              id="shipping_address"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="العنوان الكامل"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">الحالة</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="pending">قيد الانتظار</option>
                <option value="confirmed">مؤكد</option>
                <option value="processing">قيد التجهيز</option>
                <option value="shipped">تم الشحن</option>
                <option value="delivered">تم التوصيل</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">العملة</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="دينار عراقي"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipping_notes">ملاحظات الشحن</Label>
            <Textarea
              id="shipping_notes"
              value={shippingNotes}
              onChange={(e) => setShippingNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              rows={2}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={createOrderMutation.isPending || !selectedUser || orderItems.length === 0}
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                'إنشاء الطلب'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminCreateOrderDialog;
