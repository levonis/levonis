import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Ticket, Plus, Minus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface UserWithTickets {
  user_id: string;
  ticket_count: number;
  updated_at: string;
  profile: {
    username: string;
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
  } | null;
}

interface UserTicketsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserTicketsManager({ open, onOpenChange }: UserTicketsManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [addTicketDialogOpen, setAddTicketDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithTickets | null>(null);
  const [ticketAmount, setTicketAmount] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const queryClient = useQueryClient();

  // Fetch all users with tickets
  const { data: usersWithTickets, isLoading } = useQuery({
    queryKey: ['users-with-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_tickets')
        .select('user_id, ticket_count, updated_at')
        .order('ticket_count', { ascending: false });

      if (error) throw error;

      // Fetch profiles
      const userIds = data?.map(t => t.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, phone_number')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(ticket => ({
        ...ticket,
        profile: profileMap.get(ticket.user_id) || null
      })) as UserWithTickets[];
    },
    enabled: open
  });

  // Fetch all users for adding tickets
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-tickets', userSearchTerm],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, username, full_name, email, phone_number')
        .order('username')
        .limit(50);

      if (userSearchTerm) {
        query = query.or(`username.ilike.%${userSearchTerm}%,full_name.ilike.%${userSearchTerm}%,phone_number.ilike.%${userSearchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: addTicketDialogOpen && userSearchTerm.length > 0
  });

  const filteredUsers = usersWithTickets?.filter(u => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      u.profile?.username?.toLowerCase().includes(search) ||
      u.profile?.full_name?.toLowerCase().includes(search) ||
      u.profile?.phone_number?.includes(search) ||
      u.profile?.email?.toLowerCase().includes(search)
    );
  });

  // Mutation to update tickets
  const updateTicketsMutation = useMutation({
    mutationFn: async ({ userId, amount, isAdd }: { userId: string; amount: number; isAdd: boolean }) => {
      const { data: existing } = await supabase
        .from('user_tickets')
        .select('ticket_count')
        .eq('user_id', userId)
        .maybeSingle();

      const currentCount = existing?.ticket_count || 0;
      const newCount = isAdd ? currentCount + amount : Math.max(0, currentCount - amount);

      if (existing) {
        const { error } = await supabase
          .from('user_tickets')
          .update({ ticket_count: newCount, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_tickets')
          .insert({ user_id: userId, ticket_count: newCount });
        if (error) throw error;
      }

      return { userId, newCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-tickets'] });
      toast.success(`تم تحديث التذاكر بنجاح (${result.newCount} تذكرة)`);
      setAddTicketDialogOpen(false);
      setSelectedUser(null);
      setTicketAmount("");
    },
    onError: (error) => {
      toast.error('خطأ في تحديث التذاكر: ' + error.message);
    }
  });

  const handleAddToUser = (user: any) => {
    setSelectedUser({
      user_id: user.id,
      ticket_count: 0,
      updated_at: new Date().toISOString(),
      profile: user
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              إدارة تذاكر المستخدمين
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              <Badge variant="outline" className="text-base px-4 py-2">
                <Ticket className="h-4 w-4 ml-2" />
                {usersWithTickets?.reduce((sum, u) => sum + u.ticket_count, 0) || 0} تذكرة إجمالي
              </Badge>
              <Badge variant="outline" className="text-base px-4 py-2">
                {usersWithTickets?.length || 0} مستخدم لديه تذاكر
              </Badge>
            </div>

            {/* Search and Add */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم، الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Button onClick={() => setAddTicketDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة تذاكر لمستخدم
              </Button>
            </div>

            {/* Table */}
            <ScrollArea className="flex-1 border rounded-lg h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">عدد التذاكر</TableHead>
                    <TableHead className="text-right">آخر تحديث</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا يوجد مستخدمين لديهم تذاكر
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers?.map((user, index) => (
                      <TableRow key={user.user_id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.profile?.full_name || 'بدون اسم'}</span>
                            <span className="text-xs text-muted-foreground">@{user.profile?.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>{user.profile?.phone_number || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-lg font-bold">
                            {user.ticket_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(user.updated_at), 'dd MMM yyyy HH:mm', { locale: ar })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                setTicketAmount("1");
                                setAddTicketDialogOpen(true);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTicketsMutation.mutate({
                                userId: user.user_id,
                                amount: 1,
                                isAdd: false
                              })}
                              disabled={user.ticket_count === 0}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Tickets Dialog */}
      <Dialog open={addTicketDialogOpen} onOpenChange={setAddTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة تذاكر لمستخدم</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {!selectedUser ? (
              <div className="space-y-2">
                <Label>ابحث عن مستخدم</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="اكتب اسم المستخدم أو رقم الهاتف..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                
                {userSearchTerm && allUsers && allUsers.length > 0 && (
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <div className="p-2 space-y-1">
                      {allUsers.map(user => (
                        <button
                          key={user.id}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-right"
                          onClick={() => handleAddToUser(user)}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{user.full_name || user.username}</p>
                            <p className="text-xs text-muted-foreground">{user.phone_number || user.email}</p>
                          </div>
                          <Plus className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedUser.profile?.full_name || selectedUser.profile?.username}</p>
                  <p className="text-sm text-muted-foreground">الرصيد الحالي: {selectedUser.ticket_count} تذكرة</p>
                </div>
                
                <div className="space-y-2">
                  <Label>عدد التذاكر المراد إضافتها</Label>
                  <Input
                    type="number"
                    min="1"
                    value={ticketAmount}
                    onChange={(e) => setTicketAmount(e.target.value)}
                    placeholder="أدخل عدد التذاكر"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => updateTicketsMutation.mutate({
                      userId: selectedUser.user_id,
                      amount: parseInt(ticketAmount) || 0,
                      isAdd: true
                    })}
                    disabled={!ticketAmount || updateTicketsMutation.isPending}
                  >
                    {updateTicketsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedUser(null);
                      setUserSearchTerm("");
                    }}
                  >
                    اختيار مستخدم آخر
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
