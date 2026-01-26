import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Search, Eye, AlertTriangle, CheckCircle, Clock, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout, { AdminSection } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface Conversation {
  id: string;
  request_id: string;
  customer_id: string;
  merchant_id: string;
  status: string;
  created_at: string;
  last_message_at: string | null;
  customer_name?: string;
  merchant_name?: string;
  request_title?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface Props {
  embedded?: boolean;
}

function MessagesContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Fetch print offer conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ["community-conversations", searchQuery, statusFilter],
    queryFn: async () => {
      // Get offers with request info
      const { data: offers, error } = await (supabase as any)
        .from("print_offers")
        .select(`
          id,
          request_id,
          trader_id,
          status,
          created_at,
          community_print_requests (
            title,
            user_id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get unique user IDs
      const userIds = new Set<string>();
      offers?.forEach((o: any) => {
        if (o.trader_id) userIds.add(o.trader_id);
        if (o.community_print_requests?.user_id) userIds.add(o.community_print_requests.user_id);
      });

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", Array.from(userIds));

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => {
        profileMap[p.id] = p.username || "مستخدم";
      });

      // Map to conversations format
      const mapped = offers?.map((o: any) => ({
        id: o.id,
        request_id: o.request_id,
        customer_id: o.community_print_requests?.user_id || "",
        merchant_id: o.trader_id,
        status: o.status,
        created_at: o.created_at,
        last_message_at: null,
        customer_name: profileMap[o.community_print_requests?.user_id] || "زبون",
        merchant_name: profileMap[o.trader_id] || "تاجر",
        request_title: o.community_print_requests?.title || "طلب طباعة",
      })) || [];

      // Filter
      let filtered = mapped;
      if (statusFilter !== "all") {
        filtered = filtered.filter(c => c.status === statusFilter);
      }
      if (searchQuery) {
        filtered = filtered.filter(c => 
          c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.merchant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.request_title?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      return filtered;
    },
  });

  // Fetch messages for selected conversation - using messages table if available
  const { data: messages } = useQuery({
    queryKey: ["conversation-messages", selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];
      
      // Try to get messages from messages table or return empty
      const { data, error } = await (supabase as any)
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${selectedConversation.customer_id},sender_id.eq.${selectedConversation.merchant_id}`)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) return [];
      return (data || []) as Message[];
    },
    enabled: !!selectedConversation,
  });

  const stats = {
    total: conversations?.length || 0,
    active: conversations?.filter(c => c.status === "accepted").length || 0,
    pending: conversations?.filter(c => c.status === "pending").length || 0,
    completed: conversations?.filter(c => c.status === "completed").length || 0,
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "قيد الانتظار", color: "bg-yellow-500/20 text-yellow-400" },
    accepted: { label: "نشط", color: "bg-green-500/20 text-green-400" },
    completed: { label: "مكتمل", color: "bg-blue-500/20 text-blue-400" },
    cancelled: { label: "ملغي", color: "bg-red-500/20 text-red-400" },
    rejected: { label: "مرفوض", color: "bg-gray-500/20 text-gray-400" },
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="levo-card-frame">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">إجمالي المحادثات</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-green-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
            <div className="text-xs text-muted-foreground">نشطة</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">قيد الانتظار</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-blue-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">مكتملة</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث في المحادثات..."
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="accepted">نشط</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conversations List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : conversations?.length === 0 ? (
        <Card className="levo-card-frame">
          <CardContent className="p-12 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">لا توجد محادثات</h3>
            <p className="text-sm text-muted-foreground">لم تبدأ أي محادثات بين التجار والزبائن بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations?.map((conv) => (
            <Card key={conv.id} className="levo-card-frame hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground truncate">{conv.request_title}</h3>
                      <Badge className={statusLabels[conv.status]?.color || ""}>
                        {statusLabels[conv.status]?.label || conv.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <span className="text-foreground/70">الزبون:</span> {conv.customer_name}
                      </span>
                      <span>↔</span>
                      <span>
                        <span className="text-foreground/70">التاجر:</span> {conv.merchant_name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(conv.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <Eye className="h-4 w-4 ml-1" />
                    عرض
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Conversation Detail Dialog */}
      <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              تفاصيل المحادثة
            </DialogTitle>
          </DialogHeader>

          {selectedConversation && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <h3 className="font-semibold">{selectedConversation.request_title}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <Badge className={statusLabels[selectedConversation.status]?.color || ""}>
                    {statusLabels[selectedConversation.status]?.label}
                  </Badge>
                  <span className="text-muted-foreground">
                    {selectedConversation.customer_name} ↔ {selectedConversation.merchant_name}
                  </span>
                </div>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg p-4">
                {messages?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    لا توجد رسائل في هذه المحادثة
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages?.map((msg) => {
                      const isCustomer = msg.sender_id === selectedConversation.customer_id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              isCustomer
                                ? "bg-muted/50"
                                : "bg-primary/20 text-primary-foreground"
                            }`}
                          >
                            <div className="text-xs text-muted-foreground mb-1">
                              {isCustomer ? selectedConversation.customer_name : selectedConversation.merchant_name}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(msg.created_at), "HH:mm", { locale: ar })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>هذا العرض للقراءة فقط - لا يمكن للإدارة إرسال رسائل</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCommunityMessages({ embedded }: Props) {
  if (embedded) {
    return <MessagesContent />;
  }

  return (
    <AdminLayout
      title="محادثات المجتمع"
      description="مراقبة محادثات مجتمع ليفو بين التجار والزبائن"
      icon={<MessageCircle className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <MessagesContent />
    </AdminLayout>
  );
}
