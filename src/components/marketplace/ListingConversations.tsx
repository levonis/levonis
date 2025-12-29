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
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ListingConversationsProps {
  children?: React.ReactNode;
  listingId?: string;
  onClose?: () => void;
  isAdmin?: boolean;
}

export const ListingConversations = ({ children, listingId, onClose, isAdmin: propIsAdmin }: ListingConversationsProps) => {
  const { user, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = propIsAdmin || authIsAdmin;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto open if listingId is provided
  useEffect(() => {
    if (listingId) {
      setOpen(true);
    }
  }, [listingId]);

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['listing-conversations', user?.id, listingId, isAdmin],
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

  // Fetch profiles
  const { data: profiles } = useQuery({
    queryKey: ['conversation-profiles', conversations?.map(c => [c.buyer_id, c.seller_id]).flat()],
    queryFn: async () => {
      if (!conversations?.length) return {};
      const userIds = [...new Set(conversations.flatMap(c => [c.buyer_id, c.seller_id]))];
      const { data } = await supabase.from('profiles').select('id, full_name, username').in('id', userIds);
      return data?.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, any>) || {};
    },
    enabled: !!conversations?.length,
  });

  // Fetch messages
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (imageUrl?: string) => {
      if (!user || !selectedConversation || (!messageInput.trim() && !imageUrl)) {
        throw new Error('لا يمكن إرسال رسالة فارغة');
      }
      
      const { error } = await supabase.from('listing_messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: messageInput.trim() || (imageUrl ? '📷 صورة' : ''),
        image_url: imageUrl || null,
      });
      if (error) throw error;
      
      await supabase.from('listing_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation);
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestAdminMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversation) return;
      const { error } = await supabase
        .from('listing_conversations')
        .update({ status: 'disputed', admin_joined: true })
        .eq('id', selectedConversation);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم طلب تدخل الإدارة');
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploadingImage(true);
    try {
      const fileName = `chat/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('listing-images').upload(fileName, file);
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(fileName);
      await sendMessageMutation.mutateAsync(publicUrl);
    } catch (error) {
      toast.error('فشل رفع الصورة');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) sendMessageMutation.mutate(undefined);
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
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
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
      <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-right flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              {listingId ? 'محادثات المنتج' : 'محادثات المبيعات'}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogDescription>التواصل مع المشترين والبائعين</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Conversations List */}
          <div className={`${selectedConversation ? 'hidden md:block' : ''} w-full md:w-1/3 border-l overflow-y-auto`}>
            {loadingConversations ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-muted/50 rounded-lg p-3 animate-pulse h-16" />
                ))}
              </div>
            ) : conversations?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>لا توجد محادثات</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations?.map(conv => {
                  const otherUserId = conv.buyer_id === user?.id ? conv.seller_id : conv.buyer_id;
                  const otherUser = profiles?.[otherUserId];
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
                          <img src={(conv.user_listings as any).images[0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{(conv.user_listings as any)?.title_ar}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {otherUser?.full_name || otherUser?.username || 'مستخدم'}
                            {!isAdmin && <span className="text-primary mr-1">• {role}</span>}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            {conv.status === 'disputed' && <Badge variant="destructive" className="text-xs py-0">نزاع</Badge>}
                            {conv.admin_joined && <Badge variant="secondary" className="text-xs py-0"><ShieldCheck className="w-3 h-3" /></Badge>}
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
          <div className={`${!selectedConversation ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-h-0`}>
            {selectedConversation ? (
              <>
                {/* Header */}
                <div className="p-3 border-b bg-muted/30 flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => setSelectedConversation(null)} className="p-1 hover:bg-muted rounded md:hidden">
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{(selectedConv?.user_listings as any)?.title_ar}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number((selectedConv?.user_listings as any)?.price).toLocaleString()} {(selectedConv?.user_listings as any)?.currency}
                    </p>
                  </div>
                  {(isBuyer || isSeller) && selectedConv?.status !== 'disputed' && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => requestAdminMutation.mutate()}>
                      <AlertTriangle className="w-3 h-3 ml-1" />
                      طلب تدخل الإدارة
                    </Button>
                  )}
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}><div className="bg-muted rounded-lg p-3 w-2/3 h-12 animate-pulse" /></div>)}
                    </div>
                  ) : messages?.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">ابدأ المحادثة</p>
                  ) : (
                    <div className="space-y-3">
                      {messages?.map(msg => {
                        const isMe = msg.sender_id === user?.id;
                        const sender = profiles?.[msg.sender_id];
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : ''}`}>
                            <div className={`max-w-[80%] rounded-2xl p-3 ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                              {!isMe && <p className="text-xs font-medium mb-1 opacity-70">{sender?.full_name || sender?.username}</p>}
                              {msg.image_url && <img src={msg.image_url} alt="" className="rounded-lg max-w-full mb-2 max-h-48" />}
                              {msg.content && msg.content !== '📷 صورة' && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
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

                {/* Input */}
                <form onSubmit={handleSend} className="p-3 border-t flex gap-2 flex-shrink-0 bg-background">
                  <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleImageUpload} className="hidden" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                    {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  </Button>
                  <Input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="اكتب رسالتك..." className="flex-1" />
                  <Button type="submit" size="icon" disabled={sendMessageMutation.isPending || !messageInput.trim()}>
                    {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
