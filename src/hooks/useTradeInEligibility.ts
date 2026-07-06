import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EligiblePrinter {
  id: string;
  brand: string;
  printer_model: string;
  base_trade_in_value: number;
  max_operating_hours: number | null;
  notes: string | null;
  is_active: boolean;
  display_order: number;
}

export interface ValuationRule {
  id: string;
  rule_key: string;
  label_ar: string;
  label_en: string | null;
  label_ku: string | null;
  rule_type: "hours_tier" | "condition_adjust";
  min_hours: number | null;
  max_hours: number | null;
  multiplier_percent: number | null;
  adjust_percent: number | null;
  is_active: boolean;
  display_order: number;
}

export function useEligiblePrinters(opts?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ["trade-in-eligible-printers", opts?.includeInactive],
    queryFn: async () => {
      let q = supabase
        .from("trade_in_eligible_printers")
        .select("*")
        .order("display_order")
        .order("brand");
      if (!opts?.includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EligiblePrinter[];
    },
    staleTime: 60_000,
  });
}

export function useValuationRules() {
  return useQuery({
    queryKey: ["trade-in-valuation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_in_valuation_rules")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as ValuationRule[];
    },
    staleTime: 60_000,
  });
}
