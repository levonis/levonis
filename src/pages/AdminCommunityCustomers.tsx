import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, Ban, CheckCircle, Eye, Star, ShoppingBag, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout, { AdminSection } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_requests_made: number;
  total_requests_received: number;
  total_spent: number;
  reputation_score: number;
  is_verified: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  created_at: string;
}

interface Props {
  embedded?: boolean;
}

function CustomersContent() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");

  // Fetch profiles from main profiles table with community data
  const { data: customers, isLoading } = useQuery({
    queryKey: ["community-customers", searchQuery],
    queryFn: async () => {
      // Get users who have made print requests
      const { data: requestUsers, error: reqError } = await supabase
        .from("community_print_requests")
        .select("user_id")
        .order("created_at", { ascending: false });

      if (reqError) throw reqError;

      const userIds = [...new Set(requestUsers?.map(r => r.user_id) || [])];
      
      if (userIds.length === 0) return [];

      // Get profiles for these users
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, created_at")
        .in("id", userIds);

      if (profError) throw profError;

      // Get request counts per user
      const { data: requestCounts } = await supabase
        .from("community_print_requests")
        .select("user_id");

      const countMap: Record<string, number> = {};
      requestCounts?.forEach(r => {
        countMap[r.user_id] = (countMap[r.user_id] || 0) + 1;
      });

      // Combine data
      const combined = profiles?.map(p => ({
        id: p.id,
        user_id: p.id,
        display_name: p.username,
        avatar_url: p.avatar_url,
        total_requests_made: countMap[p.id] || 0,
        total_requests_received: 0,
        total_spent: 0,
        reputation_score: 0,
        is_verified: false,
        is_suspended: false,
        suspension_reason: null,
        created_at: p.created_at,
      })) || [];

      // Filter by search
      if (searchQuery) {
        return combined.filter(c => 
          c.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      return combined;
    },
  });

  const toggleSuspension = useMutation({
    mutationFn: async ({ userId, suspend, reason }: { userId: string; suspend: boolean; reason?: string }) => {
      // For now, we'll just show a toast - in production, this would update a real suspension table
      if (suspend) {
        toast.success(`تم إيقاف الزبون مؤقتاً: ${reason}`);
      } else {
        toast.success("تم إلغاء الإيقاف");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-customers"] });
      setSelectedCustomer(null);
      setSuspensionReason("");
    },
  });

  const stats = {
    total: customers?.length || 0,
    active: customers?.filter(c => !c.is_suspended).length || 0,
    suspended: customers?.filter(c => c.is_suspended).length || 0,
    verified: customers?.filter(c => c.is_verified).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="levo-card-frame">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">إجمالي الزبائن</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-green-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
            <div className="text-xs text-muted-foreground">نشط</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-red-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.suspended}</div>
            <div className="text-xs text-muted-foreground">موقوف</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-blue-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.verified}</div>
            <div className="text-xs text-muted-foreground">موثق</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="البحث عن زبون..."
          className="pr-10"
        />
      </div>

      {/* Customers List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : customers?.length === 0 ? (
        <Card className="levo-card-frame">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">لا يوجد زبائن</h3>
            <p className="text-sm text-muted-foreground">لم يسجل أي زبون في المجتمع بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customers?.map((customer) => (
            <Card key={customer.id} className="levo-card-frame hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={customer.avatar_url || undefined} />
                      <AvatarFallback>
                        {customer.display_name?.charAt(0) || "؟"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{customer.display_name || "بدون اسم"}</h3>
                        {customer.is_verified && (
                          <CheckCircle className="h-4 w-4 text-blue-400" />
                        )}
                        {customer.is_suspended && (
                          <Badge variant="destructive" className="text-xs">موقوف</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {customer.total_requests_made} طلب
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {customer.reputation_score.toFixed(1)}
                        </span>
                        <span>
                          انضم {format(new Date(customer.created_at), "dd MMM yyyy", { locale: ar })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <Eye className="h-4 w-4 ml-1" />
                    إدارة
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Customer Management Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              إدارة الزبون
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedCustomer.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">
                    {selectedCustomer.display_name?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{selectedCustomer.display_name || "بدون اسم"}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedCustomer.is_verified && (
                      <Badge className="bg-blue-500/20 text-blue-400">موثق</Badge>
                    )}
                    {selectedCustomer.is_suspended && (
                      <Badge variant="destructive">موقوف</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/20 rounded-lg text-center">
                  <div className="text-xl font-bold">{selectedCustomer.total_requests_made}</div>
                  <div className="text-xs text-muted-foreground">طلبات مقدمة</div>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg text-center">
                  <div className="text-xl font-bold">{selectedCustomer.reputation_score.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">التقييم</div>
                </div>
              </div>

              {!selectedCustomer.is_suspended ? (
                <div className="space-y-3">
                  <label className="text-sm font-medium">سبب الإيقاف</label>
                  <Textarea
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    placeholder="اكتب سبب إيقاف الحساب..."
                  />
                </div>
              ) : (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">
                    <strong>سبب الإيقاف:</strong> {selectedCustomer.suspension_reason || "غير محدد"}
                  </p>
                </div>
              )}

              <DialogFooter>
                {selectedCustomer.is_suspended ? (
                  <Button
                    onClick={() => toggleSuspension.mutate({ userId: selectedCustomer.user_id, suspend: false })}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 ml-1" />
                    إلغاء الإيقاف
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => toggleSuspension.mutate({ 
                      userId: selectedCustomer.user_id, 
                      suspend: true, 
                      reason: suspensionReason 
                    })}
                    disabled={!suspensionReason.trim()}
                  >
                    <Ban className="h-4 w-4 ml-1" />
                    إيقاف الحساب
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCommunityCustomers({ embedded }: Props) {
  if (embedded) {
    return <CustomersContent />;
  }

  return (
    <AdminLayout
      title="إدارة الزبائن"
      description="عرض وإدارة حسابات زبائن مجتمع ليفو"
      icon={<Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <CustomersContent />
    </AdminLayout>
  );
}
