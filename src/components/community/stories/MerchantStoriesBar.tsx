import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import MerchantStoryViewer from './MerchantStoryViewer';
import CreateStoryDialog from './CreateStoryDialog';

interface MerchantStory {
  id: string;
  merchant_id: string;
  product_id: string | null;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  views_count: number;
  store_name: string;
  store_logo: string | null;
}

interface GroupedStories {
  merchant_id: string;
  store_name: string;
  store_logo: string | null;
  stories: MerchantStory[];
}

export default function MerchantStoriesBar() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  // Check if current user is a merchant
  const { data: isMerchant } = useQuery({
    queryKey: ['merchant-status-stories', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('merchant_applications')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: groupedStories = [], refetch } = useQuery({
    queryKey: ['merchant-stories-bar'],
    queryFn: async () => {
      const { data: stories, error } = await supabase
        .from('merchant_stories')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!stories || stories.length === 0) return [];

      // Get merchant profiles - merchant_id in stories is user_id, 
      // but merchant_public_profiles.id is merchant_applications.id
      const merchantUserIds = [...new Set(stories.map(s => s.merchant_id))];
      
      // Look up merchant_applications by user_id to get display_name and store_image_url
      const { data: apps } = await supabase
        .from('merchant_applications')
        .select('id, user_id, display_name, store_image_url')
        .in('user_id', merchantUserIds)
        .eq('status', 'approved');

      // Map by user_id (which matches merchant_id in stories)
      const profileMap = new Map((apps || []).map((a: any) => [a.user_id, a]));

      // Group stories by merchant
      const groups: Map<string, GroupedStories> = new Map();
      for (const story of stories) {
        const profile = profileMap.get(story.merchant_id) as any;
        if (!groups.has(story.merchant_id)) {
          groups.set(story.merchant_id, {
            merchant_id: story.merchant_id,
            store_name: profile?.display_name || 'متجر',
            store_logo: profile?.store_image_url || null,
            stories: [],
          });
        }
        groups.get(story.merchant_id)!.stories.push({
          ...story,
          store_name: profile?.display_name || 'متجر',
          store_logo: profile?.store_image_url || null,
        });
      }

      return Array.from(groups.values());
    },
    staleTime: 30_000,
  });

  const handleOpen = (index: number) => {
    setActiveGroupIndex(index);
    setViewerOpen(true);
  };

  if (groupedStories.length === 0 && !isMerchant) return null;

  return (
    <>
      <div className="w-full py-3">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Add story button for merchants */}
          {isMerchant && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className="w-[64px] h-[64px] md:w-[72px] md:h-[72px] rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 group-hover:border-primary/60 transition-all">
                <Plus className="h-6 w-6 text-primary/60 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground font-medium text-center leading-tight">
                أضف ستوري
              </span>
            </button>
          )}

          {groupedStories.map((group, idx) => (
            <button
              key={group.merchant_id}
              onClick={() => handleOpen(idx)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className="w-[64px] h-[64px] md:w-[72px] md:h-[72px] rounded-full p-[2.5px] bg-gradient-to-tr from-primary via-accent to-primary/60 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted">
                  {group.store_logo ? (
                    <img
                      src={group.store_logo}
                      alt={group.store_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg font-bold">
                      {group.store_name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground font-medium max-w-[68px] truncate text-center leading-tight">
                {group.store_name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {viewerOpen && groupedStories.length > 0 && (
        <MerchantStoryViewer
          groups={groupedStories}
          initialGroupIndex={activeGroupIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {createOpen && (
        <CreateStoryDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => refetch()}
        />
      )}
    </>
  );
}
