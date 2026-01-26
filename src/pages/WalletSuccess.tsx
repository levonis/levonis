import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WalletSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const sessionId = searchParams.get("session_id");
  const amount = searchParams.get("amount");

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId || !user) {
        setStatus("error");
        setErrorMessage("بيانات الدفع غير صحيحة");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-wallet-payment", {
          body: { session_id: sessionId, amount: parseInt(amount || "0") },
        });

        if (error) throw error;

        if (data.success) {
          setStatus("success");
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
          queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
          queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
          
          if (!data.already_processed) {
            toast.success("تمت تعبئة المحفظة بنجاح!");
          }
        } else {
          throw new Error(data.error || "فشل التحقق من الدفع");
        }
      } catch (err: any) {
        console.error("Payment verification error:", err);
        setStatus("error");
        setErrorMessage(err.message || "حدث خطأ أثناء التحقق من الدفع");
      }
    };

    verifyPayment();
  }, [sessionId, amount, user, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <CardTitle>جاري التحقق من الدفع...</CardTitle>
              <CardDescription>يرجى الانتظار</CardDescription>
            </>
          )}
          
          {status === "success" && (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-green-600">تمت العملية بنجاح!</CardTitle>
              <CardDescription>
                تمت إضافة {parseInt(amount || "0").toLocaleString()} دينار عراقي إلى محفظتك
              </CardDescription>
            </>
          )}
          
          {status === "error" && (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">حدث خطأ</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => navigate("/")} className="w-full">
            العودة للصفحة الرئيسية
          </Button>
          {status === "error" && (
            <Button variant="outline" onClick={() => navigate("/")}>
              المحاولة مرة أخرى
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
