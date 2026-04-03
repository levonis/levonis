
ALTER TABLE public.points_transactions DROP CONSTRAINT points_transactions_source_check;
ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_source_check CHECK (source = ANY (ARRAY['order','order_delivered','review','coupon','cash','daily_task','referral','referred','verified_review','wallet_conversion','admin_adjustment','tickets_conversion','avatar_frame','spend','frame_purchase','rating','merchant_rating','game_store','offer_purchase']));
