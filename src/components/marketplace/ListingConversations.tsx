import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Image as ImageIcon,
  Package,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ListingConversationsProps {
  children?: React.ReactNode;
  listingId?: string;
  onClose?: () => void;
}

export const ListingConversations = ({ children, listingId, onClose }: ListingConversationsProps) => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(!listingId);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto open if listingId is provided
  useEffect(() => {
    if (listingId) {
      setOpen(true);
    }
  }, [listingId]);

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['listing-conversations', user?.id, listingId],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('listing_conversations')
        .select(`
          *,
          user_listings(title_ar, images, price, currency)
        `)
        .order('updated_at', { ascending: false });
      
      if (listingId) {
        query = query.eq('listing_id', listingId);
      } else if (!isAdmin) {
        query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Fetch buyer/seller profiles
  const { data: profiles } = useQuery({
    queryKey: ['conversation-profiles', conversations?.map(c => [c.buyer_id, c.seller_id]).flat()],
    queryFn: async () => {
      if (!conversations?.length) return {};
      
      const userIds = [...new Set(conversations.flatMap(c => [c.buyer_id, c.seller_id]))];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);
      
      if (error) throw error;
      
      return data?.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, typeof data[0]>) || {};
    },
    enabled: !!conversations?.length,
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['listing-messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      
      const { data, error } = await supabase
        .from('listing_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedConversation,
    refetchInterval: 5000,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedConversation || !messageInput.trim()) {
        throw new Error('لا يمكن إرسال رسالة فارغة');
      }
      
      const { data, error } = await supabase
        .from('listing_messages')
        .insert({
          conversation_id: selectedConversation,
          sender_id: user.id,
          content: messageInput.trim(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await supabase
        .from('listing_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation);
      
      return data;
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Request admin help
  const requestAdminMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversation) return;
      
      const { error } = await supabase
        .from('listing_conversations')
        .update({ status: 'disputed' })
        .eq('id', selectedConversation);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم طلب تدخل الإدارة');
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessageMutation.mutate();
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedConversation(null);
    if (onClose) onClose();
  };

  const selectedConv = conversations?.find(c => c.id === selectedConversation);
  const isBuyer = selectedConv?.buyer_id === user?.id;
  const isSeller = selectedConv?.seller_id === user?.id;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {!listingId && (
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline" size="sm" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              المحادثات
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-right flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {listingId ? 'محادثات المنتج' : 'محادثات المبيعات'}
          </DialogTitle>
          <DialogDescription>التواصل مع المشترين والبائعين</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Conversations List */}
          <div className="w-1/3 border-l overflow-y-auto">
            {loadingConversations ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-muted/50 rounded-lg p-3 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : conversations?.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">لا توجد محادثات</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations?.map(conv => {
                  const otherUserId = conv.buyer_id === user?.id ? conv.seller_id : conv.buyer_id;
                  const otherUser = profiles?.[otherUserId];
                  const isCurrentUser = conv.buyer_id === user?.id || conv.seller_id === user?.id;
                  const role = conv.buyer_id === user?.id ? 'مشتري' : 'بائع';
                  
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full p-3 text-right hover:bg-muted/50 transition-colors ${
                        selectedConversation === conv.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        {(conv.user_listings as any)?.images?.[0] ? (
                          <img
                            src={(conv.user_listings as any).images[0]}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {(conv.user_listings as any)?.title_ar}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {otherUser?.full_name || otherUser?.username || 'مستخدم'}
                            <span className="mx-1">•</span>
                            <span className="text-primary">{role}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {conv.status === 'disputed' && (
                              <Badge variant="destructive" className="text-xs py-0">
                                نزاع
                              </Badge>
                            )}
                            {conv.admin_joined && (
                              <Badge variant="secondary" className="text-xs py-0">
                                <ShieldCheck className="w-3 h-3 ml-1" />
                                الإدارة
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedConversation ? (
              <>
                {/* Conversation Header */}
                <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="p-1 hover:bg-muted rounded lg:hidden"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="font-medium text-sm">{(selectedConv?.user_listings as any)?.title_ar}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number((selectedConv?.user_listings as any)?.price).toLocaleString()} {(selectedConv?.user_listings as any)?.currency}
                    </p>
                  </div>
                  {(isBuyer || isSeller) && selectedConv?.status !== 'disputed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive"
                      onClick={() => requestAdminMutation.mutate()}
                    >
                      <AlertTriangle className="w-3 h-3 ml-1" />
                      طلب تدخل الإدارة
                    </Button>
                  )}
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
                          <div className="bg-muted rounded-lg p-3 w-2/3 animate-pulse">
                            <div className="h-4 bg-muted-foreground/20 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : messages?.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm">
                      ابدأ المحادثة
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {messages?.map(msg => {
                        const isMe = msg.sender_id === user?.id;
                        const sender = profiles?.[msg.sender_id];
                        
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isMe ? 'justify-end' : ''}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                isMe
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              {!isMe && (
                                <p className="text-xs font-medium mb-1 opacity-70">
                                  {sender?.full_name || sender?.username}
                                </p>
                              )}
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              {msg.image_url && (
                                <img
                                  src={msg.image_url}
                                  alt=""
                                  className="mt-2 rounded max-w-full"
                                />
                              )}
                              <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {format(new Date(msg.created_at), 'HH:mm', { locale: ar })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={sendMessageMutation.isPending}>
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>اختر محادثة للعرض</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ListingConversations;
