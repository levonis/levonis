import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, User as UserIcon, ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CommunityCustomerProfileModal from "@/components/community/CommunityCustomerProfileModal";
import MerchantSignupDialog from "@/components/community/MerchantSignupDialog";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);

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

  if (!user) return null;

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
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                onClick={() => navigate("/community/customer/new")}
                disabled={!complete}
                className="shrink-0 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
              >
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة طلب جديد
              </Button>

              <Button
                variant="outline"
                disabled={!complete}
                onClick={() => navigate("/community/customer/requests")}
                className="shrink-0"
              >
                <ClipboardList className="ml-2 h-4 w-4" />
                طلباتي
              </Button>

              <Button
                variant={complete ? "outline" : "default"}
                onClick={() => (complete ? navigate("/profile") : setProfileOpen(true))}
                className={
                  !complete
                    ? "shrink-0 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    : "shrink-0"
                }
              >
                <UserIcon className="ml-2 h-4 w-4" />
                {complete ? "الملف الشخصي" : "إكمال الملف"}
              </Button>
            </div>
          )}

          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>الملف الشخصي</DialogTitle>
              </DialogHeader>
              <div className="scrollbar-stable max-h-[70vh] overflow-y-auto overflow-x-hidden">
                <div className="rounded-xl border border-border bg-card">
                  <CommunityCustomerProfileModal
                    onDone={() => setProfileOpen(false)}
                    onOpenMerchantSignup={() => {
                      setProfileOpen(false);
                      setMerchantOpen(true);
                    }}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <MerchantSignupDialog open={merchantOpen} onOpenChange={setMerchantOpen} />

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

export function CommunityCustomerActionsInline({
  className,
  mode = "standalone",
}: {
  className?: string;
  mode?: "standalone" | "items";
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);

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

  if (!user) return null;

  if (isLoading) {
    return (
      <div className={className} aria-label="اختصارات الزبون">
        {mode === "items" ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        )}
      </div>
    );
  }

  const newBtnClass =
    !complete
      ? "h-10 w-full shrink-0 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
      : "h-10 w-full shrink-0";

  const content = (
    <>
      <Button
        size="sm"
        onClick={() => navigate("/community/customer/new")}
        disabled={!complete}
        className={
          !complete
            ? "h-10 w-full shrink-0 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
            : "h-10 w-full shrink-0"
        }
      >
        <PlusCircle className="ml-2 h-4 w-4" />
        طلب جديد
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={!complete}
        onClick={() => navigate("/community/customer/requests")}
        className="h-10 w-full shrink-0"
      >
        <ClipboardList className="ml-2 h-4 w-4" />
        طلباتي
      </Button>

      <Button
        size="sm"
        variant={complete ? "outline" : "default"}
        onClick={() => (complete ? navigate("/profile") : setProfileOpen(true))}
        className={newBtnClass}
      >
        <UserIcon className="ml-2 h-4 w-4" />
        {complete ? "الملف" : "إكمال"}
      </Button>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>الملف الشخصي</DialogTitle>
          </DialogHeader>
          <div className="scrollbar-stable max-h-[70vh] overflow-y-auto overflow-x-hidden">
            <div className="rounded-xl border border-border bg-card">
              <CommunityCustomerProfileModal
                onDone={() => setProfileOpen(false)}
                onOpenMerchantSignup={() => {
                  setProfileOpen(false);
                  setMerchantOpen(true);
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MerchantSignupDialog open={merchantOpen} onOpenChange={setMerchantOpen} />
    </>
  );

  if (mode === "items") return <>{content}</>;

  return (
    <div className={className} aria-label="اختصارات الزبون">
      {/* Mobile: exactly 2 rows (2 buttons per row). Desktop: inline */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {content}
      </div>
    </div>
  );
}
