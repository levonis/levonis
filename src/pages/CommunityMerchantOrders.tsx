 import { useNavigate } from "react-router-dom";
 import { useQuery } from "@tanstack/react-query";
 import { ClipboardList, ArrowRight } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Badge } from "@/components/ui/badge";
 
 type PrintRequestRow = {
   id: string;
   title: string;
   status: string;
   created_at: string;
 };
 
 type PrintOfferRow = {
   id: string;
   request_id: string;
   trader_id: string;
   price_iqd: number;
   status: string;
   created_at: string;
 };
 
 export default function CommunityMerchantOrders() {
   const navigate = useNavigate();
   const { user } = useAuth();
 
   const { data: merchantApp, isLoading: appLoading } = useQuery({
     queryKey: ["merchant-app", user?.id],
     enabled: !!user?.id,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("merchant_applications")
         .select("id, status")
         .eq("user_id", user!.id)
         .eq("status", "approved")
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });
 
   // Fetch offers submitted by this merchant
   const { data: myOffers = [], isLoading: offersLoading } = useQuery({
     queryKey: ["merchant-offers", user?.id],
     enabled: !!user?.id && !!merchantApp,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("print_offers")
         .select("id, request_id, trader_id, price_iqd, status, created_at")
         .eq("trader_id", user!.id)
         .order("created_at", { ascending: false });
       if (error) throw error;
       return data as PrintOfferRow[];
     },
   });
 
   // Fetch corresponding requests
   const requestIds = myOffers.map((o) => o.request_id);
   const { data: requests = [], isLoading: requestsLoading } = useQuery({
     queryKey: ["merchant-requests", requestIds],
     enabled: requestIds.length > 0,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("print_requests")
         .select("id, title, status, created_at")
         .in("id", requestIds);
       if (error) throw error;
       return data as PrintRequestRow[];
     },
   });
 
   const requestsMap = new Map(requests.map((r) => [r.id, r]));
 
   if (appLoading || offersLoading || requestsLoading) {
     return (
       <div className="min-h-screen bg-background/95">
         <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
           <Skeleton className="h-12 w-64 rounded-xl mb-6" />
           <Skeleton className="h-40 rounded-2xl" />
         </main>
       </div>
     );
   }
 
   if (!merchantApp) {
     return (
       <div className="min-h-screen bg-background/95">
         <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
           <Card className="border-border bg-card p-6">
             <p className="text-sm text-muted-foreground">لا يمكن الوصول لهذه الصفحة إلا للتجار المقبولين.</p>
             <Button className="mt-4" variant="outline" onClick={() => navigate("/community")}>
               العودة للمجتمع
             </Button>
           </Card>
         </main>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-background/95 backdrop-blur-sm">
       <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
         <header className="mb-6 flex items-center justify-between gap-4">
           <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
               <ClipboardList className="h-5 w-5 text-primary" />
             </div>
             <div>
               <h1 className="text-2xl sm:text-3xl font-black text-primary">إدارة الطلبات</h1>
               <p className="text-sm text-muted-foreground">طلبات الزبائن التي قدّمت عليها عروض</p>
             </div>
           </div>
           <Button variant="outline" onClick={() => navigate("/community")}>
             <ArrowRight className="ml-2 h-4 w-4" />
             رجوع
           </Button>
         </header>
 
         {myOffers.length === 0 ? (
           <Card className="border-border bg-card p-6">
             <p className="text-sm text-muted-foreground text-center">
               لا توجد عروض بعد. تصفح طلبات الزبائن وقدّم عروضاً.
             </p>
             <Button className="mt-4 mx-auto block" onClick={() => navigate("/community/requests")}>
               تصفح طلبات الزبائن
             </Button>
           </Card>
         ) : (
           <div className="space-y-3">
             {myOffers.map((offer) => {
               const req = requestsMap.get(offer.request_id);
               return (
                 <Card key={offer.id} className="border-border bg-card">
                   <CardHeader className="pb-3">
                     <div className="flex items-start justify-between gap-2">
                       <div>
                         <CardTitle className="text-base">{req?.title || "طلب #" + offer.request_id.slice(0, 8)}</CardTitle>
                         <CardDescription className="mt-1">
                           عرضك: {offer.price_iqd.toLocaleString()} د.ع
                         </CardDescription>
                       </div>
                       <Badge variant={offer.status === "accepted" ? "default" : "secondary"}>
                         {offer.status === "pending" && "قيد الانتظار"}
                         {offer.status === "accepted" && "مقبول"}
                         {offer.status === "rejected" && "مرفوض"}
                         {offer.status === "completed" && "مكتمل"}
                       </Badge>
                     </div>
                   </CardHeader>
                   <CardContent>
                     <div className="text-xs text-muted-foreground">
                       حالة الطلب: {req?.status || "—"} • تاريخ العرض:{" "}
                       {new Date(offer.created_at).toLocaleDateString("ar-IQ")}
                     </div>
                   </CardContent>
                 </Card>
               );
             })}
           </div>
         )}
       </main>
     </div>
   );
 }