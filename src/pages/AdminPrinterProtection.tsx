import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Shield, Users, Search, Loader2, ShieldCheck, Play, Pause, X, Edit, 
  FileText, Calendar, Package, CheckCircle, Clock, AlertTriangle,
  Crown, Star, Settings, History
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import AdminQRPrinterTab from '@/components/admin/AdminQRPrinterTab';

interface ProtectionPlan {
  id: string;
  plan_type: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  monthly_price: number;
  features: string[];
  is_active: boolean;
  max_service_requests_per_month: number;
  maintenance_discount_percentage: number;
  parts_discount_percentage: number;
  waiting_period_days: number;
  priority_level: number;
  has_preventive_maintenance: boolean;
  preventive_maintenance_interval_months: number | null;
  has_replacement_printer: boolean;
  icon_name: string;
  badge_text: string | null;
  annual_coverage_cap: number | null;
  parts_discount_categories: string[] | null;
  parts_discount_type: string;
  parts_discount_value: number;
  parts_discount_limit_type: string;
  parts_discount_limit_count: number;
  display_order: number;
}

interface SubscriptionWithDetails {
  id: string;
  user_id: string;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  start_date: string;
  end_date: string | null;
  next_billing_date: string | null;
  monthly_price: number;
  admin_notes: string | null;
  auto_renew: boolean;
  waiting_period_ends_at: string | null;
  user_printers: {
    store_printers: {
      model_name_ar: string;
      serial_number: string;
    };
  };
  protection_plans: {
    id: string;
    name_ar: string;
    plan_type: string;
  };
  profiles: {
    username: string;
    email: string;
  };
}

interface SerialRequest {
  id: string;
  user_id: string;
  order_item_id: string;
  product_name_ar: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  profiles: {
    username: string;
    email: string;
  };
}

interface DeliveredOrderItem {
  id: string;
  order_id: string;
  product_name: string;
  product_name_ar: string;
  serial_number: string | null;
  order: {
    order_number: string;
    delivered_at: string;
    user_id: string;
    profiles: {
      username: string;
      email: string;
      full_name: string | null;
    };
  };
}

