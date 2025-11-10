import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  image_url?: string;
}

interface CustomerChatProps {
  orderId?: string;
}

export default function CustomerChat({ orderId }: CustomerChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get or create conversation
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['customer-conversation', user?.id, orderId],
    queryFn: async () => {
      if (!user) return null;

      // Check if conversation exists
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open');

      if (orderId) {
        query = query.eq('order_id', orderId);
      } else {
        query = query.is('order_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) return existing;

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          order_id: orderId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newConv;
    },
    enabled: !!user && isOpen,
  });

  // Get messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['conversation-messages', conversation?.id],
    queryFn: async () => {
      if (!conversation) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversation,
  });

  // Get unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-messages-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id);

      if (!conversations || conversations.length === 0) return 0;

      const conversationIds = conversations.map(c => c.id);

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Subscribe to new messages
  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversation.id] });
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count', user?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation, queryClient, user?.id]);

  // Mark messages as read when opened
  useEffect(() => {
    if (!conversation || !isOpen || !user) return;

    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        (m) => m.sender_id !== user.id && !m.is_read
      );

      for (const msg of unreadMessages) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('id', msg.id);
      }

      queryClient.invalidateQueries({ queryKey: ['unread-messages-count', user?.id] });
    };

    markAsRead();
  }, [conversation, isOpen, messages, user, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يجب اختيار صورة فقط');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload image to storage
  const uploadImage = async (file: File): Promise<string> => {
    if (!user) throw new Error('No user');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      if (!conversation || !user) throw new Error('No conversation');

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content,
        image_url: imageUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversation?.id] });
    },
    onError: () => {
      toast.error('فشل إرسال الرسالة');
      setUploadingImage(false);
    },
  });

  const handleSend = async () => {
    if (!message.trim() && !selectedImage) return;

    try {
      setUploadingImage(true);
      let imageUrl: string | undefined;

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      await sendMessageMutation.mutateAsync({
        content: message.trim() || 'صورة',
        imageUrl,
      });
    } catch (error) {
      toast.error('فشل إرسال الرسالة');
    } finally {
      setUploadingImage(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        size="icon"
      >
        <div className="relative">
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 left-6 w-96 h-[500px] shadow-2xl z-50 flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">خدمة العملاء</CardTitle>
                <CardDescription>
                  {orderId ? `محادثة حول الطلب #${orderId.slice(0, 8)}` : 'كيف يمكننا مساعدتك؟'}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {conversationLoading || messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">ابدأ المحادثة مع فريق الدعم</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                     <div
                      className={`max-w-[75%] rounded-lg px-4 py-2 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.image_url && (
                        <img
                          src={msg.image_url}
                          alt="صورة"
                          className="rounded-lg mb-2 max-w-full h-auto cursor-pointer"
                          onClick={() => window.open(msg.image_url, '_blank')}
                        />
                      )}
                      <p className="text-sm break-words">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}
                      >
                        {formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="border-t p-4">
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img
                  src={imagePreview}
                  alt="معاينة"
                  className="h-20 w-20 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || sendMessageMutation.isPending}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="اكتب رسالتك..."
                disabled={uploadingImage || sendMessageMutation.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={(!message.trim() && !selectedImage) || uploadingImage || sendMessageMutation.isPending}
                size="icon"
              >
                {uploadingImage || sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
