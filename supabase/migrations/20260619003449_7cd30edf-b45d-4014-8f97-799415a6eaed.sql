-- Force PostgREST to reload its schema cache so it sees admin_update_product(_product_id, _updates)
-- and admin_create_product(_values) with their current signatures.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';