const AdminPrinterProtection = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editSubscriptionDialogOpen, setEditSubscriptionDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionWithDetails | null>(null);
  const [serialDialogOpen, setSerialDialogOpen] = useState(false);
  const [selectedOrderItem, setSelectedOrderItem] = useState<DeliveredOrderItem | null>(null);
  const [serialInput, setSerialInput] = useState('');
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ProtectionPlan | null>(null);
  const [addPlanDialogOpen, setAddPlanDialogOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<Partial<ProtectionPlan>>({
    plan_type: 'basic',
    name_ar: '',
    name_en: '',
    description_ar: '',
    monthly_price: 0,
    features: [],
    is_active: true,
    max_service_requests_per_month: 1,
    maintenance_discount_percentage: 0,
    parts_discount_percentage: 0,
    waiting_period_days: 30,
    priority_level: 1,
    has_preventive_maintenance: false,
    has_replacement_printer: false,
    icon_name: 'shield',
    parts_discount_categories: [],
  });
  const [requestActionDialogOpen, setRequestActionDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SerialRequest | null>(null);
  const [requestAction, setRequestAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch protection plans
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['admin-protection-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as ProtectionPlan[];
    },
    enabled: isAdmin,
  });

  // Fetch categories for parts discount
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, name_ar, slug')
        .order('name_ar');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch all subscriptions (hide cancelled)
  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['admin-subscriptions', statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('printer_subscriptions')
        .select(`
          *,
          user_printers (
            store_printers (model_name_ar, serial_number)
          ),
          protection_plans (id, name_ar, plan_type)
        `)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all' && statusFilter !== 'cancelled') {
        query = query.eq('status', statusFilter as 'active' | 'paused' | 'expired');
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = [...new Set(data?.map(s => s.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      let result = data?.map(s => ({
        ...s,
        profiles: profileMap.get(s.user_id) || { username: 'غير معروف', email: '' }
      })) as SubscriptionWithDetails[];

      // Filter by search term
      if (searchTerm) {
        result = result?.filter(s => 
          s.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.user_printers?.store_printers?.serial_number?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return result;
    },
    enabled: isAdmin,
  });

  // Fetch serial number requests
  const { data: serialRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['admin-serial-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('serial_number_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set(data?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(r => ({
        ...r,
        profiles: profileMap.get(r.user_id) || { username: 'غير معروف', email: '' }
      })) as SerialRequest[];
    },
    enabled: isAdmin,
  });

  // Fetch delivered orders needing serial numbers - ONLY printer category
  const PRINTER_CATEGORY_ID = '3cd72a43-3af6-4adb-83e4-a482b4feca25';
  const { data: deliveredItems, isLoading: deliveredLoading } = useQuery({
    queryKey: ['admin-delivered-printer-items'],
    queryFn: async () => {
      // First get product IDs in printer category
      const { data: printerProducts } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', PRINTER_CATEGORY_ID);
      
      const printerProductIds = printerProducts?.map(p => p.id) || [];
      if (printerProductIds.length === 0) return [];

      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          product_id,
          product_name,
          product_name_ar,
          serial_number,
          orders!inner (
            order_number,
            delivered_at,
            user_id,
            status,
            profiles (username, email, full_name)
          )
        `)
        .eq('orders.status', 'delivered')
        .is('serial_number', null)
        .in('product_id', printerProductIds)
        .order('orders(delivered_at)', { ascending: false });

      if (error) throw error;
      
      return data?.map(item => ({
        id: item.id,
        order_id: item.order_id,
        product_name: item.product_name,
        product_name_ar: item.product_name_ar,
        serial_number: item.serial_number,
        order: {
          order_number: (item.orders as any).order_number,
          delivered_at: (item.orders as any).delivered_at,
          user_id: (item.orders as any).user_id,
          profiles: (item.orders as any).profiles
        }
      })) as DeliveredOrderItem[];
    },
    enabled: isAdmin,
  });

  // Fetch logs
  const { data: logs } = useQuery({
    queryKey: ['printer-protection-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printer_protection_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async (updates: Partial<ProtectionPlan> & { id: string }) => {
      const { id, ...rest } = updates;
      // Cast to any to allow dynamic updates
      const data: any = { ...rest };
      const { error } = await supabase
        .from('protection_plans')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث الباقة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-protection-plans'] });
      queryClient.invalidateQueries({ queryKey: ['protection-plans'] });
      setEditPlanDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // Add new plan mutation
  const addPlanMutation = useMutation({
    mutationFn: async (plan: Partial<ProtectionPlan>) => {
      const maxOrder = plans?.reduce((max, p) => Math.max(max, p.display_order || 0), 0) || 0;
      const insertData: any = {
        ...plan,
        display_order: maxOrder + 1,
      };
      const { error } = await supabase
        .from('protection_plans')
        .insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إضافة الباقة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-protection-plans'] });
      queryClient.invalidateQueries({ queryKey: ['protection-plans'] });
      setAddPlanDialogOpen(false);
      setNewPlan({
        plan_type: 'basic',
        name_ar: '',
        name_en: '',
        description_ar: '',
        monthly_price: 0,
        features: [],
        is_active: true,
        max_service_requests_per_month: 1,
        maintenance_discount_percentage: 0,
        parts_discount_percentage: 0,
        waiting_period_days: 30,
        priority_level: 1,
        has_preventive_maintenance: false,
        has_replacement_printer: false,
        icon_name: 'shield',
        parts_discount_categories: [],
      });
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // Add serial number mutation - using RPC function
  const addSerialMutation = useMutation({
    mutationFn: async ({ itemId, serialNumber }: { itemId: string; serialNumber: string }) => {
      const { data, error } = await supabase
        .rpc('add_serial_number_to_order_item', {
          p_order_item_id: itemId,
          p_serial_number: serialNumber,
          p_admin_id: user?.id,
        });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (result && !result.success) throw new Error(result.error || 'حدث خطأ');
      return result;
    },
    onSuccess: () => {
      toast.success('تم إضافة الرقم التسلسلي بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-delivered-printer-items'] });
      queryClient.invalidateQueries({ queryKey: ['admin-serial-requests'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-printers'] });
      setSerialDialogOpen(false);
      setSelectedOrderItem(null);
      setSerialInput('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async (updates: { id: string; status?: string; plan_id?: string; admin_notes?: string }) => {
      const updateData: any = {};
      if (updates.status) {
        updateData.status = updates.status;
        if (updates.status === 'paused') updateData.paused_at = new Date().toISOString();
        if (updates.status === 'cancelled') updateData.cancelled_at = new Date().toISOString();
      }
      if (updates.plan_id) {
        updateData.plan_id = updates.plan_id;
        const plan = plans?.find(p => p.id === updates.plan_id);
        if (plan) updateData.monthly_price = plan.monthly_price;
      }
      if (updates.admin_notes !== undefined) updateData.admin_notes = updates.admin_notes;

      const { error } = await supabase
        .from('printer_subscriptions')
        .update(updateData)
        .eq('id', updates.id);

      if (error) throw error;

      // Log the action
      await supabase.from('printer_protection_logs').insert({
        admin_id: user?.id,
        action: 'update_subscription',
        entity_type: 'subscription',
        entity_id: updates.id,
        details: updateData,
      });
    },
    onSuccess: () => {
      toast.success('تم تحديث الاشتراك بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setEditSubscriptionDialogOpen(false);
      setSelectedSubscription(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // Handle serial request mutation
  const handleRequestMutation = useMutation({
    mutationFn: async ({ requestId, action, notes, orderItemId, serialNumber }: { 
      requestId: string; 
      action: 'approve' | 'reject'; 
      notes: string;
      orderItemId?: string;
      serialNumber?: string;
    }) => {
      // If approved and serial provided, use the RPC function which handles everything
      if (action === 'approve' && orderItemId && serialNumber) {
        const { data, error } = await supabase
          .rpc('add_serial_number_to_order_item', {
            p_order_item_id: orderItemId,
            p_serial_number: serialNumber,
            p_admin_id: user?.id,
          });

        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (result && !result.success) throw new Error(result.error || 'حدث خطأ');
      } else {
        // Just update status for rejection
        const { error } = await supabase
          .from('serial_number_requests')
          .update({
            status: 'rejected',
            admin_notes: notes,
            resolved_at: new Date().toISOString(),
            resolved_by: user?.id,
          })
          .eq('id', requestId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(requestAction === 'approve' ? 'تمت الموافقة وإضافة الرقم التسلسلي' : 'تم رفض الطلب');
      queryClient.invalidateQueries({ queryKey: ['admin-serial-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-delivered-printer-items'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-printers'] });
      setRequestActionDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes('');
      setSerialInput('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">نشط</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">متوقف</Badge>;
      case 'expired':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">منتهي</Badge>;
      case 'cancelled':
        return <Badge className="bg-muted text-muted-foreground">ملغي</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">قيد الانتظار</Badge>;
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">تمت الموافقة</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">مرفوض</Badge>;
      default:
        return null;
    }
  };

  const getPlanIcon = (iconName: string) => {
    switch (iconName) {
      case 'shield':
        return <Shield className="w-5 h-5" />;
      case 'star':
        return <Star className="w-5 h-5" />;
      case 'crown':
        return <Crown className="w-5 h-5" />;
      default:
        return <Shield className="w-5 h-5" />;
    }
  };

  // Stats
  const pendingRequests = serialRequests?.filter(r => r.status === 'pending').length || 0;
  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active').length || 0;
  const itemsNeedingSerial = deliveredItems?.length || 0;

  return (
    <AdminLayout title="إدارة حماية الطابعات">
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary" />
              إدارة حماية الطابعات
            </h1>
            <p className="text-muted-foreground mt-1">إدارة الباقات والاشتراكات وطلبات الأرقام التسلسلية</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeSubscriptions}</p>
                  <p className="text-sm text-muted-foreground">اشتراكات نشطة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={pendingRequests > 0 ? 'border-amber-500/50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingRequests}</p>
                  <p className="text-sm text-muted-foreground">طلبات سيريال معلقة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={itemsNeedingSerial > 0 ? 'border-orange-500/50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{itemsNeedingSerial}</p>
                  <p className="text-sm text-muted-foreground">منتجات بدون سيريال</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{subscriptions?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">إجمالي الاشتراكات</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="qr-printers" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="qr-printers">إنشاء + QR</TabsTrigger>
            <TabsTrigger value="subscriptions">الاشتراكات</TabsTrigger>
            <TabsTrigger value="plans">الباقات</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              طلبات السيريال
              {pendingRequests > 0 && (
                <Badge className="mr-2 bg-amber-500 text-white text-xs px-1.5">{pendingRequests}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="delivered">طلبات الطابعات</TabsTrigger>
            <TabsTrigger value="logs">السجل</TabsTrigger>
          </TabsList>

          {/* QR Printers Tab */}
          <TabsContent value="qr-printers" className="space-y-4">
            <AdminQRPrinterTab />
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  إدارة الاشتراكات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث بالاسم أو الإيميل أو السيريال..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="paused">متوقف</SelectItem>
                      <SelectItem value="expired">منتهي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {subscriptionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المستخدم</TableHead>
                        <TableHead>الطابعة</TableHead>
                        <TableHead>الباقة</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>تاريخ البدء</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions?.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sub.profiles?.username}</p>
                              <p className="text-sm text-muted-foreground">{sub.profiles?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sub.user_printers?.store_printers?.model_name_ar}</p>
                              <p className="text-xs font-mono text-muted-foreground" dir="ltr">
                                {sub.user_printers?.store_printers?.serial_number}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{sub.protection_plans?.name_ar}</TableCell>
                          <TableCell>{sub.monthly_price?.toLocaleString()} د.ع</TableCell>
                          <TableCell>{getStatusBadge(sub.status)}</TableCell>
                          <TableCell>{format(new Date(sub.start_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedSubscription(sub);
                                  setEditSubscriptionDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              {sub.status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => updateSubscriptionMutation.mutate({ id: sub.id, status: 'paused' })}
                                >
                                  <Pause className="w-4 h-4" />
                                </Button>
                              )}
                              {sub.status === 'paused' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => updateSubscriptionMutation.mutate({ id: sub.id, status: 'active' })}
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                              )}
                              {(sub.status === 'active' || sub.status === 'paused') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => updateSubscriptionMutation.mutate({ id: sub.id, status: 'cancelled' })}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!subscriptions || subscriptions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            لا توجد اشتراكات
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  إدارة الباقات
                </CardTitle>
                <Button onClick={() => setAddPlanDialogOpen(true)}>
                  إضافة باقة جديدة
                </Button>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {plans?.map((plan) => (
                      <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-2 rounded-lg ${
                                plan.plan_type === 'basic' ? 'bg-blue-500/10 text-blue-500' :
                                plan.plan_type === 'standard' ? 'bg-purple-500/10 text-purple-500' :
                                'bg-amber-500/10 text-amber-500'
                              }`}>
                                {getPlanIcon(plan.icon_name)}
                              </div>
                              <div>
                                <CardTitle className="text-lg">{plan.name_ar}</CardTitle>
                                <p className="text-sm text-muted-foreground">{plan.name_en}</p>
                              </div>
                            </div>
                            <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                              {plan.is_active ? 'نشطة' : 'معطلة'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-2xl font-bold">
                            {plan.monthly_price.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">د.ع/شهر</span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">خصم الصيانة:</span>
                              <span>{plan.maintenance_discount_percentage}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">خصم قطع الغيار:</span>
                              <span>{plan.parts_discount_percentage}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">طلبات الخدمة/شهر:</span>
                              <span>{plan.max_service_requests_per_month}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">فترة الانتظار:</span>
                              <span>{plan.waiting_period_days} يوم</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setSelectedPlan(plan);
                              setEditPlanDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 ml-2" />
                            تعديل
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Serial Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  طلبات إضافة الرقم التسلسلي
                </CardTitle>
              </CardHeader>
              <CardContent>
                {requestsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المستخدم</TableHead>
                        <TableHead>المنتج</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>تاريخ الطلب</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serialRequests?.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.profiles?.username}</p>
                              <p className="text-sm text-muted-foreground">{request.profiles?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{request.product_name_ar}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>{format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                          <TableCell>
                            {request.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-500"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setRequestAction('approve');
                                    setRequestActionDialogOpen(true);
                                  }}
                                >
                                  <CheckCircle className="w-4 h-4 ml-1" />
                                  موافقة
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setRequestAction('reject');
                                    setRequestActionDialogOpen(true);
                                  }}
                                >
                                  <X className="w-4 h-4 ml-1" />
                                  رفض
                                </Button>
                              </div>
                            )}
                            {request.admin_notes && (
                              <p className="text-xs text-muted-foreground mt-1">{request.admin_notes}</p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!serialRequests || serialRequests.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            لا توجد طلبات
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delivered Orders Tab */}
          <TabsContent value="delivered" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  الطلبات الموصلة بدون رقم تسلسلي
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deliveredLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : deliveredItems && deliveredItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الطلب</TableHead>
                        <TableHead>المستخدم</TableHead>
                        <TableHead>المنتج</TableHead>
                        <TableHead>تاريخ التوصيل</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveredItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.order?.order_number}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.order?.profiles?.full_name || item.order?.profiles?.username}</p>
                              <p className="text-sm text-muted-foreground">{item.order?.profiles?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{item.product_name_ar}</TableCell>
                          <TableCell>{item.order?.delivered_at ? format(new Date(item.order.delivered_at), 'dd/MM/yyyy') : '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrderItem(item);
                                setSerialDialogOpen(true);
                              }}
                            >
                              إضافة سيريال
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p>جميع الطلبات الموصلة لديها رقم تسلسلي</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  سجل التغييرات
                </CardTitle>
                {logs && logs.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (!confirm('هل أنت متأكد من حذف جميع السجلات؟')) return;
                      const { error } = await supabase
                        .from('printer_protection_logs')
                        .delete()
                        .neq('id', '00000000-0000-0000-0000-000000000000');
                      if (error) {
                        toast.error('فشل حذف السجلات');
                      } else {
                        toast.success('تم حذف جميع السجلات');
                        queryClient.invalidateQueries({ queryKey: ['printer-protection-logs'] });
                      }
                    }}
                  >
                    <X className="w-4 h-4 ml-1" />
                    حذف الكل
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الإجراء</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>التفاصيل</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>حذف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell>{log.entity_type}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </TableCell>
                        <TableCell>{format(new Date(log.created_at!), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-8 w-8"
                            onClick={async () => {
                              const { error } = await supabase
                                .from('printer_protection_logs')
                                .delete()
                                .eq('id', log.id);
                              if (error) {
                                toast.error('فشل الحذف');
                              } else {
                                queryClient.invalidateQueries({ queryKey: ['printer-protection-logs'] });
                              }
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!logs || logs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          لا توجد سجلات
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Subscription Dialog */}
        <Dialog open={editSubscriptionDialogOpen} onOpenChange={setEditSubscriptionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل الاشتراك</DialogTitle>
            </DialogHeader>
            {selectedSubscription && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>تغيير الباقة</Label>
                  <Select
                    defaultValue={selectedSubscription.protection_plans?.id}
                    onValueChange={(value) => {
                      updateSubscriptionMutation.mutate({
                        id: selectedSubscription.id,
                        plan_id: value,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.filter(p => p.is_active).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name_ar} - {plan.monthly_price.toLocaleString()} د.ع
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات الإدارة</Label>
                  <Textarea
                    defaultValue={selectedSubscription.admin_notes || ''}
                    onChange={(e) => {
                      // Save on blur
                    }}
                    onBlur={(e) => {
                      if (e.target.value !== selectedSubscription.admin_notes) {
                        updateSubscriptionMutation.mutate({
                          id: selectedSubscription.id,
                          admin_notes: e.target.value,
                        });
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Serial Dialog */}
        <Dialog open={serialDialogOpen} onOpenChange={setSerialDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة رقم تسلسلي</DialogTitle>
              <DialogDescription>
                أدخل الرقم التسلسلي للمنتج: {selectedOrderItem?.product_name_ar}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الرقم التسلسلي</Label>
                <Input
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="مثال: SN-123456789"
                  dir="ltr"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSerialDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => {
                  if (!serialInput.trim()) {
                    toast.error('الرجاء إدخال الرقم التسلسلي');
                    return;
                  }
                  addSerialMutation.mutate({
                    itemId: selectedOrderItem!.id,
                    serialNumber: serialInput.trim(),
                  });
                }}
                disabled={addSerialMutation.isPending}
              >
                {addSerialMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'حفظ'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Plan Dialog */}
        <Dialog open={editPlanDialogOpen} onOpenChange={setEditPlanDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>تعديل الباقة: {selectedPlan?.name_ar}</DialogTitle>
            </DialogHeader>
            {selectedPlan && (
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>السعر الشهري (د.ع)</Label>
                    <Input
                      type="number"
                      defaultValue={selectedPlan.monthly_price}
                      onChange={(e) => setSelectedPlan({
                        ...selectedPlan,
                        monthly_price: Number(e.target.value),
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>طلبات الخدمة/شهر</Label>
                    <Input
                      type="number"
                      defaultValue={selectedPlan.max_service_requests_per_month}
                      onChange={(e) => setSelectedPlan({
                        ...selectedPlan,
                        max_service_requests_per_month: Number(e.target.value),
                      })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>خصم الصيانة (%)</Label>
                    <Input
                      type="number"
                      defaultValue={selectedPlan.maintenance_discount_percentage}
                      onChange={(e) => setSelectedPlan({
                        ...selectedPlan,
                        maintenance_discount_percentage: Number(e.target.value),
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>خصم قطع الغيار (%)</Label>
                    <Input
                      type="number"
                      defaultValue={selectedPlan.parts_discount_percentage}
                      onChange={(e) => setSelectedPlan({
                        ...selectedPlan,
                        parts_discount_percentage: Number(e.target.value),
                      })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>فترة الانتظار (أيام)</Label>
                    <Input
                      type="number"
                      defaultValue={selectedPlan.waiting_period_days}
                      onChange={(e) => setSelectedPlan({
                        ...selectedPlan,
                        waiting_period_days: Number(e.target.value),
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>مستوى الأولوية</Label>
                    <Input
                      type="number"
                      defaultValue={selectedPlan.priority_level}
                      onChange={(e) => setSelectedPlan({
                        ...selectedPlan,
                        priority_level: Number(e.target.value),
                      })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>الباقة نشطة</Label>
                  <Switch
                    checked={selectedPlan.is_active}
                    onCheckedChange={(checked) => setSelectedPlan({
                      ...selectedPlan,
                      is_active: checked,
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>صيانة وقائية</Label>
                  <Switch
                    checked={selectedPlan.has_preventive_maintenance}
                    onCheckedChange={(checked) => setSelectedPlan({
                      ...selectedPlan,
                      has_preventive_maintenance: checked,
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>أقسام الخصم (مفصولة بفاصلة)</Label>
                  <Input
                    defaultValue={selectedPlan.parts_discount_categories?.join('، ') || ''}
                    onChange={(e) => setSelectedPlan({
                      ...selectedPlan,
                      parts_discount_categories: e.target.value.split(/[,،]/).map(s => s.trim()).filter(Boolean),
                    })}
                    placeholder="مثال: صيانة بامبولاب، قطع غيار"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>خدمة استبدال عند الكسر والتلف</Label>
                  <Switch
                    checked={selectedPlan.has_replacement_printer}
                    onCheckedChange={(checked) => setSelectedPlan({
                      ...selectedPlan,
                      has_replacement_printer: checked,
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>نص الشارة (مثل: الأكثر شعبية)</Label>
                  <Input
                    defaultValue={selectedPlan.badge_text || ''}
                    onChange={(e) => setSelectedPlan({
                      ...selectedPlan,
                      badge_text: e.target.value || null,
                    })}
                    placeholder="اتركه فارغاً لإخفاء الشارة"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPlanDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => {
                  if (selectedPlan) {
                    updatePlanMutation.mutate({
                      id: selectedPlan.id,
                      monthly_price: selectedPlan.monthly_price,
                      max_service_requests_per_month: selectedPlan.max_service_requests_per_month,
                      maintenance_discount_percentage: selectedPlan.maintenance_discount_percentage,
                      parts_discount_percentage: selectedPlan.parts_discount_percentage,
                      waiting_period_days: selectedPlan.waiting_period_days,
                      priority_level: selectedPlan.priority_level,
                      is_active: selectedPlan.is_active,
                      has_preventive_maintenance: selectedPlan.has_preventive_maintenance,
                      has_replacement_printer: selectedPlan.has_replacement_printer,
                      parts_discount_categories: selectedPlan.parts_discount_categories,
                      badge_text: selectedPlan.badge_text,
                    });
                  }
                }}
                disabled={updatePlanMutation.isPending}
              >
                {updatePlanMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'حفظ التغييرات'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Action Dialog */}
        <Dialog open={requestActionDialogOpen} onOpenChange={setRequestActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {requestAction === 'approve' ? 'الموافقة على الطلب' : 'رفض الطلب'}
              </DialogTitle>
              <DialogDescription>
                المنتج: {selectedRequest?.product_name_ar}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {requestAction === 'approve' && (
                <div className="space-y-2">
                  <Label>الرقم التسلسلي</Label>
                  <Input
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                    placeholder="أدخل الرقم التسلسلي للطابعة"
                    dir="ltr"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>ملاحظات للمستخدم</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={requestAction === 'approve' ? 'تم إضافة الرقم التسلسلي بنجاح' : 'سبب الرفض...'}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestActionDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                variant={requestAction === 'approve' ? 'default' : 'destructive'}
                onClick={() => {
                  if (requestAction === 'approve' && !serialInput.trim()) {
                    toast.error('الرجاء إدخال الرقم التسلسلي');
                    return;
                  }
                  handleRequestMutation.mutate({
                    requestId: selectedRequest!.id,
                    action: requestAction,
                    notes: adminNotes,
                    orderItemId: requestAction === 'approve' ? selectedRequest?.order_item_id : undefined,
                    serialNumber: requestAction === 'approve' ? serialInput.trim() : undefined,
                  });
                }}
                disabled={handleRequestMutation.isPending}
              >
                {handleRequestMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : requestAction === 'approve' ? (
                  'موافقة وإضافة السيريال'
                ) : (
                  'رفض الطلب'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Plan Dialog */}
        <Dialog open={addPlanDialogOpen} onOpenChange={setAddPlanDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة باقة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم الباقة (عربي)</Label>
                  <Input
                    value={newPlan.name_ar || ''}
                    onChange={(e) => setNewPlan({ ...newPlan, name_ar: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم الباقة (إنجليزي)</Label>
                  <Input
                    value={newPlan.name_en || ''}
                    onChange={(e) => setNewPlan({ ...newPlan, name_en: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>نوع الباقة</Label>
                <Select
                  value={newPlan.plan_type}
                  onValueChange={(v) => setNewPlan({ ...newPlan, plan_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">أساسية</SelectItem>
                    <SelectItem value="standard">متوسطة</SelectItem>
                    <SelectItem value="comprehensive">شاملة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>السعر الشهري (د.ع)</Label>
                  <Input
                    type="number"
                    value={newPlan.monthly_price || 0}
                    onChange={(e) => setNewPlan({ ...newPlan, monthly_price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>فترة الانتظار (أيام)</Label>
                  <Input
                    type="number"
                    value={newPlan.waiting_period_days || 30}
                    onChange={(e) => setNewPlan({ ...newPlan, waiting_period_days: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>خصم الصيانة (%)</Label>
                  <Input
                    type="number"
                    value={newPlan.maintenance_discount_percentage || 0}
                    onChange={(e) => setNewPlan({ ...newPlan, maintenance_discount_percentage: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>خصم قطع الغيار (%)</Label>
                  <Input
                    type="number"
                    value={newPlan.parts_discount_percentage || 0}
                    onChange={(e) => setNewPlan({ ...newPlan, parts_discount_percentage: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>أقسام الخصم (مفصولة بفاصلة)</Label>
                <Input
                  value={newPlan.parts_discount_categories?.join('، ') || ''}
                  onChange={(e) => setNewPlan({ ...newPlan, parts_discount_categories: e.target.value.split(/[,،]/).map(s => s.trim()).filter(Boolean) })}
                  placeholder="مثال: صيانة بامبولاب، قطع غيار"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>خدمة استبدال عند الكسر والتلف</Label>
                <Switch
                  checked={newPlan.has_replacement_printer || false}
                  onCheckedChange={(checked) => setNewPlan({ ...newPlan, has_replacement_printer: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPlanDialogOpen(false)}>إلغاء</Button>
              <Button
                onClick={() => {
                  if (!newPlan.name_ar || !newPlan.name_en) {
                    toast.error('الرجاء إدخال اسم الباقة');
                    return;
                  }
                  addPlanMutation.mutate(newPlan);
                }}
                disabled={addPlanMutation.isPending}
              >
                {addPlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إضافة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPrinterProtection;