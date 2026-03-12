
-- Create storage bucket for game reward images
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-rewards', 'game-rewards', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to game-rewards
CREATE POLICY "Authenticated users can upload game reward images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-rewards');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update game reward images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'game-rewards');

-- Allow authenticated users to delete game reward images
CREATE POLICY "Authenticated users can delete game reward images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'game-rewards');

-- Allow public read access
CREATE POLICY "Public can read game reward images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'game-rewards');
