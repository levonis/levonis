-- Migration A: add enum values only (must be committed before use)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='print_request_status' AND e.enumlabel='in_progress') THEN
    ALTER TYPE public.print_request_status ADD VALUE 'in_progress';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='print_request_status' AND e.enumlabel='completed') THEN
    ALTER TYPE public.print_request_status ADD VALUE 'completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='print_request_status' AND e.enumlabel='delivered') THEN
    ALTER TYPE public.print_request_status ADD VALUE 'delivered';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='print_request_status' AND e.enumlabel='cancelled') THEN
    ALTER TYPE public.print_request_status ADD VALUE 'cancelled';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='print_offer_status' AND e.enumlabel='completed') THEN
    ALTER TYPE public.print_offer_status ADD VALUE 'completed';
  END IF;
END$$;