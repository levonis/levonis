-- Add location and address fields to listing_messages
ALTER TABLE public.listing_messages
ADD COLUMN IF NOT EXISTS location_data JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS address_data JSONB DEFAULT NULL;

-- location_data structure: { latitude: number, longitude: number, address_name?: string }
-- address_data structure: { recipient_name, phone, governorate, city, address, postal_code, notes, is_default }

COMMENT ON COLUMN public.listing_messages.location_data IS 'GPS location data with lat/lng coordinates';
COMMENT ON COLUMN public.listing_messages.address_data IS 'Saved address data from user_addresses';