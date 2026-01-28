import { useEffect, useState } from 'react';
import { MessageSquare, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ListingConversations } from '@/components/marketplace/ListingConversations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function CommunityMessages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creatingConversation, setCreatingConversation] = useState(false);
  
  // Get params for automatic conversation opening or creation
  const autoOpenConversationId = searchParams.get('auto_open');
  const merchantId = searchParams.get('merchant_id');
  const productTitle = searchParams.get('product_title');
  const productUrl = searchParams.get('product_url');
  const requestId = searchParams.get('request_id');

  // Context for product/request that user entered through
  const [entryContext, setEntryContext] = useState<{
    type: 'product' | 'request';
    title: string;
    imageUrl?: string | null;
    price?: number | null;
  } | null>(null);

  // Create or find existing conversation with merchant
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (!user || !merchantId) throw new Error('Missing data');

      // First, get the merchant's user_id and auto-response settings from merchant_applications
      const { data: merchantApp, error: merchantError } = await supabase
        .from('merchant_applications')
        .select('user_id, display_name, inquiry_template, welcome_message, away_message, is_away')
        .eq('id', merchantId)
        .maybeSingle();

      if (merchantError || !merchantApp) {
        throw new Error('لا يمكن العثور على التاجر');
      }

      const sellerId = merchantApp.user_id;

      // If request_id is provided, fetch request details
      let requestDetails: { title: string; description: string; size: string; colors: string; image_url?: string | null } | null = null;
      if (requestId) {
        const { data: reqData } = await supabase
          .from('community_print_requests')
          .select('title, description, size, colors, image_url')
          .eq('id', requestId)
          .maybeSingle();
        requestDetails = reqData;
        
        // Set entry context for the product bar
        if (reqData) {
          setEntryContext({
            type: 'request',
            title: reqData.title,
            imageUrl: reqData.image_url,
            price: null,
          });
        }
      } else if (productTitle) {
        setEntryContext({
          type: 'product',
          title: productTitle,
          imageUrl: null,
          price: null,
        });
      }

      // Check if conversation already exists between buyer and seller
      const { data: existingConv } = await supabase
        .from('listing_conversations')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('seller_id', sellerId)
        .maybeSingle();

      let conversationId: string;
      let isNewConversation = false;

      if (existingConv) {
        conversationId = existingConv.id;
        // Update conversation context
        await supabase.from('listing_conversations')
          .update({ 
            updated_at: new Date().toISOString(),
            entry_context: requestDetails || productTitle ? {
              type: requestDetails ? 'request' : 'product',
              title: requestDetails?.title || productTitle,
              requestId: requestId,
            } : null
          })
          .eq('id', existingConv.id);
      } else {
        isNewConversation = true;
        // Create new conversation
        const convCode = `CONV-${Date.now().toString(36).toUpperCase()}`;
        const { data: newConv, error: convError } = await supabase
          .from('listing_conversations')
          .insert({
            buyer_id: user.id,
            seller_id: sellerId,
            listing_id: merchantId,
            conversation_code: convCode,
            status: 'open',
            entry_context: requestDetails || productTitle ? {
              type: requestDetails ? 'request' : 'product',
              title: requestDetails?.title || productTitle,
              requestId: requestId,
            } : null
          })
          .select('id')
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;

        // Send welcome message if merchant has one configured
        if (merchantApp.welcome_message && isNewConversation) {
          await supabase.from('listing_messages').insert({
            conversation_id: conversationId,
            sender_id: sellerId,
            content: `🤖 ${merchantApp.welcome_message}`,
          });
        }
      }

      // Send away message if merchant is away
      if (merchantApp.is_away && merchantApp.away_message) {
        await supabase.from('listing_messages').insert({
          conversation_id: conversationId,
          sender_id: sellerId,
          content: `⏰ ${merchantApp.away_message}`,
        });
      }

      // Send Telegram notification to merchant
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();

      const senderName = userProfile?.full_name || userProfile?.username || 'مستخدم';

      await supabase.functions.invoke('notify-marketplace-telegram', {
        body: {
          user_id: sellerId,
          event_type: 'new_message',
          listing_title: merchantApp.display_name,
          sender_name: senderName,
          message_content: 'محادثة جديدة',
          conversation_id: conversationId,
        },
      });

      return conversationId;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
      // Update URL to auto-open the conversation
      navigate(`/community/messages?auto_open=${conversationId}`, { replace: true });
      setCreatingConversation(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setCreatingConversation(false);
    },
  });

  // Handle creating conversation if merchant_id is provided
  useEffect(() => {
    if (merchantId && user && !creatingConversation && !autoOpenConversationId) {
      setCreatingConversation(true);
      createConversationMutation.mutate();
    }
  }, [merchantId, user, autoOpenConversationId]);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 250);
    return () => window.clearTimeout(t);
  }, []);

  // Handle dialog close - return to community
  const handleClose = () => {
    setOpen(false);
    navigate('/community');
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 pt-20 max-w-4xl">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => navigate('/community')}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">محادثات المجتمع</h1>
                <p className="text-xs text-muted-foreground">تواصل مع التجار</p>
              </div>
            </div>
          </div>
        </header>

        {/* Loading State */}
        {(loading || creatingConversation) && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {creatingConversation ? 'جاري إنشاء المحادثة...' : 'جاري التحميل...'}
            </p>
          </div>
        )}

        {/* Conversations Dialog */}
        <ListingConversations
          externalOpen={open}
          onExternalOpenChange={setOpen}
          onClose={handleClose}
          autoOpenConversationId={autoOpenConversationId}
        >
          <span className="sr-only">فتح المحادثات</span>
        </ListingConversations>
      </main>
    </div>
  );
}