import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { sendAllNotifications } from '@/lib/notifications';

// Support user ID - the admin support account
const SUPPORT_USER_ID = "2ae7972f-6d1d-40fb-b73f-9fb72941f3f3";

interface AdminOrderChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  image_url?: string | null;
  is_read: boolean;
}

export default function AdminOrderChatDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  userId,
  customerName
}: AdminOrderChatDialogProps) {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Get or create conversation when dialog opens
  useEffect(() => {
    if (open && userId) {
      getOrCreateConversation();
    }
  }, [open, userId]);

  const getOrCreateConversation = async () => {
    setIsLoading(true);
    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('listing_conversations')
        .select('id')
        .or(`and(buyer_id.eq.${userId},seller_id.eq.${SUPPORT_USER_ID}),and(buyer_id.eq.${SUPPORT_USER_ID},seller_id.eq.${userId})`)
        .maybeSingle();

      if (existingConv) {
        setConversationId(existingConv.id);
      } else {
        // Create new conversation - listing_id is required, use order reference
        const { data: newConv, error } = await supabase
          .from('listing_conversations')
          .insert({
            listing_id: orderId, // Use order ID as listing reference
            buyer_id: userId,
            seller_id: SUPPORT_USER_ID,
            entry_context: { type: 'order_support', order_number: orderNumber },
          })
          .select('id')
          .single();

        if (error) throw error;
        setConversationId(newConv.id);
      }
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      toast.error('حدث خطأ في فتح المحادثة');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch messages
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['admin-order-chat-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('listing_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
    refetchInterval: open ? 5000 : false,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) {
        await getOrCreateConversation();
      }
      
      const convId = conversationId;
      if (!convId) throw new Error('No conversation');

      // Send initial context message if this is first message
      const { data: existingMessages } = await supabase
        .from('listing_messages')
        .select('id')
        .eq('conversation_id', convId)
        .limit(1);

      if (!existingMessages || existingMessages.length === 0) {
        // Send context about the order
        await supabase.from('listing_messages').insert({
          conversation_id: convId,
          sender_id: SUPPORT_USER_ID,
          content: `📦 مرحباً، هذه رسالة بخصوص طلبك رقم ${orderNumber}`,
        });
      }

      // Send the actual message
      const { error } = await supabase.from('listing_messages').insert({
        conversation_id: convId,
        sender_id: SUPPORT_USER_ID,
        content,
      });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('listing_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);

      // Send all notifications (in-app, Telegram, Email)
      await sendAllNotifications({
        userId,
        title: 'رسالة جديدة من الدعم',
        message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        type: 'info',
        relatedId: orderId,
        notificationType: 'new_message',
        metadata: {
          orderNumber,
          senderName: 'دعم ليفونيس',
        }
      });
    },
    onSuccess: () => {
      setMessage('');
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('فشل في إرسال الرسالة');
    }
  });

  // Mark messages as read when viewing
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      supabase
        .from('listing_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', SUPPORT_USER_ID)
        .eq('is_read', false)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
        });
    }
  }, [conversationId, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[80vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span>محادثة مع {customerName}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">طلب رقم: {orderNumber}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">ابدأ المحادثة مع العميل</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSupport = msg.sender_id === SUPPORT_USER_ID;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isSupport ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-4 py-2 ${
                            isSupport
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {msg.image_url && (
                            <img
                              src={msg.image_url}
                              alt="صورة"
                              className="max-w-full rounded-lg mb-2"
                            />
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-xs mt-1 ${isSupport ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), 'HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t shrink-0">
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب رسالتك..."
                  className="resize-none min-h-[44px] max-h-24"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  size="icon"
                  className="shrink-0"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
