
-- =============================================
-- GACHA GAME SYSTEM — FULL SCHEMA
-- =============================================

-- 1) gacha_settings (global config)
CREATE TABLE public.gacha_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read gacha settings" ON public.gacha_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage gacha settings" ON public.gacha_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2) gacha_rarity_tiers
CREATE TABLE public.gacha_rarity_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888888',
  glow_color TEXT NOT NULL DEFAULT '#888888',
  drop_weight NUMERIC NOT NULL DEFAULT 100,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_rarity_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rarity tiers" ON public.gacha_rarity_tiers FOR SELECT USING (true);
CREATE POLICY "Admins manage rarity tiers" ON public.gacha_rarity_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) gacha_machines
CREATE TABLE public.gacha_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  theme TEXT NOT NULL DEFAULT 'default',
  ticket_cost INT NOT NULL DEFAULT 1,
  multi_spin_options JSONB NOT NULL DEFAULT '[1,3,5,10]'::jsonb,
  model_url TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_limited BOOLEAN NOT NULL DEFAULT false,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active machines" ON public.gacha_machines FOR SELECT USING (true);
CREATE POLICY "Admins manage machines" ON public.gacha_machines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) gacha_dolls (collectible catalog)
CREATE TABLE public.gacha_dolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doll_number INT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  image_url TEXT,
  model_url TEXT,
  rarity_tier_id UUID REFERENCES public.gacha_rarity_tiers(id) ON DELETE SET NULL,
  base_price INT NOT NULL DEFAULT 100,
  current_price INT NOT NULL DEFAULT 100,
  demand_score NUMERIC NOT NULL DEFAULT 0,
  supply_count INT NOT NULL DEFAULT 0,
  is_tradable BOOLEAN NOT NULL DEFAULT true,
  collection_category TEXT DEFAULT 'general',
  is_limited BOOLEAN NOT NULL DEFAULT false,
  is_seasonal BOOLEAN NOT NULL DEFAULT false,
  season_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_dolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read dolls catalog" ON public.gacha_dolls FOR SELECT USING (true);
CREATE POLICY "Admins manage dolls" ON public.gacha_dolls FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5) gacha_coupons (coupon definitions)
CREATE TABLE public.gacha_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  coupon_type TEXT NOT NULL DEFAULT 'discount',
  discount_value NUMERIC,
  discount_type TEXT DEFAULT 'fixed',
  min_purchase NUMERIC,
  max_uses_per_user INT DEFAULT 1,
  validity_days INT DEFAULT 30,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read coupon defs" ON public.gacha_coupons FOR SELECT USING (true);
CREATE POLICY "Admins manage coupon defs" ON public.gacha_coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6) gacha_advice_cards
CREATE TABLE public.gacha_advice_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  content TEXT NOT NULL,
  content_ar TEXT NOT NULL,
  rarity_tier_id UUID REFERENCES public.gacha_rarity_tiers(id) ON DELETE SET NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_advice_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read advice cards" ON public.gacha_advice_cards FOR SELECT USING (true);
CREATE POLICY "Admins manage advice cards" ON public.gacha_advice_cards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7) gacha_machine_prizes (prize pool per machine)
CREATE TABLE public.gacha_machine_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.gacha_machines(id) ON DELETE CASCADE,
  prize_type TEXT NOT NULL,
  prize_ref_id UUID,
  prize_name TEXT NOT NULL,
  prize_name_ar TEXT NOT NULL,
  prize_image_url TEXT,
  rarity_tier_id UUID REFERENCES public.gacha_rarity_tiers(id) ON DELETE SET NULL,
  drop_weight NUMERIC NOT NULL DEFAULT 100,
  points_value INT DEFAULT 0,
  stock INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_machine_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read machine prizes" ON public.gacha_machine_prizes FOR SELECT USING (true);
CREATE POLICY "Admins manage machine prizes" ON public.gacha_machine_prizes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8) gacha_guaranteed_rules
CREATE TABLE public.gacha_guaranteed_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.gacha_machines(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_name_ar TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value INT NOT NULL DEFAULT 1,
  reward_type TEXT NOT NULL,
  reward_ref_id UUID,
  reward_name TEXT NOT NULL,
  reward_name_ar TEXT NOT NULL,
  reward_image_url TEXT,
  per_user_limit INT,
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority_order INT NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  new_users_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_guaranteed_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read guaranteed rules" ON public.gacha_guaranteed_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage guaranteed rules" ON public.gacha_guaranteed_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9) gacha_spins (spin history)
CREATE TABLE public.gacha_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  machine_id UUID NOT NULL REFERENCES public.gacha_machines(id) ON DELETE CASCADE,
  prize_id UUID REFERENCES public.gacha_machine_prizes(id) ON DELETE SET NULL,
  prize_type TEXT NOT NULL,
  prize_name TEXT NOT NULL,
  prize_name_ar TEXT NOT NULL,
  rarity_tier_id UUID REFERENCES public.gacha_rarity_tiers(id) ON DELETE SET NULL,
  tickets_spent INT NOT NULL DEFAULT 1,
  is_guaranteed BOOLEAN NOT NULL DEFAULT false,
  guaranteed_rule_id UUID REFERENCES public.gacha_guaranteed_rules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own spins" ON public.gacha_spins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts spins" ON public.gacha_spins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all spins" ON public.gacha_spins FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 10) gacha_user_inventory (owned dolls)
