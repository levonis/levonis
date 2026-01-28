import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Printer, Plus, X, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { POPULAR_PRINTER_BRANDS } from "@/lib/printingMaterials";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PrinterModel {
  id: string;
  model_name: string;
  brand: string | null;
}

interface PrinterModelsEditorProps {
  merchantId: string;
}

export default function PrinterModelsEditor({ merchantId }: PrinterModelsEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newModel, setNewModel] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const { data: printerModels = [], isLoading } = useQuery({
    queryKey: ["printer-models", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_printer_models")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as PrinterModel[];
    },
  });

  const addModelMutation = useMutation({
    mutationFn: async ({ brand, model }: { brand: string; model: string }) => {
      const { error } = await supabase
        .from("merchant_printer_models")
        .insert({
          merchant_id: merchantId,
          brand: brand || null,
          model_name: model,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printer-models", merchantId] });
      setNewModel("");
      setSelectedBrand("");
      toast({ title: "تمت الإضافة", description: "تم إضافة الطابعة بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل إضافة الطابعة", variant: "destructive" });
    },
  });

  const removeModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const { error } = await supabase
        .from("merchant_printer_models")
        .delete()
        .eq("id", modelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printer-models", merchantId] });
      toast({ title: "تم الحذف", description: "تم حذف الطابعة بنجاح" });
    },
  });

  const handleAddModel = () => {
    if (!newModel.trim()) return;
    addModelMutation.mutate({ brand: selectedBrand, model: newModel.trim() });
  };

  const handleQuickAdd = (brand: string, model: string) => {
    addModelMutation.mutate({ brand, model: `${brand} ${model}` });
    setModelOpen(false);
    setBrandOpen(false);
  };

  const selectedBrandData = POPULAR_PRINTER_BRANDS.find(b => b.brand === selectedBrand);

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Printer className="h-4 w-4 text-primary" />
        الطابعات في ورشتك
      </Label>

      {/* Current Models */}
      {printerModels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {printerModels.map((model) => (
            <Badge
              key={model.id}
              variant="secondary"
              className="gap-1.5 px-3 py-1.5 text-xs"
            >
              <Printer className="h-3 w-3" />
              {model.model_name}
              <button
                onClick={() => removeModelMutation.mutate(model.id)}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add New Model */}
      <div className="flex gap-2 flex-wrap">
        {/* Brand Selector */}
        <Popover open={brandOpen} onOpenChange={setBrandOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-32 justify-between text-xs"
            >
              {selectedBrand || "اختر العلامة"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2 max-h-60 overflow-y-auto">
            <div className="space-y-1">
              {POPULAR_PRINTER_BRANDS.map((brand) => (
                <button
                  key={brand.brand}
                  onClick={() => {
                    setSelectedBrand(brand.brand);
                    setBrandOpen(false);
                  }}
                  className={`w-full text-right px-2 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${
                    selectedBrand === brand.brand ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  {brand.brand}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Model Selector (if brand selected) */}
        {selectedBrand && selectedBrandData && (
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-32 justify-between text-xs"
              >
                اختر الموديل
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2 max-h-60 overflow-y-auto">
              <div className="space-y-1">
                {selectedBrandData.models.map((model) => (
                  <button
                    key={model}
                    onClick={() => handleQuickAdd(selectedBrand, model)}
                    className="w-full text-right px-2 py-1.5 text-xs rounded-md hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    {model}
                    <Plus className="h-3 w-3 text-primary" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Manual Input */}
        <div className="flex gap-1.5 flex-1 min-w-[200px]">
          <Input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="أو اكتب اسم الطابعة..."
            className="h-9 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
          />
          <Button
            size="sm"
            onClick={handleAddModel}
            disabled={!newModel.trim() || addModelMutation.isPending}
            className="h-9 px-3"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {printerModels.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground text-center py-2">
          لم تضف أي طابعات بعد. يساعد هذا العملاء في معرفة قدراتك
        </p>
      )}
    </div>
  );
}
