import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout, { AdminLoading, AdminEmptyState, AdminStatsGrid, AdminStatCard } from '@/components/admin/AdminLayout';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { 
  Users, 
  Search, 
  Wallet, 
  Star, 
  ShoppingBag, 
  Store, 
  User,
  ExternalLink,
  Filter,
  TrendingUp,
  Eye,
  Info,
  Ticket,
  CreditCard
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminUserDetailsDialog from '@/components/admin/AdminUserDetailsDialog';

interface UserData {
  id: string;
  email: string | null;
  phone_number: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  email_verified: boolean | null;
}

interface MerchantData {
  user_id: string;
  display_name: string | null;
  status: string;
  city: string | null;
}

interface CustomerData {
  user_id: string;
  display_name: string | null;
  total_requests_made: number | null;
  total_spent: number | null;
}

interface WalletData {
  user_id: string;
  balance: number;
}

interface PointsData {
  user_id: string;
  available_points: number;
}

interface OrderStats {
  user_id: string;
  total_orders: number;
  total_spent: number;
  order_numbers: string[];
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'merchant'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'wallet' | 'points' | 'orders'>('newest');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch all users with profiles
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, phone_number, full_name, username, avatar_url, created_at, email_verified')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserData[];
    }
  });

  // Fetch tickets count per user
  const { data: ticketCounts } = useQuery({
    queryKey: ['admin-tickets-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competition_tickets')
        .select('user_id');
      
      if (error) throw error;
      
      // Count tickets per user
      const counts: Record<string, number> = {};
      data?.forEach((t: any) => {
        counts[t.user_id] = (counts[t.user_id] || 0) + 1;
      });
      return counts;
    }
  });

  // Fetch active cards per user
  const { data: userCards } = useQuery({
    queryKey: ['admin-user-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('user_id, loyalty_levels(name_ar, color)')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Map user_id to card info
      const cardsMap: Record<string, { name_ar: string; color: string }> = {};
      data?.forEach((c: any) => {
        if (c.loyalty_levels) {
          cardsMap[c.user_id] = {
            name_ar: c.loyalty_levels.name_ar,
            color: c.loyalty_levels.color
          };
        }
      });
      return cardsMap;
    }
  });

  // Fetch merchant data
  const { data: merchants } = useQuery({
    queryKey: ['admin-merchants-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_applications')
        .select('user_id, display_name, status, city');
      
      if (error) throw error;
      return data as MerchantData[];
    }
  });

  // Fetch customer data
  const { data: customers } = useQuery({
    queryKey: ['admin-customers-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_customer_profiles')
        .select('user_id, display_name, total_requests_made, total_spent');
      
      if (error) throw error;
      return data as CustomerData[];
    }
  });

  // Fetch wallet data
  const { data: wallets } = useQuery({
    queryKey: ['admin-wallets-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_wallets')
        .select('user_id, balance');
      
      if (error) throw error;
      return data as WalletData[];
    }
  });

  // Fetch points data
  const { data: points } = useQuery({
    queryKey: ['admin-points-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_points')
        .select('user_id, available_points');
      
      if (error) throw error;
      return data as PointsData[];
    }
  });

  // Fetch order stats
  const { data: orderStats } = useQuery({
    queryKey: ['admin-order-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('user_id, total, order_number');
      
      if (error) throw error;
      
      // Aggregate orders by user
      const stats: Record<string, OrderStats> = {};
      data?.forEach((order: any) => {
        if (!stats[order.user_id]) {
          stats[order.user_id] = { user_id: order.user_id, total_orders: 0, total_spent: 0, order_numbers: [] };
        }
        stats[order.user_id].total_orders++;
        stats[order.user_id].total_spent += order.total || 0;
        if (order.order_number) {
          stats[order.user_id].order_numbers.push(order.order_number.toLowerCase());
        }
      });
      
      return Object.values(stats);
    }
  });

  // Create lookup maps
  const merchantMap = useMemo(() => {
    const map = new Map<string, MerchantData>();
    merchants?.forEach(m => map.set(m.user_id, m));
    return map;
  }, [merchants]);

  const customerMap = useMemo(() => {
    const map = new Map<string, CustomerData>();
    customers?.forEach(c => map.set(c.user_id, c));
    return map;
  }, [customers]);

  const walletMap = useMemo(() => {
    const map = new Map<string, number>();
    wallets?.forEach(w => map.set(w.user_id, w.balance));
    return map;
  }, [wallets]);

  const pointsMap = useMemo(() => {
    const map = new Map<string, number>();
    points?.forEach(p => map.set(p.user_id, p.available_points));
    return map;
  }, [points]);

  const orderStatsMap = useMemo(() => {
    const map = new Map<string, OrderStats>();
    orderStats?.forEach(o => map.set(o.user_id, o));
    return map;
  }, [orderStats]);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    let result = users.filter(user => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const userOrders = orderStatsMap.get(user.id);
      const matchesSearch = !searchQuery || 
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.username?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.phone_number?.includes(searchQuery) ||
        userOrders?.order_numbers.some(on => on.includes(searchLower));
      
      // Type filter
      const isMerchant = merchantMap.has(user.id);
      const isCustomer = customerMap.has(user.id);
      
      const matchesType = filterType === 'all' || 
        (filterType === 'merchant' && isMerchant) ||
        (filterType === 'customer' && isCustomer);
      
      return matchesSearch && matchesType;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'wallet':
          return (walletMap.get(b.id) || 0) - (walletMap.get(a.id) || 0);
        case 'points':
          return (pointsMap.get(b.id) || 0) - (pointsMap.get(a.id) || 0);
        case 'orders':
          return (orderStatsMap.get(b.id)?.total_orders || 0) - (orderStatsMap.get(a.id)?.total_orders || 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [users, searchQuery, filterType, sortBy, merchantMap, customerMap, walletMap, pointsMap, orderStatsMap]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!users) return { total: 0, merchants: 0, customers: 0, verified: 0 };
    return {
      total: users.length,
      merchants: merchants?.filter(m => m.status === 'approved').length || 0,
      customers: customers?.length || 0,
      verified: users.filter(u => u.email_verified).length
    };
  }, [users, merchants, customers]);

  const getUserType = (userId: string): 'merchant' | 'customer' | 'user' => {
    if (merchantMap.has(userId)) return 'merchant';
    if (customerMap.has(userId)) return 'customer';
    return 'user';
  };

  const handleViewProfile = (userId: string, type: 'merchant' | 'customer' | 'user') => {
    switch (type) {
      case 'merchant':
        navigate(`/store/${userId}`);
        break;
      case 'customer':
        navigate(`/profile/${userId}`);
        break;
      default:
        navigate(`/profile/${userId}`);
    }
  };

  if (usersLoading) {
    return (
      <AdminLayout title="إدارة المستخدمين" icon={<Users className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="إدارة المستخدمين"
      description={`إجمالي المستخدمين: ${stats.total}`}
      icon={<Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="7xl"
    >
      {/* Stats Cards */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<Users className="h-5 w-5" />}
          value={stats.total}
          label="إجمالي المستخدمين"
        />
        <AdminStatCard
          icon={<Store className="h-5 w-5" />}
          value={stats.merchants}
          label="التجار"
          colorClass="text-emerald-600"
          bgClass="bg-emerald-600/10"
        />
        <AdminStatCard
          icon={<User className="h-5 w-5" />}
          value={stats.customers}
          label="العملاء"
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
        <AdminStatCard
          icon={<Star className="h-5 w-5" />}
          value={stats.verified}
          label="بريد مؤكد"
          colorClass="text-amber-600"
          bgClass="bg-amber-600/10"
        />
      </AdminStatsGrid>

      {/* Filters */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث بالاسم، اليوزر، الإيميل، الهاتف، أو رقم الطلب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="merchant">التجار</SelectItem>
                  <SelectItem value="customer">العملاء</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[140px]">
                  <TrendingUp className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="ترتيب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">الأحدث</SelectItem>
                  <SelectItem value="wallet">المحفظة</SelectItem>
                  <SelectItem value="points">النقاط</SelectItem>
                  <SelectItem value="orders">الطلبات</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="mt-6 space-y-3">
        {filteredUsers.length === 0 ? (
          <AdminEmptyState
            icon={<Users className="h-12 w-12" />}
            title="لا يوجد مستخدمين"
            description="لم يتم العثور على مستخدمين مطابقين للبحث"
          />
        ) : (
          filteredUsers.map((user) => {
            const userType = getUserType(user.id);
            const merchantData = merchantMap.get(user.id);
            const customerData = customerMap.get(user.id);
            const orders = orderStatsMap.get(user.id);
            const walletBalance = walletMap.get(user.id) || 0;
            const userPoints = pointsMap.get(user.id) || 0;

            return (
              <Card key={user.id} className="overflow-hidden hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Avatar & Basic Info */}
                    <div className="flex items-center gap-3 min-w-0 lg:w-[280px]">
                      <Avatar className="h-12 w-12 shrink-0 border-2 border-border">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground truncate">
                            {user.full_name || 'بدون اسم'}
                          </p>
                          {userType === 'merchant' && (
                            <Badge variant="outline" className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 shrink-0">
                              <Store className="h-3 w-3 ml-1" />
                              تاجر
                            </Badge>
                          )}
                          {userType === 'customer' && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 shrink-0">
                              <User className="h-3 w-3 ml-1" />
                              عميل
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          @{user.username || 'no-username'}
                        </p>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="lg:w-[200px] text-sm">
                      <p className="text-muted-foreground truncate" title={user.email || ''}>
                        {user.email || 'لا يوجد إيميل'}
                      </p>
                      <p className="text-muted-foreground" dir="ltr">
                        {user.phone_number || 'لا يوجد هاتف'}
                      </p>
                    </div>

                    {/* Wallet & Points */}
                    <div className="flex items-center gap-4 lg:w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="h-4 w-4 text-primary" />
                        <span className="font-bold text-primary">
                          {walletBalance.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="font-bold text-amber-500">
                          {userPoints.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Tickets & Membership */}
                    <div className="flex items-center gap-4 lg:w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <Ticket className="h-4 w-4 text-purple-500" />
                        <span className="font-bold text-purple-500">
                          {(ticketCounts?.[user.id] || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">تذكرة</span>
                      </div>
                      {userCards?.[user.id] && (
                        <Badge 
                          variant="outline" 
                          className="gap-1 shrink-0"
                          style={{ 
                            backgroundColor: `${userCards[user.id].color}20`,
                            borderColor: `${userCards[user.id].color}50`,
                            color: userCards[user.id].color 
                          }}
                        >
                          <CreditCard className="h-3 w-3" />
                          {userCards[user.id].name_ar}
                        </Badge>
                      )}
                    </div>

                    {/* Orders/Activity */}
                    <div className="flex items-center gap-3 lg:w-[150px]">
                      <div className="flex items-center gap-1.5">
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          <span className="font-bold">{orders?.total_orders || 0}</span>
                          <span className="text-muted-foreground"> طلب</span>
                        </span>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="lg:mr-auto flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setSelectedUserName(user.full_name || user.username);
                          setDetailsOpen(true);
                        }}
                        className="gap-2"
                      >
                        <Info className="h-4 w-4" />
                        التفاصيل
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewProfile(user.id, userType)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        الملف
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Merchant specific info */}
                  {userType === 'merchant' && merchantData && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">اسم المتجر: </span>
                        <span className="font-bold">{merchantData.display_name || 'غير محدد'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">المدينة: </span>
                        <span className="font-bold">{merchantData.city || 'غير محددة'}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          merchantData.status === 'approved' 
                            ? 'bg-emerald-600/10 text-emerald-600 border-emerald-600/30'
                            : merchantData.status === 'pending'
                            ? 'bg-amber-600/10 text-amber-600 border-amber-600/30'
                            : 'bg-destructive/10 text-destructive border-destructive/30'
                        }
                      >
                        {merchantData.status === 'approved' ? 'موثق' : 
                         merchantData.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Results count */}
      {filteredUsers.length > 0 && (
        <p className="text-center text-sm text-muted-foreground mt-6">
          عرض {filteredUsers.length} من {stats.total} مستخدم
        </p>
      )}

      {/* User Details Dialog */}
      <AdminUserDetailsDialog
        userId={selectedUserId}
        userName={selectedUserName}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </AdminLayout>
  );
}
