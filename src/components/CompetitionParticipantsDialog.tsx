import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Search, AlertTriangle, Users, Ticket, Phone, Mail, Shield, UserCheck, Trash2, Loader2, Undo2 } from "lucide-react";
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
  profile: {
    username: string;
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
    governorate: string | null;
    created_at: string | null;
  } | null;
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
}

export default function CompetitionParticipantsDialog({
  open,
  onOpenChange,
  competitionId,
  competitionTitle,
  requiredTickets = 1
}: CompetitionParticipantsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cancelTicketDialogOpen, setCancelTicketDialogOpen] = useState(false);
  const [selectedTicketToCancel, setSelectedTicketToCancel] = useState<Participant | null>(null);
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
          user_id
        `)
        .eq('competition_id', competitionId)
        .order('purchased_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
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

  // Analyze for potential fraud
  const fraudAlerts: FraudAlert[] = [];
  
  if (participants) {
    // Check for users with multiple tickets
    const userTicketCounts = new Map<string, number>();
    participants.forEach(p => {
      userTicketCounts.set(p.user_id, (userTicketCounts.get(p.user_id) || 0) + 1);
    });
    
    const multipleTicketUsers = Array.from(userTicketCounts.entries())
      .filter(([_, count]) => count >= 5)
      .map(([userId, count]) => {
        const profile = participants.find(p => p.user_id === userId)?.profile;
        return `${profile?.full_name || profile?.username} (${count} تذاكر)`;
      });

    if (multipleTicketUsers.length > 0) {
      fraudAlerts.push({
        type: 'multiple_tickets',
        severity: 'medium',
        message: 'مستخدمون لديهم تذاكر متعددة (5+)',
        users: multipleTicketUsers
      });
    }

    // Check for new accounts (created within last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const newAccounts = participants.filter(p => {
      if (!p.profile?.created_at) return false;
      return new Date(p.profile.created_at) > weekAgo;
    }).map(p => p.profile?.full_name || p.profile?.username || 'مجهول');

    const uniqueNewAccounts = [...new Set(newAccounts)];
    if (uniqueNewAccounts.length > 0) {
      fraudAlerts.push({
        type: 'new_account',
        severity: 'low',
        message: 'حسابات جديدة (أقل من 7 أيام)',
        users: uniqueNewAccounts
      });
    }

    // Check for suspicious timing (multiple tickets in short time)
    const sortedByTime = [...participants].sort((a, b) => 
      new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime()
    );
    
    const suspiciousBursts: string[] = [];
    for (let i = 0; i < sortedByTime.length - 3; i++) {
      const timeWindow = new Date(sortedByTime[i + 3].purchased_at).getTime() - 
                         new Date(sortedByTime[i].purchased_at).getTime();
      // If 4 tickets in less than 30 seconds
      if (timeWindow < 30000) {
        const usersInWindow = new Set([
          sortedByTime[i].profile?.username,
          sortedByTime[i + 1].profile?.username,
          sortedByTime[i + 2].profile?.username,
          sortedByTime[i + 3].profile?.username
        ]);
        if (usersInWindow.size === 1 && sortedByTime[i].profile?.username) {
          suspiciousBursts.push(sortedByTime[i].profile.username);
        }
      }
    }

    const uniqueBursts = [...new Set(suspiciousBursts)];
    if (uniqueBursts.length > 0) {
      fraudAlerts.push({
        type: 'suspicious_timing',
        severity: 'high',
        message: 'شراء متعدد في وقت قصير جداً',
        users: uniqueBursts
      });
    }
  }

  const filteredParticipants = participants?.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      p.ticket_number.toLowerCase().includes(search) ||
      p.profile?.username?.toLowerCase().includes(search) ||
      p.profile?.full_name?.toLowerCase().includes(search) ||
      p.profile?.phone_number?.includes(search) ||
      p.profile?.email?.toLowerCase().includes(search)
    );
  });

  const exportToExcel = () => {
    if (!participants || participants.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData = participants.map((p, index) => ({
      '#': index + 1,
      'رقم التذكرة': p.ticket_number,
      'اسم المستخدم': p.profile?.username || '-',
      'الاسم الكامل': p.profile?.full_name || '-',
      'البريد الإلكتروني': p.profile?.email || '-',
      'رقم الهاتف': p.profile?.phone_number || '-',
      'المحافظة': p.profile?.governorate || '-',
      'تاريخ الشراء': format(new Date(p.purchased_at), 'yyyy-MM-dd HH:mm:ss'),
      'فائز': p.is_winner ? 'نعم' : 'لا'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'المشاركين');

    // Auto-size columns
    const maxWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, ...exportData.map(row => String((row as any)[key]).length)) + 2
    }));
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, `مشاركين-${competitionTitle}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('تم تصدير القائمة بنجاح');
  };

  // Mutation to cancel/refund ticket
  const cancelTicketMutation = useMutation({
    mutationFn: async (ticket: Participant) => {
      // Delete the competition ticket
      const { error: deleteError } = await supabase
        .from('competition_tickets')
        .delete()
        .eq('id', ticket.id);
      
      if (deleteError) throw deleteError;

      // Return the ticket(s) to the user
      const { error: ticketError } = await supabase
        .from('user_tickets')
        .upsert({
          user_id: ticket.user_id,
          ticket_count: requiredTickets
        }, {
          onConflict: 'user_id'
        });

      if (ticketError) {
        // If upsert fails, try update
        const { error: updateError } = await supabase
          .rpc('purchase_tickets', {
            ticket_quantity: -requiredTickets, // Negative to add back
            price_per_ticket: 0
          });
        
        // Alternative: directly update
        const { data: existingTickets } = await supabase
          .from('user_tickets')
          .select('ticket_count')
          .eq('user_id', ticket.user_id)
          .single();

        if (existingTickets) {
          await supabase
            .from('user_tickets')
            .update({ 
              ticket_count: existingTickets.ticket_count + requiredTickets,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', ticket.user_id);
        } else {
          await supabase
            .from('user_tickets')
            .insert({
              user_id: ticket.user_id,
              ticket_count: requiredTickets
            });
        }
      }

      // Create notification for user
      await supabase
        .from('notifications')
        .insert({
          user_id: ticket.user_id,
          title: 'تم إلغاء تذكرة المسابقة',
          message: `تم إلغاء تذكرتك رقم ${ticket.ticket_number} في المسابقة وإرجاع ${requiredTickets} تذكرة إلى رصيدك`,
          type: 'info'
        });

      return ticket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['competition-participants', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
      toast.success(`تم إلغاء التذكرة ${ticket.ticket_number} وإرجاع ${requiredTickets} تذكرة للمستخدم`);
      setCancelTicketDialogOpen(false);
      setSelectedTicketToCancel(null);
    },
    onError: (error) => {
      console.error('Error canceling ticket:', error);
      toast.error('حدث خطأ في إلغاء التذكرة');
    }
  });

  const uniqueUsers = new Set(participants?.map(p => p.user_id) || []).size;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            المشاركين في: {competitionTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Stats */}
          <div className="flex flex-wrap gap-4">
            <Badge variant="outline" className="text-base px-4 py-2">
              <Ticket className="h-4 w-4 ml-2" />
              {participants?.length || 0} تذكرة
            </Badge>
            <Badge variant="outline" className="text-base px-4 py-2">
              <UserCheck className="h-4 w-4 ml-2" />
              {uniqueUsers} مشارك فريد
            </Badge>
          </div>

          {/* Fraud Alerts */}
          {fraudAlerts.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <Shield className="h-5 w-5" />
                تنبيهات الأمان ({fraudAlerts.length})
              </div>
              {fraudAlerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                    alert.severity === 'high' ? 'text-red-500' :
                    alert.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                  }`} />
                  <div>
                    <span className="font-medium">{alert.message}:</span>
                    <span className="text-muted-foreground mr-2">
                      {alert.users.slice(0, 5).join('، ')}
                      {alert.users.length > 5 && ` و${alert.users.length - 5} آخرين`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search and Export */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، رقم التذكرة، الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Button onClick={exportToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              تصدير Excel
            </Button>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1 border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">رقم التذكرة</TableHead>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">المحافظة</TableHead>
                  <TableHead className="text-right">تاريخ الشراء</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredParticipants?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      لا توجد نتائج
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParticipants?.map((participant, index) => {
                    const ticketCount = participants?.filter(p => p.user_id === participant.user_id).length || 0;
                    const isNewAccount = participant.profile?.created_at && 
                      new Date(participant.profile.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    
                    return (
                      <TableRow key={participant.id} className={participant.is_winner ? 'bg-primary/10' : ''}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {participant.ticket_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {participant.profile?.full_name || participant.profile?.username || 'مجهول'}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {participant.profile?.email || '-'}
                            </span>
                            <div className="flex gap-1 mt-1">
                              {ticketCount > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  {ticketCount} تذاكر
                                </Badge>
                              )}
                              {isNewAccount && (
                                <Badge variant="secondary" className="text-xs">
                                  حساب جديد
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {participant.profile?.phone_number || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{participant.profile?.governorate || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(participant.purchased_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                        </TableCell>
                        <TableCell>
                          {participant.is_winner && (
                            <Badge className="bg-green-500">فائز 🎉</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!participant.is_winner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedTicketToCancel(participant);
                                setCancelTicketDialogOpen(true);
                              }}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>

    {/* Cancel Ticket Confirmation Dialog */}
    <AlertDialog open={cancelTicketDialogOpen} onOpenChange={setCancelTicketDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Undo2 className="h-5 w-5" />
              تأكيد إلغاء التذكرة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {selectedTicketToCancel && (
                <>
                  هل أنت متأكد من إلغاء التذكرة رقم <span className="font-bold text-foreground">{selectedTicketToCancel.ticket_number}</span>؟
                  <br />
                  <span className="text-muted-foreground text-sm">
                    المستخدم: <span className="font-medium">{selectedTicketToCancel.profile?.full_name || selectedTicketToCancel.profile?.username}</span>
                  </span>
                  <br />
                  <span className="text-green-600 text-sm">
                    سيتم إرجاع {requiredTickets} تذكرة إلى رصيد المستخدم.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => {
                if (selectedTicketToCancel) {
                  cancelTicketMutation.mutate(selectedTicketToCancel);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 gap-1"
              disabled={cancelTicketMutation.isPending}
            >
              {cancelTicketMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              تأكيد الإلغاء
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => setSelectedTicketToCancel(null)}>
              رجوع
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
