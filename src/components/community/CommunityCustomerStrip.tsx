 import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, User as UserIcon, ClipboardList, Store } from "lucide-react";
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

   // Check if user is an approved merchant
   const { data: merchantApp } = useQuery({
     queryKey: ["merchant-status", user?.id],
     queryFn: async () => {
       if (!user?.id) return null;
       const { data, error } = await supabase
         .from("merchant_applications")
         .select("id, status")
         .eq("user_id", user.id)
         .eq("status", "approved")
         .maybeSingle();
       if (error) throw error;
       return data;
     },
     enabled: !!user?.id,
     staleTime: 60_000,
   });

   const isMerchant = useMemo(() => !!merchantApp, [merchantApp]);

   const handleRequestsClick = useCallback(() => {
     if (isMerchant) {
       navigate("/community/merchant/orders");
     } else {
       navigate("/community/customer/requests");
     }
   }, [isMerchant, navigate]);

   const handleNewClick = useCallback(() => {
     if (isMerchant) {
       navigate("/community/merchant/store");
     } else {
       navigate("/community/customer/new");
     }
   }, [isMerchant, navigate]);

  if (!user) return null;

  return (
    <section className={className} aria-label="لوحة مجتمع ليفو">
      {/* Premium card container with refined styling */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/30 bg-muted/10">
          <h3 className="text-base font-bold text-foreground">مجتمع ليفو — الزبون</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {complete
              ? "اختصارات سريعة للطلبات والمحادثات والملف الشخصي"
              : "أكمل ملفك الشخصي أولاً لتفعيل لوحة المجتمع"}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              <Button
                size="sm"
                onClick={handleNewClick}
                disabled={!complete}
                className="h-9 shrink-0 rounded-xl bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 shadow-sm"
              >
                {isMerchant ? (
                  <>
                    <Store className="ml-2 h-4 w-4" />
                    المتجر
                  </>
                ) : (
                  <>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة طلب جديد
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={!complete}
                onClick={handleRequestsClick}
                className="h-9 shrink-0 rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              >
                <ClipboardList className="ml-2 h-4 w-4" />
                {isMerchant ? "طلبات الزبائن" : "طلباتي"}
              </Button>

              <Button
                size="sm"
                variant={complete ? "outline" : "default"}
                onClick={() => (complete ? navigate("/profile") : setProfileOpen(true))}
                className={
                  !complete
                    ? "h-9 shrink-0 rounded-xl bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 shadow-sm"
                    : "h-9 shrink-0 rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5"
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
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
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
        </div>
      </div>
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

   // Check if user is an approved merchant
   const { data: merchantApp } = useQuery({
     queryKey: ["merchant-status", user?.id],
     queryFn: async () => {
       if (!user?.id) return null;
       const { data, error } = await supabase
         .from("merchant_applications")
         .select("id, status")
         .eq("user_id", user.id)
         .eq("status", "approved")
         .maybeSingle();
       if (error) throw error;
       return data;
     },
     enabled: !!user?.id,
     staleTime: 60_000,
   });

   const isMerchant = useMemo(() => !!merchantApp, [merchantApp]);

   const handleRequestsClick = useCallback(() => {
     if (isMerchant) {
       navigate("/community/merchant/orders");
     } else {
       navigate("/community/customer/requests");
     }
   }, [isMerchant, navigate]);

   const handleNewClick = useCallback(() => {
     if (isMerchant) {
       navigate("/community/merchant/store");
     } else {
       navigate("/community/customer/new");
     }
   }, [isMerchant, navigate]);

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
        onClick={handleNewClick}
        disabled={!complete}
        className={
          !complete
            ? "h-10 w-full shrink-0 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
            : "h-10 w-full shrink-0"
        }
      >
        {isMerchant ? (
          <>
            <Store className="ml-2 h-4 w-4" />
            المتجر
          </>
        ) : (
          <>
            <PlusCircle className="ml-2 h-4 w-4" />
            طلب جديد
          </>
        )}
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={!complete}
        onClick={handleRequestsClick}
        className="h-10 w-full shrink-0"
      >
        <ClipboardList className="ml-2 h-4 w-4" />
        {isMerchant ? "طلبات الزبائن" : "طلباتي"}
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
