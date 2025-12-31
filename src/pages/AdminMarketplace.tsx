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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, CheckCircle, XCircle, Eye, Package, Settings, Percent, MessageSquare, Trash2, Search, AlertTriangle, ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AdminConversationChat } from '@/components/marketplace/AdminConversationChat';
import AdminLayout, { AdminSection, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState, AdminCard } from '@/components/admin/AdminLayout';

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

const transactionStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'قيد الانتظار', variant: 'secondary' },
  confirmed: { label: 'مؤكد', variant: 'default' },
  shipped: { label: 'تم الشحن', variant: 'default' },
  delivered: { label: 'تم التوصيل', variant: 'default' },
  completed: { label: 'مكتمل', variant: 'default' },
  cancelled: { label: 'ملغي', variant: 'destructive' },
  disputed: { label: 'نزاع', variant: 'destructive' },
};

export default function AdminMarketplace() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [conversationSearch, setConversationSearch] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [listingSearch, setListingSearch] = useState('');
  const [conversationStatusFilter, setConversationStatusFilter] = useState<string>('all');
  
  const [listingsPage, setListingsPage] = useState(1);
  const [conversationsPage, setConversationsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: ['admin-listings', statusFilter, listingSearch, listingsPage],
    queryFn: async () => {
      let query = supabase
        .from('user_listings')
        .select('*, categories(name_ar)', { count: 'exact' })
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      if (listingSearch.trim()) {
        query = query.or(`title_ar.ilike.%${listingSearch.trim()}%,listing_code.ilike.%${listingSearch.trim()}%`);
      }
      
      const from = (listingsPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      if (error) throw error;
      
      if (data?.length) {
        const sellerIds = [...new Set(data.map(l => l.seller_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, phone_number')
          .in('id', sellerIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return { 
          listings: data.map(l => ({ ...l, seller_profile: profilesMap.get(l.seller_id) })),
          totalCount: count || 0 
        };
      }
      return { listings: data || [], totalCount: count || 0 };
    },
    enabled: isAdmin,
  });
  
  const listings = listingsData?.listings;
  const listingsTotalPages = Math.ceil((listingsData?.totalCount || 0) / ITEMS_PER_PAGE);

  const { data: stats } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: async () => {
      const [pending, approved, sold, disputed] = await Promise.all([
        supabase.from('user_listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('user_listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('user_listings').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
        supabase.from('listing_conversations').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
      ]);
      return {
        pending: pending.count || 0,
        approved: approved.count || 0,
        sold: sold.count || 0,
        disputed: disputed.count || 0,
      };
    },
    enabled: isAdmin,
  });

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

  const deleteMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from('user_listings')
        .delete()
        .eq('id', listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف المنتج');
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-stats'] });
    },
  });

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <AdminLayout
      title="إدارة السوق المستعمل"
      icon={<Store className="h-5 w-5" />}
      description="مراجعة وإدارة منتجات المستخدمين"
    >
      {/* Stats */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<Package className="h-5 w-5" />}
          value={stats?.pending || 0}
          label="قيد المراجعة"
          colorClass="text-yellow-600"
          bgClass="bg-yellow-500/10"
        />
        <AdminStatCard
          icon={<CheckCircle className="h-5 w-5" />}
          value={stats?.approved || 0}
          label="منشور"
          colorClass="text-green-600"
          bgClass="bg-green-500/10"
        />
        <AdminStatCard
          icon={<Store className="h-5 w-5" />}
          value={stats?.sold || 0}
          label="تم البيع"
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
        <AdminStatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          value={stats?.disputed || 0}
          label="نزاعات"
          colorClass="text-red-600"
          bgClass="bg-red-500/10"
        />
      </AdminStatsGrid>

      <Tabs defaultValue="listings" className="mt-6">
        <TabsList className="admin-tabs">
          <TabsTrigger value="listings" className="admin-tab">المنتجات</TabsTrigger>
          <TabsTrigger value="conversations" className="admin-tab">المحادثات</TabsTrigger>
          <TabsTrigger value="settings" className="admin-tab">الإعدادات</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4">
          <AdminSection>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث عن منتج..."
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="pending">قيد المراجعة</SelectItem>
                  <SelectItem value="approved">منشور</SelectItem>
                  <SelectItem value="rejected">مرفوض</SelectItem>
                  <SelectItem value="sold">تم البيع</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {listingsLoading ? (
              <AdminLoading />
            ) : !listings || listings.length === 0 ? (
              <AdminEmptyState
                icon={<Store className="h-12 w-12" />}
                title="لا توجد منتجات"
                description="لا توجد منتجات مطابقة للبحث"
              />
            ) : (
              <>
                <div className="admin-table-wrapper">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-right">البائع</TableHead>
                        <TableHead className="text-right">السعر</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listings.map((listing: any) => (
                        <TableRow key={listing.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {listing.images?.[0] && (
                                <img 
                                  src={listing.images[0]} 
                                  alt={listing.title_ar}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              )}
                              <div>
                                <p className="font-medium line-clamp-1">{listing.title_ar}</p>
                                <p className="text-xs text-muted-foreground">{listing.listing_code}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{listing.seller_profile?.full_name || listing.seller_profile?.username}</p>
                            <p className="text-xs text-muted-foreground">{listing.seller_profile?.phone_number}</p>
                          </TableCell>
                          <TableCell className="font-medium">{listing.price?.toLocaleString()} د.ع</TableCell>
                          <TableCell>
                            <Badge variant={statusConfig[listing.status]?.variant || 'secondary'}>
                              {statusConfig[listing.status]?.label || listing.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedListing(listing)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {listing.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600"
                                    onClick={() => approveMutation.mutate(listing.id)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600"
                                    onClick={() => {
                                      setSelectedListing(listing);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                                    deleteMutation.mutate(listing.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {listingsTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      صفحة {listingsPage} من {listingsTotalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={listingsPage === 1}
                        onClick={() => setListingsPage(p => p - 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={listingsPage === listingsTotalPages}
                        onClick={() => setListingsPage(p => p + 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          <AdminSection>
            <AdminEmptyState
              icon={<MessageSquare className="h-12 w-12" />}
              title="إدارة المحادثات"
              description="ستظهر هنا محادثات المستخدمين"
            />
          </AdminSection>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <AdminSection title="إعدادات الرسوم">
            <AdminCard>
              <div className="p-6">
                <p className="text-muted-foreground">إعدادات رسوم المنصة ستظهر هنا</p>
              </div>
            </AdminCard>
          </AdminSection>
        </TabsContent>
      </Tabs>

      {/* Listing Detail Dialog */}
      <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل المنتج</DialogTitle>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              {selectedListing.images && selectedListing.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedListing.images.map((img: string, i: number) => (
                    <img key={i} src={img} alt="" className="w-full aspect-square rounded-lg object-cover" />
                  ))}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">العنوان:</span>
                  <span className="mr-2 font-medium">{selectedListing.title_ar}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">السعر:</span>
                  <span className="mr-2 font-medium">{selectedListing.price?.toLocaleString()} د.ع</span>
                </div>
                <div>
                  <span className="text-muted-foreground">الحالة:</span>
                  <span className="mr-2 font-medium">{conditionLabels[selectedListing.condition] || selectedListing.condition}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">البائع:</span>
                  <span className="mr-2 font-medium">{selectedListing.seller_profile?.full_name}</span>
                </div>
              </div>

              {selectedListing.description_ar && (
                <div>
                  <span className="text-muted-foreground text-sm">الوصف:</span>
                  <p className="mt-1">{selectedListing.description_ar}</p>
                </div>
              )}

              {selectedListing.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="flex-1"
                    onClick={() => approveMutation.mutate(selectedListing.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    موافقة
                  </Button>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="سبب الرفض..."
                      value={rejectionNotes}
                      onChange={(e) => setRejectionNotes(e.target.value)}
                    />
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => rejectMutation.mutate({ listingId: selectedListing.id, notes: rejectionNotes })}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 ml-2" />
                      رفض
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
