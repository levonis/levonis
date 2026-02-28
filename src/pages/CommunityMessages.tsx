import { useEffect, useState, useMemo } from 'react';
import { MessageSquare, ArrowRight, Loader2, Headphones, Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ListingConversations } from '@/components/marketplace/ListingConversations';

// Support account ID
const SUPPORT_USER_ID = "f632ba7b-60e7-4f2f-9cb7-2851f7f2ed2f";

export default function CommunityMessages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [creatingConversation, setCreatingConversation] = useState(false);
  
  // Get params for automatic conversation opening or creation
  const autoOpenConversationId = searchParams.get('auto_open');
  const merchantId = searchParams.get('merchant_id');
  const userId = searchParams.get('user_id');
  const productTitle = searchParams.get('product_title');
  const productPrice = searchParams.get('product_price');
  const productImage = searchParams.get('product_image');
  const productId = searchParams.get('product_id');
  const requestId = searchParams.get('request_id');
  const cartItemsParam = searchParams.get('cart_items');

  // Context for product/request that user entered through
  const [entryContext, setEntryContext] = useState<{
    type: 'product' | 'request';
    title: string;
    imageUrl?: string | null;
    price?: number | null;
    productId?: string | null;
  } | null>(() => {
    if (productTitle) {
      return {
        type: 'product',
        title: productTitle,
        imageUrl: productImage || null,
        price: productPrice ? parseInt(productPrice, 10) : null,
        productId: productId || null,
      };
    }
    return null;
  });

  // Create or find existing conversation with merchant (by merchant_applications.id)
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Missing user');

      let sellerId: string;
      let displayName: string = 'مستخدم';

      if (merchantId) {
        const { data: merchantApp, error: merchantError } = await supabase
          .from('merchant_applications')
          .select('user_id, display_name, inquiry_template, welcome_message, away_message, is_away')
          .eq('id', merchantId)
          .maybeSingle();

        if (merchantError || !merchantApp) {
          throw new Error('لا يمكن العثور على التاجر');
        }
        sellerId = merchantApp.user_id;
        displayName = merchantApp.display_name || 'تاجر';
      } else if (userId) {
        sellerId = userId;
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', userId)
          .maybeSingle();
        displayName = targetProfile?.full_name || targetProfile?.username || 'مستخدم';
      } else {
        throw new Error('Missing merchant_id or user_id');
      }

      if (sellerId === user.id) {
        throw new Error('لا يمكنك مراسلة نفسك');
      }

      let requestDetails: { title: string; description: string; size: string; colors: string; image_url?: string | null } | null = null;
      if (requestId) {
        const { data: reqData } = await supabase
          .from('community_print_requests')
          .select('title, description, size, colors, image_url')
          .eq('id', requestId)
          .maybeSingle();
        requestDetails = reqData;
        
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
          imageUrl: productImage || null,
          price: productPrice ? parseInt(productPrice, 10) : null,
        });
      }

      const { data: existingConvs } = await supabase
        .from('listing_conversations')
        .select('id, buyer_id, seller_id')
        .or(`and(buyer_id.eq.${user.id},seller_id.eq.${sellerId}),and(buyer_id.eq.${sellerId},seller_id.eq.${user.id})`);

      let conversationId: string;

      if (existingConvs && existingConvs.length > 0) {
        conversationId = existingConvs[0].id;
        await supabase.from('listing_conversations')
          .update({ 
            updated_at: new Date().toISOString(),
            entry_context: requestDetails || productTitle ? {
              type: requestDetails ? 'request' : 'product',
              title: requestDetails?.title || productTitle,
              imageUrl: requestDetails?.image_url || null,
              requestId: requestId,
            } : null
          })
          .eq('id', conversationId);
      } else {
        const convCode = `CONV-${Date.now().toString(36).toUpperCase()}`;
        const { data: newConv, error: convError } = await supabase
          .from('listing_conversations')
          .insert({
            buyer_id: user.id,
            seller_id: sellerId,
            listing_id: merchantId || sellerId,
            conversation_code: convCode,
            status: 'open',
            entry_context: requestDetails || productTitle ? {
              type: requestDetails ? 'request' : 'product',
              title: requestDetails?.title || productTitle,
              imageUrl: requestDetails?.image_url || null,
              requestId: requestId,
            } : null
          })
          .select('id')
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;

        await supabase.from('listing_messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: `👋 مرحباً، تم بدء محادثة جديدة.`,
        });
      }

      // Auto-send cart items as product messages
      if (cartItemsParam) {
        try {
          const cartItems = JSON.parse(cartItemsParam) as Array<{
            title: string;
            price: number;
            image: string | null;
            quantity: number;
            productId: string;
          }>;
          
          for (const item of cartItems) {
            const content = `🛒 أنا مهتم بالمنتج:\n${item.title}\n💰 ${item.price.toLocaleString('ar-IQ')} د.ع\n📦 الكمية: ${item.quantity}`;
            await supabase.from('listing_messages').insert({
              conversation_id: conversationId,
              sender_id: user.id,
              content,
              image_url: item.image || null,
            });
          }

          const { data: defaultAddr } = await supabase
            .from('user_addresses')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .maybeSingle();
          
          const address = defaultAddr || (await supabase
            .from('user_addresses')
            .select('*')
            .eq('user_id', user.id)
            .limit(1)
            .single()).data;
          
          if (address) {
            await supabase.from('listing_messages').insert({
              conversation_id: conversationId,
              sender_id: user.id,
              content: '',
              address_data: {
                governorate: address.governorate,
                area: address.area,
                neighborhood: address.neighborhood,
                nearest_landmark: address.nearest_landmark,
                phone_number: address.phone_number,
                additional_notes: address.additional_notes,
              },
            });
            
            await supabase.from('listing_messages').insert({
              conversation_id: conversationId,
              sender_id: user.id,
              content: '📍 هذا عنواني للتوصيل. يمكنك تعديله من صفحة العناوين إذا لزم الأمر.',
            });
          }
        } catch (e) {
          console.error('Error sending cart items:', e);
        }
      }

      // Send Telegram notification
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
          listing_title: displayName,
          sender_name: senderName,
          message_content: cartItemsParam ? 'طلب جديد من السلة' : 'محادثة جديدة',
          conversation_id: conversationId,
        },
      }).catch(() => {});

      return conversationId;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
      const url = new URL(`/chats`, window.location.origin);
      url.searchParams.set('auto_open', conversationId);
      if (entryContext) {
        url.searchParams.set('product_title', entryContext.title);
        if (entryContext.price) url.searchParams.set('product_price', String(entryContext.price));
        if (entryContext.imageUrl) url.searchParams.set('product_image', entryContext.imageUrl);
        if (entryContext.productId) url.searchParams.set('product_id', entryContext.productId);
      }
      navigate(`${url.pathname}${url.search}`, { replace: true });
      setCreatingConversation(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setCreatingConversation(false);
    },
  });

  // Handle creating conversation if merchant_id or user_id is provided
  useEffect(() => {
    if ((merchantId || userId) && user && !creatingConversation && !autoOpenConversationId && !createConversationMutation.isSuccess) {
      setCreatingConversation(true);
      createConversationMutation.mutate();
    }
  }, [merchantId, userId, user, autoOpenConversationId, creatingConversation]);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 250);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-0 pt-16 max-w-6xl h-screen">
        {(loading || creatingConversation) && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {creatingConversation ? 'جاري إنشاء المحادثة...' : 'جاري التحميل...'}
            </p>
          </div>
        )}

        <ListingConversations
          externalOpen={true}
          onExternalOpenChange={() => {}}
          onClose={() => navigate('/')}
          autoOpenConversationId={autoOpenConversationId}
          entryContext={entryContext}
          embedded
        >
          <span className="sr-only">المحادثات</span>
        </ListingConversations>
      </main>
    </div>
  );
}
