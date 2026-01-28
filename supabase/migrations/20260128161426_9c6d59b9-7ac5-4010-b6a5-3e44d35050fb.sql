-- Drop the old foreign key that references wrong table
ALTER TABLE print_offers DROP CONSTRAINT IF EXISTS print_offers_request_id_fkey;

-- Add correct foreign key to community_print_requests
ALTER TABLE print_offers 
ADD CONSTRAINT print_offers_request_id_fkey 
FOREIGN KEY (request_id) REFERENCES community_print_requests(id) ON DELETE CASCADE;