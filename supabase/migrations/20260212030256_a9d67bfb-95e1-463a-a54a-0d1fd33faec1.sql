
-- Temporarily disable the tampering trigger to seed test data
ALTER TABLE merchant_public_profiles DISABLE TRIGGER prevent_merchant_profile_tampering_trigger;

-- Update merchant badges, frames, and verification
UPDATE merchant_public_profiles SET badge_tier = 'gold', is_verified = true, selected_frame_id = '1771f5dd-d03c-4cf1-901f-316c14f772bb' WHERE id = 'a1b2c3d4-0001-4000-8000-000000000001';
UPDATE merchant_public_profiles SET badge_tier = 'silver', selected_frame_id = 'ca8a3469-e819-42fd-9cf6-9a7620f80b03' WHERE id = 'a1b2c3d4-0001-4000-8000-000000000002';
UPDATE merchant_public_profiles SET badge_tier = 'diamond_1', is_verified = true, selected_frame_id = '0fae2146-2bc9-4b73-be33-5b5656765138' WHERE id = 'a1b2c3d4-0001-4000-8000-000000000003';
UPDATE merchant_public_profiles SET badge_tier = 'emerald', is_verified = true, selected_frame_id = '3e967f36-4f9d-46c8-a6a0-1d6cba0353bd' WHERE id = 'a1b2c3d4-0001-4000-8000-000000000004';
UPDATE merchant_public_profiles SET badge_tier = 'diamond_2', selected_frame_id = 'a3cf6b71-1fbc-4e6f-936c-200bf735fd21' WHERE id = 'a1b2c3d4-0001-4000-8000-000000000005';

-- Re-enable the trigger
ALTER TABLE merchant_public_profiles ENABLE TRIGGER prevent_merchant_profile_tampering_trigger;

-- Update existing requests to approved status
UPDATE community_print_requests SET status = 'approved' WHERE status IN ('open', 'pending');

-- Set featured products
UPDATE merchant_products SET is_featured = true WHERE id IN (
  'c1b2c3d4-0001-4000-8000-000000000001',
  'c1b2c3d4-0001-4000-8000-000000000003',
  'c1b2c3d4-0001-4000-8000-000000000005',
  'c1b2c3d4-0009-4000-8000-000000000009',
  'c1b2c3d4-0001-4000-8000-000000000007'
);
