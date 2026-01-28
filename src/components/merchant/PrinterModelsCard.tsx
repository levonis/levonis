import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PrinterModelsCardProps {
  merchantId: string;
}

export default function PrinterModelsCard({ merchantId }: PrinterModelsCardProps) {
  const { data: printerModels = [], isLoading } = useQuery({
    queryKey: ["printer-models-public", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_printer_models")
        .select("id, model_name, brand")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <Card className="rounded-xl overflow-hidden border-border/50 bg-gradient-to-br from-[hsl(160_52%_16%)] to-[hsl(160_48%_12%)]">
        <CardContent className="p-3">
          <Skeleton className="h-4 w-20 mb-2 bg-white/10" />
          <div className="flex flex-wrap gap-1">
            <Skeleton className="h-6 w-16 rounded-full bg-white/10" />
            <Skeleton className="h-6 w-20 rounded-full bg-white/10" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (printerModels.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-xl overflow-hidden border-border/50 bg-gradient-to-br from-[hsl(160_52%_16%)] to-[hsl(160_48%_12%)]">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="p-1 rounded-md bg-primary/20">
            <Printer className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground">الطابعات</span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-white/10 text-muted-foreground">
            {printerModels.length}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {printerModels.map((model) => (
            <Badge
              key={model.id}
              variant="outline"
              className="text-[10px] px-2 py-0.5 gap-1 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Printer className="h-2.5 w-2.5" />
              {model.model_name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
