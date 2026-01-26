-- Add platform commission setting
INSERT INTO default_settings (setting_key, setting_value)
VALUES ('platform_commission_rate', '{"rate": 0.007, "description": "نسبة عمولة المنصة من التاجر"}')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Add new columns to community_print_requests for escrow workflow
ALTER TABLE community_print_requests 
ADD COLUMN IF NOT EXISTS accepted_offer_id uuid REFERENCES print_offers(id),
ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS escrow_amount integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS escrow_held_at timestamptz,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS auto_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS merchant_paid_at timestamptz,
ADD COLUMN IF NOT EXISTS merchant_paid_amount integer DEFAULT 0;

-- Add more columns to print_offers for the offer workflow
ALTER TABLE print_offers
ADD COLUMN IF NOT EXISTS offer_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS declined_at timestamptz,
ADD COLUMN IF NOT EXISTS decline_reason text;

-- Create escrow transactions table
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES community_print_requests(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES print_offers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  merchant_id uuid NOT NULL,
  amount integer NOT NULL,
  platform_fee integer NOT NULL DEFAULT 0,
  merchant_payout integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded', 'disputed')),
  held_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on escrow_transactions
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for escrow_transactions
CREATE POLICY "Users can view their own escrow transactions"
  ON escrow_transactions FOR SELECT
  USING (auth.uid() = customer_id OR auth.uid() = merchant_id);

CREATE POLICY "Admins can manage all escrow transactions"
  ON escrow_transactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_escrow_transactions_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_community_updated_at();

-- Enable realtime for print_offers
ALTER PUBLICATION supabase_realtime ADD TABLE print_offers;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_print_offers_request_id ON print_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_print_offers_trader_id ON print_offers(trader_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_request_id ON escrow_transactions(request_id);