CREATE TABLE public.gacha_user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  doll_id UUID NOT NULL REFERENCES public.gacha_dolls(id) ON DELETE CASCADE,
  acquired_from TEXT NOT NULL DEFAULT 'spin',
  acquired_price INT DEFAULT 0,
  is_listed BOOLEAN NOT NULL DEFAULT false,
  spin_id UUID REFERENCES public.gacha_spins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own inventory" ON public.gacha_user_inventory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts inventory" ON public.gacha_user_inventory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own inventory" ON public.gacha_user_inventory FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage inventory" ON public.gacha_user_inventory FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 11) gacha_user_coupons (owned coupons)
CREATE TABLE public.gacha_user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  coupon_id UUID NOT NULL REFERENCES public.gacha_coupons(id) ON DELETE CASCADE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  spin_id UUID REFERENCES public.gacha_spins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_user_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own coupons" ON public.gacha_user_coupons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts user coupons" ON public.gacha_user_coupons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own coupons" ON public.gacha_user_coupons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage user coupons" ON public.gacha_user_coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 12) gacha_guaranteed_claims
CREATE TABLE public.gacha_guaranteed_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  rule_id UUID NOT NULL REFERENCES public.gacha_guaranteed_rules(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.gacha_machines(id) ON DELETE CASCADE,
  claim_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_guaranteed_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own claims" ON public.gacha_guaranteed_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts claims" ON public.gacha_guaranteed_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own claims" ON public.gacha_guaranteed_claims FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage claims" ON public.gacha_guaranteed_claims FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 13) gacha_marketplace
CREATE TABLE public.gacha_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES public.gacha_user_inventory(id) ON DELETE CASCADE,
  doll_id UUID NOT NULL REFERENCES public.gacha_dolls(id) ON DELETE CASCADE,
  asking_price INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  buyer_id UUID,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_marketplace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active listings" ON public.gacha_marketplace FOR SELECT USING (status = 'active' OR auth.uid() = seller_id OR auth.uid() = buyer_id);
CREATE POLICY "Users create own listings" ON public.gacha_marketplace FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users update own listings" ON public.gacha_marketplace FOR UPDATE TO authenticated USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage marketplace" ON public.gacha_marketplace FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 14) gacha_transactions (points ledger)
CREATE TABLE public.gacha_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_type TEXT NOT NULL,
  amount INT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  counterparty_id UUID,
  description TEXT,
  description_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON public.gacha_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts transactions" ON public.gacha_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all transactions" ON public.gacha_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 15) gacha_price_history
CREATE TABLE public.gacha_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doll_id UUID NOT NULL REFERENCES public.gacha_dolls(id) ON DELETE CASCADE,
  price INT NOT NULL,
  demand_score NUMERIC,
  supply_count INT,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gacha_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read price history" ON public.gacha_price_history FOR SELECT USING (true);
CREATE POLICY "Admins manage price history" ON public.gacha_price_history FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_gacha_spins_user ON public.gacha_spins(user_id, created_at DESC);
CREATE INDEX idx_gacha_spins_machine ON public.gacha_spins(machine_id);
CREATE INDEX idx_gacha_inventory_user ON public.gacha_user_inventory(user_id);
CREATE INDEX idx_gacha_inventory_doll ON public.gacha_user_inventory(doll_id);
CREATE INDEX idx_gacha_marketplace_status ON public.gacha_marketplace(status, created_at DESC);
CREATE INDEX idx_gacha_marketplace_doll ON public.gacha_marketplace(doll_id);
CREATE INDEX idx_gacha_transactions_user ON public.gacha_transactions(user_id, created_at DESC);
CREATE INDEX idx_gacha_price_history_doll ON public.gacha_price_history(doll_id, snapshot_at DESC);
CREATE INDEX idx_gacha_machine_prizes_machine ON public.gacha_machine_prizes(machine_id);
CREATE INDEX idx_gacha_guaranteed_claims_user_rule ON public.gacha_guaranteed_claims(user_id, rule_id);

-- Insert default rarity tiers
INSERT INTO public.gacha_rarity_tiers (name, name_ar, color, glow_color, drop_weight, display_order) VALUES
  ('Common', 'عادي', '#9CA3AF', '#9CA3AF', 60, 1),
  ('Rare', 'نادر', '#22C55E', '#22C55E', 25, 2),
  ('Epic', 'ملحمي', '#3B82F6', '#3B82F6', 10, 3),
  ('Legendary', 'أسطوري', '#A855F7', '#A855F7', 4, 4),
  ('Mythic', 'خرافي', '#F59E0B', '#F59E0B', 1, 5);

-- Insert default gacha settings
INSERT INTO public.gacha_settings (key, value, description) VALUES
  ('gacha_enabled', 'true'::jsonb, 'Enable/disable the entire gacha system'),
  ('instant_sell_min_discount', '10'::jsonb, 'Minimum instant sell discount percentage'),
  ('instant_sell_max_discount', '50'::jsonb, 'Maximum instant sell discount percentage'),
  ('marketplace_fee_percent', '5'::jsonb, 'Marketplace transaction fee percentage');

-- Updated_at triggers
CREATE TRIGGER update_gacha_settings_updated_at BEFORE UPDATE ON public.gacha_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gacha_rarity_tiers_updated_at BEFORE UPDATE ON public.gacha_rarity_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gacha_machines_updated_at BEFORE UPDATE ON public.gacha_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gacha_dolls_updated_at BEFORE UPDATE ON public.gacha_dolls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gacha_coupons_updated_at BEFORE UPDATE ON public.gacha_coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gacha_advice_cards_updated_at BEFORE UPDATE ON public.gacha_advice_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gacha_machine_prizes_updated_at BEFORE UPDATE ON public.gacha_machine_prizes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gacha_guaranteed_rules_updated_at BEFORE UPDATE ON public.gacha_guaranteed_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gacha_marketplace_updated_at BEFORE UPDATE ON public.gacha_marketplace FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
