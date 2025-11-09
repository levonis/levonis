import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Users, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ReferralCardProps {
  referralCode: string;
  referralCount: number;
  totalPointsEarned: number;
  onGenerateCode: () => void;
}

export default function ReferralCard({ 
  referralCode, 
  referralCount, 
  totalPointsEarned,
  onGenerateCode 
}: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const [referrerPoints, setReferrerPoints] = useState(50);

  useEffect(() => {
    const fetchReferralSettings = async () => {
      const { data } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", "referral_settings")
        .single();

      if (data?.setting_value) {
        const settings = data.setting_value as any;
        setReferrerPoints(settings.points_for_referrer || 50);
      }
    };

    fetchReferralSettings();
  }, []);

  const handleCopy = () => {
    const referralLink = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("تم نسخ رابط الدعوة!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          برنامج دعوة الأصدقاء
        </CardTitle>
        <CardDescription>ادع أصدقاءك واحصل على {referrerPoints} نقطة لكل صديق يسجل</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {referralCode ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">كود الدعوة الخاص بك:</label>
              <div className="flex gap-2">
                <Input
                  value={referralCode}
                  readOnly
                  className="font-mono text-lg"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Users className="h-4 w-4" />
                  الأصدقاء المدعوين
                </div>
                <p className="text-2xl font-bold">{referralCount}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <TrendingUp className="h-4 w-4" />
                  النقاط المكتسبة
                </div>
                <p className="text-2xl font-bold">{totalPointsEarned}</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleCopy}
            >
              <Copy className="ml-2 h-4 w-4" />
              نسخ رابط الدعوة
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">لم تقم بإنشاء كود دعوة بعد</p>
            <Button onClick={onGenerateCode}>
              إنشاء كود الدعوة
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}