import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

import CommunityCustomerProfileModal from "@/components/community/CommunityCustomerProfileModal";

export default function CommunityCustomerProfile() {
  const navigate = useNavigate();

  // Prevent background scroll + page jitter while the completion overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* Centered modern card */}
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <section
          className="w-[min(92vw,480px)] max-h-[90dvh] rounded-2xl border bg-card shadow-lg overflow-hidden flex flex-col"
          aria-label="إكمال الملف الشخصي"
        >
          <CommunityCustomerProfileModal
            showMerchantCta
            onDone={() => navigate("/community/customer", { replace: true })}
            onLater={() => navigate("/community/customer")}
          />
        </section>
      </div>
    </div>
  );
}
