import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { X } from 'lucide-react';
import { useState } from 'react';

const AnnouncementBar = () => {
  const [dismissed, setDismissed] = useState(false);

  const { data: announcements } = useQuery({
    queryKey: ['active-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (!announcements || announcements.length === 0 || dismissed) {
    return null;
  }

  const announcement = announcements[0];
  
  const bgColor = announcement.color || '#3b82f6';
  const speed = announcement.speed || 20;
  const direction = announcement.direction || 'right';

  return (
    <div 
      className="text-white py-2 px-4 relative overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex-1 overflow-hidden">
          <div 
            className="whitespace-nowrap"
            style={{ 
              animation: `marquee-${direction} ${speed}s linear infinite` 
            }}
          >
            <span className="inline-block px-4">{announcement.message_ar}</span>
            <span className="inline-block px-4">{announcement.message_ar}</span>
            <span className="inline-block px-4">{announcement.message_ar}</span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <style>{`
        @keyframes marquee-right {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.33%); }
        }
        @keyframes marquee-left {
          0% { transform: translateX(-33.33%); }
          100% { transform: translateX(0%); }
        }
      `}</style>
    </div>
  );
};

export default AnnouncementBar;