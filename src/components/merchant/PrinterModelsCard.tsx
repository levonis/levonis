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
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-3">
          <Skeleton className="h-4 w-20 mb-2" />
          <div className="flex flex-wrap gap-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (printerModels.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-xl overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Printer className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">الطابعات</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {printerModels.map((model) => (
            <Badge
              key={model.id}
              variant="secondary"
              className="text-[10px] px-2 py-0.5 gap-1"
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
