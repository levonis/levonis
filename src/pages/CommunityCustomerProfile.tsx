import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

import CommunityCustomerProfileModal from "@/components/community/CommunityCustomerProfileModal";

export default function CommunityCustomerProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the intended destination from navigation state
  const from = (location.state as any)?.from || "/community";

  // Prevent background scroll + page jitter while the completion overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleDone = () => {
    // Navigate to the original destination after completing profile
    navigate(from, { replace: true });
  };

  const handleLater = () => {
    // If they skip, go to home - they can't access community without profile
    navigate("/", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* Centered modern card */}
      <div className="relative flex h-full w-full items-center justify-center p-4 overflow-y-auto">
        <section
          className="w-[min(92vw,480px)] max-h-[85dvh] rounded-2xl border bg-card shadow-lg flex flex-col my-auto"
          aria-label="إكمال الملف الشخصي"
        >
          <CommunityCustomerProfileModal
            showMerchantCta
            onDone={handleDone}
            onLater={handleLater}
          />
        </section>
      </div>
    </div>
  );
}
