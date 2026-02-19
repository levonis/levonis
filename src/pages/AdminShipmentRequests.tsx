import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Truck, CheckCircle, Clock, Search, User, Phone, MapPin, Calendar, Hash, Eye, Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";

interface ShipmentRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking_number: string | null;
  shipping_address: string | null;
  phone_number: string | null;
  admin_notes: string | null;
  governorate: string | null;
  user_profile?: {
    username: string;
    full_name: string | null;
    phone_number: string | null;
    governorate: string | null;
  } | null;
  products?: any[];
}

const formatBaghdadTime = (dateString: string) => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, 'dd MMM yyyy - hh:mm a', { locale: ar });
};

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'قيد الانتظار', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: Clock },
  processing: { label: 'قيد المعالجة', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Package },
  confirmed: { label: 'تم التأكيد', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30', icon: CheckCircle },
  shipped: { label: 'تم الشحن', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30', icon: Truck },
  on_the_way: { label: 'في طريقه إليك', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30', icon: Truck },
  delivered: { label: 'تم التسليم', color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: CheckCircle },
};

export default function AdminShipmentRequests() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ShipmentRequest | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    tracking_number: '',
    admin_notes: ''
  });

  // Fetch shipment requests
  const { data: shipmentRequests, isLoading } = useQuery({
    queryKey: ['admin-shipment-requests'],
    queryFn: async () => {
      // Fetch shipment requests
      const { data: requests, error } = await supabase
        .from('shipment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch user profiles for each request
      const userIds = [...new Set(requests?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, phone_number, governorate')
        .in('id', userIds);
      
      const profilesMap: Record<string, any> = {};
      profiles?.forEach(p => { profilesMap[p.id] = p; });

      // Fetch items for each shipment
      const shipmentIds = requests?.map(r => r.id) || [];
      const { data: items } = await supabase
        .from('shipment_request_items')
        .select(`
          *,
          purchased_product:user_purchased_products(id, product_name, product_name_ar, product_image, quantity)
        `)
        .in('shipment_request_id', shipmentIds);

      const itemsMap: Record<string, any[]> = {};
      items?.forEach(item => {
        if (!itemsMap[item.shipment_request_id]) {
          itemsMap[item.shipment_request_id] = [];
        }
        const prod = item.purchased_product as any;
        itemsMap[item.shipment_request_id].push({
          product_name: prod?.product_name || '',
          product_name_ar: prod?.product_name_ar || '',
          product_image: prod?.product_image || '',
          quantity: item.quantity
        });
      });

      return (requests || []).map(r => ({
        ...r,
        user_profile: profilesMap[r.user_id] || null,
        products: itemsMap[r.id] || []
      })) as ShipmentRequest[];
    },
  });

  // Update shipment mutation
  const updateShipmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ShipmentRequest> }) => {
      const updatePayload: any = { ...updates };
      
      if (updates.status === 'shipped' && !updates.shipped_at) {
        updatePayload.shipped_at = new Date().toISOString();
      }
      if (updates.status === 'delivered' && !updates.delivered_at) {
        updatePayload.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('shipment_requests')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipment-requests'] });
      toast.success('تم تحديث حالة الشحنة بنجاح');
      setShowUpdateDialog(false);
      setSelectedRequest(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    },
  });

  // Filter requests by tab and search
  const filteredRequests = shipmentRequests?.filter(req => {
    const matchesTab = activeTab === 'all' || req.status === activeTab;
    const matchesSearch = !searchQuery || 
      req.user_profile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.user_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.user_profile?.phone_number?.includes(searchQuery) ||
      req.tracking_number?.includes(searchQuery);
    return matchesTab && matchesSearch;
  }) || [];

  // Count by status
  const countByStatus = (status: string) => 
    shipmentRequests?.filter(r => r.status === status).length || 0;

  const handleOpenUpdate = (request: ShipmentRequest) => {
    setSelectedRequest(request);
    setUpdateData({
      status: request.status,
      tracking_number: request.tracking_number || '',
      admin_notes: request.admin_notes || ''
    });
    setShowUpdateDialog(true);
  };

  const handleSaveUpdate = () => {
    if (!selectedRequest) return;
    updateShipmentMutation.mutate({
      id: selectedRequest.id,
      updates: {
        status: updateData.status,
        tracking_number: updateData.tracking_number || null,
        admin_notes: updateData.admin_notes || null
      }
    });
  };

  return (
    <AdminLayout title="إدارة طلبات الشحن" icon={<Truck className="h-6 w-6" />}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus('pending')}</p>
                <p className="text-xs text-muted-foreground">قيد الانتظار</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus('processing')}</p>
                <p className="text-xs text-muted-foreground">قيد المعالجة</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus('shipped')}</p>
                <p className="text-xs text-muted-foreground">تم الشحن</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus('delivered')}</p>
                <p className="text-xs text-muted-foreground">تم التسليم</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، رقم الهاتف، أو رقم التتبع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all">الكل ({shipmentRequests?.length || 0})</TabsTrigger>
            <TabsTrigger value="pending">انتظار ({countByStatus('pending')})</TabsTrigger>
            <TabsTrigger value="processing">معالجة ({countByStatus('processing')})</TabsTrigger>
            <TabsTrigger value="shipped">شحن ({countByStatus('shipped')})</TabsTrigger>
            <TabsTrigger value="delivered">تسليم ({countByStatus('delivered')})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">لا توجد طلبات شحن</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المستخدم</TableHead>
                        <TableHead className="text-right">المنتجات</TableHead>
                        <TableHead className="text-right">العنوان</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => {
                        const statusInfo = statusLabels[request.status] || statusLabels.pending;
                        const StatusIcon = statusInfo.icon;
                        const products = request.products || [];
                        
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">
                                    {request.user_profile?.full_name || request.user_profile?.username || 'مستخدم'}
                                  </p>
                                  {request.phone_number && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {request.phone_number}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {products.slice(0, 2).map((p: any, i: number) => (
                                  <span key={i} className="text-xs">
                                    {p.product_name_ar || p.product_name} × {p.quantity || 1}
                                  </span>
                                ))}
                                {products.length > 2 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{products.length - 2} منتجات أخرى
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-start gap-1 text-xs text-muted-foreground max-w-[200px]">
                                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">
                                  {request.shipping_address || request.user_profile?.governorate || '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusInfo.color}>
                                <StatusIcon className="h-3 w-3 ml-1" />
                                {statusInfo.label}
                              </Badge>
                              {request.tracking_number && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Hash className="h-3 w-3" />
                                  {request.tracking_number}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatBaghdadTime(request.created_at)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setShowDetailsDialog(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenUpdate(request)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              تفاصيل طلب الشحن
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              {/* User Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    معلومات المستخدم
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>الاسم:</strong> {selectedRequest.user_profile?.full_name || selectedRequest.user_profile?.username}</p>
                  <p><strong>الهاتف:</strong> {selectedRequest.phone_number || selectedRequest.user_profile?.phone_number || '-'}</p>
                  <p><strong>المحافظة:</strong> {selectedRequest.user_profile?.governorate || '-'}</p>
                  <p><strong>العنوان:</strong> {selectedRequest.shipping_address || '-'}</p>
                </CardContent>
              </Card>

              {/* Products */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    المنتجات ({selectedRequest.products?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {selectedRequest.products?.map((product: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-lg">
                          {product.product_image && (
                            <img 
                              src={product.product_image} 
                              alt={product.product_name_ar}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{product.product_name_ar || product.product_name}</p>
                            <p className="text-xs text-muted-foreground">الكمية: {product.quantity || 1}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">سجل التتبع</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <p className="text-sm">تاريخ الطلب: {formatBaghdadTime(selectedRequest.created_at)}</p>
                    </div>
                    {selectedRequest.shipped_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <p className="text-sm">تاريخ الشحن: {formatBaghdadTime(selectedRequest.shipped_at)}</p>
                      </div>
                    )}
                    {selectedRequest.delivered_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <p className="text-sm">تاريخ التسليم: {formatBaghdadTime(selectedRequest.delivered_at)}</p>
                      </div>
                    )}
                    {selectedRequest.tracking_number && (
                      <div className="flex items-center gap-3">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">رقم التتبع: {selectedRequest.tracking_number}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              تحديث حالة الشحنة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">الحالة</label>
              <Select
                value={updateData.status}
                onValueChange={(value) => setUpdateData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="processing">قيد المعالجة</SelectItem>
                  <SelectItem value="shipped">تم الشحن</SelectItem>
                  <SelectItem value="delivered">تم التسليم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">رقم التتبع</label>
              <Input
                placeholder="أدخل رقم التتبع (اختياري)"
                value={updateData.tracking_number}
                onChange={(e) => setUpdateData(prev => ({ ...prev, tracking_number: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">ملاحظات</label>
              <Input
                placeholder="ملاحظات إضافية (اختياري)"
                value={updateData.admin_notes}
                onChange={(e) => setUpdateData(prev => ({ ...prev, admin_notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button 
              onClick={handleSaveUpdate}
              disabled={updateShipmentMutation.isPending}
            >
              {updateShipmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              حفظ التغييرات
            </Button>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}