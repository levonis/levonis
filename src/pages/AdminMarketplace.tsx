import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ArrowRight, Store, CheckCircle, XCircle, Eye, Package, Settings, Loader2, Percent, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const conditionLabels: Record<string, string> = {
  new: 'جديد',
  like_new: 'شبه جديد',
  good: 'جيد',
  used: 'مستعمل',
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'قيد المراجعة', variant: 'secondary' },
  approved: { label: 'منشور', variant: 'default' },
  rejected: { label: 'مرفوض', variant: 'destructive' },
  sold: { label: 'تم البيع', variant: 'outline' },
};

export default function AdminMarketplace() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  // Fetch listings
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['admin-listings', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('user_listings')
        .select('*, categories(name_ar)')
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch seller profiles
      if (data?.length) {
        const sellerIds = [...new Set(data.map(l => l.seller_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, phone_number')
          .in('id', sellerIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(l => ({ ...l, seller_profile: profilesMap.get(l.seller_id) }));
      }
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch fee settings
  const { data: feeSettings } = useQuery({
    queryKey: ['listing-fee-settings-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listing_fees_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: async () => {
      const [pending, approved, sold] = await Promise.all([
        supabase.from('user_listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('user_listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('user_listings').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
      ]);
      return {
        pending: pending.count || 0,
        approved: approved.count || 0,
        sold: sold.count || 0,
      };
    },
    enabled: isAdmin,
  });

  // Approve listing
  const approveMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from('user_listings')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم الموافقة على المنتج');
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-stats'] });
      setSelectedListing(null);
    },
  });

  // Reject listing
  const rejectMutation = useMutation({
    mutationFn: async ({ listingId, notes }: { listingId: string; notes: string }) => {
      const { error } = await supabase
        .from('user_listings')
        .update({ status: 'rejected', admin_notes: notes })
        .eq('id', listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم رفض المنتج');
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-stats'] });
      setSelectedListing(null);
      setRejectionNotes('');
    },
  });

  // Update fee settings
  const updateFeeMutation = useMutation({
    mutationFn: async (values: any) => {
      if (feeSettings?.id) {
        const { error } = await supabase
          .from('listing_fees_settings')
          .update(values)
          .eq('id', feeSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('listing_fees_settings')
          .insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('تم حفظ إعدادات الرسوم');
      queryClient.invalidateQueries({ queryKey: ['listing-fee-settings-admin'] });
    },
  });

  // Initialize fee form from settings - use useEffect to avoid infinite loops
  const [feeFormInitialized, setFeeFormInitialized] = useState(false);
  const [feeForm, setFeeForm] = useState({
    fee_type: 'percentage',
    fee_value: 5,
    min_fee: 0,
    max_fee: null as number | null,
    terms_ar: 'يتم خصم رسوم المنصة من رصيد المحفظة عند إضافة المنتج',
    is_active: true,
  });

  // Update form when settings load (only once)
  if (feeSettings && !feeFormInitialized) {
    setFeeFormInitialized(true);
    setFeeForm({
      fee_type: feeSettings.fee_type,
      fee_value: feeSettings.fee_value,
      min_fee: feeSettings.min_fee || 0,
      max_fee: feeSettings.max_fee,
      terms_ar: feeSettings.terms_ar || '',
      is_active: feeSettings.is_active ?? true,
    });
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">إدارة السوق المستعمل</h1>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setStatusFilter('pending')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">قيد المراجعة</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-500">{stats?.pending || 0}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setStatusFilter('approved')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">منشور</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-500">{stats?.approved || 0}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setStatusFilter('sold')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">تم البيع</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-500">{stats?.sold || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="listings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="listings" className="gap-2">
              <Package className="w-4 h-4" />
              المنتجات
            </TabsTrigger>
            <TabsTrigger value="fees" className="gap-2">
              <Settings className="w-4 h-4" />
              إعدادات الرسوم
            </TabsTrigger>
          </TabsList>

          {/* Listings Tab */}
          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>المنتجات المعروضة</CardTitle>
                  <div className="flex gap-2">
                    {['all', 'pending', 'approved', 'rejected', 'sold'].map(status => (
                      <Button
                        key={status}
                        variant={statusFilter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status === 'all' ? 'الكل' : statusConfig[status]?.label || status}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {listingsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : listings?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    لا توجد منتجات
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الصورة</TableHead>
                        <TableHead>العنوان</TableHead>
                        <TableHead>البائع</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listings?.map(listing => (
                        <TableRow key={listing.id}>
                          <TableCell>
                            {listing.images?.[0] ? (
                              <img src={listing.images[0]} alt="" className="w-12 h-12 object-cover rounded" />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{listing.title_ar}</p>
                              <p className="text-xs text-muted-foreground">{conditionLabels[listing.condition]}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{(listing as any).seller_profile?.full_name || (listing as any).seller_profile?.username}</p>
                              <p className="text-xs text-muted-foreground">{(listing as any).seller_profile?.phone_number}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-primary">{Number(listing.price).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground mr-1">{listing.currency}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig[listing.status]?.variant || 'secondary'}>
                              {statusConfig[listing.status]?.label || listing.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{format(new Date(listing.created_at), 'dd MMM yyyy', { locale: ar })}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setSelectedListing(listing)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {listing.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-green-500 hover:text-green-600"
                                    onClick={() => approveMutation.mutate(listing.id)}
                                    disabled={approveMutation.isPending}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => setSelectedListing({ ...listing, showReject: true })}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fees Tab */}
          <TabsContent value="fees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  إعدادات رسوم المنصة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Label>تفعيل الرسوم</Label>
                  <Switch
                    checked={feeForm.is_active}
                    onCheckedChange={(checked) => setFeeForm(prev => ({ ...prev, is_active: checked }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {feeForm.is_active ? 'مفعّل' : 'الإضافة مجانية'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نوع الرسوم</Label>
                    <select
                      className="w-full p-2 border rounded-md bg-background"
                      value={feeForm.fee_type}
                      onChange={(e) => setFeeForm(prev => ({ ...prev, fee_type: e.target.value }))}
                    >
                      <option value="percentage">نسبة مئوية %</option>
                      <option value="fixed">مبلغ ثابت</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>القيمة {feeForm.fee_type === 'percentage' ? '(%)' : '(دينار)'}</Label>
                    <Input
                      type="number"
                      value={feeForm.fee_value}
                      onChange={(e) => setFeeForm(prev => ({ ...prev, fee_value: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                {feeForm.fee_type === 'percentage' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الحد الأدنى للرسوم (دينار)</Label>
                      <Input
                        type="number"
                        value={feeForm.min_fee}
                        onChange={(e) => setFeeForm(prev => ({ ...prev, min_fee: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الحد الأقصى للرسوم (دينار، اتركه فارغاً لعدم وجود حد)</Label>
                      <Input
                        type="number"
                        value={feeForm.max_fee || ''}
                        onChange={(e) => setFeeForm(prev => ({ ...prev, max_fee: e.target.value ? parseFloat(e.target.value) : null }))}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>شروط وأحكام الرسوم (عربي)</Label>
                  <Textarea
                    value={feeForm.terms_ar}
                    onChange={(e) => setFeeForm(prev => ({ ...prev, terms_ar: e.target.value }))}
                    rows={3}
                  />
                </div>

                <Button onClick={() => updateFeeMutation.mutate(feeForm)} disabled={updateFeeMutation.isPending}>
                  {updateFeeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  حفظ الإعدادات
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View/Reject Dialog */}
        <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedListing?.showReject ? 'رفض المنتج' : 'تفاصيل المنتج'}</DialogTitle>
            </DialogHeader>
            
            {selectedListing && (
              <div className="space-y-4">
                {selectedListing.showReject ? (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">سيتم إرسال إشعار للبائع مع سبب الرفض</p>
                    <div className="space-y-2">
                      <Label>سبب الرفض</Label>
                      <Textarea
                        value={rejectionNotes}
                        onChange={(e) => setRejectionNotes(e.target.value)}
                        placeholder="اكتب سبب الرفض..."
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="destructive"
                        onClick={() => rejectMutation.mutate({ listingId: selectedListing.id, notes: rejectionNotes })}
                        disabled={rejectMutation.isPending || !rejectionNotes.trim()}
                      >
                        {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                        تأكيد الرفض
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedListing(null)}>إلغاء</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Images */}
                    <div className="flex gap-2 overflow-x-auto">
                      {selectedListing.images?.map((img: string, idx: number) => (
                        <img key={idx} src={img} alt="" className="w-32 h-32 object-cover rounded-lg" />
                      ))}
                      {selectedListing.purchase_receipt_url && (
                        <div className="relative">
                          <img src={selectedListing.purchase_receipt_url} alt="وصل الشراء" className="w-32 h-32 object-cover rounded-lg border-2 border-primary" />
                          <Badge className="absolute top-1 right-1 text-xs">وصل الشراء</Badge>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">العنوان</Label>
                        <p className="font-medium">{selectedListing.title_ar}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">السعر</Label>
                        <p className="font-bold text-primary">{Number(selectedListing.price).toLocaleString()} {selectedListing.currency}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">الحالة</Label>
                        <p>{conditionLabels[selectedListing.condition]}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">طريقة الشحن</Label>
                        <p>{selectedListing.shipping_method === 'through_site' ? 'عبر الموقع' : 'توصيل مباشر'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">البائع</Label>
                        <p>{(selectedListing as any).seller_profile?.full_name || (selectedListing as any).seller_profile?.username}</p>
                        <p className="text-sm text-muted-foreground">{(selectedListing as any).seller_profile?.phone_number}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">الموقع</Label>
                        <p>{selectedListing.location || 'غير محدد'}</p>
                      </div>
                    </div>

                    {selectedListing.description_ar && (
                      <div>
                        <Label className="text-muted-foreground">الوصف</Label>
                        <p className="text-sm">{selectedListing.description_ar}</p>
                      </div>
                    )}

                    {selectedListing.status === 'pending' && (
                      <div className="flex gap-3 pt-4 border-t">
                        <Button
                          className="flex-1"
                          onClick={() => approveMutation.mutate(selectedListing.id)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                          <CheckCircle className="w-4 h-4 ml-2" />
                          موافقة
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => setSelectedListing({ ...selectedListing, showReject: true })}
                        >
                          <XCircle className="w-4 h-4 ml-2" />
                          رفض
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
