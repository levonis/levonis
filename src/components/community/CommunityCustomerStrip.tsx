import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, PlusCircle, User as UserIcon, Truck } from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
});

type Profile = z.infer<typeof profileSchema>;

function isProfileComplete(p: Profile | null | undefined) {
  if (!p) return false;
  const fullNameOk = !!p.full_name?.trim();
  const phoneOk = !!p.phone_number?.trim();
  const usernameOk = !!p.username?.trim();
  const birthDateOk = !!p.birth_date;
  const genderOk = p.gender === "male" || p.gender === "female";
  return fullNameOk && phoneOk && usernameOk && birthDateOk && genderOk;
}

export default function CommunityCustomerStrip({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["community-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number, username, avatar_url, birth_date, gender")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return profileSchema.parse(data);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const complete = useMemo(() => isProfileComplete(profile), [profile]);

  // On homepage we still want a visible community entry even when logged out.
  if (!user) {
    return (
      <section className={className} aria-label="مجتمع ليفو">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">مجتمع ليفو</CardTitle>
            <CardDescription>
              لتفعيل لوحة الزبون والمحادثات داخل المجتمع، يرجى تسجيل الدخول أولاً.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={() => navigate("/auth")}
                className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
              >
                تسجيل الدخول
              </Button>
              <Button variant="outline" onClick={() => navigate("/community")}
                className="w-full"
              >
                الدخول إلى المجتمع
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className={className} aria-label="لوحة مجتمع ليفو">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">مجتمع ليفو — الزبون</CardTitle>
          <CardDescription>
            {complete
              ? "اختصارات سريعة للطلبات والمحادثات والملف الشخصي"
              : "أكمل ملفك الشخصي أولاً لتفعيل لوحة المجتمع"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-11 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                onClick={() => navigate("/community/customer/new")}
                disabled={!complete}
                className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
              >
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة طلب جديد
              </Button>
              <Button variant="outline" disabled={!complete} onClick={() => navigate("/community/customer/track")}> 
                <Truck className="ml-2 h-4 w-4" />
                تتبع الطلب
              </Button>
              <Button variant="outline" disabled={!complete} onClick={() => navigate("/community/messages")}> 
                <MessageCircle className="ml-2 h-4 w-4" />
                المحادثات
              </Button>
              <Button
                variant={complete ? "outline" : "default"}
                onClick={() => navigate("/community/customer/profile")}
                className={!complete ? "bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90" : undefined}
              >
                <UserIcon className="ml-2 h-4 w-4" />
                {complete ? "الملف الشخصي" : "إكمال الملف"}
              </Button>
            </div>
          )}

          {!isLoading && !complete && (
            <p className="mt-3 text-xs text-muted-foreground">
              المطلوب: الاسم، رقم الهاتف، يوزرنيم، تاريخ الميلاد، الجنس.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
