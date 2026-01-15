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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Printer, Shield, Users, Search, Plus, Loader2, 
  ShieldCheck, ShieldX, Play, Pause, X, Edit, 
  FileText, Calendar, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface StorePrinter {
  id: string;
  model_name: string;
  model_name_ar: string;
  serial_number: string;
  sold_at: string | null;
  is_registered: boolean;
  created_at: string;
}

interface UserPrinterWithDetails {
  id: string;
  user_id: string;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  store_printers: {
    model_name_ar: string;
    serial_number: string;
  };
  profiles: {
    username: string;
    email: string;
  };
  printer_subscriptions: Array<{
    id: string;
    status: string;
    start_date: string;
    monthly_price: number;
    protection_plans: {
      name_ar: string;
      plan_type: string;
    };
  }>;
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

const AdminPrinterProtection = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addPrinterDialogOpen, setAddPrinterDialogOpen] = useState(false);
  const [editSubscriptionDialogOpen, setEditSubscriptionDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionWithDetails | null>(null);
  
  // New printer form state
  const [newPrinter, setNewPrinter] = useState({
    model_name: '',
    model_name_ar: '',
    serial_number: '',
  });

  // Fetch store printers
  const { data: storePrinters, isLoading: printersLoading } = useQuery({
    queryKey: ['admin-store-printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_printers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StorePrinter[];
    },
    enabled: isAdmin,
  });

  // Fetch registered printers with user details
  const { data: registeredPrinters, isLoading: registeredLoading } = useQuery({
    queryKey: ['admin-registered-printers', searchTerm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_printers')
        .select(`
          *,
          store_printers (model_name_ar, serial_number),
          printer_subscriptions (
            id, status, start_date, monthly_price,
            protection_plans (name_ar, plan_type)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = [...new Set(data?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data?.map(p => ({
        ...p,
        profiles: profileMap.get(p.user_id) || { username: 'غير معروف', email: '' }
      })) as UserPrinterWithDetails[];
    },
    enabled: isAdmin,
  });

  // Fetch all subscriptions
  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['admin-subscriptions', statusFilter],
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
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'active' | 'paused' | 'expired' | 'cancelled');
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
      
      return data?.map(s => ({
        ...s,
        profiles: profileMap.get(s.user_id) || { username: 'غير معروف', email: '' }
      })) as SubscriptionWithDetails[];
    },
    enabled: isAdmin,
  });

  // Fetch protection plans for editing
  const { data: plans } = useQuery({
    queryKey: ['protection-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  // Fetch logs
  const { data: logs } = useQuery({
    queryKey: ['printer-protection-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printer_protection_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Add store printer mutation
  const addPrinterMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('store_printers')
        .insert(newPrinter);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تمت إضافة الطابعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-store-printers'] });
      setAddPrinterDialogOpen(false);
      setNewPrinter({ model_name: '', model_name_ar: '', serial_number: '' });
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
      default:
        return null;
    }
  };

  const filteredPrinters = registeredPrinters?.filter(p => 
    p.store_printers?.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.store_printers?.model_name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalPrinters = storePrinters?.length || 0;
  const registeredCount = storePrinters?.filter(p => p.is_registered).length || 0;
  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active').length || 0;

  return (
    <AdminLayout title="إدارة حماية الطابعات">
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary" />
              إدارة حماية الطابعات
            </h1>
            <p className="text-muted-foreground mt-1">إدارة الطابعات والاشتراكات</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Printer className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalPrinters}</p>
                  <p className="text-sm text-muted-foreground">طابعات المتجر</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{registeredCount}</p>
                  <p className="text-sm text-muted-foreground">طابعات مسجلة</p>
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
                  <p className="text-2xl font-bold">{activeSubscriptions}</p>
                  <p className="text-sm text-muted-foreground">اشتراكات نشطة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <FileText className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{logs?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">سجل العمليات</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="subscriptions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="subscriptions">الاشتراكات</TabsTrigger>
            <TabsTrigger value="printers">الطابعات المسجلة</TabsTrigger>
            <TabsTrigger value="store-printers">طابعات المتجر</TabsTrigger>
            <TabsTrigger value="logs">سجل العمليات</TabsTrigger>
          </TabsList>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="paused">متوقف</SelectItem>
                    <SelectItem value="expired">منتهي</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>الطابعة</TableHead>
                    <TableHead>الرقم التسلسلي</TableHead>
                    <TableHead>الباقة</TableHead>
                    <TableHead>تاريخ البدء</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptionsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : subscriptions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا توجد اشتراكات
                      </TableCell>
                    </TableRow>
                  ) : (
                    subscriptions?.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sub.profiles?.username}</p>
                            <p className="text-xs text-muted-foreground">{sub.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{sub.user_printers?.store_printers?.model_name_ar}</TableCell>
                        <TableCell className="font-mono text-xs" dir="ltr">
                          {sub.user_printers?.store_printers?.serial_number}
                        </TableCell>
                        <TableCell>{sub.protection_plans?.name_ar}</TableCell>
                        <TableCell>
                          {format(new Date(sub.start_date), 'dd/MM/yyyy', { locale: ar })}
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {sub.status === 'active' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => updateSubscriptionMutation.mutate({ id: sub.id, status: 'paused' })}
                                title="إيقاف مؤقت"
                              >
                                <Pause className="w-4 h-4" />
                              </Button>
                            )}
                            {sub.status === 'paused' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => updateSubscriptionMutation.mutate({ id: sub.id, status: 'active' })}
                                title="تفعيل"
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setEditSubscriptionDialogOpen(true);
                              }}
                              title="تعديل"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {sub.status !== 'cancelled' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => updateSubscriptionMutation.mutate({ id: sub.id, status: 'cancelled' })}
                                title="إلغاء"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Registered Printers Tab */}
          <TabsContent value="printers" className="space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، البريد، الرقم التسلسلي..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>الموديل</TableHead>
                    <TableHead>الرقم التسلسلي</TableHead>
                    <TableHead>حالة التحقق</TableHead>
                    <TableHead>الاشتراك</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registeredLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredPrinters?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا توجد طابعات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPrinters?.map((printer) => {
                      const activeSubscription = printer.printer_subscriptions?.find(s => s.status === 'active');
                      return (
                        <TableRow key={printer.id}>
                          <TableCell className="font-medium">{printer.profiles?.username}</TableCell>
                          <TableCell>{printer.profiles?.email}</TableCell>
                          <TableCell>{printer.store_printers?.model_name_ar}</TableCell>
                          <TableCell className="font-mono text-xs" dir="ltr">
                            {printer.store_printers?.serial_number}
                          </TableCell>
                          <TableCell>
                            {printer.verification_status === 'verified' ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">موثق</Badge>
                            ) : (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">قيد المراجعة</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {activeSubscription ? (
                              <Badge className="bg-primary/20 text-primary border-primary/30">
                                {activeSubscription.protection_plans?.name_ar}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">غير مشترك</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(printer.created_at), 'dd/MM/yyyy', { locale: ar })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Store Printers Tab */}
          <TabsContent value="store-printers" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setAddPrinterDialogOpen(true)}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة طابعة
              </Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموديل (EN)</TableHead>
                    <TableHead>الموديل (AR)</TableHead>
                    <TableHead>الرقم التسلسلي</TableHead>
                    <TableHead>تاريخ البيع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ الإضافة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : storePrinters?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا توجد طابعات
                      </TableCell>
                    </TableRow>
                  ) : (
                    storePrinters?.map((printer) => (
                      <TableRow key={printer.id}>
                        <TableCell>{printer.model_name}</TableCell>
                        <TableCell>{printer.model_name_ar}</TableCell>
                        <TableCell className="font-mono text-xs" dir="ltr">
                          {printer.serial_number}
                        </TableCell>
                        <TableCell>
                          {printer.sold_at 
                            ? format(new Date(printer.sold_at), 'dd/MM/yyyy', { locale: ar })
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {printer.is_registered ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">مسجلة</Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground">غير مسجلة</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(printer.created_at), 'dd/MM/yyyy', { locale: ar })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الإجراء</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        لا توجد سجلات
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                        </TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.entity_type}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Printer Dialog */}
        <Dialog open={addPrinterDialogOpen} onOpenChange={setAddPrinterDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة طابعة جديدة للمتجر</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم الموديل (English)</Label>
                <Input
                  value={newPrinter.model_name}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, model_name: e.target.value }))}
                  placeholder="e.g., Creality Ender 3"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>اسم الموديل (العربية)</Label>
                <Input
                  value={newPrinter.model_name_ar}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, model_name_ar: e.target.value }))}
                  placeholder="مثال: كريالتي إندر 3"
                />
              </div>
              <div className="space-y-2">
                <Label>الرقم التسلسلي</Label>
                <Input
                  value={newPrinter.serial_number}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, serial_number: e.target.value }))}
                  placeholder="Serial Number"
                  dir="ltr"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPrinterDialogOpen(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={() => addPrinterMutation.mutate()}
                disabled={!newPrinter.model_name || !newPrinter.model_name_ar || !newPrinter.serial_number || addPrinterMutation.isPending}
              >
                {addPrinterMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog open={editSubscriptionDialogOpen} onOpenChange={setEditSubscriptionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل الاشتراك</DialogTitle>
            </DialogHeader>
            {selectedSubscription && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <p><strong>المستخدم:</strong> {selectedSubscription.profiles?.username}</p>
                  <p><strong>الطابعة:</strong> {selectedSubscription.user_printers?.store_printers?.model_name_ar}</p>
                </div>
                
                <div className="space-y-2">
                  <Label>الباقة</Label>
                  <Select 
                    defaultValue={selectedSubscription.protection_plans?.id}
                    onValueChange={(value) => updateSubscriptionMutation.mutate({ 
                      id: selectedSubscription.id, 
                      plan_id: value 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name_ar} - {plan.monthly_price.toLocaleString()} د.ع
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select 
                    defaultValue={selectedSubscription.status}
                    onValueChange={(value) => updateSubscriptionMutation.mutate({ 
                      id: selectedSubscription.id, 
                      status: value 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="paused">متوقف</SelectItem>
                      <SelectItem value="expired">منتهي</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات الإدارة</Label>
                  <Textarea
                    defaultValue={selectedSubscription.admin_notes || ''}
                    placeholder="أضف ملاحظات..."
                    onBlur={(e) => {
                      if (e.target.value !== selectedSubscription.admin_notes) {
                        updateSubscriptionMutation.mutate({ 
                          id: selectedSubscription.id, 
                          admin_notes: e.target.value 
                        });
                      }
                    }}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSubscriptionDialogOpen(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPrinterProtection;
