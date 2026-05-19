import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";

interface Material {
  code: string;
  name_ar: string;
  name_en: string;
  density_g_cm3: number;
  cost_per_kg_iqd: number;
}

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export default function MaterialPicker({ value, onChange }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const { data: materials = [] } = useQuery({
    queryKey: ["print-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_materials" as any)
        .select("code, name_ar, name_en, density_g_cm3, cost_per_kg_iqd")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return ((data ?? []) as unknown) as Material[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{isAr ? "اختر الفلامنت" : "Material"}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {materials.map((m) => (
            <SelectItem key={m.code} value={m.code}>
              <span className="font-medium">{isAr ? m.name_ar : m.name_en}</span>
              <span className="text-muted-foreground text-xs ms-2">
                {m.cost_per_kg_iqd.toLocaleString()} IQD/kg · {m.density_g_cm3} g/cm³
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
