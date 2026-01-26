import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCommunityProfileCheck } from "@/hooks/useCommunityProfileCheck";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UserCircle, Sparkles, X, ChevronLeft } from "lucide-react";
import CommunityCustomerProfileModal from "@/components/community/CommunityCustomerProfileModal";

/**
 * A beautiful banner prompting users to complete their profile
 * Only shows for logged-in users who haven't completed their profile
 */
export default function CompleteProfileBanner() {
  const { user } = useAuth();
  const { isProfileComplete, isLoading } = useCommunityProfileCheck();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if not logged in, profile is complete, loading, or dismissed
  if (!user || isProfileComplete || isLoading || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Premium Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card/95 to-primary/5 shadow-xl shadow-primary/5">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-accent/15 to-transparent rounded-full blur-xl" />
        
        {/* Dismiss button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-2 left-2 p-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="إغلاق"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="relative px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Icon with glow effect */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-lg animate-pulse" />
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <UserCircle className="h-7 w-7 sm:h-8 sm:w-8 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-accent flex items-center justify-center shadow-md">
                <Sparkles className="h-3 w-3 text-accent-foreground" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 text-center sm:text-right min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                أكمل ملفك الشخصي
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                أكمل بياناتك للوصول إلى مجتمع ليفو والاستفادة من جميع المميزات
              </p>
            </div>

            {/* CTA Button */}
            <Button
              onClick={() => setIsModalOpen(true)}
              className="shrink-0 gap-2 rounded-xl px-5 py-2.5 h-auto font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <span>إكمال الملف</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Completion Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="p-0 max-w-lg max-h-[90vh] overflow-hidden rounded-3xl border-primary/20 shadow-2xl">
          <CommunityCustomerProfileModal
            onDone={() => setIsModalOpen(false)}
            onLater={() => setIsModalOpen(false)}
            showMerchantCta={true}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
