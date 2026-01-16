import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Search, Loader2, Gift, Ticket, Plus, Edit2, Trash2, Check, X, Copy, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportUtils";

interface AdminLettersPrizeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  competitionTitle: string;
}

interface Coupon {
  id: string;
  user_id: string;
  competition_id: string;
  coupon_code: string;
  prize_name_ar: string;
  prize_value: number;
  is_used: boolean;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
  profile?: {
    username: string;
    full_name: string | null;
  };
}

interface CollectedLetter {
  id: string;
  user_id: string;
  competition_id: string;
  letter: string;
  collected_at: string;
  profile?: {
    username: string;
    full_name: string | null;
  };
}

export default function AdminLettersPrizeManager({
  open,
  onOpenChange,
  competitionId,
  competitionTitle
}: AdminLettersPrizeManagerProps) {
  const [activeTab, setActiveTab] = useState("coupons");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [addLetterDialogOpen, setAddLetterDialogOpen] = useState(false);
  const [newLetterData, setNewLetterData] = useState({ user_id: "", letter: "" });
  const queryClient = useQueryClient();

  // Fetch coupons
  const { data: coupons, isLoading: loadingCoupons } = useQuery({
    queryKey: ['admin-coupons', competitionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('letter_prize_coupons')
        .select('*')
        .eq('competition_id', competitionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set(data?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return data?.map(coupon => ({
        ...coupon,
        profile: profileMap.get(coupon.user_id)
      })) as Coupon[];
    },
    enabled: open && !!competitionId
  });

  // Fetch collected letters
  const { data: collectedLetters, isLoading: loadingLetters } = useQuery({
    queryKey: ['admin-collected-letters', competitionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collected_letters')
        .select('*')
        .eq('competition_id', competitionId)
        .order('collected_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(data?.map(l => l.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return data?.map(letter => ({
        ...letter,
        profile: profileMap.get(letter.user_id)
      })) as CollectedLetter[];
    },
    enabled: open && !!competitionId && activeTab === 'letters'
  });

  // Fetch users for adding letters
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-letters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .order('username');
      if (error) throw error;
      return data;
    },
    enabled: addLetterDialogOpen
  });

  // Update coupon mutation
  const updateCouponMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Coupon> }) => {
      const { error } = await supabase
        .from('letter_prize_coupons')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons', competitionId] });
      toast.success('تم تحديث القسيمة بنجاح');
      setEditingCoupon(null);
    },
    onError: (error) => {
      toast.error('خطأ في التحديث: ' + error.message);
    }
  });

  // Delete coupon mutation
  const deleteCouponMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('letter_prize_coupons')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons', competitionId] });
      toast.success('تم حذف القسيمة');
    },
    onError: (error) => {
      toast.error('خطأ في الحذف: ' + error.message);
    }
  });

  // Add collected letter mutation
  const addLetterMutation = useMutation({
    mutationFn: async ({ user_id, letter }: { user_id: string; letter: string }) => {
      const { error } = await supabase
        .from('user_collected_letters')
        .insert({
          user_id,
          competition_id: competitionId,
          letter: letter.toUpperCase(),
          collected_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-collected-letters', competitionId] });
      toast.success('تم إضافة الحرف بنجاح');
      setAddLetterDialogOpen(false);
      setNewLetterData({ user_id: "", letter: "" });
    },
    onError: (error) => {
      toast.error('خطأ في الإضافة: ' + error.message);
    }
  });

  // Delete collected letter mutation
  const deleteLetterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_collected_letters')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-collected-letters', competitionId] });
      toast.success('تم حذف الحرف');
    },
    onError: (error) => {
      toast.error('خطأ في الحذف: ' + error.message);
    }
  });

  const filteredCoupons = coupons?.filter(c =>
    c.profile?.username?.includes(searchTerm) ||
    c.profile?.full_name?.includes(searchTerm) ||
    c.coupon_code.includes(searchTerm) ||
    c.prize_name_ar.includes(searchTerm)
  );

  const filteredLetters = collectedLetters?.filter(l =>
    l.profile?.username?.includes(searchTerm) ||
    l.profile?.full_name?.includes(searchTerm) ||
    l.letter.includes(searchTerm.toUpperCase())
  );

  const exportCoupons = () => {
    if (!coupons || coupons.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData = coupons.map((c, index) => ({
      '#': index + 1,
      'المستخدم': c.profile?.full_name || c.profile?.username || '-',
      'كود القسيمة': c.coupon_code,
      'الجائزة': c.prize_name_ar,
      'القيمة': c.prize_value,
      'الحالة': c.is_used ? 'مستخدمة' : 'نشطة',
      'تاريخ الإنشاء': format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'),
      'تاريخ الاستخدام': c.used_at ? format(new Date(c.used_at), 'dd/MM/yyyy HH:mm') : '-',
    }));

    exportToExcel(exportData, { filename: `قسائم-${competitionTitle}-${format(new Date(), 'yyyy-MM-dd')}.csv` });
    toast.success('تم تصدير القسائم بنجاح');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('تم نسخ الكود');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0" dir="rtl">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              إدارة الجوائز والأحرف: {competitionTitle}
            </DialogTitle>
            <DialogDescription>عرض وتعديل قسائم الجوائز والأحرف المجمعة</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 p-4">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="coupons" className="gap-2">
                <Ticket className="h-4 w-4" />
                قسائم الجوائز ({coupons?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="letters" className="gap-2">
                <span className="font-bold">أ</span>
                الأحرف المجمعة ({collectedLetters?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Coupons Tab */}
            <TabsContent value="coupons" className="flex-1 flex flex-col min-h-0 mt-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Button onClick={exportCoupons} size="sm" className="gap-1">
                  <Download className="h-4 w-4" />
                  تصدير
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{coupons?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">إجمالي القسائم</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{coupons?.filter(c => !c.is_used).length || 0}</p>
                    <p className="text-xs text-muted-foreground">نشطة</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-gray-500">{coupons?.filter(c => c.is_used).length || 0}</p>
                    <p className="text-xs text-muted-foreground">مستخدمة</p>
                  </CardContent>
                </Card>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">الجائزة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCoupons ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : !filteredCoupons || filteredCoupons.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          لا توجد قسائم
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCoupons.map((coupon, index) => (
                        <TableRow key={coupon.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{coupon.profile?.full_name || coupon.profile?.username}</p>
                              <p className="text-xs text-muted-foreground">@{coupon.profile?.username}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{coupon.coupon_code}</code>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(coupon.coupon_code)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{coupon.prize_name_ar}</p>
                              <p className="text-xs text-muted-foreground">{coupon.prize_value.toLocaleString()} دينار</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={coupon.is_used ? "secondary" : "default"}>
                              {coupon.is_used ? 'مستخدمة' : 'نشطة'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  updateCouponMutation.mutate({
                                    id: coupon.id,
                                    updates: { is_used: !coupon.is_used, used_at: coupon.is_used ? null : new Date().toISOString() }
                                  });
                                }}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  if (window.confirm('هل أنت متأكد من حذف هذه القسيمة؟')) {
                                    deleteCouponMutation.mutate(coupon.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            {/* Letters Tab */}
            <TabsContent value="letters" className="flex-1 flex flex-col min-h-0 mt-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Button onClick={() => setAddLetterDialogOpen(true)} size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  إضافة حرف
                </Button>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">الحرف</TableHead>
                      <TableHead className="text-right">تاريخ الجمع</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingLetters ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : !filteredLetters || filteredLetters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          لا توجد أحرف مجمعة
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLetters.map((letter, index) => (
                        <TableRow key={letter.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{letter.profile?.full_name || letter.profile?.username}</p>
                              <p className="text-xs text-muted-foreground">@{letter.profile?.username}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-lg font-bold w-10 h-10 flex items-center justify-center">
                              {letter.letter}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(letter.collected_at || ''), 'dd/MM/yyyy HH:mm', { locale: ar })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                if (window.confirm('هل أنت متأكد من حذف هذا الحرف؟')) {
                                  deleteLetterMutation.mutate(letter.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Letter Dialog */}
      <Dialog open={addLetterDialogOpen} onOpenChange={setAddLetterDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة حرف لمستخدم</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اختر المستخدم</Label>
              <Select value={newLetterData.user_id} onValueChange={(v) => setNewLetterData({ ...newLetterData, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مستخدم..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {allUsers?.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.username} (@{user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحرف</Label>
              <Input
                value={newLetterData.letter}
                onChange={(e) => setNewLetterData({ ...newLetterData, letter: e.target.value.toUpperCase() })}
                placeholder="أدخل حرف واحد"
                maxLength={1}
                className="text-center text-2xl font-bold"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => addLetterMutation.mutate(newLetterData)}
              disabled={!newLetterData.user_id || !newLetterData.letter || addLetterMutation.isPending}
            >
              {addLetterMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إضافة الحرف'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}