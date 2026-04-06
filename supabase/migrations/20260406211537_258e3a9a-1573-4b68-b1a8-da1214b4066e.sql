
-- Bypass fraud check to refund tickets
SET LOCAL app.bypass_ticket_fraud_check = 'true';

UPDATE user_tickets 
SET ticket_count = ticket_count + 2, updated_at = now()
WHERE user_id = '75c281cd-81a1-4554-b08f-605116f72fed';

-- Rebuild user_collected_letters from remaining competition_tickets
INSERT INTO user_collected_letters (user_id, competition_id, letter, ticket_id, collected_at)
SELECT 
  ct.user_id,
  ct.competition_id,
  ct.letter_awarded,
  ct.id,
  ct.purchased_at
FROM competition_tickets ct
WHERE ct.user_id = '75c281cd-81a1-4554-b08f-605116f72fed'
  AND ct.competition_id = '758360b9-8a6c-45f0-8d2f-983784209a55'
  AND ct.letter_awarded IS NOT NULL
ON CONFLICT (ticket_id) DO NOTHING;
