import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, Search, AlertTriangle, Users, Ticket, Phone, Mail, Shield, UserCheck, Loader2, Undo2, ChevronDown, ChevronUp, FileText, DollarSign, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Participant {
  id: string;
  ticket_number: string;
  purchased_at: string;
  is_winner: boolean;
  user_id: string;
  letter_awarded: string | null;
  profile: {
    username: string;
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
    governorate: string | null;
    created_at: string | null;
  } | null;
}

interface GroupedUser {
  user_id: string;
  profile: Participant['profile'];
  tickets: Participant[];
  ticketCount: number;
  isNewAccount: boolean;
}

interface CollectedLetter {
  letter: string;
  count: number;
  user_id: string;
  username: string;
  full_name: string | null;
}

interface FraudAlert {
  type: 'duplicate_ip' | 'new_account' | 'multiple_tickets' | 'suspicious_timing';
  severity: 'low' | 'medium' | 'high';
  message: string;
  users: string[];
}

interface CompetitionParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  competitionTitle: string;
  requiredTickets?: number;
  ticketPrice?: number;
}

export default function CompetitionParticipantsDialog({
  open,
  onOpenChange,
  competitionId,
  competitionTitle,
  requiredTickets = 1,
  ticketPrice = 1
}: CompetitionParticipantsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cancelTicketDialogOpen, setCancelTicketDialogOpen] = useState(false);
  const [selectedTicketsToCancel, setSelectedTicketsToCancel] = useState<Participant[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("participants");
  const queryClient = useQueryClient();

  const { data: participants, isLoading } = useQuery({
    queryKey: ['competition-participants', competitionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competition_tickets')
        .select(`
          id,
          ticket_number,
          purchased_at,
          is_winner,
          user_id,
          letter_awarded
        `)
        .eq('competition_id', competitionId)
        .order('purchased_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(data?.map(t => t.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, phone_number, governorate, created_at')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(ticket => ({
        ...ticket,
        profile: profileMap.get(ticket.user_id) || null
      })) as Participant[];
    },
    enabled: open && !!competitionId
  });

  // Fetch collected letters for report
  const { data: collectedLetters } = useQuery({
    queryKey: ['collected-letters-report', competitionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collected_letters')
        .select(`
          letter,
          user_id
        `)
        .eq('competition_id', competitionId);

      if (error) throw error;

      const userIds = [...new Set(data?.map(l => l.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Group by user and letter
      const lettersByUser = new Map<string, Map<string, number>>();
      data?.forEach(item => {
        if (!lettersByUser.has(item.user_id)) {
          lettersByUser.set(item.user_id, new Map());
        }
        const userLetters = lettersByUser.get(item.user_id)!;
        userLetters.set(item.letter, (userLetters.get(item.letter) || 0) + 1);
      });

      const result: { user_id: string; username: string; full_name: string | null; letters: Record<string, number> }[] = [];
      lettersByUser.forEach((letters, user_id) => {
        const profile = profileMap.get(user_id);
        const lettersObj: Record<string, number> = {};
        letters.forEach((count, letter) => {
          lettersObj[letter] = count;
        });
        result.push({
          user_id,
          username: profile?.username || 'مجهول',
          full_name: profile?.full_name || null,
          letters: lettersObj
        });
      });

      return result;
    },
    enabled: open && !!competitionId && activeTab === 'letters'
  });

  // Group participants by user
  const groupedUsers = useMemo<GroupedUser[]>(() => {
    if (!participants) return [];
    
    const userMap = new Map<string, GroupedUser>();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    participants.forEach(p => {
      if (!userMap.has(p.user_id)) {
        const isNewAccount = p.profile?.created_at ? new Date(p.profile.created_at) > weekAgo : false;
        userMap.set(p.user_id, {
          user_id: p.user_id,
          profile: p.profile,
          tickets: [],
          ticketCount: 0,
          isNewAccount
        });
      }
      const user = userMap.get(p.user_id)!;
      user.tickets.push(p);
      user.ticketCount++;
    });
    
    return Array.from(userMap.values()).sort((a, b) => b.ticketCount - a.ticketCount);
  }, [participants]);

  // Analyze for potential fraud
  const fraudAlerts: FraudAlert[] = useMemo(() => {
    const alerts: FraudAlert[] = [];
    if (!participants) return alerts;

    const multipleTicketUsers = groupedUsers
      .filter(u => u.ticketCount >= 5)
      .map(u => `${u.profile?.full_name || u.profile?.username} (${u.ticketCount} تذاكر)`);

    if (multipleTicketUsers.length > 0) {
      alerts.push({
        type: 'multiple_tickets',
        severity: 'medium',
        message: 'مستخدمون لديهم تذاكر متعددة (5+)',
        users: multipleTicketUsers
      });
    }

    const newAccounts = groupedUsers
      .filter(u => u.isNewAccount)
      .map(u => u.profile?.full_name || u.profile?.username || 'مجهول');

    if (newAccounts.length > 0) {
      alerts.push({
        type: 'new_account',
        severity: 'low',
        message: 'حسابات جديدة (أقل من 7 أيام)',
        users: [...new Set(newAccounts)]
      });
    }

    return alerts;
  }, [participants, groupedUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return groupedUsers;
    const search = searchTerm.toLowerCase();
    return groupedUsers.filter(u => 
      u.profile?.username?.toLowerCase().includes(search) ||
      u.profile?.full_name?.toLowerCase().includes(search) ||
      u.profile?.phone_number?.includes(search) ||
      u.profile?.email?.toLowerCase().includes(search) ||
      u.tickets.some(t => t.ticket_number.toLowerCase().includes(search))
    );
  }, [groupedUsers, searchTerm]);

  const toggleUserExpand = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const toggleTicketSelection = (ticketId: string) => {
    const newSelected = new Set(selectedTicketIds);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTicketIds(newSelected);
  };

  const selectAllUserTickets = (user: GroupedUser, select: boolean) => {
    const newSelected = new Set(selectedTicketIds);
    user.tickets.forEach(t => {
      if (!t.is_winner) {
        if (select) {
          newSelected.add(t.id);
        } else {
          newSelected.delete(t.id);
        }
      }
    });
    setSelectedTicketIds(newSelected);
  };

  const handleRefundSelected = () => {
    const ticketsToRefund = participants?.filter(p => selectedTicketIds.has(p.id) && !p.is_winner) || [];
    if (ticketsToRefund.length === 0) {
      toast.error('لم يتم تحديد أي تذاكر للإرجاع');
      return;
    }
    setSelectedTicketsToCancel(ticketsToRefund);
    setCancelTicketDialogOpen(true);
  };

  const exportToExcel = () => {
    if (!participants || participants.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData = groupedUsers.map((user, index) => ({
      '#': index + 1,
      'اسم المستخدم': user.profile?.username || '-',
      'الاسم الكامل': user.profile?.full_name || '-',
      'البريد الإلكتروني': user.profile?.email || '-',
      'رقم الهاتف': user.profile?.phone_number || '-',
      'المحافظة': user.profile?.governorate || '-',
      'عدد التذاكر': user.ticketCount,
      'أرقام التذاكر': user.tickets.map(t => t.ticket_number).join(', '),
      'فائز': user.tickets.some(t => t.is_winner) ? 'نعم' : 'لا'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'المشاركين');

    const maxWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, ...exportData.map(row => String((row as any)[key]).length)) + 2
    }));
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, `مشاركين-${competitionTitle}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('تم تصدير القائمة بنجاح');
  };

  const exportLettersReport = () => {
    if (!collectedLetters || collectedLetters.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const allLetters = new Set<string>();
    collectedLetters.forEach(u => {
      Object.keys(u.letters).forEach(l => allLetters.add(l));
    });
    const letterColumns = Array.from(allLetters).sort();

    const exportData = collectedLetters.map((user, index) => {
      const row: Record<string, any> = {
        '#': index + 1,
        'اسم المستخدم': user.username,
        'الاسم الكامل': user.full_name || '-',
      };
      letterColumns.forEach(letter => {
        row[`حرف ${letter}`] = user.letters[letter] || 0;
      });
      row['المجموع'] = Object.values(user.letters).reduce((sum, count) => sum + count, 0);
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الأحرف المجمعة');

    XLSX.writeFile(workbook, `احرف-${competitionTitle}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('تم تصدير تقرير الأحرف بنجاح');
  };

  const exportFinancialReport = () => {
    if (!participants || participants.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData = groupedUsers.map((user, index) => ({
      '#': index + 1,
      'اسم المستخدم': user.profile?.username || '-',
      'الاسم الكامل': user.profile?.full_name || '-',
      'البريد الإلكتروني': user.profile?.email || '-',
      'رقم الهاتف': user.profile?.phone_number || '-',
      'المحافظة': user.profile?.governorate || '-',
      'عدد التذاكر': user.ticketCount,
      'المبلغ المنفق': user.ticketCount * requiredTickets * ticketPrice,
      'حساب جديد': user.isNewAccount ? 'نعم' : 'لا',
      'فائز': user.tickets.some(t => t.is_winner) ? 'نعم' : 'لا'
    }));

    // Add summary row
    exportData.push({
      '#': '',
      'اسم المستخدم': 'الإجمالي',
      'الاسم الكامل': '',
      'البريد الإلكتروني': '',
      'رقم الهاتف': '',
      'المحافظة': '',
      'عدد التذاكر': participants.length,
      'المبلغ المنفق': participants.length * requiredTickets * ticketPrice,
      'حساب جديد': '',
      'فائز': ''
    } as any);

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'التقرير المالي');

    const maxWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, ...exportData.map(row => String((row as any)[key]).length)) + 2
    }));
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, `تقرير-مالي-${competitionTitle}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('تم تصدير التقرير المالي بنجاح');
  };

  // Mutation to cancel/refund multiple tickets
  const cancelTicketsMutation = useMutation({
    mutationFn: async (tickets: Participant[]) => {
      // Group tickets by user for efficient refund
      const ticketsByUser = new Map<string, Participant[]>();
      tickets.forEach(t => {
        if (!ticketsByUser.has(t.user_id)) {
          ticketsByUser.set(t.user_id, []);
        }
        ticketsByUser.get(t.user_id)!.push(t);
      });

      // Delete all tickets
      const ticketIds = tickets.map(t => t.id);
      const { error: deleteError } = await supabase
        .from('competition_tickets')
        .delete()
        .in('id', ticketIds);
      
      if (deleteError) throw deleteError;

      // Refund each user
      for (const [userId, userTickets] of ticketsByUser) {
        const refundAmount = userTickets.length * requiredTickets;
        
        const { data: existingTickets } = await supabase
          .from('user_tickets')
          .select('ticket_count')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingTickets) {
          await supabase
            .from('user_tickets')
            .update({ 
              ticket_count: existingTickets.ticket_count + refundAmount,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        } else {
          await supabase
            .from('user_tickets')
            .insert({
              user_id: userId,
              ticket_count: refundAmount
            });
        }

        // Create notification
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: 'تم إلغاء تذاكر المسابقة',
            message: `تم إلغاء ${userTickets.length} تذكرة في المسابقة وإرجاع ${refundAmount} تذكرة إلى رصيدك`,
            type: 'info'
          });
      }

      return tickets;
    },
    onSuccess: (tickets) => {
      queryClient.invalidateQueries({ queryKey: ['competition-participants', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
      toast.success(`تم إلغاء ${tickets.length} تذكرة وإرجاعها للمستخدمين`);
      setCancelTicketDialogOpen(false);
      setSelectedTicketsToCancel([]);
      setSelectedTicketIds(new Set());
    },
    onError: (error) => {
      console.error('Error canceling tickets:', error);
      toast.error('حدث خطأ في إلغاء التذاكر');
    }
  });

  const uniqueUsers = groupedUsers.length;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-4 sm:p-6 pb-2 flex-shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="truncate">المشاركين: {competitionTitle}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4 sm:p-6 pt-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {/* Stats */}
          <div className="flex flex-wrap gap-2 sm:gap-4 flex-shrink-0">
            <Badge variant="outline" className="text-xs sm:text-base px-2 sm:px-4 py-1 sm:py-2">
              <Ticket className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
              {participants?.length || 0} تذكرة
            </Badge>
            <Badge variant="outline" className="text-xs sm:text-base px-2 sm:px-4 py-1 sm:py-2">
              <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
              {uniqueUsers} مشارك
            </Badge>
            {selectedTicketIds.size > 0 && (
              <Badge className="text-xs sm:text-base px-2 sm:px-4 py-1 sm:py-2 bg-primary">
                {selectedTicketIds.size} محدد
              </Badge>
            )}
          </div>

          {/* Fraud Alerts */}
          {fraudAlerts.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 sm:p-4 space-y-2 flex-shrink-0">
              <div className="flex items-center gap-2 text-destructive font-semibold text-xs sm:text-sm">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                تنبيهات الأمان ({fraudAlerts.length})
              </div>
              {fraudAlerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className={`h-3 w-3 sm:h-4 sm:w-4 mt-0.5 ${
                    alert.severity === 'high' ? 'text-red-500' :
                    alert.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                  }`} />
                  <div>
                    <span className="font-medium">{alert.message}:</span>
                    <span className="text-muted-foreground mr-1">
                      {alert.users.slice(0, 3).join('، ')}
                      {alert.users.length > 3 && ` و${alert.users.length - 3} آخرين`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="w-full grid grid-cols-3 flex-shrink-0">
              <TabsTrigger value="participants" className="text-xs sm:text-sm">المشاركين</TabsTrigger>
              <TabsTrigger value="report" className="text-xs sm:text-sm">التقرير المالي</TabsTrigger>
              <TabsTrigger value="letters" className="text-xs sm:text-sm">تقرير الأحرف</TabsTrigger>
            </TabsList>

            <TabsContent value="participants" className="flex-1 flex flex-col mt-3 space-y-3 min-h-0 overflow-hidden">
              {/* Search and Actions */}
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  {selectedTicketIds.size > 0 && (
                    <Button onClick={handleRefundSelected} variant="destructive" size="sm" className="gap-1 text-xs">
                      <Undo2 className="h-3 w-3" />
                      إرجاع ({selectedTicketIds.size})
                    </Button>
                  )}
                  <Button onClick={exportToExcel} size="sm" className="gap-1 text-xs">
                    <Download className="h-3 w-3" />
                    <span className="hidden sm:inline">تصدير</span>
                  </Button>
                </div>
              </div>

              {/* Grouped Users List */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-2">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">لا توجد نتائج</div>
                  ) : (
                    filteredUsers.map((user) => (
                      <Collapsible 
                        key={user.user_id} 
                        open={expandedUsers.has(user.user_id)}
                        onOpenChange={() => toggleUserExpand(user.user_id)}
                      >
                        <div className="border rounded-lg overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-2 sm:p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer">
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <Checkbox
                                  checked={user.tickets.filter(t => !t.is_winner).every(t => selectedTicketIds.has(t.id)) && user.tickets.some(t => !t.is_winner)}
                                  onCheckedChange={(checked) => {
                                    selectAllUserTickets(user, !!checked);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={user.tickets.every(t => t.is_winner)}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-xs sm:text-sm truncate">
                                      {user.profile?.full_name || user.profile?.username || 'مجهول'}
                                    </span>
                                    <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                      {user.ticketCount} تذكرة
                                    </Badge>
                                    {user.isNewAccount && (
                                      <Badge variant="outline" className="text-[10px] sm:text-xs text-orange-600">
                                        جديد
                                      </Badge>
                                    )}
                                    {user.tickets.some(t => t.is_winner) && (
                                      <Badge className="bg-green-500 text-[10px] sm:text-xs">فائز 🎉</Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] sm:text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                                    {user.profile?.phone_number && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {user.profile.phone_number}
                                      </span>
                                    )}
                                    {user.profile?.governorate && (
                                      <span>{user.profile.governorate}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {expandedUsers.has(user.user_id) ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t p-2 space-y-1 bg-background">
                              {user.tickets.map(ticket => (
                                <div 
                                  key={ticket.id} 
                                  className={`flex items-center justify-between p-2 rounded text-xs ${
                                    ticket.is_winner ? 'bg-green-500/10' : 'hover:bg-muted/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={selectedTicketIds.has(ticket.id)}
                                      onCheckedChange={() => toggleTicketSelection(ticket.id)}
                                      disabled={ticket.is_winner}
                                    />
                                    <span className="font-mono text-primary font-semibold">
                                      {ticket.ticket_number}
                                    </span>
                                    {ticket.letter_awarded && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {ticket.letter_awarded}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-[10px]">
                                      {format(new Date(ticket.purchased_at), 'dd/MM HH:mm')}
                                    </span>
                                    {ticket.is_winner && (
                                      <Badge className="bg-green-500 text-[10px]">فائز</Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Financial Report Tab */}
            <TabsContent value="report" className="flex-1 flex flex-col mt-3 space-y-3 min-h-0 overflow-hidden">
              <div className="flex justify-end flex-shrink-0">
                <Button onClick={exportFinancialReport} size="sm" className="gap-1 text-xs">
                  <Download className="h-3 w-3" />
                  تصدير التقرير المالي
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">إجمالي التذاكر</div>
                  <div className="text-lg font-bold text-primary">{participants?.length || 0}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">المشاركين</div>
                  <div className="text-lg font-bold text-primary">{groupedUsers.length}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">إجمالي الإنفاق</div>
                  <div className="text-lg font-bold text-green-600">
                    {((participants?.length || 0) * requiredTickets * ticketPrice).toLocaleString()}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">متوسط الإنفاق</div>
                  <div className="text-lg font-bold text-blue-600">
                    {groupedUsers.length > 0 
                      ? Math.round(((participants?.length || 0) * requiredTickets * ticketPrice) / groupedUsers.length).toLocaleString()
                      : 0}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-right text-xs">#</TableHead>
                      <TableHead className="text-right text-xs">المستخدم</TableHead>
                      <TableHead className="text-right text-xs">التذاكر</TableHead>
                      <TableHead className="text-right text-xs">الإنفاق</TableHead>
                      <TableHead className="text-right text-xs">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                          لا توجد بيانات
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupedUsers.map((user, index) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="text-xs">{index + 1}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div className="font-medium">{user.profile?.full_name || user.profile?.username || 'مجهول'}</div>
                              {user.profile?.phone_number && (
                                <div className="text-muted-foreground">{user.profile.phone_number}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold">{user.ticketCount}</TableCell>
                          <TableCell className="text-xs font-bold text-green-600">
                            {(user.ticketCount * requiredTickets * ticketPrice).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {user.tickets.some(t => t.is_winner) ? (
                              <Badge className="bg-green-500 text-[10px]">فائز</Badge>
                            ) : user.isNewAccount ? (
                              <Badge variant="outline" className="text-[10px] text-orange-600">جديد</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">مشارك</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="letters" className="flex-1 flex flex-col mt-3 space-y-3 min-h-0 overflow-hidden">
              <div className="flex justify-end flex-shrink-0">
                <Button onClick={exportLettersReport} size="sm" className="gap-1 text-xs">
                  <Download className="h-3 w-3" />
                  تصدير التقرير
                </Button>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-right text-xs">#</TableHead>
                      <TableHead className="text-right text-xs">المستخدم</TableHead>
                      <TableHead className="text-right text-xs">الأحرف المجمعة</TableHead>
                      <TableHead className="text-right text-xs">المجموع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!collectedLetters || collectedLetters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                          لا توجد أحرف مجمعة
                        </TableCell>
                      </TableRow>
                    ) : (
                      collectedLetters.map((user, index) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="text-xs">{index + 1}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div className="font-medium">{user.full_name || user.username}</div>
                              <div className="text-muted-foreground">@{user.username}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(user.letters).sort().map(([letter, count]) => (
                                <Badge key={letter} variant="outline" className="text-[10px] font-mono">
                                  {letter}: {count}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold">
                            {Object.values(user.letters).reduce((sum, count) => sum + count, 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Cancel Tickets Confirmation Dialog */}
    <AlertDialog open={cancelTicketDialogOpen} onOpenChange={setCancelTicketDialogOpen}>
      <AlertDialogContent dir="rtl" className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive text-sm">
            <Undo2 className="h-4 w-4" />
            تأكيد إلغاء التذاكر
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right text-xs">
            هل أنت متأكد من إلغاء <span className="font-bold text-foreground">{selectedTicketsToCancel.length}</span> تذكرة؟
            <br />
            <span className="text-green-600">
              سيتم إرجاع {selectedTicketsToCancel.length * requiredTickets} تذكرة إلى رصيد المستخدمين.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogAction
            onClick={() => cancelTicketsMutation.mutate(selectedTicketsToCancel)}
            className="bg-destructive hover:bg-destructive/90 gap-1 text-xs"
            disabled={cancelTicketsMutation.isPending}
          >
            {cancelTicketsMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Undo2 className="h-3 w-3" />
            )}
            تأكيد الإلغاء
          </AlertDialogAction>
          <AlertDialogCancel onClick={() => setSelectedTicketsToCancel([])} className="text-xs">
            رجوع
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
