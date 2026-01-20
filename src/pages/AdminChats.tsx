import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MessageCircle, Crown, Award, Star, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import AdminLayout, { AdminCard, AdminCardContent, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  image_url?: string;
}

const LEVEL_PRIORITY: { [key: string]: number } = {
  platinum: 4,
  gold: 3,
  silver: 2,
  bronze: 1,
};

const LEVEL_ICONS: { [key: string]: any } = {
  platinum: Crown,
  gold: Award,
  silver: Star,
  bronze: MessageCircle,
};

export default function AdminChats() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['admin-conversations'],
    queryFn: async () => {
      const { data: convs, error: convsError } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (convsError) throw convsError;

      const conversationsWithUsers = await Promise.all(
        (convs || []).map(async (conv) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .eq('id', conv.user_id)
            .single();

          const { data: points } = await supabase
            .from('user_points')
            .select('level, total_points')
            .eq('user_id', conv.user_id)
            .single();

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user?.id || '')
            .eq('is_read', false);

          return {
            ...conv,
            user: profile,
            level: points?.level || 'bronze',
            total_points: points?.total_points || 0,
            unread_count: unreadCount || 0,
          };
        })
      );

      return conversationsWithUsers.sort((a, b) => {
        const levelDiff = (LEVEL_PRIORITY[b.level] || 0) - (LEVEL_PRIORITY[a.level] || 0);
        if (levelDiff !== 0) return levelDiff;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    },
    enabled: !!user && isAdmin,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['admin-conversation-messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
          if (selectedConversation) {
            queryClient.invalidateQueries({ 
              queryKey: ['admin-conversation-messages', selectedConversation] 
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedConversation]);

  useEffect(() => {
    if (!selectedConversation || !user) return;

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

      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
    };

    markAsRead();
  }, [selectedConversation, messages, user, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      if (!selectedConversation || !user) throw new Error('No conversation');

      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
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
      queryClient.invalidateQueries({ 
        queryKey: ['admin-conversation-messages', selectedConversation] 
      });
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

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  if (authLoading || conversationsLoading) {
    return <AdminLoading />;
  }

  if (!user || !isAdmin) return null;

  return (
    <AdminLayout
      title="محادثات العملاء"
      description="إدارة جميع محادثات الدعم"
      icon={<MessageCircle className="h-5 w-5" />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* Conversations List */}
        <AdminCard className="lg:col-span-1 overflow-hidden flex flex-col max-h-[300px] lg:max-h-none">
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">المحادثات</h3>
              {conversations.filter((c: any) => c.unread_count > 0).length > 0 && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  {conversations.filter((c: any) => c.unread_count > 0).length} غير مقروءة
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {conversations.length} محادثة - العملاء المميزون أولاً
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">لا توجد محادثات</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {conversations.map((conv: any) => {
                  const LevelIcon = LEVEL_ICONS[conv.level] || MessageCircle;
                  const hasUnread = conv.unread_count > 0;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full p-3 text-right hover:bg-muted/50 transition-colors relative ${
                        selectedConversation === conv.id ? 'bg-primary/10' : ''
                      } ${hasUnread ? 'bg-destructive/5' : ''}`}
                    >
                      {hasUnread && (
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-destructive rounded-l" />
                      )}
                      <div className="flex items-start gap-2">
                        <div className="relative flex-shrink-0">
                          <img
                            src={conv.user?.avatar_url || '/placeholder.svg'}
                            alt={conv.user?.full_name}
                            className={`h-9 w-9 rounded-full object-cover ${hasUnread ? 'ring-2 ring-destructive' : ''}`}
                          />
                          <LevelIcon className="absolute -bottom-1 -right-1 h-4 w-4 text-primary bg-background rounded-full p-0.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className={`truncate text-sm ${hasUnread ? 'font-bold' : 'font-medium'}`}>
                              {conv.user?.full_name || conv.user?.username}
                            </p>
                            {hasUnread && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 animate-pulse flex-shrink-0">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.last_message_at), {
                              addSuffix: true,
                              locale: ar,
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </AdminCard>

        {/* Chat Window */}
        <AdminCard className="lg:col-span-2 flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
          {selectedConversation && selectedConv ? (
            <>
              <div className="p-3 border-b border-border/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <img
                    src={selectedConv.user?.avatar_url || '/placeholder.svg'}
                    alt={selectedConv.user?.full_name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">
                      {selectedConv.user?.full_name || selectedConv.user?.username}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedConv.order_id
                        ? `محادثة حول الطلب #${selectedConv.order_id.slice(0, 8)}`
                        : 'محادثة عامة'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-xl px-3 py-2 ${
                              isOwn
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {msg.image_url && (
                              <img
                                src={msg.image_url}
                                alt="صورة"
                                className="rounded-lg mb-2 max-w-full max-h-40 h-auto cursor-pointer"
                                onClick={() => window.open(msg.image_url, '_blank')}
                              />
                            )}
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                            <p
                              className={`text-[10px] mt-1 ${
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
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="border-t border-border/50 p-3 flex-shrink-0">
                {imagePreview && (
                  <div className="mb-2 relative inline-block">
                    <img
                      src={imagePreview}
                      alt="معاينة"
                      className="h-16 w-16 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
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
                <div className="flex gap-2 items-center">
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
                    disabled={uploadingImage}
                    className="h-9 w-9 flex-shrink-0"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    disabled={uploadingImage}
                    className="h-9 text-sm"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={(!message.trim() && !selectedImage) || uploadingImage}
                    className="admin-btn-primary h-9 px-3 flex-shrink-0"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <AdminEmptyState
                icon={<MessageCircle className="h-10 w-10" />}
                title="اختر محادثة"
                description="اختر محادثة من القائمة للبدء"
              />
            </div>
          )}
        </AdminCard>
      </div>
    </AdminLayout>
  );
}
