import { useNavigate } from "react-router-dom";
import MerchantSignupDialog from "@/components/community/MerchantSignupDialog";

export default function CommunityMerchantSignup() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      {/* Keep this route for deep-links, but show the flow as a modal */}
      <MerchantSignupDialog
        defaultOpen
        onOpenChange={(v) => {
          if (!v) navigate(-1);
        }}
      />
    </div>
  );
}

