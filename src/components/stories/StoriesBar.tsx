import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRef, useState } from 'react';
import StoryViewer from './StoryViewer';

interface StorySection {
  id: string;
  title_ar: string;
  thumbnail_url: string | null;
  display_order: number;
  videos: { id: string; video_url: string; duration_seconds: number | null; display_order: number; created_at: string }[];
}

export default function StoriesBar() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  const { data: sections = [] } = useQuery({
    queryKey: ['story-sections-with-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_sections')
        .select('id, title_ar, thumbnail_url, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch videos for all sections
      const { data: videos, error: vErr } = await supabase
        .from('story_videos')
        .select('id, section_id, video_url, duration_seconds, display_order, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (vErr) throw vErr;

      return data
        .map((s) => ({
          ...s,
          videos: (videos || []).filter((v) => v.section_id === s.id),
        }))
        .filter((s) => s.videos.length > 0) as StorySection[];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (sections.length === 0) return null;

  const handleOpen = (index: number) => {
    setActiveSectionIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="w-full py-3">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {sections.map((section, idx) => (
            <button
              key={section.id}
              onClick={() => handleOpen(idx)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              {/* Ring + circle */}
              <div className="w-[68px] h-[68px] md:w-[76px] md:h-[76px] rounded-full p-[2.5px] bg-gradient-to-tr from-primary via-accent to-primary/60 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted">
                  {section.thumbnail_url ? (
                    <img
                      src={section.thumbnail_url}
                      alt={section.title_ar}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg font-bold">
                      {section.title_ar.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              {/* Label */}
              <span className="text-[10px] md:text-xs text-muted-foreground font-medium max-w-[72px] truncate text-center leading-tight">
                {section.title_ar}
              </span>
            </button>
          ))}
        </div>
      </div>

      {viewerOpen && (
        <StoryViewer
          sections={sections}
          initialSectionIndex={activeSectionIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
