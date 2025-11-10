import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Loader2, Send, MessageCircle, CheckCircle2, Crown, Award, Star } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Conversation {
  id: string;
  user_id: string;
  order_id: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
}

interface UserWithLevel {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  level: string;
  total_points: number;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  // Get all conversations with user details
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['admin-conversations'],
    queryFn: async () => {
      const { data: convs, error: convsError } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (convsError) throw convsError;

      // Get user details and points for each conversation
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

          // Get unread count
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

      // Sort by level priority first, then by last message
      return conversationsWithUsers.sort((a, b) => {
        const levelDiff = (LEVEL_PRIORITY[b.level] || 0) - (LEVEL_PRIORITY[a.level] || 0);
        if (levelDiff !== 0) return levelDiff;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    },
    enabled: !!user && isAdmin,
  });

  // Get messages for selected conversation
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

  // Subscribe to new messages
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

  // Mark messages as read when viewing
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

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversation || !user) throw new Error('No conversation');

      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ 
        queryKey: ['admin-conversation-messages', selectedConversation] 
      });
    },
    onError: () => {
      toast.error('فشل إرسال الرسالة');
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  if (authLoading || conversationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4">
            <ArrowRight className="h-4 w-4 ml-2 rotate-180" />
            العودة إلى لوحة التحكم
          </Button>
          <h1 className="text-3xl font-bold text-foreground">محادثات العملاء</h1>
          <p className="text-muted-foreground mt-2">إدارة جميع محادثات الدعم</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Conversations List */}
          <Card className="md:col-span-1 overflow-hidden">
            <CardHeader>
              <CardTitle>المحادثات</CardTitle>
              <CardDescription>
                {conversations.length} محادثة - العملاء المميزون أولاً
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto h-[calc(100%-100px)]">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">لا توجد محادثات</p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv: any) => {
                    const LevelIcon = LEVEL_ICONS[conv.level] || MessageCircle;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`w-full p-4 text-right hover:bg-accent/50 transition-colors ${
                          selectedConversation === conv.id ? 'bg-accent' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <img
                              src={conv.user?.avatar_url}
                              alt={conv.user?.full_name}
                              className="h-10 w-10 rounded-full"
                            />
                            <LevelIcon className="absolute -bottom-1 -right-1 h-4 w-4 text-primary bg-background rounded-full p-0.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-semibold truncate">
                                {conv.user?.full_name || conv.user?.username}
                              </p>
                              {conv.unread_count > 0 && (
                                <Badge variant="destructive" className="text-xs">
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
                            {conv.order_id && (
                              <Badge variant="outline" className="text-xs mt-1">
                                طلب #{conv.order_id.slice(0, 8)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Window */}
          <Card className="md:col-span-2 flex flex-col">
            {selectedConversation && selectedConv ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedConv.user?.avatar_url}
                      alt={selectedConv.user?.full_name}
                      className="h-10 w-10 rounded-full"
                    />
                    <div>
                      <CardTitle className="text-lg">
                        {selectedConv.user?.full_name || selectedConv.user?.username}
                      </CardTitle>
                      <CardDescription>
                        {selectedConv.order_id
                          ? `محادثة حول الطلب #${selectedConv.order_id.slice(0, 8)}`
                          : 'محادثة عامة'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
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
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground'
                              }`}
                            >
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
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </CardContent>

                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="اكتب رسالتك..."
                      disabled={sendMessageMutation.isPending}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!message.trim() || sendMessageMutation.isPending}
                      size="icon"
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
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">اختر محادثة لعرضها</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
