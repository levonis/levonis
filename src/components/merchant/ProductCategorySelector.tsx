import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Check } from "lucide-react";

interface Props {
  merchantId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function ProductCategorySelector({ merchantId, selectedIds, onChange }: Props) {
  const { data: categories = [] } = useQuery({
    queryKey: ["merchant-store-categories", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_store_categories")
        .select("id, name_ar, image_url, parent_id, display_order")
        .eq("merchant_id", merchantId)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  if (categories.length === 0) return null;

  const mainCats = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        <FolderOpen className="h-4 w-4" />
        أقسام المنتج
      </Label>
      <div className="flex flex-wrap gap-2">
        {mainCats.map((cat) => {
          const isSelected = selectedIds.includes(cat.id);
          const subs = categories.filter((c) => c.parent_id === cat.id);
          return (
            <div key={cat.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggle(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-muted/30 border-border hover:border-primary/30"
                }`}
              >
                {cat.image_url && (
                  <img src={cat.image_url} alt="" className="h-4 w-4 rounded object-cover" />
                )}
                {cat.name_ar}
                {isSelected && <Check className="h-3 w-3" />}
              </button>
              {subs.length > 0 && (
                <div className="flex flex-wrap gap-1 mr-3">
                  {subs.map((sub) => {
                    const subSelected = selectedIds.includes(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => toggle(sub.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-all ${
                          subSelected
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-background border-border/50 hover:border-primary/20"
                        }`}
                      >
                        {sub.name_ar}
                        {subSelected && <Check className="h-2.5 w-2.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
