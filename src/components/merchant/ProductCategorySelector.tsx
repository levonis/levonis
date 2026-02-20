import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { FolderOpen, ChevronDown, Check } from "lucide-react";

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

  if (categories.length === 0) return null;

  const mainCats = categories.filter((c) => !c.parent_id);
  
  // Current selection: selectedIds should contain at most 1 id (single category)
  const selectedId = selectedIds[0] || null;
  
  // Determine if selected is a main or sub category
  const selectedCategory = categories.find(c => c.id === selectedId);
  const selectedMainId = selectedCategory?.parent_id || selectedId;
  const selectedSubId = selectedCategory?.parent_id ? selectedId : null;
  
  // Get subcategories of the selected main category
  const selectedMainCat = mainCats.find(c => c.id === selectedMainId);
  const subCats = selectedMainId ? categories.filter(c => c.parent_id === selectedMainId) : [];

  const selectMain = (id: string) => {
    // If clicking the same main cat that's already selected (and no sub selected), deselect
    if (id === selectedMainId && !selectedSubId) {
      const subs = categories.filter(c => c.parent_id === id);
      if (subs.length === 0) {
        onChange([]);
        return;
      }
    }
    // Check if this main cat has subcategories
    const subs = categories.filter(c => c.parent_id === id);
    if (subs.length === 0) {
      // No subs, select the main category directly
      onChange([id]);
    } else {
      // Has subs, select the main cat itself so sub-cats show
      onChange([id]);
    }
  };

  const selectSub = (subId: string) => {
    if (subId === selectedSubId) {
      onChange([]); // Deselect
    } else {
      onChange([subId]); // Single selection
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        <FolderOpen className="h-4 w-4" />
        قسم المنتج
      </Label>
      
      {/* Main Categories */}
      <div className="flex flex-wrap gap-2">
        {mainCats.map((cat) => {
          const isSelected = cat.id === selectedMainId;
          const hasSubs = categories.some(c => c.parent_id === cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectMain(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary/15 border-primary/40 text-primary ring-1 ring-primary/20"
                  : "bg-muted/30 border-border hover:border-primary/30 hover:bg-muted/50"
              }`}
            >
              {cat.image_url && (
                <img src={cat.image_url} alt="" className="h-4 w-4 rounded object-cover" />
              )}
              {cat.name_ar}
              {hasSubs && <ChevronDown className={`h-3 w-3 transition-transform ${isSelected ? "rotate-180" : ""}`} />}
              {isSelected && !hasSubs && <Check className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {/* Sub Categories - show when a main cat with subs is selected */}
      {selectedMainId && subCats.length > 0 && (
        <div className="mr-2 p-2 rounded-lg bg-muted/20 border border-border/50 space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium">
            اختر القسم الفرعي في «{selectedMainCat?.name_ar}»:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {subCats.map((sub) => {
              const isSubSelected = sub.id === selectedSubId;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => selectSub(sub.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                    isSubSelected
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-background border-border/50 hover:border-primary/20 hover:bg-muted/30"
                  }`}
                >
                  {sub.image_url && (
                    <img src={sub.image_url} alt="" className="h-3.5 w-3.5 rounded object-cover" />
                  )}
                  {sub.name_ar}
                  {isSubSelected && <Check className="h-2.5 w-2.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
