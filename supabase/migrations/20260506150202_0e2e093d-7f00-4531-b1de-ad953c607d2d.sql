DO $$
BEGIN
  PERFORM set_config('app.refund_authorized', 'true', true);

  UPDATE public.user_wallets
     SET balance = balance + 22000, updated_at = now()
   WHERE user_id = '21156308-bcfe-4f22-9a15-c2513afe6067';

  INSERT INTO public.wallet_transactions (user_id, amount, type, status, admin_notes)
  VALUES (
    '21156308-bcfe-4f22-9a15-c2513afe6067',
    22000,
    'deposit',
    'completed',
    'استرجاع يدوي - طلب الفلمنت العشوائي ORD-20260505-0546 لم يحتوِ على عناصر'
  );

  DELETE FROM public.orders WHERE id = '45618161-75ef-49bb-a451-951ff7c16c3a';
END $$;
