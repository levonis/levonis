-- Make payment-proofs bucket public so images can be viewed
UPDATE storage.buckets SET public = true WHERE id = 'payment-proofs';