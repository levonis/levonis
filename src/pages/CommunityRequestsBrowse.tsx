import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Users,
  Package,
  Loader2,
  Search,
  Filter,
  SlidersHorizontal,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import PrintRequestCard from "@/components/community/PrintRequestCard";
import PrintRequestDetailModal from "@/components/community/PrintRequestDetailModal";
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
  accepted_at: string | null;
  escrow_amount: number | null;
}

const MATERIAL_FILTERS = [
  { value: "all", label: "الكل" },
  { value: "filament", label: "فلمنت" },
  { value: "resin", label: "رزن" },
  { value: "both", label: "كلاهما" },
  { value: "any", label: "لا يهم" },
];

export default function CommunityRequestsBrowse() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "accepted">("open");
  
  const [selectedRequest, setSelectedRequest] = useState<PrintRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddOfferDialog, setShowAddOfferDialog] = useState(false);
  const [offerTargetRequest, setOfferTargetRequest] = useState<PrintRequest | null>(null);

  // Check if user is a merchant - need to join with merchant_applications
  const { data: merchantProfile } = useQuery({
    queryKey: ["my-merchant-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // First get merchant application for this user
      const { data: merchantApp } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .maybeSingle();
      
      if (!merchantApp) return null;
      
      // Then get merchant public profile using the application ID
      const { data } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name")
        .eq("id", merchantApp.id)
        .maybeSingle();
      
      return data;
    },
  });

  const isMerchant = !!merchantProfile;

  // Fetch requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["community-print-requests", materialFilter, statusFilter],
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
          accepted_at,
          escrow_amount
        `)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (materialFilter !== "all") {
        query = query.eq("material_type", materialFilter);
      }

      if (statusFilter === "open") {
        query = query.is("accepted_offer_id", null);
      } else {
        query = query.not("accepted_offer_id", "is", null);
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

  const handleViewDetails = (request: PrintRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const handleAddOffer = (request: PrintRequest) => {
    setOfferTargetRequest(request);
    setShowAddOfferDialog(true);
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-primary">طلبات الطباعة</h1>
              <p className="text-xs text-muted-foreground">
                {isMerchant ? "تصفح وقدم عروضك للزبائن" : "تصفح طلبات الطباعة المتاحة"}
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate("/community")} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        {/* Filters */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث في الطلبات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-2">
            {/* Status Toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === "open"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
                onClick={() => setStatusFilter("open")}
              >
                طلبات مفتوحة
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === "accepted"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
                onClick={() => setStatusFilter("accepted")}
              >
                تم القبول
              </button>
            </div>

            {/* Material Filter */}
            <Select value={materialFilter} onValueChange={setMaterialFilter}>
              <SelectTrigger className="w-36">
                <SlidersHorizontal className="h-4 w-4 ml-2" />
                <SelectValue placeholder="نوع المادة" />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Requests Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">لا توجد طلبات متطابقة</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredRequests.map((request) => (
              <PrintRequestCard
                key={request.id}
                request={request}
                onViewDetails={handleViewDetails}
                onAddOffer={handleAddOffer}
                isMerchant={isMerchant}
                merchantId={merchantProfile?.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <PrintRequestDetailModal
        request={selectedRequest}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        isMerchant={isMerchant}
        merchantId={merchantProfile?.id}
      />

      {/* Add Offer Dialog */}
      {offerTargetRequest && (
        <AddOfferDialog
          open={showAddOfferDialog}
          onOpenChange={setShowAddOfferDialog}
          requestId={offerTargetRequest.id}
          requestTitle={offerTargetRequest.title}
          merchantId={merchantProfile?.id || ""}
          onSuccess={() => setShowAddOfferDialog(false)}
        />
      )}
    </div>
  );
}
