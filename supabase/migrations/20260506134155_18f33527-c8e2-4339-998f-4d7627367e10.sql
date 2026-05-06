REVOKE ALL ON FUNCTION public.admin_update_order(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_order(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_product(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_product(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_update_order(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_product(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(uuid) TO authenticated;
