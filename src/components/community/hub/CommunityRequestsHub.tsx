import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Loader2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CompactRequestCard from "@/components/community/CompactRequestCard";
import RequestDetailModal from "@/components/community/RequestDetailModal";
import AddOfferDialog from "@/components/community/AddOfferDialog";

interface PrintRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  size: string;
  colors: string;
  notes: string | null;
  material_type: string | null;
  images: string[] | null;
  image_url: string | null;
  video_url: string | null;
  reference_links: string[] | null;
  status: string;
  created_at: string;
  accepted_offer_id: string | null;
  quantity?: number;
  customer_governorate?: string;
}

interface CommunityRequestsHubProps {
  mode: "preview" | "hub";
  searchQuery?: string;
  sortBy?: string;
}

export default function CommunityRequestsHub({
  mode,
  searchQuery = "",
  sortBy = "newest",
}: CommunityRequestsHubProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [selectedRequest, setSelectedRequest] = useState<PrintRequest | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAddOffer, setShowAddOffer] = useState(false);

  // Check if user is a merchant
  const { data: merchantProfile } = useQuery({
    queryKey: ["my-merchant-profile-hub", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const isMerchant = !!merchantProfile;
  const limit = mode === "preview" ? 6 : 20;

  // Fetch requests
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["community-requests-hub", sortBy, searchQuery, mode],
    queryFn: async () => {
      let query = supabase
        .from("community_print_requests")
        .select(`
          id,
          user_id,
          title,
          description,
          size,
          colors,
          notes,
          material_type,
          images,
          image_url,
          video_url,
          reference_links,
          status,
          created_at,
          accepted_offer_id,
          quantity,
          customer_governorate
        `)
        .eq("status", "approved")
        .is("accepted_offer_id", null) // Only show open requests
        .order("created_at", { ascending: false })
        .limit(limit);

      // Apply material filter
      if (sortBy === "resin") {
        query = query.eq("material_type", "resin");
      } else if (sortBy === "filament") {
        query = query.eq("material_type", "filament");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PrintRequest[];
    },
  });

  // Filter by search
  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  // For not_priced filter (merchant only) - filter out requests that merchant already priced
  const { data: myOfferRequestIds = [] } = useQuery({
    queryKey: ["my-offer-request-ids", merchantProfile?.id],
    enabled: isMerchant && sortBy === "not_priced",
    queryFn: async () => {
      const { data } = await supabase
        .from("print_offers")
        .select("request_id")
        .eq("trader_id", merchantProfile!.id);
      return (data || []).map((o) => o.request_id);
    },
  });

  const displayRequests = sortBy === "not_priced" && isMerchant
    ? filteredRequests.filter((r) => !myOfferRequestIds.includes(r.id))
    : filteredRequests;

  const handleViewDetails = (request: PrintRequest) => {
    setSelectedRequest(request);
    setShowDetail(true);
  };

  const handleAddOffer = (request: PrintRequest) => {
    setSelectedRequest(request);
    setShowAddOffer(true);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
        <AlertCircle className="h-4 w-4" />
        حدث خطأ في تحميل الطلبات
      </div>
    );
  }

  if (displayRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Package className="h-10 w-10 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">لا توجد طلبات متاحة</p>
        {!user && (
          <Button
            variant="link"
            className="mt-2 text-xs"
            onClick={() => navigate("/auth")}
          >
            سجل دخولك لإضافة طلب جديد
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {displayRequests.map((request) => (
          <CompactRequestCard
            key={request.id}
            request={request}
            onViewDetails={handleViewDetails}
            onAddOffer={handleAddOffer}
            isMerchant={isMerchant}
            isOwner={user?.id === request.user_id}
          />
        ))}
      </div>

      {/* Request Detail Modal */}
      <RequestDetailModal
        request={selectedRequest}
        open={showDetail}
        onOpenChange={setShowDetail}
        isMerchant={isMerchant}
        merchantId={merchantProfile?.id}
        onAddOffer={() => {
          setShowDetail(false);
          setShowAddOffer(true);
        }}
      />

      {/* Add Offer Dialog */}
      {selectedRequest && merchantProfile && (
        <AddOfferDialog
          open={showAddOffer}
          onOpenChange={setShowAddOffer}
          requestId={selectedRequest.id}
          requestTitle={selectedRequest.title}
          merchantId={merchantProfile.id}
          onSuccess={() => setShowAddOffer(false)}
        />
      )}
    </>
  );
}
