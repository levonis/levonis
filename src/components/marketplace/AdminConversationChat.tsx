import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Send,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Image as ImageIcon,
  Package,
  X,
  CheckCheck,
  User,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AdminConversationChatProps {
  conversation: any;
  open: boolean;
  onClose: () => void;
}

const formatMessageDate = (date: Date) => {
  if (isToday(date)) return 'اليوم';
  if (isYesterday(date)) return 'أمس';
  return format(date, 'dd MMM yyyy', { locale: ar });
};

export const AdminConversationChat = ({ conversation, open, onClose }: AdminConversationChatProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageInput, setMessageInput] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch messages
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['admin-conversation-messages', conversation?.id],
    queryFn: async () => {
      if (!conversation) return [];
      const { data, error } = await supabase
        .from('listing_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch sender profiles
      if (data?.length) {
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', senderIds);
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(m => ({
          ...m,
          sender_profile: profilesMap.get(m.sender_id),
        }));
      }
      return data;
    },
    enabled: !!conversation && open,
    refetchInterval: open ? 3000 : false,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // Send message as admin
  const sendMessageMutation = useMutation({
    mutationFn: async (mediaUrl?: string) => {
      if (!user || !conversation || (!messageInput.trim() && !mediaUrl)) {
        throw new Error('لا يمكن إرسال رسالة فارغة');
      }

      const messageContent = messageInput.trim() || (mediaUrl ? '📷 وسائط' : '');

      // Insert message
      const { error } = await supabase.from('listing_messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: `[الإدارة] ${messageContent}`,
        image_url: mediaUrl || null,
      });
      if (error) throw error;

      // Update conversation
      await supabase.from('listing_conversations')
        .update({ 
          updated_at: new Date().toISOString(),
          admin_joined: true,
        })
        .eq('id', conversation.id);
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['admin-conversation-messages', conversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Resolve dispute
  const resolveDisputeMutation = useMutation({
    mutationFn: async () => {
      if (!conversation || !user) return;
      
      const { error } = await supabase
        .from('listing_conversations')
        .update({ status: 'resolved' })
        .eq('id', conversation.id);
      if (error) throw error;

      // Add system message
      await supabase.from('listing_messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: '✅ تم حل النزاع من قبل الإدارة',
      });

      // Notify both parties
      await supabase.from('notifications').insert([
        {
          user_id: conversation.buyer_id,
          title: 'تم حل النزاع',
          message: 'تم حل النزاع في محادثة السوق من قبل الإدارة',
          type: 'success',
        },
        {
          user_id: conversation.seller_id,
          title: 'تم حل النزاع',
          message: 'تم حل النزاع في محادثة السوق من قبل الإدارة',
          type: 'success',
        },
      ]);
    },
    onSuccess: () => {
      toast.success('تم حل النزاع');
      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-conversation-messages', conversation?.id] });
    },
  });

  // Reopen dispute
  const reopenDisputeMutation = useMutation({
    mutationFn: async () => {
      if (!conversation || !user) return;
      
      const { error } = await supabase
        .from('listing_conversations')
        .update({ status: 'open' })
        .eq('id', conversation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إعادة فتح المحادثة');
      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
    },
  });

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingMedia(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `admin-chat/${user.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('listing-images').upload(fileName, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(fileName);
      await sendMessageMutation.mutateAsync(publicUrl);
    } catch {
      toast.error('فشل رفع الملف');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) sendMessageMutation.mutate(undefined);
  };

  // Group messages by date
  const groupedMessages = messages?.reduce((groups: any, msg) => {
    const date = formatMessageDate(new Date(msg.created_at));
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  if (!conversation) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div>
                <span>محادثة الإدارة</span>
                {conversation.conversation_code && (
                  <Badge variant="outline" className="mr-2 font-mono">
                    {conversation.conversation_code}
                  </Badge>
                )}
              </div>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {conversation.status === 'disputed' ? (
                <Button 
                  size="sm" 
                  onClick={() => resolveDisputeMutation.mutate()}
                  disabled={resolveDisputeMutation.isPending}
                  className="gap-1"
                >
                  {resolveDisputeMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  حل النزاع
                </Button>
              ) : conversation.status === 'resolved' ? (
                <Badge variant="default" className="gap-1">
                  <CheckCheck className="w-3 h-3" />
                  تم الحل
                </Badge>
              ) : (
                <Badge variant="outline">{conversation.status}</Badge>
              )}
            </div>
          </div>

          {/* Product and Parties Info */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
            {/* Product */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
              {(conversation.user_listings as any)?.images?.[0] ? (
                <img 
                  src={(conversation.user_listings as any).images[0]} 
                  alt="" 
                  className="w-10 h-10 rounded object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              )}
              <div>
                <p className="font-medium">{(conversation.user_listings as any)?.title_ar || 'منتج'}</p>
                {(conversation.user_listings as any)?.listing_code && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {(conversation.user_listings as any).listing_code}
                  </Badge>
                )}
              </div>
            </div>

            {/* Buyer */}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              <span className="text-muted-foreground">المشتري:</span>
              <span className="font-medium">{(conversation as any).buyer_profile?.full_name || (conversation as any).buyer_profile?.username}</span>
            </div>

            {/* Seller */}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">البائع:</span>
              <span className="font-medium">{(conversation as any).seller_profile?.full_name || (conversation as any).seller_profile?.username}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {loadingMessages ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : messages?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>لا توجد رسائل</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMessages || {}).map(([date, msgs]: [string, any]) => (
                <div key={date}>
                  {/* Date Separator */}
                  <div className="flex items-center justify-center my-4">
                    <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                      {date}
                    </span>
                  </div>

                  {/* Messages */}
                  {msgs.map((msg: any) => {
                    const isAdmin = msg.content?.startsWith('[الإدارة]');
                    const isBuyer = msg.sender_id === conversation.buyer_id;
                    const displayContent = isAdmin ? msg.content.replace('[الإدارة] ', '') : msg.content;

                    return (
                      <div key={msg.id} className={cn("flex mb-2", isAdmin ? "justify-center" : isBuyer ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] rounded-lg p-3",
                          isAdmin 
                            ? "bg-primary text-primary-foreground" 
                            : isBuyer 
                              ? "bg-blue-500/10 text-foreground" 
                              : "bg-green-500/10 text-foreground"
                        )}>
                          {/* Sender Name */}
                          <p className={cn(
                            "text-xs font-medium mb-1",
                            isAdmin ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {isAdmin ? (
                              <span className="flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                الإدارة
                              </span>
                            ) : isBuyer ? (
                              `المشتري: ${msg.sender_profile?.full_name || msg.sender_profile?.username || 'مستخدم'}`
                            ) : (
                              `البائع: ${msg.sender_profile?.full_name || msg.sender_profile?.username || 'مستخدم'}`
                            )}
                          </p>

                          {/* Image */}
                          {msg.image_url && (
                            <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                              <img src={msg.image_url} alt="" className="max-w-full rounded-lg mb-2" />
                            </a>
                          )}

                          {/* Content */}
                          <p className="text-sm whitespace-pre-wrap">{displayContent}</p>

                          {/* Time */}
                          <p className={cn(
                            "text-[10px] mt-1 flex items-center gap-1",
                            isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"
                          )}>
                            {format(new Date(msg.created_at), 'HH:mm')}
                            {msg.is_read && <CheckCheck className="w-3 h-3" />}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <form onSubmit={handleSend} className="p-4 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleMediaUpload}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia}
            >
              {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            </Button>
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="اكتب رسالة كـ إدارة..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={sendMessageMutation.isPending || !messageInput.trim()}>
              {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
