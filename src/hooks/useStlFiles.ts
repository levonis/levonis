import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StlFile {
  id: string;
  uploader_id: string;
  category_id: string | null;
  status: string;
  title_ar: string;
  title_en: string | null;
  title_ku: string | null;
  description_ar: string | null;
  description_en: string | null;
  description_ku: string | null;
  cover_image_url: string | null;
  gallery_images: string[];
  video_url: string | null;
  model_preview_url: string | null;
  file_size_bytes: number | null;
  file_format: string | null;
  tags: string[];
  price_type: 'free' | 'paid' | 'daily_limit';
  price_points: number;
  downloads_count: number;
  views_count: number;
  created_at: string;
}

interface Params {
  search?: string;
  categoryId?: string | null;
  tag?: string | null;
  sort?: 'newest' | 'most_downloaded';
}

export function useStlFiles({ search, categoryId, tag, sort = 'newest' }: Params = {}) {
  return useQuery({
    queryKey: ['stl-files', { search, categoryId, tag, sort }],
    queryFn: async () => {
      let q = supabase
        .from('stl_files')
        .select('*')
        .eq('status', 'approved');
      if (categoryId) q = q.eq('category_id', categoryId);
      if (tag) q = q.contains('tags', [tag]);
      if (search?.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`title_ar.ilike.${s},title_en.ilike.${s},title_ku.ilike.${s},description_ar.ilike.${s}`);
      }
      q = sort === 'most_downloaded'
        ? q.order('downloads_count', { ascending: false })
        : q.order('created_at', { ascending: false });
      const { data, error } = await q.limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as StlFile[];
    },
    staleTime: 30_000,
  });
}

export function useStlCategories() {
  return useQuery({
    queryKey: ['stl-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stl_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useStlFile(fileId?: string) {
  return useQuery({
    queryKey: ['stl-file', fileId],
    queryFn: async () => {
      if (!fileId) return null;
      const { data, error } = await supabase
        .from('stl_files')
        .select('*')
        .eq('id', fileId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as StlFile | null;
    },
    enabled: !!fileId,
  });
}
